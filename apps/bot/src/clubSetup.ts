import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { createTeam, getLatestOpenTournament } from '@inazuma/db';
import type { EaClubSummary } from './eaClient.js';

// Frontier club setup: /frontierclubstart opens a session for the current
// tournament ("how many teams?"), then each /findclub pick from the select
// menu claims a slot. When the last slot fills, one linked team per club is
// created on the tournament — named after the club, EA club bound — ready for
// drafting on the site and auto result ingestion when the Frontier goes live.

export const CLUB_PICK_ID = 'findclub:pick';

const SESSION_TTL_MS = 30 * 60_000;

type Session = {
  tournamentId: string;
  tournamentName: string;
  needed: number;
  picked: { clubId: string; name: string }[];
  startedBy: string; // discordId of the admin running the ceremony
  expiresAt: number;
};

let session: Session | null = null;

function activeSession(): Session | null {
  if (session && Date.now() > session.expiresAt) session = null;
  return session;
}

/** Start (or restart) the setup session. Returns the intro text. */
export async function startClubSession(needed: number, startedBy: string): Promise<string> {
  const tournament = await getLatestOpenTournament();
  if (!tournament) {
    return '⚠ No open Frontier found — create the tournament on the site first (Admin → + NEW), then run this again.';
  }

  session = {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    needed,
    picked: [],
    startedBy,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return (
    `⚡ **Frontier club setup — ${tournament.name}** (Season ${tournament.season})\n` +
    `Collecting **${needed} clubs**, one per team. For each captain's fresh club run ` +
    `**/findclub name:<club name>** and pick it from the menu.\n` +
    `Progress: **0/${needed}**. Session expires in 30 minutes; re-run /frontierclubstart to restart.`
  );
}

export function cancelClubSession(): boolean {
  const was = session !== null;
  session = null;
  return was;
}

export function clubSessionStatus(): string {
  const s = activeSession();
  if (!s) return 'No club setup session running. Start one with `/frontierclubstart`.';
  return (
    `⚡ Setting up **${s.tournamentName}** — ${s.picked.length}/${s.needed} clubs picked` +
    (s.picked.length > 0 ? `: ${s.picked.map(c => `**${c.name}**`).join(', ')}` : '') +
    `. Add more with /findclub.`
  );
}

/** The select menu shown under /findclub results. */
export function buildClubMenu(clubs: EaClubSummary[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = clubs.slice(0, 25).map(c => {
    const record = c.record ? `${c.record.wins}W/${c.record.ties}D/${c.record.losses}L` : null;
    const detailBits = [record, c.members != null ? `${c.members} members` : null, `ID ${c.clubId}`]
      .filter(Boolean)
      .join(' · ');
    return new StringSelectMenuOptionBuilder()
      // value carries id + name so the pick handler needs no extra lookup
      .setValue(`${c.clubId}::${c.name}`.slice(0, 100))
      .setLabel(c.name.slice(0, 100))
      .setDescription(detailBits.slice(0, 100));
  });

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CLUB_PICK_ID)
      .setPlaceholder('Select the club…')
      .addOptions(options),
  );
}

/** A club was picked from the menu. Inside a session it claims a slot (and
 *  completes the setup on the last one); outside, it just shows the details. */
export async function handleClubPick(
  interaction: StringSelectMenuInteraction,
  readOnly: boolean,
): Promise<void> {
  const [clubId, ...nameParts] = interaction.values[0].split('::');
  const name = nameParts.join('::') || `club ${clubId}`;

  const s = activeSession();
  if (!s) {
    await interaction.update({
      content: `**${name}** — EA Club ID \`${clubId}\`. Paste it into a team's EA Club field on the site, or run /frontierclubstart to set up a whole Frontier.`,
      components: [],
    });
    return;
  }

  if (s.picked.some(c => c.clubId === clubId)) {
    await interaction.update({
      content: `**${name}** is already picked for ${s.tournamentName} (${s.picked.length}/${s.needed}). Search the next club with /findclub.`,
      components: [],
    });
    return;
  }

  s.picked.push({ clubId, name });

  if (s.picked.length < s.needed) {
    await interaction.update({
      content:
        `✔ **${name}** locked in for **${s.tournamentName}** — **${s.picked.length}/${s.needed}**: ` +
        `${s.picked.map(c => c.name).join(', ')}.\nNext: /findclub for the next captain's club.`,
      components: [],
    });
    return;
  }

  // Last slot — create one linked team per club.
  session = null;
  if (readOnly) {
    await interaction.update({
      content: '⚠ Bot is in read-only test mode — clubs collected but no teams were created. Unset BOT_READ_ONLY for the real run.',
      components: [],
    });
    return;
  }

  const created: string[] = [];
  const failed: string[] = [];
  for (const club of s.picked) {
    try {
      await createTeam(s.startedBy, {
        tournamentId: s.tournamentId,
        name: club.name.slice(0, 50),
        memberPublicIds: [],
        eaClubId: club.clubId,
      });
      created.push(club.name);
    } catch (e) {
      console.error(`[clubsetup] team create failed for ${club.name} —`, e instanceof Error ? e.message : e);
      failed.push(club.name);
    }
  }

  await interaction.update({
    content:
      `🏟️ **${s.tournamentName} is set!** Created ${created.length} linked team${created.length === 1 ? '' : 's'}: ` +
      `${created.map(n => `**${n}**`).join(', ')}.` +
      (failed.length > 0 ? `\n⚠ Failed (create manually on the site): ${failed.join(', ')}.` : '') +
      `\nNext: draft players onto the teams on the site's Draft Board, set the Frontier **live**, and every friendly between these clubs auto-records.`,
    components: [],
  });
}
