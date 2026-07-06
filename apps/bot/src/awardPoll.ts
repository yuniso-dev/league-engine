import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { HONOURS } from '@inazuma/core';
import { getLatestOpenTournament } from '@inazuma/db';

// /awardpoll — the two VOTED honours (Xavier Frost, Wallside's Award) are
// decided by the league in a native Discord poll. `start` posts a 24h poll in
// the invoking channel; `close` ends it, reads the counts, and announces the
// winner. The poll is advisory: the admin still picks the winner on the
// ceremony page, so a lost session (bot restart) never blocks the ceremony.

export type PollKind = 'pott' | 'defender';

const HONOUR_BY_KIND: Record<PollKind, { base: string; icon: string }> = {
  pott: HONOURS.find(h => h.key === 'pott')!,
  defender: HONOURS.find(h => h.key === 'bestDefender')!,
};

type PollSession = {
  channelId: string;
  messageId: string;
  /** In answer order — winner is mapped back by index, never by name. */
  nominees: { id: string; label: string }[];
  startedAt: number;
};

// One live poll per kind; lost on restart (see the close-path error message).
const active = new Map<PollKind, PollSession>();

export async function startAwardPoll(interaction: ChatInputCommandInteraction): Promise<void> {
  const kind = interaction.options.getString('kind', true) as PollKind;
  const honour = HONOUR_BY_KIND[kind];

  const nominees: { id: string; label: string }[] = [];
  for (const opt of ['nominee1', 'nominee2', 'nominee3', 'nominee4'] as const) {
    const user = interaction.options.getUser(opt);
    if (user && !nominees.some(n => n.id === user.id)) {
      nominees.push({ id: user.id, label: (user.displayName ?? user.username).slice(0, 55) });
    }
  }
  if (nominees.length < 2) {
    await interaction.reply({ content: 'Need at least 2 distinct nominees.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (active.has(kind)) {
    await interaction.reply({
      content: `A **${honour.base}** poll is already running — \`/awardpoll close kind:${kind}\` it first.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isSendable()) {
    await interaction.reply({ content: "I can't post in this channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const message = await channel.send({
    poll: {
      question: { text: `${honour.icon} ${honour.base} — vote for your winner` },
      answers: nominees.map(n => ({ text: n.label })),
      duration: 24, // hours
      allowMultiselect: false,
    },
  });

  active.set(kind, { channelId: channel.id, messageId: message.id, nominees, startedAt: Date.now() });
  await interaction.reply({
    content: `🗳️ **${honour.base}** poll is live for 24h with ${nominees.length} nominees. ` +
      `Close it any time with \`/awardpoll close kind:${kind}\`.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function closeAwardPoll(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  const kind = interaction.options.getString('kind', true) as PollKind;
  const honour = HONOUR_BY_KIND[kind];

  const session = active.get(kind);
  if (!session) {
    await interaction.reply({
      content: `No **${honour.base}** poll tracked. If the bot restarted since the poll was posted, ` +
        `end it manually (right-click the poll → End Poll) and read the winner off the message — ` +
        `then pick them on the ceremony page.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const channel = await interaction.client.channels.fetch(session.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    active.delete(kind);
    await interaction.editReply('The poll channel is gone — session cleared.');
    return;
  }
  const message = await channel.messages.fetch(session.messageId).catch(() => null);
  if (!message?.poll) {
    active.delete(kind);
    await interaction.editReply('The poll message is gone — session cleared. Pick the winner on the ceremony page.');
    return;
  }

  // End it (if still running) and read counts from the RETURNED message —
  // the pre-end object holds stale vote counts.
  const finalMessage = message.poll.resultsFinalized ? message : await message.poll.end();
  const answers = [...(finalMessage.poll?.answers.values() ?? [])];

  // Map winner(s) back by answer index — answers keep insertion order.
  const counts = answers.map((a, i) => ({
    nominee: session.nominees[i],
    votes: a.voteCount,
  })).filter(c => c.nominee);
  const maxVotes = Math.max(0, ...counts.map(c => c.votes));
  const winners = counts.filter(c => c.votes === maxVotes && maxVotes > 0);

  active.delete(kind);

  if (winners.length === 0) {
    await interaction.editReply(`🗳️ **${honour.base}** poll closed — nobody voted. Decide it the old way.`);
    return;
  }

  const tournament = await getLatestOpenTournament().catch(() => null);
  const ceremonyLink = tournament
    ? `\nLock it in on the ceremony page: ${siteUrl}/admin/tournaments/${tournament.id}/awards`
    : '';
  const winnerLine = winners.length === 1
    ? `<@${winners[0].nominee.id}> wins with **${maxVotes}** vote${maxVotes === 1 ? '' : 's'}`
    : `TIE at **${maxVotes}** votes: ${winners.map(w => `<@${w.nominee.id}>`).join(' vs ')} — organiser's call`;

  await interaction.editReply({
    content: `🗳️ **${honour.icon} ${honour.base}** poll closed — ${winnerLine}.${ceremonyLink}`,
    allowedMentions: { parse: [] }, // announce without pinging the winners
  });
}
