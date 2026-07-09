import type { Client } from 'discord.js';
import {
  SANCTION_LABELS,
  getDueReminders,
  getLatestOpenTournament,
  getNewAwardGrants,
  getUnnotifiedSignups,
  getTeamMemberKeys,
  listActiveSanctions,
  markReminderSent,
  markSignupsNotified,
  type PlayerSanction,
} from '@inazuma/db';

// DM notifier — polls the database for things players should hear about
// directly: award wins, signup confirmations, and being drafted onto a team.
// Watermarks are seeded to boot time so a restart NEVER replays history into
// people's DMs. Award DMs are deliberately not gated on an open tournament —
// ceremonies run after a Frontier completes.

let awardsSince = new Date();
/** `${teamId}:${userId}` roster snapshot; null = needs (re)seeding, so the
 *  first pass after boot or a new tournament never DMs the whole roster. */
let teamKeys: Set<string> | null = null;
/** Active suspensions by sanction id; null = seed on the first pass (no DMs
 *  on restart). New id → "you're suspended"; vanished id → "you're back". */
let sanctions: Map<string, PlayerSanction> | null = null;

// ── Outbound DM queue ───────────────────────────────────────────────────────
// A Frontier kickoff used to fire ~25 reminder DMs + ~25 drafted DMs in a
// single tick — a burst that saturates Discord's global rate limit and leaves
// slash-command replies stuck behind it ("thinking…" forever). Instead we
// DETECT once (advancing every watermark/flag immediately, so nothing re-sends
// or duplicates) and ENQUEUE, then deliver a small batch each tick. The backlog
// drains over a couple of minutes; a restart just drops the queue (DMs are
// best-effort, and the state already moved on, so nothing replays).
const dmQueue: Array<{ discordId: string; text: string }> = [];
const MAX_DMS_PER_TICK = 10;
const MAX_QUEUE = 500; // safety bound; real bursts are far smaller

function enqueueDm(discordId: string, text: string): void {
  if (dmQueue.length >= MAX_QUEUE) return;
  dmQueue.push({ discordId, text });
}

async function drainDmQueue(client: Client<true>): Promise<void> {
  const batch = dmQueue.splice(0, MAX_DMS_PER_TICK);
  for (const d of batch) await sendDm(client, d.discordId, d.text);
  if (batch.length > 0) {
    console.log(`[notifier] delivered ${batch.length} DM${batch.length === 1 ? '' : 's'}${dmQueue.length ? ` (${dmQueue.length} still queued)` : ''}`);
  }
}

/** Fire-and-forget DM — closed DMs are common and fine, so failures only log.
 *  Shared by the notifier ticks and the frontier sync's admin alerts. */
export async function sendDm(client: Client<true>, discordId: string, text: string): Promise<void> {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(text);
  } catch (e) {
    console.log(`[notifier] DM to ${discordId} failed — ${e instanceof Error ? e.message : e}`);
  }
}

