// Appele par le navigateur du client au retour de Monext. Ne fait JAMAIS
// confiance au simple fait que le client soit revenu sur cette URL : on
// revérifie toujours le vrai statut aupres de Monext via GET /sessions
// avant de considerer la commande comme payee.
const { getSession } = require("../lib/monext");

module.exports = async (req, res) => {
  const sessionId = req.query && req.query.sessionId;
  res.setHeader("Content-Type", "application/json");

  if (!sessionId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing sessionId" }));
    return;
  }

  try {
    const details = await getSession(sessionId);
    res.end(
      JSON.stringify({
        paid: details.paid,
        status: details.status,
        message: details.detail,
        privateData: details.privateData,
      })
    );
  } catch (err) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  }
};
