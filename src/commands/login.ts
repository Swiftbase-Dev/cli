import http from "http";
import crypto from "crypto";
import { ConfigStore } from "../core/config-store";
import { formatter } from "../core/formatter";
import open from "open";
import readline from "readline";

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

export async function loginAction(): Promise<void> {
  const store = ConfigStore.getInstance();
  const baseUrl = store.getBaseUrl();

  formatter.info("Starting login process...");

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Setup local server for redirect
  const port = 3010;
  const redirectUri = `http://localhost:${port}/callback`;
  const authorizeUrl = `${baseUrl.replace(/\/$/, "")}/oauth2/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&client_id=swiftbase&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  formatter.info(`If a browser window does not open automatically, copy and paste this URL:`);
  console.log(authorizeUrl);

  const server = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith("/callback")) {
      const urlObj = new URL(req.url, `http://localhost:${port}`);
      const code = urlObj.searchParams.get("code");

      if (code) {
        // Exchange code for token via OAuth2 token endpoint
        try {
          const body = new URLSearchParams();
          body.append("grant_type", "authorization_code");
          body.append("code", code);
          body.append("redirect_uri", redirectUri);
          body.append("client_id", "swiftbase");
          body.append("code_verifier", codeVerifier);

          const tokenRes = await fetch(`${baseUrl.replace(/\/$/, "")}/oauth2/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });

          if (!tokenRes.ok) {
            throw new Error(`Token exchange failed with status ${tokenRes.status}`);
          }

          const data: any = await tokenRes.json();
          if (data.access_token) {
            store.save({ accessToken: data.access_token });
            res.end("Login successful! You can now close this tab and return to the CLI.");
            formatter.success("Authentication successful! Token saved locally.");
          } else {
            res.end("Login failed: Access token missing.");
            formatter.error("Login failed: Access token missing.");
          }
        } catch (err: any) {
          res.end(`Login error: ${err.message}`);
          formatter.error(`Failed to exchange code: ${err.message}`);
        } finally {
          server.close();
          process.exit(0);
        }
      } else {
        res.end("Authentication code missing.");
        formatter.error("Failed to authenticate: code missing.");
        server.close();
        process.exit(1);
      }
    }
  });

  server.listen(port, async () => {
    try {
      await open(authorizeUrl);
    } catch (err) {
      formatter.warn("Could not launch default browser automatically. Please copy the link above.");
    }
  });

  // Provide backup terminal input code mechanism
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter authorization code (if authenticating headless/manually): ", async (code) => {
    rl.close();
    server.close();

    if (!code.trim()) {
      formatter.error("Authorization code cannot be empty.");
      process.exit(1);
    }

    try {
      const body = new URLSearchParams();
      body.append("grant_type", "authorization_code");
      body.append("code", code.trim());
      body.append("redirect_uri", redirectUri);
      body.append("client_id", "swiftbase");
      body.append("code_verifier", codeVerifier);

      const tokenRes = await fetch(`${baseUrl.replace(/\/$/, "")}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        throw new Error(`Token exchange failed: ${tokenRes.status}`);
      }

      const data: any = await tokenRes.json();
      if (data.access_token) {
        store.save({ accessToken: data.access_token });
        formatter.success("Manual authentication successful! Token saved locally.");
        process.exit(0);
      } else {
        formatter.error("Failed: No access token returned.");
        process.exit(1);
      }
    } catch (err: any) {
      formatter.error(`Error exchanging code: ${err.message}`);
      process.exit(1);
    }
  });
}