/** 60s tick. A few cheap indexed queries when nothing happened. */
export async function pollNotifier(client: Client<true>, siteUrl: string): Promise<void> {
  // ── Award wins (always on) ──────────────────────────────────────────────
  const grants = await getNewAwardGrants(awardsSince);
  if (grants.length > 0) {
    // Advance BEFORE queueing — a detection must never re-fire on the next tick.
    awardsSince = grants[grants.length - 1].awardedAt;
    for (const grant of grants) {
      const cabinet = grant.publicId ? `\nYour trophy cabinet: ${siteUrl}/p/${grant.publicId}` : '';
      enqueueDm(
        grant.discordId,
        `🏆 You've won **${grant.awardName}**${grant.awardIcon ? ` ${grant.awardIcon}` : ''} — congratulations!${cabinet}`,
      );
    }
    console.log(`[notifier] queued ${grants.length} award DM${grants.length === 1 ? '' : 's'}`);
  }

  // ── Suspensions (always on — issued, served, and pardoned regardless of
  //    an open Frontier: bans serve themselves when one COMPLETES) ─────────
  const activeSanctions = await listActiveSanctions();
  const activeNow = new Map(activeSanctions.map(s => [s.id, s]));
  if (sanctions === null) {
    sanctions = activeNow; // seed pass — a restart never re-announces old bans
  } else {
    for (const [id, s] of activeNow) {
      if (sanctions.has(id)) continue;
      const n = s.frontiersRemaining;
      enqueueDm(
        s.discordId,
        `🚫 You've been suspended from the Frontier — you're sitting out ${n === 1 ? '**the next tournament**' : `**the next ${n} tournaments**`} ` +
        `(${SANCTION_LABELS[s.type].toLowerCase()}${s.reason ? `: ${s.reason}` : ''}). ` +
        `Signups are blocked until it's served. If you think this is wrong, talk to an admin.`,
      );
    }
    for (const [id, s] of sanctions) {
      if (activeNow.has(id)) continue;
      enqueueDm(
        s.discordId,
        `🕊️ Your Frontier suspension has ended — you're eligible to sign up again. Welcome back.`,
      );
    }
    sanctions = activeNow;
  }

  // ── Signup confirmations — one DM per signup, ever (notified flag) ──────
  // Marked BEFORE sending so a mid-batch crash can't re-DM the whole list.
  const signups = await getUnnotifiedSignups();
  if (signups.length > 0) {
    await markSignupsNotified(signups.map(s => s.signupId));
    for (const s of signups) {
      // No EA ID linked = their goals/assists/rating won't attach when the bot
      // pulls the game from EA. Nudge them right in the confirmation.
      const eaNote = s.eaLinked
        ? ''
        : `\n\n⚠️ **Link your EA ID** at ${siteUrl}/settings so your match stats count — without it, your goals, assists and rating won't attach.`;
      enqueueDm(s.discordId, `✅ You're signed up for **${s.tournamentName}** — see you on the Frontier!${eaNote}`);
    }
    console.log(`[notifier] queued ${signups.length} signup DM${signups.length === 1 ? '' : 's'}`);
  }

  // ── Kickoff reminders — fired once when start_time is within 15 min ──────
  // A live Discord timestamp (<t:UNIX:R>) renders the correct "in N minutes"
  // for each reader in their own timezone — and stays right even if the DM is
  // delivered a little late (drained from the queue, or after a bot restart).
  const reminders = await getDueReminders();
  for (const r of reminders) {
    await markReminderSent(r.tournamentId);
    const unix = Math.floor(r.startTime.getTime() / 1000);
    for (const discordId of r.discordIds) {
      enqueueDm(discordId, `⏰ **${r.tournamentName}** kicks off <t:${unix}:R> (<t:${unix}:t>) — get in the Discord voice channel!`);
    }
    console.log(`[notifier] queued ${r.discordIds.length} kickoff reminder${r.discordIds.length === 1 ? '' : 's'} for ${r.tournamentName}`);
  }

  // ── Drafts only matter while a Frontier is open ─────────────────────────
  const open = await getLatestOpenTournament();
  if (!open) {
    teamKeys = null; // next tournament reseeds silently instead of DM-flooding its roster
  } else {
    // team_members has no timestamp — diff roster snapshots instead. New keys
    // are fresh drafts (or mid-tournament sub swaps: exactly one DM each).
    const roster = await getTeamMemberKeys();
    const current = new Set(roster.map(r => `${r.teamId}:${r.userId}`));
    if (teamKeys === null) {
      teamKeys = current; // seed pass — no DMs
    } else {
      let drafted = 0;
      for (const r of roster) {
        if (teamKeys.has(`${r.teamId}:${r.userId}`)) continue;
        drafted++;
        enqueueDm(
          r.userId,
          `⚡ You're on **${r.teamName}**! Head to the **${r.teamName}** voice channel when your team plays.`,
        );
      }
      teamKeys = current;
      if (drafted > 0) console.log(`[notifier] queued ${drafted} drafted DM${drafted === 1 ? '' : 's'}`);
    }
  }

  // Deliver a small, rate-limit-friendly batch — the rest goes next tick.
  await drainDmQueue(client);
}
