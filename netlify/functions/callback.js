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

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: "Missing code" };
  }

  let token;
  try {
    const result = await exchangeCodeForToken(code);
    if (result.error || !result.access_token) {
      throw new Error(result.error_description || "Échec de l'échange du token");
    }
    token = result.access_token;
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<script>
        window.opener.postMessage(
          'authorization:github:error:${JSON.stringify(String(err.message))}',
          '*'
        );
        window.close();
      </script>`,
    };
  }

  const message = JSON.stringify({ token, provider: "github" });
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `<script>
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
    </script>`,
  };
};
