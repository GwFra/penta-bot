import { fetchJSON, PUUID_API, MATCHES_API, MATCH_API } from "../utils/api.ts";
import { getUserByDiscordUsername } from "../services/userStore.ts";
import type { Command } from "../types/command.ts";
import type { RiotAccount, RiotMatch } from "../types/riot.ts";

const history: Command = {
  name: "history",
  async execute(message, args) {
    const argsUser = args.join(" ");
    const trackedUser = await getUserByDiscordUsername(message.author.username);
    console.log(trackedUser);
    const userToSearch = argsUser || trackedUser?.lolName;

    if (!userToSearch) {
      return void message.reply("Usage: `!history <user>`");
    }

    // Could make this loading thing a bit more interesting
    const reply = await message.reply(`Fetching match history...`);

    try {
      const puuidData = await fetchJSON<RiotAccount>(PUUID_API(userToSearch));
      if (!puuidData) {
        return void message.reply(`Oops, no stats found for ${userToSearch}`);
      }
      const puuid = puuidData.puuid;
      const matchesData = await fetchJSON<string[]>(MATCHES_API(puuid));

      const combineMatches = matchesData.map((matchId) =>
        fetchJSON<RiotMatch>(MATCH_API(matchId)),
      );
      // rate limit issue - might need some long awaiting work around
      const matchResults = await Promise.all(combineMatches);

      const combinedResults = matchResults.reduce(
        (acc, matchData) => {
          const participant = matchData.info.participants[0];
          return {
            kills: acc.kills + participant.kills,
            deaths: acc.deaths + participant.deaths,
            assists: acc.assists + participant.assists,
          };
        },
        {
          kills: 0,
          deaths: 0,
          assists: 0,
        },
      );
      await reply.edit(
        `Match Results (ARAM): ${combinedResults.kills}/${combinedResults.deaths}/${combinedResults.assists}`,
      );
    } catch (err) {
      console.error(err);
      await reply.edit("Error fetching match history. Please try again later.");
    }
  },
};

export default history;
