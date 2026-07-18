# Penta Bot

A Discord bot (built on discord.js) that watches members' League of Legends
(ARAM) presence, tracks who's playing together, and looks up match stats via
the Riot API. Match/stat data is persisted to a Postgres (Neon) database via
Drizzle ORM, and live game membership is tracked in Redis.

## Project structure

```
├── auth
│   └── server.js       -> Express server implementing the Discord OAuth2 flow (WIP)
├── commands            -> chat commands, auto-loaded from this folder
│   ├── ping.js          -> liveness check
│   ├── history.js       -> a user's recent ARAM KDA
│   └── penta.js         -> penta/quad-kill summary for a live/finished game (WIP)
├── services
│   ├── userStore.js     -> CRUD for the `users` table (Postgres)
│   ├── stats.js         -> reads/writes match stats & stolen pentas (Postgres)
│   └── gameQueue.js     -> tracks which tracked players are in which live game (Redis)
├── utils
│   ├── api.js            -> Riot API URL builders + fetchJSON helper
│   ├── retry.js           -> exponential-backoff retry wrapper
│   └── update.js          -> match/timeline analysis (multikills, stolen pentas) (WIP)
├── db
│   ├── index.js          -> Drizzle/Neon client
│   └── schema.js          -> table definitions (users, matchStats, stolenPentas)
├── scripts
│   └── migrate.js        -> runs schema.sql against the configured database
├── drizzle.config.js     -> drizzle-kit config (used by `npm run db:push`)
├── index.js              -> app entrypoint: Discord client, command loader, presence watcher
├── .env.sample
└── package.json
```

## How it works

### Startup (`index.js`)

- Loads every file in `commands/` and registers it by its `name` export.
- Logs into Discord and starts a small Express auth server (`auth/server.js`)
  on `PORT` (default `3000`).
- Listens for two kinds of events:
  - `messageCreate` — dispatches `!`-prefixed messages to the matching command.
  - `presenceUpdate` — watches for members' League of Legends presence
    transitioning between `In Lobby` and `In Game` for an ARAM activity.

### Automatic game tracking

The bot doesn't require players to run a command to be tracked — it reacts to
Discord Rich Presence:

1. **Game start** (`In Lobby` → `In Game`): looks the player up in the
   database by Discord ID (`getUserByDiscordId`). If they have a stored
   `puuid`, it calls the Riot Spectator API (with retry/backoff via
   `withRetry`) to get the live `gameId`, converts it to a match-v5 id
   (`toMatchId`, e.g. `EUW1_1234567890`), then records the player as "in that
   match" in Redis (`addPlayerToGame`) via `services/gameQueue.js`. This also
   returns which other tracked players are already in the same match.
2. **Game end** (`In Game` → `In Lobby`): removes the player from the Redis
   match tracker (`removePlayerFromGame`), which returns the matchId plus any
   other tracked players who were in it. It then looks up all tracked
   participants (the player + those others) and calls
   `obtainResultsForMatch(matchId, trackedUsers)` (`utils/update.js`), which
   polls the Riot match-v5 API with backoff (it briefly 404s right after a
   game ends, before Riot finishes processing it) until the finished match is
   available, then computes and saves each tracked player's stats. Results
   are currently logged to the console rather than posted back to Discord.

Untracked players (no `puuid` on file) or members whose presence hasn't been
observed since the bot logged in (no `GuildMembers` intent is used) are
silently skipped.

### Commands

All commands use the `!` prefix (e.g. `!ping`).

