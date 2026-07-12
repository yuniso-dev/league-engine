// INAZUMA FC Discord bot — Phase 5.
// Long-running gateway client: member sync, rank nicknames after each weekly
// reveal, /leaderboard + auto-updating rankings message, /profile.
// Needs an always-on host (see SETUP.md) — cannot run on Vercel.

// Before anything touches the DB: this process runs 24/7 and fires several
// background jobs on the same cadence (notifier + role sync every 60s, etc.).
// A small pool meant a couple of jobs could hold every connection and leave
// nothing for a slash command's query — so the command hung past Discord's
// window. 8 gives ample headroom so interactions always get a connection
// (the jobs are also phase-staggered below so they don't all fire at once).
// Railway's DB_POOL_MAX env var still overrides. (Supabase's pgBouncer pooler
// handles this easily.)
process.env.DB_POOL_MAX ??= '8';

import { Client, Events, GatewayIntentBits, type Guild } from 'discord.js';
import { closeDb, getConfig } from '@inazuma/db';
import { registerCommands, dispatch } from './commands.js';
import { onMemberAdd, onMemberRemove, syncAllMembers } from './memberSync.js';
import { syncNicknames } from './nicknameSync.js';
import { updateRankingsMessage } from './leaderboard.js';
import { syncCasualMatches } from './casualSync.js';
import { syncFrontierMatches } from './frontierSync.js';
import { pollFriendlyTest } from './friendlyTest.js';
import { pollNotifier } from './notifier.js';
import { pollClubTracker } from './clubTracker.js';
import { syncRoles } from './roleSync.js';
import { fetchAllMembers } from './guildMembers.js';

// ── env ───────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is not set — create a bot in the Discord Developer Portal (see apps/bot/SETUP.md) and set this variable on your host.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — use the same Supabase pooler URL (port 6543) as the website.');
  process.exit(1);
}
const SITE_URL = process.env.SITE_URL ?? 'https://inazuma-fc.vercel.app';

// Safe test mode: read production data but write NOTHING to the shared database
// or the real server. Set BOT_READ_ONLY=true (+ BOT_GUILD_ID=<test server id>)
// on a test host to dry-run in a throwaway server without touching live data.
const READ_ONLY = /^(1|true)$/i.test(process.env.BOT_READ_ONLY ?? '');
const GUILD_OVERRIDE = process.env.BOT_GUILD_ID || null;

const REVEAL_POLL_MS = 5 * 60_000;   // check for a committed reveal
const MEMBER_SYNC_MS = 6 * 3_600_000; // periodic full member re-sync
const GUILD_RETRY_MS = 60_000;        // re-check config.guildId when unset
const CASUAL_POLL_MS = 5 * 60_000;    // EA Clubs API poll — 5 min keeps the results feed fresh while staying gentle (≤12 requests/pass at the 6-club cap)
const FRONTIER_POLL_MS = 2 * 60_000;  // live-tournament result ingest (no-op unless a linked Frontier is live)
const CLUB_TRACK_MS = 2 * 60_000;     // tracked-club snapshots, a few stalest clubs per pass

// ── client ────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates, // lets /checkvc read who's in a voice channel on demand
  ],
});

let activeGuildId: string | null = null;
let lastRevealSeen: number | null = null;
const timers: NodeJS.Timeout[] = [];

client.on(Events.Error, e => console.error('[discord] client error —', e));
process.on('unhandledRejection', e => console.error('[bot] unhandled rejection —', e));
process.on('uncaughtException', e => {
  console.error('[bot] uncaught exception — exiting so the host restarts us', e);
  process.exit(1);
});

/** Interval bodies must never kill the timer or the process on a transient
 *  error — and must never STACK: if a pass is still running when the next tick
 *  fires (e.g. the notifier mid-way through a big DM burst), skip it rather
 *  than run two copies that fight over DB connections.
 *
 *  `phaseMs` delays the FIRST tick so same-cadence jobs don't all fire on the
 *  same instant — e.g. notifier at :00 and role sync at :30 — spreading DB and
 *  Discord-API load across the minute instead of bunching it. */
function every(ms: number, label: string, fn: () => Promise<void>, phaseMs = 0): void {
  let running = false;
  const tick = (): void => {
    if (running) {
      console.log(`[bot] ${label} still running — skipping this tick`);
      return;
    }
    running = true;
    fn()
      .catch(e => console.error(`[bot] ${label} failed —`, e))
      .finally(() => { running = false; });
  };
  timers.push(setTimeout(() => {
    tick();
    timers.push(setInterval(tick, ms));
  }, phaseMs));
}

async function fullPass(guild: Guild): Promise<void> {
  // ONE member fetch shared by both syncs — each fetch is a gateway request
  // (opcode 8) with its own rate limit, and two back-to-back fetches right
  // after a couple of restarts is exactly what trips it.
  const members = await fetchAllMembers(guild);
  if (!READ_ONLY) await syncAllMembers(guild, members); // member sync writes to the DB
  await syncNicknames(guild, members);                  // only edits nicknames in this guild — no DB writes
  if (!READ_ONLY) await updateRankingsMessage(client, SITE_URL);
}

/** Waits for config.guildId to be set (in the site's Admin → Settings) and the
 *  bot to actually be in that server — retrying instead of crash-looping, so
 *  the owner can fix configuration without a redeploy. */
