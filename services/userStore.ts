import { db } from "../db/index.js";
import { users, type User } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface UpsertUserInput {
  discordId: string;
  discordName: string;
  lolName?: string | null;
  puuid?: string | null;
}

export async function upsertUser({
  discordId,
  discordName,
  lolName,
  puuid,
}: UpsertUserInput): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      discordId,
      discordName,
      lolName,
      puuid,
    })
    .onConflictDoUpdate({
      target: users.discordId,
      set: {
        discordName,
        lolName,
        puuid,
      },
    })
    .returning();
  return user;
}

export async function getUserByDiscordId(
  discordId: string,
): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, discordId));
  return user ?? null;
}

export async function getUserByDiscordUsername(
  username: string,
): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordName, `#${username}`));
  return user ?? null;
}

export async function getUserByPuuid(puuid: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.puuid, puuid));
  return user ?? null;
}