| Command | Usage | Description |
| --- | --- | --- |
| `!ping` | `!ping` | Replies "Pong!" — basic liveness check. |
| `!history` | `!history [riotId]` | Looks up a Riot account (defaults to the caller's linked `lolName`), fetches their last 10 ARAM (queue 450) match IDs, pulls each match, and replies with combined kills/deaths/assists across those games. |
| `!penta` | `!penta` | Server-only. Finds guild members currently showing an "In Game" League of Legends presence, filters to ones that are tracked users, and (if 2+ are found) runs `obtainResults` to summarize penta/multikill data for the game. Still uses the older, hardcoded `obtainResults` path (see below) rather than the automatic per-match flow. |

### Match/kill analysis (`utils/update.js`)

Both entry points share the same kill-analysis logic, computed from a
match's data and timeline:

- Reads the participant's `pentaKills`, `largestMultiKill`, snowball
  (Poro-King) cast/hit counts, and poro explosions from match `challenges`.
- If the player got a quad-kill or better (`largestMultiKill >= 4`), scans the
  match timeline for **stolen pentas**: any kill by a teammate landing within
  30 seconds (`PENTA_KILL_WINDOW_MS`) after the end of that player's 4-kill
  streak (kills within a 10s window, `MULTI_KILL_WINDOW_MS`, count as one
  streak) is considered a "stolen" potential penta.
- Saves the computed stats via `services/stats.js`.

There are two entry points into this logic:

- **`obtainResultsForMatch(matchId, trackedUsers)`** — the automatic path
  used by the presence-based game-end flow in `index.js` (see above). Given a
  known matchId and the tracked users who were in it, it polls match-v5 with
  retry until the match is ready, matches each tracked user to their
  participant by `puuid`, and saves per-user stats. Stolen-penta records are
  only saved when the teammate who stole the kill is also a tracked user
  (`stolen_pentas` rows reference `users.id`, not Riot's in-match
  `participantId`).
- **`obtainResults(discordUser)`** — the older function still used by
  `!penta`. It currently has hardcoded/placeholder values (a fixed
  `discordId`/`discordName`, and it indexes a fixed match rather than the
  game just played) and hasn't been updated to use a real matchId — it's
  mid-refactor and due to be replaced or reworked to use
  `obtainResultsForMatch` instead.

### Data storage

**Postgres (Neon), via Drizzle ORM** — persistent data:

- `users` — Discord ID/name, linked LoL summoner name, and `puuid`.
- `match_stats` — per-user, per-match penta kills and snowball hit/miss
  counts (unique per `userId` + `matchId`).
- `stolen_pentas` — records of a penta being "stolen" from one tracked user
  by another, with the in-game timestamp.

**Redis, via ioredis** — ephemeral live-game state:

- A single hash (`active_players`) mapping `discordId -> matchId` for players
  currently in a tracked live game, used to determine which tracked players
  are in the same match and to look up that match once the game finishes.

### Discord OAuth2 (`auth/server.js`)

An Express server exposing `/auth/discord` (redirects to Discord's OAuth2
consent screen requesting `identify connections` scope) and
`/auth/discord/callback` (exchanges the returned code for an access token and
fetches the user's connections, intended to find their linked League of
Legends account). This flow is unfinished — the callback doesn't yet persist
the linked account back into the `users` table.

## Setup

```bash
npm install
```

Copy `.env.sample` to `.env` and fill in:

| Variable | Purpose |
| --- | --- |
| `APP_ID`, `DISCORD_TOKEN`, `PUBLIC_KEY` | Discord bot credentials |
| `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` | Discord OAuth2 app credentials |
| `RIOT_API_KEY`, `RIOT_BASE_API` | Riot API access (regional routing, e.g. `https://europe.api.riotgames.com`) |
| `DATABASE_URL` | Neon/Postgres connection string |
| `REDIS_URL` | Redis connection string |

Push the schema to your database:

```bash
npm run db:push
```

### Run the app

```bash
npm run start
```

or, with auto-restart on file changes:

```bash
npm run dev
```

## Known gaps / in progress

- `!penta` still calls the older, hardcoded `obtainResults` rather than the
  automatic `obtainResultsForMatch` path — it needs reworking to use a real
  matchId (or to be replaced by the automatic flow's console output).
- Match results from the automatic post-game flow are only logged to the
  console, not posted back to a Discord channel.
- The Discord OAuth2 callback doesn't persist the linked Riot account, and
  has a bug where it references an undefined `user` variable in its response.
- Command lookup for `!history`/`!penta` assumes the caller already has a
  `users` row linking their Discord account to a `lolName`/`puuid` — there's
  no command yet to self-register or link an account (this is what the OAuth2
  flow is meant to eventually cover).
- Bot presence-tracking requires the `GuildPresences` intent and only sees
  members whose presence has been observed since the bot logged in — no
  `GuildMembers` intent is requested.
