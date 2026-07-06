import type { ChatInputCommandInteraction } from 'discord.js';
import { getLatestOpenTournament, getTournamentCaptains } from '@inazuma/db';

// /spinorder — the digital wheel. Shuffles the current Frontier's captains
// into a random pick order and spells out the snake, on the record in the
// channel — no more screen-sharing a spinner site mid-ceremony.

/** Fisher-Yates, unbiased — every order equally likely. */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function handleSpinOrder(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const tournament = await getLatestOpenTournament();
  if (!tournament) {
    await interaction.editReply('⚠ No open Frontier found — create the tournament on the site first (Admin → + NEW).');
    return;
  }

  const teams = (await getTournamentCaptains(tournament.id)).filter(t => t.captainId !== null);
  if (teams.length < 2) {
    await interaction.editReply(
      `⚠ **${tournament.name}** needs at least 2 teams with captains before the spin — ` +
      `assign captains on the site's Draft Board.`,
    );
    return;
  }

  const order = shuffle(teams);
  const picks = order.map((_, i) => i + 1);
  const forward = picks.join('·');
  const backward = [...picks].reverse().join('·');

  const lines = [
    `🎲 **DRAFT SPIN — ${tournament.name}** (Season ${tournament.season})`,
    '',
    ...order.map((t, i) => `**${i + 1}.** **${t.teamName}** — <@${t.captainId}>`),
    '',
    `🐍 Snake order: **R1** ${forward} → **R2** ${backward} → **R3** ${forward} → … keep snaking until squads are full.`,
  ];

  // Captains render as mentions but are NOT pinged — the ceremony channel is
  // already watching, and re-spins shouldn't spam anyone.
  await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
}
