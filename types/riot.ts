// Minimal shapes for the parts of Riot's API responses this bot actually
// reads - not a full mapping of match-v5/spectator-v5's schemas.

export interface RiotAccount {
  puuid: string;
}

export interface ActiveGame {
  gameId: number;
  [key: string]: unknown;
}

export interface RiotChallenges {
  poroExplosions: number;
  snowballsHit: number;
  [key: string]: unknown;
}

export interface RiotParticipant {
  puuid: string;
  participantId: number;
  teamId: number;
  summonerName: string;
  kills: number;
  deaths: number;
  assists: number;
  summoner1Id: number;
  summoner1Casts: number;
  summoner2Id: number;
  summoner2Casts: number;
  pentaKills: number;
  largestMultiKill: number;
  challenges: RiotChallenges;
  [key: string]: unknown;
}

export interface RiotMatch {
  info: {
    participants: RiotParticipant[];
    [key: string]: unknown;
  };
}

export interface RiotTimelineEvent {
  type: string;
  killerId: number;
  timestamp: number;
  [key: string]: unknown;
}

export interface RiotTimelineFrame {
  events: RiotTimelineEvent[];
  [key: string]: unknown;
}

// Timeline participants only carry participantId/puuid - teamId lives on
// the match's own participants list, not the timeline's.
export interface RiotTimelineParticipant {
  participantId: number;
  puuid: string;
}

export interface RiotMatchTimeline {
  info: {
    frames: RiotTimelineFrame[];
    participants: RiotTimelineParticipant[];
  };
}
