import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { readdirSync } from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { startAuthServer } from "./auth/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load all command files from ./commands
const commandFiles = readdirSync(join(__dirname, "commands")).filter((f) =>
  f.endsWith(".js"),
);
for (const file of commandFiles) {
  const { default: command } = await import(
    pathToFileURL(join(__dirname, "commands", file))
  );
  client.commands.set(command.name, command);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
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
client.login(process.env.DISCORD_TOKEN);
