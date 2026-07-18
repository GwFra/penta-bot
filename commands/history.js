import { fetchJSON, PUUID_API, MATCHES_API, MATCH_API } from "../utils/api.js";
import { getUserByDiscordUsername } from "../services/userStore.js";

export default {
  name: "history",
  async execute(message, args) {
    const argsUser = args.join(" ");
    console.log(await getUserByDiscordUsername(message.author.username));
    const userToSearch =
      argsUser ||
      (await getUserByDiscordUsername(message.author.username)).lolName;

    if (!userToSearch) {
      return message.reply("Usage: `!history <user>`");
    }

    // Could make this loading thing a bit more interesting
    const reply = await message.reply(`Fetching match history...`);

    try {
      const puuidData = await fetchJSON(PUUID_API(userToSearch));
      if (!puuidData) {
        return message.reply(`Oops, no stats found for ${userToSearch}`);
      }
      const puuid = puuidData.puuid;
      const matchesData = await fetchJSON(MATCHES_API(puuid));

      const combineMatches = matchesData.map((matchId) =>
        fetchJSON(MATCH_API(matchId)),
      );
      // rate limit issue - might need some long awaiting work around
      const matchResults = await Promise.all(combineMatches);

      const combinedResults = matchResults.reduce(
        (acc, matchData) => {
          return {
            kills: acc.kills + matchData.info.participants[0].kills,
            deaths: acc.deaths + matchData.info.participants[0].deaths,
            assists: acc.assists + matchData.info.participants[0].assists,
          };
        },
        {
          kills: 0,
          deaths: 0,
          assists: 0,
        },
      );
      reply.edit(
        `Match Results (ARAM): ${combinedResults.kills}/${combinedResults.deaths}/${combinedResults.assists}`,
      );
    } catch (err) {
      console.error(err);
      reply.edit("Error fetching match history. Please try again later.");
    }
  },
};
