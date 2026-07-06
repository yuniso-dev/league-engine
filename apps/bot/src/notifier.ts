import type { Client } from 'discord.js';
import { getLatestOpenTournament, getNewAwardGrants, getNewSignups, getTeamMemberKeys } from '@inazuma/db';

// DM notifier — polls the database for things players should hear about
// directly: award wins, signup confirmations, and being drafted onto a team.
// Watermarks are seeded to boot time so a restart NEVER replays history into
// people's DMs. Award DMs are deliberately not gated on an open tournament —
// ceremonies run after a Frontier completes.

let awardsSince = new Date();
let signupsSince = new Date();
/** `${teamId}:${userId}` roster snapshot; null = needs (re)seeding, so the
 *  first pass after boot or a new tournament never DMs the whole roster. */
let teamKeys: Set<string> | null = null;

async function dm(client: Client<true>, discordId: string, text: string): Promise<void> {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(text);
  } catch (e) {
    // Closed DMs are common and fine — log and move on.
    console.log(`[notifier] DM to ${discordId} failed — ${e instanceof Error ? e.message : e}`);
  }
}

/** 60s tick. A few cheap indexed queries when nothing happened. */
export async function pollNotifier(client: Client<true>, siteUrl: string): Promise<void> {
  // ── Award wins (always on) ──────────────────────────────────────────────
  const grants = await getNewAwardGrants(awardsSince);
  if (grants.length > 0) {
    // Advance BEFORE sending — a failed DM must never cause a re-send loop.
    awardsSince = grants[grants.length - 1].awardedAt;
    for (const grant of grants) {
      const cabinet = grant.publicId ? `\nYour trophy cabinet: ${siteUrl}/p/${grant.publicId}` : '';
      await dm(
        client,
        grant.discordId,
        `🏆 You've won **${grant.awardName}**${grant.awardIcon ? ` ${grant.awardIcon}` : ''} — congratulations!${cabinet}`,
      );
    }
    console.log(`[notifier] sent ${grants.length} award DM${grants.length === 1 ? '' : 's'}`);
  }

  // ── Signups + drafts only matter while a Frontier is open ───────────────
  const open = await getLatestOpenTournament();
  if (!open) {
    teamKeys = null; // next tournament reseeds silently instead of DM-flooding its roster
    return;
  }

  const signups = await getNewSignups(signupsSince);
  if (signups.length > 0) {
    signupsSince = signups[signups.length - 1].signedUpAt;
    for (const s of signups) {
      await dm(client, s.discordId, `✅ You're signed up for **${s.tournamentName}** — see you on the Frontier!`);
    }
    console.log(`[notifier] sent ${signups.length} signup DM${signups.length === 1 ? '' : 's'}`);
  }

  // team_members has no timestamp — diff roster snapshots instead. New keys
  // are fresh drafts (or mid-tournament sub swaps: exactly one DM each).
  const roster = await getTeamMemberKeys();
  const current = new Set(roster.map(r => `${r.teamId}:${r.userId}`));
  if (teamKeys === null) {
    teamKeys = current; // seed pass — no DMs
    return;
  }
  let drafted = 0;
  for (const r of roster) {
    if (teamKeys.has(`${r.teamId}:${r.userId}`)) continue;
    drafted++;
    await dm(
      client,
      r.userId,
      `⚡ You're on **${r.teamName}**! Head to the **${r.teamName}** voice channel when your team plays.`,
    );
  }
  teamKeys = current;
  if (drafted > 0) console.log(`[notifier] sent ${drafted} drafted DM${drafted === 1 ? '' : 's'}`);
}
