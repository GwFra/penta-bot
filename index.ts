import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { readdirSync } from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { startAuthServer } from "./auth/server.ts";
import { getUserByDiscordId } from "./services/userStore.ts";
import {
  fetchJSON,
  HttpError,
  MATCH_TIMELINE,
  MATCHES_API,
  SPECTATOR_API,
} from "./utils/api.ts";
import { withRetry } from "./utils/retry.ts";
import { requireEnv } from "./utils/env.ts";
import type { Command } from "./types/command.ts";
import type { Presence } from "discord.js";
import { redis } from "./redis/index.ts";
import { RiotMatchTimeline } from "./types/riot.ts";
import { obtainResultsForMatch } from "./utils/update.ts";

const MOCK_PARTY_ID = "EXAMPLE_PARTY_ID";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
}) as Client & {
  commands: Collection<string, Command>;
};

client.commands = new Collection();

// Load all command files from ./commands (.ts under tsx in dev, .js once compiled)
const commandFiles = readdirSync(join(__dirname, "commands")).filter(
  (f) => f.endsWith(".js") || f.endsWith(".ts"),
);
for (const file of commandFiles) {
  const { default: command } = (await import(
    pathToFileURL(join(__dirname, "commands", file)).href
  )) as { default: Command };
  client.commands.set(command.name, command);
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

// True when the presence is showing an in-progress ARAM (details === "ARAM").
const isInAram = (presence: Presence | null): boolean =>
  Boolean(
    presence?.activities?.some(
      (a) => a.name === "League of Legends" && a.details === "ARAM",
    ),
  );

// Raw spectator lookup so we can distinguish a 404 (game no longer live)
// from a transient error - fetchJSON collapses both into a thrown Error.
// Throws HttpError (rather than a generic Error) on non-404 failures so
// withRetry can detect and extend the wait on a 429.
async function isSpectatorGameLive(puuid: string): Promise<boolean> {
  const res = await fetch(SPECTATOR_API(puuid));
  console.log("Response from spectator API");
  console.log(res);
  if (res.status === 404) return false;
  if (!res.ok) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : undefined;
    throw new HttpError(res.status, res.statusText, retryAfterMs);
  }
  return true;
}

// A tracked user transitioned into ARAM lobby initially and is added to the redis hget
async function handleGameStart(presence: Presence): Promise<void> {
  const user = await getUserByDiscordId(presence.userId);
  const partyId = presence.activities[0].party?.id || MOCK_PARTY_ID;
  if (!user?.puuid || !partyId) {
    console.log(
      `${presence.user?.username} entered ARAM but isn't tracked yet`,
    );
    return;
  }

  try {
    // TODO: Needs to handle people leaving lobby's but this can come later
    await redis.hset(
      // Party id should remain once the game ends and people are in the lobby
      // Might change state between ending and being in a lobby - will have to test
      partyId,
      { [presence.userId]: user.puuid },
    );
    console.log(`${presence.user?.username} entered a lobby`);
  } catch (err) {
    console.error(
      `Failed to confirm active game for ${presence.user?.username}`,
      err,
    );
  }
}

// A tracked user transitioned out of ARAM: re-check the spectator API. A 404
// means the game is genuinely over (not just Discord going quiet), so claim
// the match and compute stats for everyone who was in it - exactly once.
async function handleGameEnd(
  oldPresence: Presence,
  // Figure out what this may be needed for... datetime stamp?
  _: Presence,
): Promise<void> {
  // Could come from previous presence?
  const partyId = oldPresence.activities[0]?.party?.id || MOCK_PARTY_ID;
  if (partyId) {
    const players = await redis.hgetall(partyId);
    // Obtain the valye which is the puuid
    const playerPuuids = Object.values(players);
    const firstTry = playerPuuids[0];
    await withRetry(() => isSpectatorGameLive(firstTry));
    const latestMatchId = await fetchJSON<string[]>(MATCHES_API(firstTry, 1));

    const matchTimeline = await fetchJSON<RiotMatchTimeline>(
      MATCH_TIMELINE(latestMatchId[0]),
    );
    await obtainResultsForMatch(latestMatchId[0], playerPuuids, matchTimeline);
  }
}

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  if (!newPresence?.user) return;

  console.log(newPresence.activities);
  newPresence.activities.forEach((activity) =>
    console.log(JSON.stringify(activity)),
  );

  // These flags work for getting us from a lobby & into a game to leaving the game
  const wasInAram = isInAram(oldPresence);
  const nowInAram = isInAram(newPresence);

  /**
   * Redefine the presence to be:
   * 1. Once an initial lobby change has been detected - add all players discord ids into a redis hash under a party id party.id from within the presence.activity
   * 2. Once the next detection comes through for a player that has that state previously, start polling the endpoint to fetch the matchId
   * 3. With that matchId determine who else in that redis hash is in that game and add all them into the active_players queue
   * 4. Once the game has ended (with the existing flag), obtain the match stats for one player and go from there, highlighting who else was there
   * 5. Then normal flow to detect pentakills and otherwise
   */

  if (!wasInAram && nowInAram) {
    await handleGameStart(newPresence);
  } else if (wasInAram && !nowInAram) {
    await handleGameEnd(oldPresence!, newPresence);
  }
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [commandName, ...args] = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);
  const command = client.commands.get(commandName.toLowerCase());

  if (command) command.execute(message, args);
});

startAuthServer(process.env.PORT || 3000);
client.login(requireEnv("DISCORD_TOKEN"));
