import { db } from "../db/index.js";
import {
  users,
  matchStats,
  stolenPentas as stolenPentasDB,
} from "../db/schema.js";
import { eq, sum } from "drizzle-orm";

export async function saveMatchStats({
  userId,
  matchId,
  pentaKills,
  snowballsHit,
  snowballsMissed,
  stolenPentas,
}) {
  await db
    .insert(matchStats)
    .values({ userId, matchId, pentaKills, snowballsHit, snowballsMissed })
    .onConflictDoNothing();

  if (stolenPentas.length) {
    await db.insert(stolenPentasDB).values(
      stolenPentas.map(({ stolenBy, stolenFrom, timestamp }) => ({
        matchId,
        stolenBy,
        stolenFrom,
        gameTimestamp: timestamp,
      })),
    );
  }
}

export async function getUserStats(discordId) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, discordId));
  if (!user) return null;

  const [totals] = await db
    .select({
      totalPentas: sum(matchStats.pentaKills),
      totalSnowballsHit: sum(matchStats.snowballsHit),
      totalSnowballsMissed: sum(matchStats.snowballsMissed),
    })
    .from(matchStats)
    .where(eq(matchStats.userId, user.id));

  return { ...user, ...totals };
}

export async function getStolenPentaStats(discordId) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, discordId));
  if (!user) return [];

  return db
    .select({
      matchId: stolenPentasDB.matchId,
      gameTimestamp: stolenPentasDB.gameTimestamp,
      stolenFromName: users.discordName,
    })
    .from(stolenPentasDB)
    .innerJoin(users, eq(users.id, stolenPentasDB.stolenFrom))
    .where(eq(stolenPentasDB.stolenBy, user.id));
}

export async function getServerTotalPentas() {
  const [result] = await db
    .select({ total: sum(matchStats.pentaKills) })
    .from(matchStats);
  return Number(result.total ?? 0);
}
