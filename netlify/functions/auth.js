exports.handler = async (event) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const redirectUri = `https://${host}/callback`;
  const state = Math.random().toString(36).slice(2);

  const authorizeUrl =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&scope=repo" +
    `&state=${state}`;

  return {
    statusCode: 302,
    headers: { Location: authorizeUrl },
  };
};
