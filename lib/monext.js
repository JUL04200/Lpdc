// Client pour l'API REST "Monext Retail" (Checkout API), la plateforme de
// paiement en ligne actuelle de Monext Online (l'ancienne API SOAP
// WebPaymentAPI/Payline n'est plus utilisee ici).
// Pas de dependance externe : simple appel HTTPS + JSON.
//
// Variables d'environnement attendues (a definir dans Vercel) :
//   MONEXT_API_BASE     ex. https://api-sandbox.retail.monext.com (sandbox)
//                        ou https://api.retail.monext.com (prod, a confirmer
//                        aupres de Monext au moment de la bascule)
//   MONEXT_MERCHANT_ID  identifiant marchand (login HTTP Basic)
//   MONEXT_ACCESS_KEY   cle API (mot de passe HTTP Basic)

const https = require("https");

function apiCall(method, path, body) {
  const base = process.env.MONEXT_API_BASE;
  const merchantId = process.env.MONEXT_MERCHANT_ID;
  const accessKey = process.env.MONEXT_ACCESS_KEY;
  if (!base || !merchantId || !accessKey) {
    return Promise.reject(new Error("Configuration Monext manquante (variables d'environnement)"));
  }

  const url = new URL(base + path);
  const auth = Buffer.from(`${merchantId}:${accessKey}`).toString("base64");
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = null;
        }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// order.reference sert a la detection de doublons cote Monext, doit rester
// unique. Le numero affiche au client reste court (2 chiffres) pour rester
// simple a l'oral au comptoir.
function buildOrderRef(orderNumber) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `LPC-${stamp}-${orderNumber}`;
}

function buildPrivateData({ name, pickupTime, orderNumber, cartSummary, subtotal, discount, total }) {
  const privateData = {
    name,
    pickupTime,
    orderNumber,
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    total: total.toFixed(2),
  };
  cartSummary.forEach((line, i) => {
    privateData[`item${i + 1}`] = line.slice(0, 50);
  });
  return privateData;
}

function errorFromResponse(res, action) {
  const detail = res.body && res.body.result && res.body.result.detail;
  const code = res.body && res.body.result && res.body.result.code;
  const message = detail || (res.body ? JSON.stringify(res.body).slice(0, 300) : res.raw.slice(0, 300));
  return new Error(`Monext ${action} a échoué (HTTP ${res.status}${code ? `, code ${code}` : ""}) : ${message}`);
}

async function createSession({ amountCents, orderNumber, name, pickupTime, cartSummary, subtotal, discount, total, returnURL, notificationURL, contractNumber }) {
  const ref = buildOrderRef(orderNumber);

  const chosenContract = contractNumber || "CB_MONEXT_3DS";
  const body = {
    pointOfSaleReference: "1",
    // Le point de vente a plusieurs contrats actifs (CB_MONEXT_3DS,
    // VISAMASTER_MONEXT_3DS, TRD...) : Monext refuse de choisir
    // automatiquement, il faut preciser explicitement lequel utiliser.
    paymentMethod: { contractNumber: chosenContract },
    order: {
      reference: ref,
      amount: amountCents,
      currency: "EUR",
      country: "FR",
    },
    returnURL,
    notificationURL,
    languageCode: "FR",
    privateData: buildPrivateData({ name, pickupTime, orderNumber, cartSummary, subtotal, discount, total }),
    buyer: { lastName: name },
  };

  const res = await apiCall("POST", "/v1/checkout/payments/sessions", body);

  if (res.status !== 201 || !res.body || !res.body.redirectURL || !res.body.sessionId) {
    throw errorFromResponse(res, "createSession");
  }

  return { redirectURL: res.body.redirectURL, sessionId: res.body.sessionId, orderRef: ref };
}

async function getSession(sessionId) {
  const res = await apiCall("GET", `/v1/checkout/payments/sessions/${encodeURIComponent(sessionId)}`);

  if (res.status !== 200 || !res.body) {
    throw errorFromResponse(res, "getSession");
  }

  const title = res.body.result && res.body.result.title;
  return {
    paid: title === "ACCEPTED",
    status: title,
    detail: res.body.result && res.body.result.detail,
    privateData: res.body.privateData || {},
    raw: res.body,
  };
}

module.exports = { createSession, getSession };