async function resolveGuild(ready: Client<true>): Promise<Guild> {
  for (;;) {
    try {
      const cfg = await getConfig();
      // BOT_GUILD_ID overrides the shared config.guildId (used for test runs, so
      // testing never has to change the server's real Guild ID in Admin → Settings).
      const guildId = GUILD_OVERRIDE ?? cfg.guildId;
      if (guildId) {
        const guild = await ready.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          lastRevealSeen = cfg.lastRevealAt?.getTime() ?? null;
          return guild;
        }
        console.warn(`[bot] I'm not in the server with ID ${guildId} — invite me there (SETUP.md step 2) or fix the Guild ID in Admin → Settings. Retrying in 60s.`);
      } else {
        console.warn('[bot] No Guild ID configured yet — paste your server ID into the site\'s Admin → Settings. Retrying in 60s.');
      }
    } catch (e) {
      console.error('[bot] could not read config —', e);
    }
    await new Promise(r => setTimeout(r, GUILD_RETRY_MS));
  }
}

client.once(Events.ClientReady, async ready => {
  console.log(`[bot] logged in as ${ready.user.tag}`);
  if (READ_ONLY) {
    console.log('[bot] ⚠ TEST MODE (read-only) — the database will NOT be modified. Unset BOT_READ_ONLY for the real run.');
  }

  const guild = await resolveGuild(ready);
  activeGuildId = guild.id;
  console.log(`[bot] serving guild: ${guild.name}`);

  await registerCommands(ready, guild.id);

  // Startup pass — idempotent, self-heals anything missed while offline.
  await fullPass(guild).catch(e => console.error('[bot] startup pass failed —', e));

  // React to weekly reveals: config.lastRevealAt changes when the admin commits.
  every(REVEAL_POLL_MS, 'reveal poll', async () => {
    const cfg = await getConfig();
    const stamp = cfg.lastRevealAt?.getTime() ?? null;
    if (stamp !== null && stamp !== lastRevealSeen) {
      lastRevealSeen = stamp;
      console.log('[bot] new reveal detected — syncing nicknames + rankings message');
      await syncNicknames(guild);
      if (!READ_ONLY) await updateRankingsMessage(client, SITE_URL);
    }
  });

  // Periodic full member re-sync writes to the DB — skip it entirely in test mode.
  if (!READ_ONLY) {
    every(MEMBER_SYNC_MS, 'member re-sync', async () => {
      await syncAllMembers(guild);
    });
  }

  // CASUAL realm: poll the EA Clubs API for new club matches. No-op until
  // an EA Club ID is configured in Admin → Settings.
  if (!READ_ONLY) {
    await syncCasualMatches(ready).catch(e => console.error('[bot] casual sync failed —', e));
    every(CASUAL_POLL_MS, 'casual sync', () => syncCasualMatches(ready));
  }

  // Frontier automation: while a LIVE tournament has teams with EA clubs
  // linked, fill unscored fixtures from the EA API every couple of minutes.
  if (!READ_ONLY) {
    every(FRONTIER_POLL_MS, 'frontier sync', async () => { await syncFrontierMatches(ready); });
  }

  // /testfriendly watch tick — strictly read-only, a free no-op unless armed,
  // so it runs even in READ_ONLY test mode.
  every(60_000, 'friendly test', () => pollFriendlyTest(ready), 15_000);

  // Jobs on the same cadence are phase-staggered so they never fire on the same
  // instant and fight over connections / the Discord rate limit during a busy
  // Frontier kickoff: notifier at :00, role sync at :30 (60s cadence); frontier
  // sync at :00, club tracker at :60 (120s cadence).

  // DM notifier (award wins, signups, kickoff reminders, drafts). Gated off in
  // test mode — DMs to real members are a write we must never make from a dry run.
  if (!READ_ONLY) {
    every(60_000, 'notifier', () => pollNotifier(ready, SITE_URL));
  }

  // Tracked community clubs (CASUAL → CLUBS): round-robin snapshot refresh.
  if (!READ_ONLY) {
    every(CLUB_TRACK_MS, 'club tracker', pollClubTracker, 60_000);
  }

  // Role mirror: signed-up role tracks the open Frontier's roster, punished
  // role tracks active suspensions. Assigning roles is a real-server write —
  // gated off in test mode like everything else.
  if (!READ_ONLY) {
    await syncRoles(guild).catch(e => console.error('[bot] role sync failed —', e));
    every(60_000, 'role sync', () => syncRoles(guild), 30_000);
  }
});

client.on(Events.GuildMemberAdd, member => {
  if (READ_ONLY || member.guild.id !== activeGuildId) return;
  onMemberAdd(member).catch(e => console.error('[bot] member add sync failed —', e));
});

client.on(Events.GuildMemberRemove, member => {
  if (READ_ONLY || member.guild.id !== activeGuildId) return;
  onMemberRemove(member).catch(e => console.error('[bot] member remove sync failed —', e));
});

client.on(Events.InteractionCreate, interaction => {
  if (interaction.guildId !== activeGuildId) return;
  void dispatch(interaction, { siteUrl: SITE_URL, readOnly: READ_ONLY });
});

// ── graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  console.log(`[bot] ${signal} — shutting down`);
  for (const t of timers) clearInterval(t);
  await client.destroy();
  await closeDb().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void client.login(token);
