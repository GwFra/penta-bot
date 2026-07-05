import {
  fetchJSON,
  PUUID_API,
  MATCHES_API,
  MATCH_API,
  MATCH_TIMELINE,
} from "./api.js";
import { getUserByPuuid, upsertUser } from "../services/userStore.js";
import { saveMatchStats } from "../services/stats.js";

// Process should be as follows
// 1. Detects a game has finished with x number of users in discord (2 or more)
// 2. determines if multikill of 4 or over occured
// 4. if YES, determine if penta was stolen
// 5. gather info for all players and if penta was done against team of 2 or more
// 6. respond in discord + update DB with information

const SNOWBALL_SPELL_ID = 32;
const MULTI_KILL_WINDOW_MS = 10000;
const PENTA_KILL_WINDOW_MS = 30000;

export async function obtainResults(discordUser) {
  const { puuid } = await fetchJSON(PUUID_API);
  const matches = await fetchJSON(MATCHES_API(puuid));
  const matchId = matches[8];

  const [matchData, matchTimeline] = await Promise.all([
    fetchJSON(MATCH_API(matchId)),
    fetchJSON(MATCH_TIMELINE(matchId)),
  ]);

  const participant = matchData.info.participants.find(
    (p) => p.puuid === puuid,
  );
  const {
    summoner1Id,
    summoner1Casts,
    summoner2Id,
    summoner2Casts,
    pentaKills,
    largestMultiKill,
    challenges: { poroExplosions, snowballsHit },
  } = participant;

  const snowballCasts =
    summoner1Id === SNOWBALL_SPELL_ID
      ? summoner1Casts
      : summoner2Id === SNOWBALL_SPELL_ID
        ? summoner2Casts
        : 0;

  const snowballsMissed = Math.max(0, snowballCasts - snowballsHit);
  const stolenPentas =
    largestMultiKill >= 4
      ? findStolenPentas(matchTimeline, participant.participantId)
      : [];

  // Ensure user exists in DB
  const user = await upsertUser({
    discordId: "unique_id",
    discordName: "#gwfranklin",
    lolName: participant.summonerName,
    puuid,
  });

  await saveMatchStats({
    userId: user.id,
    matchId,
    pentaKills,
    snowballsHit,
    snowballsMissed,
    stolenPentas,
  });

  return {
    pentaKills,
    largestMultiKill,
    poroExplosions,
    snowballsHit,
    snowballsMissed,
    stolenPentas,
  };
}

function getKillEvents(timeline) {
  return timeline.info.frames
    .flatMap((f) => f.events)
    .filter((e) => e.type === "CHAMPION_KILL");
}

function findMultiKillTimestamps(timeline, participantId) {
  const kills = getKillEvents(timeline)
    .filter((e) => e.killerId === participantId)
    .map((e) => e.timestamp);

  return kills.reduce(
    ({ results, streak }, ts) => {
      const active =
        streak.length && ts - streak[streak.length - 1] <= MULTI_KILL_WINDOW_MS
          ? streak
          : [];
      const next = [...active, ts];
      return {
        streak: next,
        results:
          next.length === 4
            ? [
                ...results,
                { startedAt: next[0], endedAt: ts, durationMs: ts - next[0] },
              ]
            : results,
      };
    },
    { results: [], streak: [] },
  ).results;
}

function findStolenPentas(timeline, targetParticipantId) {
  const { teamId } = timeline.info.participants.find(
    (p) => p.participantId === targetParticipantId,
  );
  const teammates = new Set(
    timeline.info.participants
      .filter(
        (p) => p.teamId === teamId && p.participantId !== targetParticipantId,
      )
      .map((p) => p.participantId),
  );

  const killEvents = getKillEvents(timeline);
  const quadKills = findMultiKillTimestamps(timeline, targetParticipantId);

  return quadKills.flatMap(({ endedAt }) =>
    killEvents
      .filter(
        (e) =>
          e.timestamp > endedAt &&
          e.timestamp <= endedAt + PENTA_KILL_WINDOW_MS,
      )
      .filter((e) => teammates.has(e.killerId))
      .map((e) => ({
        // Teammate PUUID
        stolenBy: e.killerId,
        stolenFrom: targetParticipantId,
        timestamp: e.timestamp,
      })),
  );
}
