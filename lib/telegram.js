// Envoi de notifications via un bot Telegram (gratuit), à la place de
// l'ancien envoi par email (EmailJS). Pas de dépendance externe : simple
// appel HTTPS + JSON, même style que lib/monext.js.
//
// Variables d'environnement attendues (à définir dans Vercel) :
//   TELEGRAM_BOT_TOKEN  token du bot (récupéré auprès de @BotFather)
//   TELEGRAM_CHAT_ID    identifiant du chat Telegram où envoyer les messages

const https = require("https");

function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return Promise.reject(new Error("Configuration Telegram manquante (variables d'environnement)"));
  }

  const payload = JSON.stringify({ chat_id: chatId, text });

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${token}/sendMessage`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          reject(new Error("Réponse Telegram invalide"));
          return;
        }
        if (!parsed.ok) {
          reject(new Error(parsed.description || "Envoi Telegram échoué"));
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendTelegramMessage };
