import { fetchJSON, MATCHES_API, MATCH_API } from "../utils/api.ts";
import { getUserByDiscordId } from "../services/userStore.ts";
import type { Command } from "../types/command.ts";
import type { RiotMatch } from "../types/riot.ts";

const history: Command = {
  name: "history",
  async execute(message) {
    // Account linking (services/accountLink.ts) already resolved and stored
    // the puuid for this Discord ID, so we can pull it straight from the DB
    // instead of hitting Riot's PUUID_API again here.
    const mentionedUser = message.mentions.users.first();
    const trackedUser = await getUserByDiscordId(
      mentionedUser?.id ?? message.author.id,
    );

    if (!trackedUser?.puuid) {
      return void message.reply(
        mentionedUser
          ? `${mentionedUser.username} hasn't linked their League account yet.`
          : "You haven't linked your League account yet - link it via Discord connections first.",
      );
    }

    // Could make this loading thing a bit more interesting
    const reply = await message.reply(`Fetching match history...`);

    try {
      const puuid = trackedUser.puuid;
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
