# League Platform

A full-stack web platform and Discord bot for a competitive online football league. It handles player accounts, an Elo-based ranking system, tournaments, and automated community tooling, all on a shared database.

## What it does

- **Discord sign-in:** players authenticate with their Discord account
- **Player profiles:** stats, match history, rating and rank
- **Ranking system:** a custom Elo model that weighs match result, match rating, expected result, opponent strength and goal difference, with tiered ranks
- **Tournaments:** group and partial round-robin formats with scheduling and results
- **Discord bot:** stats lookups, leaderboards, event signups, and automatic role and nickname sync
- **Admin tooling:** season management and league setup

## Tech stack

- Next.js (App Router) and TypeScript
- Auth.js v5 with the Discord provider
- PostgreSQL (Supabase) with Drizzle ORM
- Vercel for the web app, a separate host for the bot
- pnpm monorepo shared between the site and the bot

## Architecture

```
┌────────────┐     ┌──────────────┐
│  Web app   │     │ Discord bot  │
│ (Next.js)  │     │              │
└─────┬──────┘     └──────┬───────┘
      │                   │
      └────────┬──────────┘
               ▼
        ┌─────────────┐
        │  Postgres   │
        │ (via Drizzle)│
        └─────────────┘
```

The site and the bot share one schema package, so there is a single source of truth for the data model.

## Interesting problems

**Serverless database connections.** Serverless functions open a new connection per invocation, which exhausted the database under load. The fix was routing runtime traffic through a transaction pooler and keeping migrations on a direct connection, because migrations need session-level features the pooler doesn't support.

**Ranking design.** The Elo variant combines several weighted components rather than win/loss alone. A lot of the work was reasoning about where the formula could be gamed or produce unfair swings, and how tiers should feel to players.

**Tournament formats.** A two-groups-of-three layout left a team idle for a whole round on a single pitch. A partial round-robin for six teams removed the idle time while keeping the competition fair.

**Auth edge cases.** Silent sign-in failures turned out to be a missing session context and were fixed by moving to server actions. I also fixed a bug where the session token stored an internal ID instead of the Discord user ID.

**Schema tooling.** A mismatch between the schema path used by the ORM tooling and the app caused silent breakage and a redirect loop, so Drizzle is now the single schema authority.

## What I learned

- Where serverless and traditional database assumptions clash
- Designing a rating system from a fairness and player-experience angle
- Building a web app and a bot around one shared data model
- Explaining technical changes in plain language for non-technical users

## License

All rights reserved. Source is provided for viewing only.
