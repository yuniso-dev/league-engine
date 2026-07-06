// INAZUMA FC Discord bot — Phase 5.
// Long-running gateway client: member sync, rank nicknames after each weekly
// reveal, /leaderboard + auto-updating rankings message, /profile.
// Needs an always-on host (see SETUP.md) — cannot run on Vercel.

// Before anything touches the DB: this process runs 24/7 against a
// memory-tight free-tier database, and every permanent connection costs it.
// The shared client default (4) suits bursty serverless, not us. Railway's
// DB_POOL_MAX env var still overrides.
process.env.DB_POOL_MAX ??= '2';

import { Client, Events, GatewayIntentBits, type Guild } from 'discord.js';
import { closeDb, getConfig } from '@inazuma/db';
import { registerCommands, dispatch } from './commands.js';
import { onMemberAdd, onMemberRemove, syncAllMembers } from './memberSync.js';
import { syncNicknames } from './nicknameSync.js';
import { updateRankingsMessage } from './leaderboard.js';
import { syncCasualMatches } from './casualSync.js';
import { syncFrontierMatches } from './frontierSync.js';

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
const CASUAL_POLL_MS = 10 * 60_000;   // EA Clubs API poll (unofficial API — be gentle)
const FRONTIER_POLL_MS = 2 * 60_000;  // live-tournament result ingest (no-op unless a linked Frontier is live)

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

/** Interval bodies must never kill the timer or the process on a transient error. */
function every(ms: number, label: string, fn: () => Promise<void>): void {
  timers.push(setInterval(() => {
    fn().catch(e => console.error(`[bot] ${label} failed —`, e));
  }, ms));
}

async function fullPass(guild: Guild): Promise<void> {
  if (!READ_ONLY) await syncAllMembers(guild); // member sync writes to the DB
  await syncNicknames(guild);                  // only edits nicknames in this guild — no DB writes
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
    await syncCasualMatches().catch(e => console.error('[bot] casual sync failed —', e));
    every(CASUAL_POLL_MS, 'casual sync', syncCasualMatches);
  }

  // Frontier automation: while a LIVE tournament has teams with EA clubs
  // linked, fill unscored fixtures from the EA API every couple of minutes.
  if (!READ_ONLY) {
    every(FRONTIER_POLL_MS, 'frontier sync', syncFrontierMatches);
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
