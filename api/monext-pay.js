const { createSession } = require("../lib/monext");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "JSON invalide" }));
    return;
  }

  const { total, subtotal, discount, name, pickupTime, orderNumber, cartSummary } = payload;
  const amountCents = Math.round(Number(total) * 100);

  if (!amountCents || amountCents <= 0 || !name || !pickupTime || !orderNumber) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Paramètres de commande incomplets" }));
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${host}`;

  try {
    const { redirectURL } = await createSession({
      amountCents,
      orderNumber,
      name,
      pickupTime,
      cartSummary: Array.isArray(cartSummary) ? cartSummary : [],
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      returnURL: `${origin}/?monext=retour`,
      notificationURL: `${origin}/api/monext-notify`,
    });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ redirectURL }));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message }));
  }
};
