import { fetchJSON, PUUID_API } from "../utils/api.ts";
import { upsertUser } from "./userStore.ts";
import type { RiotAccount } from "../types/riot.ts";
import type { User } from "../db/schema.ts";

// https://discord.com/developers/docs/resources/user#connection-object
export interface DiscordConnection {
  type: string;
  name: string;
  id: string;
  verified: boolean;
}

export interface DiscordIdentity {
  id: string;
  username: string;
}

const LEAGUE_CONNECTION_TYPE = "leagueoflegends";

// Looks for a League of Legends connection on the user's Discord account,
// resolves its summoner name to a Riot PUUID, and upserts the user into the
// DB. Returns the stored user, or null when they have no LoL account linked
// (nothing to track yet).
export async function linkLeagueAccount(
  discordUser: DiscordIdentity,
  connections: DiscordConnection[],
): Promise<User | null> {
  const league = connections.find((c) => c.type === LEAGUE_CONNECTION_TYPE);
  if (!league) return null;

  const { puuid } = await fetchJSON<RiotAccount>(PUUID_API(league.name));

  return upsertUser({
    discordId: discordUser.id,
    discordName: discordUser.username,
    lolName: league.name,
    puuid,
  });
}
