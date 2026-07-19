import "dotenv/config";
import express from "express";
import { requireEnv } from "../utils/env.ts";
import { successPage, errorPage } from "./pages.ts";

const router = express.Router();

const CLIENT_ID = requireEnv("CLIENT_ID");
const CLIENT_SECRET = requireEnv("CLIENT_SECRET");
const REDIRECT_URI = requireEnv("REDIRECT_URI");

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
}

// Step 1: send the user here to start the OAuth2 flow
router.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify connections",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Step 2: Discord redirects back here with a one-time code
router.get("/auth/discord/callback", async (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== "string") {
    return void res.status(400).send(errorPage("Missing authorization code"));
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const { access_token, token_type } =
      (await tokenRes.json()) as DiscordTokenResponse;

    // Use the access token to fetch the user's identity - not too sure what we want from this
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `${token_type} ${access_token}`,
      },
    });
    const user = (await userRes.json()) as DiscordUser;

    res.send(successPage(user));
  } catch (err) {
    console.error(err);
    res.status(500).send(errorPage("Authentication failed"));
  }
});

export function startAuthServer(port: string | number = 3000): void {
  const app = express();
  app.use(router);
  app.use("/assets", express.static("auth/assets"));
  app.listen(port, () => console.log(`Auth server listening on port ${port}`));
}
