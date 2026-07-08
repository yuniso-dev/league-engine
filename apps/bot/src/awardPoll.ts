import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { HONOURS } from '@inazuma/core';
import { getPottNominees } from '@inazuma/db';

// /awardpoll — Xavier Frost is the only voted honour. `start` auto-nominates
// the tournament's TOP 4 players by average rating (min 3 games) and posts a
// 24h native Discord poll; `close` ends it, reads the counts, and announces the
// winner. The poll is advisory — the admin still locks the winner in on the
// ceremony page, so a lost session (bot restart) never blocks the ceremony.

const POTT = HONOURS.find(h => h.key === 'pott')!;

type PollSession = {
  channelId: string;
  messageId: string;
  tournamentId: string;
  /** In answer order — winner is mapped back by index, never by name. */
  nominees: { id: string; label: string }[];
  startedAt: number;
};

// One live poll; lost on restart (see the close-path error message).
let active: PollSession | null = null;

export async function startAwardPoll(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pool = await getPottNominees();
  if (!pool || pool.nominees.length < 2) {
    await interaction.editReply(
      'Not enough rated games yet — the Xavier Frost poll runs across the top 4 players with **3+ rated games**. ' +
      'Play more of the Frontier and try again.',
    );
    return;
  }

  if (active) {
    await interaction.editReply('A Xavier Frost poll is already running — `/awardpoll close` it first.');
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isSendable()) {
    await interaction.editReply("I can't post in this channel.");
    return;
  }

  const nominees = pool.nominees.map(n => ({ id: n.discordId, label: n.displayName.slice(0, 55) }));
  const message = await channel.send({
    poll: {
      question: { text: `${POTT.icon} ${POTT.base} — vote for the Player of the Tournament` },
      answers: nominees.map(n => ({ text: n.label })),
      duration: 24, // hours
      allowMultiselect: false,
    },
  });

  active = { channelId: channel.id, messageId: message.id, tournamentId: pool.tournamentId, nominees, startedAt: Date.now() };
  await interaction.editReply(
    `🗳️ **${POTT.base}** poll is live for 24h — the top ${nominees.length} by average rating in **${pool.tournamentName}**. ` +
    'Close it any time with `/awardpoll close`.',
  );
}

export async function closeAwardPoll(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  const session = active;
  if (!session) {
    await interaction.reply({
      content: 'No Xavier Frost poll tracked. If the bot restarted since the poll was posted, ' +
        'end it manually (right-click the poll → End Poll) and read the winner off the message — ' +
        'then pick them on the ceremony page.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const channel = await interaction.client.channels.fetch(session.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    active = null;
    await interaction.editReply('The poll channel is gone — session cleared.');
    return;
  }
  const message = await channel.messages.fetch(session.messageId).catch(() => null);
  if (!message?.poll) {
    active = null;
    await interaction.editReply('The poll message is gone — session cleared. Pick the winner on the ceremony page.');
    return;
  }

  // End it (if still running) and read counts from the RETURNED message —
  // the pre-end object holds stale vote counts.
  const finalMessage = message.poll.resultsFinalized ? message : await message.poll.end();
  const answers = [...(finalMessage.poll?.answers.values() ?? [])];

  const counts = answers
    .map((a, i) => ({ nominee: session.nominees[i], votes: a.voteCount }))
    .filter(c => c.nominee);
  const maxVotes = Math.max(0, ...counts.map(c => c.votes));
  const winners = counts.filter(c => c.votes === maxVotes && maxVotes > 0);

  const ceremonyLink = `\nLock it in on the ceremony page: ${siteUrl}/admin/tournaments/${session.tournamentId}/awards`;
  active = null;

  if (winners.length === 0) {
    await interaction.editReply(`🗳️ **${POTT.base}** poll closed — nobody voted. Decide it the old way.`);
    return;
  }

  const winnerLine = winners.length === 1
    ? `<@${winners[0].nominee.id}> wins with **${maxVotes}** vote${maxVotes === 1 ? '' : 's'}`
    : `TIE at **${maxVotes}** votes: ${winners.map(w => `<@${w.nominee.id}>`).join(' vs ')} — organiser's call`;

  await interaction.editReply({
    content: `🗳️ **${POTT.icon} ${POTT.base}** poll closed — ${winnerLine}.${ceremonyLink}`,
    allowedMentions: { parse: [] }, // announce without pinging the winners
  });
}
