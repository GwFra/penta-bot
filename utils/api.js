export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    console.error(`API request failed: ${await res.text()}`);
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const MATCHES_V5 = "/lol/match/v5/matches";

// Might need to refresh API key occasionally
// defaults to EUW server and elementninjara
export const PUUID_API = `${process.env.RIOT_BASE_API}/riot/account/v1/accounts/by-riot-id/elementninjara/EUW?api_key=${process.env.RIOT_API_KEY}`;
export const MATCHES_API = (puuid, matches = 10) =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/by-puuid/${puuid}/ids?start=0&count=${matches}&queue=450&api_key=${process.env.RIOT_API_KEY}`;
export const MATCH_API = (matchId) =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/${matchId}?api_key=${process.env.RIOT_API_KEY}`;
export const MATCH_TIMELINE = (matchId) =>
  `${process.env.RIOT_BASE_API}${MATCHES_V5}/${matchId}/timeline?api_key=${process.env.RIOT_API_KEY}`;
