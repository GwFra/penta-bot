import { obtainResults } from "../utils/update.js";
import { getUserByDiscordId } from "../services/userStore.js";

const GAME_NAME = "League of Legends";

function getMembersInGame(guild) {
  // Relies on presences already cached via the GuildPresences intent
  // (see index.js) - no GuildMembers intent, so this only sees members
  // whose presence the bot has observed since login.
  return guild.members.cache.filter((member) =>
    member.presence?.activities?.some(
      (activity) => activity.name === GAME_NAME && activity.state === "In Game",
    ),
  );
}

export default {
  name: "penta",
  async execute(message) {
    if (!message.guild) {
      return message.reply("This command can only be used in a server.");
    }

    const membersInGame = getMembersInGame(message.guild);
    const usersInGame = (
      await Promise.all(
        membersInGame.map((member) => getUserByDiscordId(member.id)),
      )
    ).filter(Boolean);

    if (usersInGame.length < 2) {
      return message.reply(
        "Not enough tracked players currently in a game together.",
      );
    }

    // Flow should be as follows:
    // On start of game, store the amount of players in a game - as long as it's more than 2
    // Once finished, determine if a player obtain 4 or higher kill streak
    // If true, determine if a pentakill was stolen by user in game or random
    // Once checked through all players, update DB and send message

    const res = await obtainResults(usersInGame);
    message.reply(`Penta/Quad data: ${JSON.stringify(res)}`);
  },
};
