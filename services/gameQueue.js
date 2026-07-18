import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// Hash of discordId -> matchId, so we can tell which players are in the
// same match rather than just how many are in *a* match.
const ACTIVE_PLAYERS_KEY = "active_players";

// Marks a player as having entered a game, returns the discordIds of
// other tracked players already in that same game.
export async function addPlayerToGame(discordId, matchId) {
  const others = await getPlayersInGame(matchId);
  await redis.hset(ACTIVE_PLAYERS_KEY, discordId, matchId);
  return others;
}

// Marks a player as having left/finished a game, returns the matchId they
// were in (null if they weren't tracked as in a game) and the discordIds of
// the other tracked players that were in that game together.
export async function removePlayerFromGame(discordId) {
  const matchId = await redis.hget(ACTIVE_PLAYERS_KEY, discordId);
  await redis.hdel(ACTIVE_PLAYERS_KEY, discordId);
  if (!matchId) return { matchId: null, others: [] };
  return { matchId, others: await getPlayersInGame(matchId) };
}

// All tracked discordIds currently marked as being in the given matchId.
export async function getPlayersInGame(matchId) {
  const allPlayers = await redis.hgetall(ACTIVE_PLAYERS_KEY);
  return Object.entries(allPlayers)
    .filter(([, playerMatchId]) => playerMatchId === String(matchId))
    .map(([discordId]) => discordId);
}

export async function getActivePlayerCount() {
  return redis.hlen(ACTIVE_PLAYERS_KEY);
}
