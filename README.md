# Inazuma FC

The web platform for **Inazuma FC**, a Discord-based EA FC Pro Clubs ranked league. It covers player profiles, ratings and rankings, tournaments, and a Discord bot, all backed by one shared database.

> Live site: `https://<your-app>.vercel.app`

## Features

- **Discord sign-in**: players log in with their Discord account
- **Player profiles and stats**: match history, ratings and rank
- **Ranked league**: Elo-based ratings with tiered ranks
- **Tournaments**: group and round-robin formats, scheduling and results
- **Discord bot**: stats lookups, leaderboards, role and nickname sync, event signups
- **Admin tools**: league management and an initialise flow for new seasons

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Auth | Auth.js v5 (Discord provider) |
| Database | PostgreSQL (Supabase) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Hosting | Vercel |
| Bot hosting | bot-hosting.net |
| Package manager | pnpm (monorepo) |

## Project structure

```
.
├── apps/
│   ├── web/          # Next.js site
│   └── bot/          # Discord bot
├── packages/
│   └── db/           # Drizzle schema, migrations, shared DB client
├── pnpm-workspace.yaml
└── README.md
```

> Adjust the folder names to match your repo.

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- A Supabase project (Postgres)
- A Discord application (OAuth2 + bot token)

### Install

```bash
git clone <repo-url>
cd <repo>
pnpm install
```

### Environment variables

Create `.env.local` in the web app:

```env
# Database
DATABASE_URL=postgresql://...:6543/postgres   # transaction pooler (runtime)
DIRECT_URL=postgresql://...:5432/postgres     # direct connection (migrations only)

# Auth.js
AUTH_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
AUTH_URL=http://localhost:3000

# Discord bot
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
```

**Important:**
- Vercel (serverless) must use the **transaction pooler on port 6543**. Direct connections on port 5432 exhaust connections at scale.
- Run migrations against `DIRECT_URL`, not the pooler.

### Database

```bash
pnpm drizzle-kit generate   # generate a migration from schema changes
pnpm drizzle-kit migrate    # apply migrations (uses DIRECT_URL)
```

Drizzle is the schema authority. If you run `drizzle-kit pull`, check the output path matches the schema path the app imports, otherwise the ORM breaks silently.

### Run locally

```bash
pnpm dev                    # web app on http://localhost:3000
pnpm --filter bot dev       # Discord bot
```

## Deployment

**Web (Vercel)**
1. Import the repo into Vercel.
2. Set the environment variables above, with `DATABASE_URL` pointing at the pooler (port 6543).
3. Deploy.

**Bot (bot-hosting.net)**
1. Upload or connect the bot package.
2. Set the bot environment variables.
3. Make sure the bot's role sits **above** the roles it manages in Discord's role hierarchy, otherwise it cannot set nicknames.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Connection exhaustion in production | App is using port 5432 instead of the pooler on 6543 |
| `signIn()` fails silently | Missing `SessionProvider` context. Use server actions for sign-in |
| 404 or redirect loop on initialise | Drizzle schema path mismatch |
| Bot can't change nicknames | Bot role is below the target role in the hierarchy |
| Buttons not clickable in drag UI | `setPointerCapture` called on `onDown`. Defer it to `onMove` past a movement threshold |

## Contributing

1. Create a branch from `main`.
2. Make your change and run `pnpm lint` and `pnpm build`.
3. Open a pull request describing what changed and why.

## License

Add a license here (e.g. MIT), or mark as private/all rights reserved.
