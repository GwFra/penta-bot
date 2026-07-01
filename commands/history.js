import { fetchJSON } from "../utils/api.js";

// Might need to refresh API key occasionally

// defaults to EUW server and elementninjara
const PUUID_API = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/elementninjara/EUW?api_key=${process.env.RIOT_API_KEY}`;
const MATCHES_API = (puuid) =>
  `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${process.env.RIOT_API_KEY}`;
const MATCH_API = (matchId) =>
  `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${process.env.RIOT_API_KEY}`;

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
      console.log(matchesData);

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
