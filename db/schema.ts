import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordName: text("discord_name").notNull(),
  lolName: text("lol_name"),
  puuid: text("puuid").unique(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow(),
});

export const matchStats = pgTable(
  "match_stats",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    matchId: text("match_id").notNull(),
    pentaKills: integer("penta_kills").notNull().default(0),
    snowballsHit: integer("snowballs_hit").notNull().default(0),
    snowballsMissed: integer("snowballs_missed").notNull().default(0),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.matchId)],
);

export const stolenPentas = pgTable("stolen_pentas", {
  id: serial("id").primaryKey(),
  matchId: text("match_id").notNull(),
  stolenBy: integer("stolen_by")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  stolenFrom: integer("stolen_from")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  gameTimestamp: integer("game_timestamp").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MatchStats = typeof matchStats.$inferSelect;
export type StolenPenta = typeof stolenPentas.$inferSelect;
