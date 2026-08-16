const https = require("https");

function exchangeCodeForToken(code) {
  const body = JSON.stringify({
    client_id: process.env.OAUTH_CLIENT_ID,
    client_secret: process.env.OAUTH_CLIENT_SECRET,
    code,
  });
  const options = {
    hostname: "github.com",
    path: "/login/oauth/access_token",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  const code = req.query && req.query.code;
  res.setHeader("Content-Type", "text/html");

  if (!code) {
    res.statusCode = 400;
    res.end("Missing code");
    return;
  }

  let token;
  try {
    const result = await exchangeCodeForToken(code);
    if (result.error || !result.access_token) {
      throw new Error(result.error_description || "Échec de l'échange du token");
    }
    token = result.access_token;
  } catch (err) {
    res.end(`<script>
      window.opener.postMessage(
        'authorization:github:error:${JSON.stringify(String(err.message))}',
        '*'
      );
      window.close();
    </script>`);
    return;
  }

  const message = JSON.stringify({ token, provider: "github" });
  res.end(`<script>
    (function() {
      function receiveMessage(e) {
        window.opener.postMessage(
          'authorization:github:success:${message}',
          e.origin
        );
        window.removeEventListener("message", receiveMessage, false);
      }
      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", "*");
    })();
  </script>`);
};
