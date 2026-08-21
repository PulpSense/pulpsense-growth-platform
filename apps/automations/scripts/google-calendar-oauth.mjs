import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";

const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error(
    "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET before authorizing",
  );
}

const host = "127.0.0.1";
const port = 53682;
const redirectUri = `http://${host}:${port}/oauth2/callback`;
const state = randomBytes(32).toString("base64url");
const verifier = randomBytes(64).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authorizationUrl = new URL(
  "https://accounts.google.com/o/oauth2/v2/auth",
);
authorizationUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/calendar.events.readonly",
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "false",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

const token = await new Promise((resolve, reject) => {
  const server = createServer(async (request, response) => {
    try {
      const callback = new URL(request.url ?? "/", redirectUri);
      if (callback.pathname !== "/oauth2/callback") {
        response.writeHead(404).end("Not found");
        return;
      }
      if (callback.searchParams.get("state") !== state) {
        throw new Error("OAuth state did not match");
      }
      const providerError = callback.searchParams.get("error");
      if (providerError)
        throw new Error(`Google denied access: ${providerError}`);
      const code = callback.searchParams.get("code");
      if (!code)
        throw new Error("Google callback omitted its authorization code");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenResponse.ok) {
        throw new Error(
          `Google token exchange failed (${tokenResponse.status})`,
        );
      }
      const result = await tokenResponse.json();
      if (!result.refresh_token) {
        throw new Error(
          "Google did not return a refresh token; revoke the prior grant and retry",
        );
      }
      response
        .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Authorization complete. Return to the terminal.");
      resolve(result);
    } catch (error) {
      response
        .writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Authorization failed. Return to the terminal.");
      reject(error);
    } finally {
      server.close();
    }
  });
  server.on("error", reject);
  server.listen(port, host, () => {
    console.log("Open this URL in the designated Google user's browser:\n");
    console.log(authorizationUrl.toString());
    console.log(
      "\nWaiting on localhost. The resulting refresh token is printed once and is not written to disk.",
    );
  });
});

console.log("\nStore this value directly in the Trigger.dev secret store:");
console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${token.refresh_token}`);
