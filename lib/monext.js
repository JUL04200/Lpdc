// Client SOAP maison pour l'API Web Payment de Monext Online (ex-Payline).
// Pas de dependance externe : on construit l'enveloppe SOAP a la main et on
// lit la reponse avec de simples regex, pour rester coherent avec le reste
// du projet (fonctions Vercel sans build ni node_modules).
//
// Variables d'environnement attendues (a definir dans Vercel) :
//   MONEXT_API_BASE       ex. https://homologation.payline.com/V4/services/WebPaymentAPI
//                          (sandbox) ou https://services.payline.com/V4/services/WebPaymentAPI (prod)
//   MONEXT_MERCHANT_ID    identifiant marchand (login HTTP Basic)
//   MONEXT_ACCESS_KEY     cle d'acces webservices (mot de passe HTTP Basic)
//   MONEXT_CONTRACT_NUMBER numero de contrat du moyen de paiement CB

const https = require("https");

function soapCall(action, bodyXml) {
  const base = process.env.MONEXT_API_BASE;
  const merchantId = process.env.MONEXT_MERCHANT_ID;
  const accessKey = process.env.MONEXT_ACCESS_KEY;
  if (!base || !merchantId || !accessKey) {
    return Promise.reject(new Error("Configuration Monext manquante (variables d'environnement)"));
  }

  const url = new URL(base);
  const auth = Buffer.from(`${merchantId}:${accessKey}`).toString("base64");
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:obj="http://obj.ws.payline.experian.com">' +
    "<soapenv:Header/>" +
    `<soapenv:Body>${bodyXml}</soapenv:Body>` +
    "</soapenv:Envelope>";

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
      Authorization: `Basic ${auth}`,
      "Content-Length": Buffer.byteLength(envelope),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(envelope);
    req.end();
  });
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`));
  return match ? match[1] : null;
}

// order.ref doit rester unique cote Monext (contrainte imposee par leur
// API), donc on prefixe avec la date meme si le numero affiche au client
// reste court (2 chiffres) pour rester simple a l'oral au comptoir.
function buildOrderRef(orderNumber) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `LPC-${stamp}-${orderNumber}`;
}

// Les privateData Payline ont une longueur limitee (~50 caracteres pour la
// valeur) : on decoupe le panier en plusieurs entrees plutot que de tout
// mettre dans un seul champ qui serait tronque.
function buildPrivateDataXml({ name, pickupTime, orderNumber, cartSummary, subtotal, discount, total }) {
  const entries = [
    { key: "name", value: name },
    { key: "pickupTime", value: pickupTime },
    { key: "orderNumber", value: orderNumber },
    { key: "subtotal", value: subtotal.toFixed(2) },
    { key: "discount", value: discount.toFixed(2) },
    { key: "total", value: total.toFixed(2) },
  ];
  cartSummary.forEach((line, i) => entries.push({ key: `item${i + 1}`, value: line.slice(0, 50) }));

  return (
    "<privateDataList>" +
    entries
      .map(
        (e) =>
          `<privateData><key>${xmlEscape(e.key)}</key><value>${xmlEscape(e.value)}</value></privateData>`
      )
      .join("") +
    "</privateDataList>"
  );
}

function formatPaylineDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function doWebPayment({ amountCents, orderNumber, name, pickupTime, cartSummary, subtotal, discount, total, returnURL, cancelURL, notificationURL }) {
  const contractNumber = process.env.MONEXT_CONTRACT_NUMBER;
  if (!contractNumber) throw new Error("MONEXT_CONTRACT_NUMBER manquant");

  const ref = buildOrderRef(orderNumber);
  const now = formatPaylineDate(new Date());

  const body =
    "<obj:doWebPaymentRequest>" +
    "<version>25</version>" +
    "<payment>" +
    `<amount>${amountCents}</amount>` +
    "<currency>978</currency>" +
    "<action>101</action>" +
    "<mode>CPT</mode>" +
    `<contractNumber>${xmlEscape(contractNumber)}</contractNumber>` +
    "</payment>" +
    `<returnURL>${xmlEscape(returnURL)}</returnURL>` +
    `<cancelURL>${xmlEscape(cancelURL)}</cancelURL>` +
    `<notificationURL>${xmlEscape(notificationURL)}</notificationURL>` +
    "<order>" +
    `<ref>${xmlEscape(ref)}</ref>` +
    `<amount>${amountCents}</amount>` +
    "<currency>978</currency>" +
    `<date>${now}</date>` +
    "</order>" +
    "<buyer>" +
    `<lastName>${xmlEscape(name)}</lastName>` +
    "</buyer>" +
    buildPrivateDataXml({ name, pickupTime, orderNumber, cartSummary, subtotal, discount, total }) +
    "<languageCode>fr</languageCode>" +
    "</obj:doWebPaymentRequest>";

  const xml = await soapCall("doWebPayment", body);
  const resultCode = extractTag(xml, "code");
  const redirectURL = extractTag(xml, "redirectURL");
  const token = extractTag(xml, "token");

  if (resultCode !== "00000" || !redirectURL || !token) {
    const faultString = extractTag(xml, "faultstring");
    const shortMessage = extractTag(xml, "shortMessage");
    const longMessage = extractTag(xml, "longMessage");
    // Phase de debug de l'integration : si aucune balise connue n'est
    // trouvee, on affiche un extrait brut de la reponse pour comprendre
    // ce que renvoie reellement Monext, plutot qu'un message generique.
    const message =
      faultString ||
      [shortMessage, longMessage].filter(Boolean).join(" ") ||
      `Réponse inattendue : ${xml.slice(0, 400)}`;
    const error = new Error(`Monext doWebPayment a échoué : ${message}`);
    error.raw = xml;
    throw error;
  }

  return { redirectURL, token, orderRef: ref };
}

async function getWebPaymentDetails(token) {
  const body = "<obj:getWebPaymentDetailsRequest>" + "<version>25</version>" + `<token>${xmlEscape(token)}</token>` + "</obj:getWebPaymentDetailsRequest>";

  const xml = await soapCall("getWebPaymentDetails", body);
  const resultCode = extractTag(xml, "code");
  const shortMessage = extractTag(xml, "shortMessage");

  const privateData = {};
  const regex = /<privateData>\s*<key>([^<]*)<\/key>\s*<value>([^<]*)<\/value>\s*<\/privateData>/g;
  let m;
  while ((m = regex.exec(xml))) {
    privateData[m[1]] = m[2];
  }

  return {
    paid: resultCode === "00000",
    resultCode,
    shortMessage,
    privateData,
    raw: xml,
  };
}

module.exports = { doWebPayment, getWebPaymentDetails, xmlEscape };
