import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { readdirSync } from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { startAuthServer } from "./auth/server.js";
import { addPlayerToGame, removePlayerFromGame } from "./services/gameQueue.js";
import { getUserByDiscordId } from "./services/userStore.js";
import { fetchJSON, SPECTATOR_API, toMatchId } from "./utils/api.js";
import { withRetry } from "./utils/retry.js";
import { obtainResultsForMatch } from "./utils/update.js";
import { requireEnv } from "./utils/env.js";
import type { Command } from "./types/command.js";
import type { ActiveGame } from "./types/riot.js";
import type { User } from "./db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
}) as Client & { commands: Collection<string, Command> };

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

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  const activity = newPresence?.activities?.find(
    (a) => a.name === "League of Legends" && a.details === "ARAM",
  );

  if (activity && newPresence.user) {
    // Compare old and new to see when the aram game finishes
    const oldActivity = oldPresence?.activities?.find(
      (act) => act.name === "League of Legends" && act.details === "ARAM",
    );

    if (oldActivity?.state === "In Lobby" && activity.state === "In Game") {
      const user = await getUserByDiscordId(newPresence.userId);
      if (!user?.puuid) {
        console.log(`${newPresence.user.username} entered a game but isn't tracked yet`);
        return;
      }

      try {
        const { gameId } = await withRetry(() =>
          fetchJSON<ActiveGame>(SPECTATOR_API(user.puuid as string)),
        );
        const matchId = toMatchId(gameId);
        const others = await addPlayerToGame(newPresence.userId, matchId);
        console.log(
          `${newPresence.user.username} entered game ${matchId} (${others.length} other tracked players in it)`,
        );
      } catch (err) {
        console.error(`Failed to look up active game for ${newPresence.user.username}`, err);
      }
    }

    if (oldActivity?.state === "In Game" && activity.state === "In Lobby") {
      const { matchId, others } = await removePlayerFromGame(newPresence.userId);
      console.log(
        `${newPresence.user.username} has finished their ARAM game! (${others.length} other tracked players were in it)`,
      );

      if (!matchId) return;

      try {
        const trackedUsers = (
          await Promise.all(
            [newPresence.userId, ...others].map((discordId) => getUserByDiscordId(discordId)),
          )
        ).filter((user): user is User => user !== null && Boolean(user.puuid));

        const results = await obtainResultsForMatch(matchId, trackedUsers);
        console.log(`Penta/Quad data for ${matchId}`, results);
      } catch (err) {
        console.error(`Failed to process results for match ${matchId}`, err);
      }
    }
  }
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [commandName, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = client.commands.get(commandName.toLowerCase());

  if (command) command.execute(message, args);
});

startAuthServer(process.env.PORT || 3000);
client.login(requireEnv("DISCORD_TOKEN"));
