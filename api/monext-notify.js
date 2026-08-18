// Notification serveur-a-serveur appelee directement par Monext apres un
// paiement (notificationURL) : sert a verifier/consigner le resultat cote
// serveur, independamment du navigateur du client. Doit repondre 200.
const { getSession } = require("../lib/monext");

module.exports = async (req, res) => {
  const sessionId = req.query && req.query.sessionId;
  if (!sessionId) {
    res.statusCode = 400;
    res.end("Missing sessionId");
    return;
  }

  try {
    const details = await getSession(sessionId);
    console.log("Monext notify", sessionId, details.status, details.detail);
  } catch (err) {
    console.error("Monext notify error", err.message);
  }

  res.statusCode = 200;
  res.end("OK");
};
