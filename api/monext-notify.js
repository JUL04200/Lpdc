// Notification serveur-a-serveur appelee directement par Monext apres un
// paiement (notificationURL) : sert a verifier/consigner le resultat cote
// serveur, independamment du navigateur du client. Doit repondre 200.
const { getWebPaymentDetails } = require("../lib/monext");

module.exports = async (req, res) => {
  const token = req.query && req.query.token;
  if (!token) {
    res.statusCode = 400;
    res.end("Missing token");
    return;
  }

  try {
    const details = await getWebPaymentDetails(token);
    console.log("Monext notify", token, details.resultCode, details.shortMessage);
  } catch (err) {
    console.error("Monext notify error", err.message);
  }

  res.statusCode = 200;
  res.end("OK");
};
