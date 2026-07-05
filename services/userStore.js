import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function upsertUser({ discordId, discordName, lolName, puuid }) {
  const [user] = await db
    .insert(users)
    .values({ discordId, discordName, lolName, puuid })
    .onConflictDoUpdate({
      target: users.discordId,
      set: { discordName, lolName, puuid },
    })
    .returning();
  return user;
}

export async function getUserByDiscordId(discordId) {
  const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
  return user ?? null;
}

export async function getUserByPuuid(puuid) {
  const [user] = await db.select().from(users).where(eq(users.puuid, puuid));
  return user ?? null;
}