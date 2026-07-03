import { PUUID_API, MATCHES_API, MATCH_API } from "../commands/history.js";
import { fetchJSON } from "./api.js";
// Do we need to store users PUUID within the DB?
// Less API = better?

// Multi kill window is 10 seconds
// Once you're on a quadrakill you have 30 seconds to get it

const MATCH_TIMELINE = (matchId) =>
  `${REGIONAL_BASE}/lol/match/v5/matches/${matchId}/timeline`;
const SNOWBALL_SPELL_ID = 32;
const MULTI_KILL_WINDOW_MS = 10000;
const PENTA_KILL_WINDOW_MS = 30000;

export async function obtainResults() {
  // Assume it gets called when game has been finished
  // Obtain league puuid - currently hardcoded to elementninjara
  const { puuid } = await fetchJSON(PUUID_API);

  // API call fetches the latest game assuming its just finished
  const matches = await fetchJSON(MATCHES_API(puuid));
  const matchData = await fetchJSON(MATCH_API(matches[0]));

  // obtain required stats
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
        : false;

  return {
    pentaKills,
    tookSnowball: snowballCasts > 0,
    snowballsHit,
    snowballsMissed: snowballCasts > 0 ? snowballCasts - snowballsHit : 0,
    poroExplosions,
    largestMultiKill,
    stolenPentas:
      largestMultiKill >= 4
        ? findStolenPentas(matchData.timeline, participant.participantId)
        : [],
  };
}

// only needs to be called if player has largestMultiKill of 4
function findMultiKillTimestamps(timeline, puuid) {
  // Find all timestamps of kills for the given puuid
  // as largestMultiKill === 4 will trigger this function
  const kills = timeline.info.frames
    .flatMap((f) => f.events)
    .filter((e) => e.type === "CHAMPION_KILL" && e.killerId === puuid)
    .map((e) => e.timestamp);

  // don't like this way of programming
  const results = [];
  let streak = [kills[0]];

  // Iterate through the kills and find streaks of kills within the MULTI_KILL_WINDOW_MS
  for (let i = 1; i < kills.length; i++) {
    if (kills[i] - streak[streak.length - 1] <= MULTI_KILL_WINDOW_MS) {
      streak.push(kills[i]);
      if (streak.length === 4) {
        results.push({
          startedAt: streak[0],
          endedAt: streak[streak.length - 1],
          durationMs: streak[streak.length - 1] - streak[0],
        });
      }
    } else {
      streak = [kills[i]];
    }
  }
  return results;
}

function findStolenPentas(timeline, targetParticipantId) {
  // participantId's team
  const { teamId } = timeline.info.participants.find(
    (p) => p.participantId === targetParticipantId,
  );
  const teammates = timeline.info.participants
    .filter((p) => p.teamId === teamId)
    .map((p) => p.participantId);

  // [{
  //     killCount: number;
  //     startedAt: any;
  //     endedAt: any;
  //     durationMs: number;
  // }, ...]
  const quadKillTimeline = findMultiKillTimestamps(
    timeline,
    targetParticipantId,
  );

  const stolenPentas = [];

  // Search for kills within the quadKillTimeline
  // filter out all the kills that occur within the PENTA_KILL_WINDOW_MS
  // determine if a player on their team got the kill
  for (const kill of quadKillTimeline) {
    const { endedAt } = kill;

    timeline.info.events
      .filter((e) => e.type === "CHAMPION_KILL")
      .filter(
        (e) =>
          e.timestamp >= endedAt &&
          e.timestamp <= endedAt + PENTA_KILL_WINDOW_MS,
      )
      .forEach((e) => {
        const { killerId, timestamp } = e;
        if (killerId !== targetParticipantId && teammates.includes(killerId)) {
          stolenPentas.push({
            stolenBy: killerId,
            stolenFrom: targetParticipantId,
            timestamp,
          });
          // This kill was stolen by a teammate
          console.log(
            `Penta kill stolen by participant ${killerId} at ${timestamp}`,
          );
        }
      });
  }
  return stolenPentas;
}
