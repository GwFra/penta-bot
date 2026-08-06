import "dotenv/config";
import {
  fetchJSON,
  MATCHES_API,
  MATCH_API,
  MATCH_TIMELINE,
} from "../utils/api.ts";
import type { RiotMatch, RiotMatchTimeline } from "../types/riot.ts";

const puuid = process.env.DEV_PUUID!;
const matchIds = await fetchJSON<string[]>(MATCHES_API(puuid, 1));
console.log("matches result:", matchIds);

// Obtains the latest match
const [matchId] = matchIds;
const matchData = await fetchJSON<RiotMatch>(MATCH_API(matchId));
const timeline = await fetchJSON<RiotMatchTimeline>(MATCH_TIMELINE(matchId));
console.log(matchData.info.participants[0].participantId);
console.log(matchData.info.participants[2].participantId);
console.log(matchData.info.participants[4].participantId);
// console.log(timeline.info.frames[0]);
// console.log(timeline.info.frames[2]);
// console.log(timeline.info.frames[15]);

process.exit(0);
