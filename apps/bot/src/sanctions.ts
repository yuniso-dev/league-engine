import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
  SANCTION_LABELS,
  getLatestOpenTournament,
  issueSanction,
  listActiveSanctions,
  pardonPlayer,
  type SanctionType,
} from '@inazuma/db';
import { syncRoles } from './roleSync.js';

// /punish, /pardon, /suspensions — the discipline ledger. A suspension blocks
// Frontier signups until it's served (each completed Frontier serves one unit;
// the offence tournament never serves its own) or pardoned. The role sync
// mirrors it onto the punished role; the notifier DMs the player both ways.

const rel = (d: Date): string => `<t:${Math.floor(d.getTime() / 1000)}:R>`;

/** Reconcile roles right away so the admin sees the effect, not "within a minute". */
function syncRolesNow(interaction: ChatInputCommandInteraction): void {
  const guild = interaction.guild;
  if (guild) void syncRoles(guild).catch(e => console.error('[roles] post-command sync failed —', e));
}

export async function handlePunish(
  interaction: ChatInputCommandInteraction,
  readOnly: boolean,
): Promise<void> {
  if (readOnly) {
    await interaction.reply({
      content: '⚠ Bot is in read-only test mode — suspensions write to the database. Unset BOT_READ_ONLY for the real run.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply();

  const target = interaction.options.getUser('user', true);
  const type = interaction.options.getString('type', true) as SanctionType;
  const reason = interaction.options.getString('reason')?.trim() || null;
  const frontiers = interaction.options.getInteger('frontiers') ?? undefined;

  // The open Frontier is the offence context — its own completion never
  // serves the ban, so "sits out the NEXT one" means exactly that.
  const open = await getLatestOpenTournament();

  let sanction;
  try {
    sanction = await issueSanction(interaction.user.id, {
      discordId: target.id,
      type,
      reason,
      frontiers,
      tournamentId: open?.id ?? null,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'Unknown player.') {
      await interaction.editReply(
        `**${target.username}** isn't in the league database yet — I only track members of this server.`,
      );
      return;
    }
    throw e;
  }

  syncRolesNow(interaction);
  const n = sanction.frontiersRemaining;
  await interaction.editReply({
    content:
      `🚫 **${sanction.displayName}** is suspended — sitting out **${n === 1 ? 'the next Frontier' : `the next ${n} Frontiers`}** ` +
      `(${SANCTION_LABELS[type]}${reason ? ` — ${reason}` : ''}).\n` +
      `Signups are blocked until it's served; the punished role and a DM follow within a minute. \`/pardon\` reverses it.`,
    allowedMentions: { parse: [] },
  });
}

export async function handlePardon(
  interaction: ChatInputCommandInteraction,
  readOnly: boolean,
): Promise<void> {
  if (readOnly) {
    await interaction.reply({
      content: '⚠ Bot is in read-only test mode — pardons write to the database. Unset BOT_READ_ONLY for the real run.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply();

  const target = interaction.options.getUser('user', true);
  const lifted = await pardonPlayer(interaction.user.id, target.id);

  if (lifted === 0) {
    await interaction.editReply({
      content: `**${target.username}** has no active suspension — nothing to pardon.`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  syncRolesNow(interaction);
  await interaction.editReply({
    content:
      `🕊️ **${target.username}** pardoned — lifted ${lifted === 1 ? 'their suspension' : `${lifted} suspensions`}. ` +
      `They can sign up again; the punished role clears and a DM follows within a minute.`,
    allowedMentions: { parse: [] },
  });
}

export async function handleSuspensions(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const active = await listActiveSanctions();
  if (active.length === 0) {
    await interaction.editReply('Nobody is suspended — a clean slate. 🕊️');
    return;
  }

  const lines = active.map(s =>
    `🚫 **${s.displayName}** — ${s.frontiersRemaining} Frontier${s.frontiersRemaining === 1 ? '' : 's'} left · ` +
    `${SANCTION_LABELS[s.type]}${s.reason ? ` — ${s.reason}` : ''}` +
    `${s.tournamentName ? ` · offence: ${s.tournamentName}` : ''} · issued ${rel(s.issuedAt)}`,
  );

  await interaction.editReply(
    `**ACTIVE SUSPENSIONS (${active.length})**\n${lines.join('\n')}\n\n` +
    `Bans serve themselves as Frontiers complete. \`/pardon\` lifts one early.`,
  );
}
