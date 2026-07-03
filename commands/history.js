import { fetchJSON } from "../utils/api.js";
import { obtainResults } from "../utils/update.js";

// Might need to refresh API key occasionally

const matchesV5 = "/lol/match/v5/matches";

// defaults to EUW server and elementninjara
export const PUUID_API = `${process.env.RIOT_BASE_API}/riot/account/v1/accounts/by-riot-id/elementninjara/EUW?api_key=${process.env.RIOT_API_KEY}`;
export const MATCHES_API = (puuid) =>
  `${process.env.RIOT_BASE_API}${matchesV5}/by-puuid/${puuid}/ids?start=0&count=10&queue=450&api_key=${process.env.RIOT_API_KEY}`;
export const MATCH_API = (matchId) =>
  `${process.env.RIOT_BASE_API}${matchesV5}/${matchId}?api_key=${process.env.RIOT_API_KEY}`;

export default {
  name: "history",
  async execute(message, args) {
    const user = args.join(" ");
    if (!user) {
      return message.reply("Usage: `!history <user>`");
    }

    try {
      const puuidData = await fetchJSON(PUUID_API);
      const puuid = puuidData.puuid;
      const matchesData = await fetchJSON(MATCHES_API(puuid));

      const killData = await obtainResults(); // Assuming client and presence are not needed for this function
      console.log("Penta/Quad data", killData);

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

      message.reply(
        `Match Results (ARAM): ${combinedResults.kills}/${combinedResults.deaths}/${combinedResults.assists}`,
      );
    } catch (err) {
      console.error(err);
      message.reply("Error fetching match history. Please try again later.");
    }
  },
};
