import { fetchJSON, MATCH_API } from "./api.ts";
import type {
  RiotMatch,
  RiotMatchTimeline,
  RiotTimelineEvent,
  RiotParticipant,
} from "../types/riot.ts";

// Process should be as follows
// 1. Detects a game has finished with x number of users in discord (2 or more)
// 2. determines if multikill of 4 or over occured
// 4. if YES, determine if penta was stolen
// 5. gather info for all players and if penta was done against team of 2 or more
// 6. respond in discord + update DB with information

const SNOWBALL_SPELL_ID = 32;
const MULTI_KILL_WINDOW_MS = 10000;
const PENTA_KILL_WINDOW_MS = 30000;

interface StolenPentaEvent {
  stolenBy: string;
  stolenFrom: string;
  timestamp: number;
}

interface MatchResultSummary {
  discordId?: string;
  pentaKills: number;
  largestMultiKill: number;
  poroExplosions: number;
  snowballsHit: number;
  snowballsMissed: number;
  stolenPentas: StolenPentaEvent[];
}

// Given the matchId of a game that has just finished (derived from the
// gameId captured at game-start, see toMatchId in api.js) and the tracked
// users who were in it, waits for Riot to finish processing the match, then
// computes and saves penta/snowball/stolen-penta stats for each of them.
export async function obtainResultsForMatch(
  matchId: string,
  trackedUsers: string[],
  matchTimeline: RiotMatchTimeline,
): Promise<MatchResultSummary[]> {
  const matchData = await fetchJSON<RiotMatch>(MATCH_API(matchId));

  const playerGameData = trackedUsers.map((puuid) => {
    return matchData.info.participants.find((stats) => stats.puuid === puuid);
  }) as RiotParticipant[];

  // const teammateParticipantIds = playerGameData[0]?.teamId || 0;
  const killerIds = playerGameData.map(({ puuid, participantId }) => ({
    puuid,
    participantId,
  }));

  console.log(killerIds);

  return playerGameData
    .filter((playerData) => playerData !== undefined)
    .map((playerData) => {
      const {
        summoner1Id,
        summoner1Casts,
        summoner2Id,
        summoner2Casts,
        pentaKills,
        largestMultiKill,
        challenges: { poroExplosions, snowballsHit },
      } = playerData;

      const snowballCasts =
        summoner1Id === SNOWBALL_SPELL_ID
          ? summoner1Casts
          : summoner2Id === SNOWBALL_SPELL_ID
            ? summoner2Casts
            : 0;

      const snowballsMissed = Math.max(0, snowballCasts - snowballsHit);

      // stolen_pentas rows reference users.id, so a steal can only be
      // recorded when the player who stole it is also a tracked user.
      const stolenPentas: StolenPentaEvent[] =
        largestMultiKill >= 4
          ? findStolenPentas(matchTimeline, playerData.participantId, killerIds)
              .filter((steal) =>
                killerIds.some((k) => k.puuid === steal.stolenBy),
              )
              .map((steal) => ({
                stolenBy: steal.stolenBy,
                // Need to map this back to the user to obtain some cool shiz
                stolenFrom: playerData.puuid,
                timestamp: steal.timestamp,
              }))
          : [];

      // User DB call - wait wait wait
      //     await saveMatchStats({
      //   userId: user.id,
      //   matchId,
      //   pentaKills,
      //   snowballsHit,
      //   snowballsMissed,
      //   stolenPentas,
      // });

      const funny = {
        discordId: playerData.puuid,
        pentaKills,
        largestMultiKill,
        poroExplosions,
        snowballsHit,
        snowballsMissed,
        stolenPentas,
      };
      return funny;
    });
}

function getKillEvents(timeline: RiotMatchTimeline): RiotTimelineEvent[] {
  return timeline.info.frames
    .flatMap((f) => f.events)
    .filter((e) => e.type === "CHAMPION_KILL");
}

interface MultiKillStreak {
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

const findQuadKills = (
  {
    results,
    streak,
  }: {
    results: MultiKillStreak[];
    streak: number[];
  },
  ts: number,
): { results: MultiKillStreak[]; streak: number[] } => {
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
            {
              startedAt: next[0],
              endedAt: ts,
              durationMs: ts - next[0],
            },
          ]
        : results,
  };
};

/**
 * Loops over the timeline for the given player id (specific to the game), uses streaks array to track current
 * kill straks and clearing if there's one that doesn't reach 4/quad-kill
 *
 * @param timeline
 * @param participantId
 * @returns array of timestamps for when the quad-kill occured
 */
function findMultiKillTimestamps(
  timeline: RiotMatchTimeline,
  participantId: number,
): MultiKillStreak[] {
  const kills = getKillEvents(timeline)
    .filter((e) => e.killerId === participantId)
    .map((e) => e.timestamp);

  const { results } = kills.reduce<{
    results: MultiKillStreak[];
    streak: number[];
  }>(findQuadKills, { results: [], streak: [] });

  return results;
}

// Stolen pentas are found by first identifying a target's quad-kill streaks
// (via findMultiKillTimestamps), then checking whether one of their
// teammates (not the target) landed a kill within PENTA_KILL_WINDOW_MS of
// the streak ending - i.e. the teammate likely finished off the penta.
function findStolenPentas(
  timeline: RiotMatchTimeline,
  targetParticipantId: number,
  teammateParticipantIds: Array<{ puuid: string; participantId: number }>,
): StolenPentaEvent[] {
  const killEvents = getKillEvents(timeline);
  const quadKills = findMultiKillTimestamps(timeline, targetParticipantId);

  return quadKills.flatMap(({ endedAt }) =>
    killEvents
      .filter(
        (e) =>
          e.timestamp > endedAt &&
          e.timestamp <= endedAt + PENTA_KILL_WINDOW_MS,
      )
      .filter((e) =>
        teammateParticipantIds.some((t) => t.participantId === e.killerId),
      )
      .map((e) => ({
        stolenBy:
          teammateParticipantIds.find((t) => t.participantId === e.killerId)
            ?.puuid ?? "",
        stolenFrom:
          teammateParticipantIds.find(
            (t) => t.participantId === targetParticipantId,
          )?.puuid ?? "",
        timestamp: e.timestamp,
      })),
  );
}
