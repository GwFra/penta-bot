import { db } from "../db/index.ts";
import {
  users,
  matchStats,
  stolenPentas as stolenPentasDB,
  type User,
} from "../db/schema.ts";
import { eq, sum } from "drizzle-orm";

interface StolenPenta {
  stolenBy: number;
  stolenFrom: number;
  timestamp: number;
}

interface SaveMatchStatsInput {
  userId: number;
  matchId: string;
  pentaKills: number;
  snowballsHit: number;
  snowballsMissed: number;
  stolenPentas: StolenPenta[];
}

export async function saveMatchStats({
  userId,
  matchId,
  pentaKills,
  snowballsHit,
  snowballsMissed,
  stolenPentas,
}: SaveMatchStatsInput): Promise<void> {
  await db
    .insert(matchStats)
    .values({
      userId,
      matchId,
      pentaKills,
      snowballsHit,
      snowballsMissed,
    })
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

interface UserStats extends User {
  totalPentas: string | null;
  totalSnowballsHit: string | null;
  totalSnowballsMissed: string | null;
}

export async function getUserStats(
  discordId: string,
): Promise<UserStats | null> {
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

interface StolenPentaRecord {
  matchId: string;
  gameTimestamp: number;
  stolenFromName: string;
}

export async function getStolenPentaStats(
  discordId: string,
): Promise<StolenPentaRecord[]> {
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

export async function getServerTotalPentas(): Promise<number> {
  const [result] = await db
    .select({
      total: sum(matchStats.pentaKills),
    })
    .from(matchStats);
  return Number(result.total ?? 0);
}
