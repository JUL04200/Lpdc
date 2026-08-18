// Appele par le navigateur du client au retour de Monext. Ne fait JAMAIS
// confiance au simple fait que le client soit revenu sur cette URL : on
// revérifie toujours le vrai statut aupres de Monext via getWebPaymentDetails
// avant de considerer la commande comme payee.
const { getWebPaymentDetails } = require("../lib/monext");

module.exports = async (req, res) => {
  const token = req.query && req.query.token;
  res.setHeader("Content-Type", "application/json");

  if (!token) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing token" }));
    return;
  }

  try {
    const details = await getWebPaymentDetails(token);
    res.end(
      JSON.stringify({
        paid: details.paid,
        resultCode: details.resultCode,
        message: details.shortMessage,
        privateData: details.privateData,
      })
    );
  } catch (err) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  }
};
