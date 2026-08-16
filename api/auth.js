module.exports = (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const redirectUri = `${proto}://${host}/api/callback`;
  const state = Math.random().toString(36).slice(2);

  const authorizeUrl =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&scope=repo" +
    `&state=${state}`;

  res.writeHead(302, { Location: authorizeUrl });
  res.end();
};
