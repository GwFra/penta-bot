import {
  fetchJSON,
  PUUID_API,
  MATCHES_API,
  MATCH_API,
  MATCH_TIMELINE,
} from "./api.js";
import { withRetry } from "./retry.js";
import { upsertUser } from "../services/userStore.js";
import { saveMatchStats } from "../services/stats.js";
import type { User } from "../db/schema.js";
import type {
  RiotAccount,
  RiotMatch,
  RiotMatchTimeline,
  RiotTimelineEvent,
  RiotParticipant,
} from "../types/riot.js";

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
  stolenBy: number;
  stolenFrom: number;
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

export async function obtainResults(
  _discordUser: unknown,
): Promise<MatchResultSummary> {
  // Pre-existing bug: PUUID_API is a URL-builder function, not a URL - this
  // needs a real Riot id argument to actually work. obtainResults is
  // unused/placeholder logic (see README "Known gaps"), kept as-is here
  // rather than fixed as part of the TypeScript conversion.
  // @ts-expect-error - see note above
  const { puuid } = await fetchJSON<RiotAccount>(PUUID_API);
  const matches = await fetchJSON<string[]>(MATCHES_API(puuid));
  // should default to 0
  const matchId = matches[8];

  const [matchData, matchTimeline] = await Promise.all([
    fetchJSON<RiotMatch>(MATCH_API(matchId)),
    fetchJSON<RiotMatchTimeline>(MATCH_TIMELINE(matchId)),
  ]);

  const participant = matchData.info.participants.find(
    (p) => p.puuid === puuid,
  )!;
  const {
    summoner1Id,
    summoner1Casts,
    summoner2Id,
    summoner2Casts,
    pentaKills,
    largestMultiKill,
    teamId,
    challenges: { poroExplosions, snowballsHit },
  } = participant;

  const snowballCasts =
    summoner1Id === SNOWBALL_SPELL_ID
      ? summoner1Casts
      : summoner2Id === SNOWBALL_SPELL_ID
        ? summoner2Casts
        : 0;

  const snowballsMissed = Math.max(0, snowballCasts - snowballsHit);

  const teammateParticipantIds = new Set(
    matchData.info.participants
      .filter(
        (p) =>
          p.teamId === teamId && p.participantId !== participant.participantId,
      )
      .map((p) => p.participantId),
  );

  const stolenPentas =
    largestMultiKill >= 4
      ? findStolenPentas(
          matchTimeline,
          participant.participantId,
          teammateParticipantIds,
        )
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

// Given the matchId of a game that has just finished (derived from the
// gameId captured at game-start, see toMatchId in api.js) and the tracked
// users who were in it, waits for Riot to finish processing the match, then
// computes and saves penta/snowball/stolen-penta stats for each of them.
export async function obtainResultsForMatch(
  matchId: string,
  trackedUsers: User[],
): Promise<MatchResultSummary[]> {
  // Match-v5 briefly 404s right after a game ends, before Riot has finished
  // processing it - retry with backoff until it's available.
  const matchData = await withRetry(() =>
    fetchJSON<RiotMatch>(MATCH_API(matchId)),
  );
  const matchTimeline = await fetchJSON<RiotMatchTimeline>(
    MATCH_TIMELINE(matchId),
  );

  const trackedParticipants = trackedUsers
    .map((user) => {
      const participant = matchData.info.participants.find(
        (p) => p.puuid === user.puuid,
      );
      return participant ? { user, participant } : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        user: User;
        participant: RiotParticipant;
      } => entry !== null,
    );

  // participantId -> our internal user id, for every tracked player Riot
  // confirms was actually in this match.
  const userIdByParticipantId = new Map<number, number>(
    trackedParticipants.map(({ user, participant }) => [
      participant.participantId,
      user.id,
    ]),
  );

  const results: MatchResultSummary[] = [];

  for (const { user, participant } of trackedParticipants) {
    const {
      summoner1Id,
      summoner1Casts,
      summoner2Id,
      summoner2Casts,
      pentaKills,
      largestMultiKill,
      teamId,
      challenges: { poroExplosions, snowballsHit },
    } = participant;

    const snowballCasts =
      summoner1Id === SNOWBALL_SPELL_ID
        ? summoner1Casts
        : summoner2Id === SNOWBALL_SPELL_ID
          ? summoner2Casts
          : 0;

    const snowballsMissed = Math.max(0, snowballCasts - snowballsHit);

    const teammateParticipantIds = new Set(
      matchData.info.participants
        .filter(
          (p) =>
            p.teamId === teamId &&
            p.participantId !== participant.participantId,
        )
        .map((p) => p.participantId),
    );

    // stolen_pentas rows reference users.id, so a steal can only be
    // recorded when the player who stole it is also a tracked user.
    const stolenPentas: StolenPentaEvent[] =
      largestMultiKill >= 4
        ? findStolenPentas(
            matchTimeline,
            participant.participantId,
            teammateParticipantIds,
          )
            .filter((steal) => userIdByParticipantId.has(steal.stolenBy))
            .map((steal) => ({
              stolenBy: userIdByParticipantId.get(steal.stolenBy)!,
              stolenFrom: user.id,
              timestamp: steal.timestamp,
            }))
        : [];

    await saveMatchStats({
      userId: user.id,
      matchId,
      pentaKills,
      snowballsHit,
      snowballsMissed,
      stolenPentas,
    });

    results.push({
      discordId: user.discordId,
      pentaKills,
      largestMultiKill,
      poroExplosions,
      snowballsHit,
      snowballsMissed,
      stolenPentas,
    });
  }

  return results;
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

function findMultiKillTimestamps(
  timeline: RiotMatchTimeline,
  participantId: number,
): MultiKillStreak[] {
  const kills = getKillEvents(timeline)
    .filter((e) => e.killerId === participantId)
    .map((e) => e.timestamp);

  return kills.reduce<{
    results: MultiKillStreak[];
    streak: number[];
  }>(
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
                {
                  startedAt: next[0],
                  endedAt: ts,
                  durationMs: ts - next[0],
                },
              ]
            : results,
      };
    },
    { results: [], streak: [] },
  ).results;
}

// Stolen pentas are found by first identifying a target's quad-kill streaks
// (via findMultiKillTimestamps), then checking whether one of their
// teammates (not the target) landed a kill within PENTA_KILL_WINDOW_MS of
// the streak ending - i.e. the teammate likely finished off the penta.
function findStolenPentas(
  timeline: RiotMatchTimeline,
  targetParticipantId: number,
  teammateParticipantIds: Set<number>,
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
      .filter((e) => teammateParticipantIds.has(e.killerId))
      .map((e) => ({
        stolenBy: e.killerId,
        stolenFrom: targetParticipantId,
        timestamp: e.timestamp,
      })),
  );
}
