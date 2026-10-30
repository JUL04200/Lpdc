const { sendTelegramMessage } = require("../lib/telegram");

module.exports = async (req, res) => {
  // GET pratique pour vérifier la connexion Telegram depuis un navigateur
  // (ex. ?test=1), sans passer par une vraie commande.
  if (req.method === "GET") {
    try {
      await sendTelegramMessage("✅ Test de connexion Telegram - Le Pain de la Cité");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

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

  const { message } = payload;
  if (!message) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Message manquant" }));
    return;
  }

  try {
    await sendTelegramMessage(message);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message }));
  }
};
