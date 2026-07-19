export async function fetchJSON<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    console.error(`API request failed: ${await res.text()}`);
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const MATCHES_V5 = "/lol/match/v5/matches";

// Spectator-v5 is routed by platform (euw1) rather than region (europe),
// unlike the account/match APIs below - defaults to EUW to match those.
const PLATFORM_BASE_API = "https://euw1.api.riotgames.com";
const PLATFORM = "EUW1";

// Might need to refresh API key occasionally
// defaults to EUW server and elementninjara
export const PUUID_API = (username: string): string =>
  `${process.env.RIOT_BASE_API}/riot/account/v1/accounts/by-riot-id/${username}/EUW?api_key=${process.env.RIOT_API_KEY}`;
export const MATCHES_API = (puuid: string, matches = 10): string =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/by-puuid/${puuid}/ids?start=0&count=${matches}&queue=450&api_key=${process.env.RIOT_API_KEY}`;
export const MATCH_API = (matchId: string): string =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/${matchId}?api_key=${process.env.RIOT_API_KEY}`;
export const MATCH_TIMELINE = (matchId: string): string =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/${matchId}/timeline?api_key=${process.env.RIOT_API_KEY}`;
export const SPECTATOR_API = (puuid: string): string =>
  `${PLATFORM_BASE_API}/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${process.env.RIOT_API_KEY}`;

// Match-v5 ids are the platform code the game was played on prefixed onto
// the numeric gameId the spectator API returns (e.g. "EUW1_1234567890").
export const toMatchId = (gameId: number | string): string =>
  `${PLATFORM}_${gameId}`;
