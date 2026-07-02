import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getConfig, getRankings, setRankingsRef, type PublicPlayer } from '@inazuma/db';

const GOLD = 0xffd24a;

/** Pure builder so the embed is identical in /leaderboard replies and the pinned message. */
export function buildLeaderboardEmbed(players: PublicPlayer[], siteUrl: string): EmbedBuilder {
  const top = players.slice(0, 15);

  const lines = top.length === 0
    ? ['No ranked players yet — play some Frontier matches!']
    : top.map(p => {
        const rank = p.provisional || p.rank == null ? '`P `' : `\`#${p.rank}\``;
        return `${rank} **${p.displayName}** — ${Math.round(p.elo)}`;
      });

  return new EmbedBuilder()
    .setTitle('⚡ INAZUMA FC — Rankings')
    .setDescription(lines.join('\n'))
    .setColor(GOLD)
    .setFooter({ text: `Full rankings → ${siteUrl}` })
    .setTimestamp();
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  await interaction.deferReply();
  const players = await getRankings();
  await interaction.editReply({ embeds: [buildLeaderboardEmbed(players, siteUrl)] });
}

/** Posts the embed in the current channel and remembers it — the bot keeps
 *  THIS message edited after every reveal (bots can only edit their own messages). */
export async function handlePostLeaderboard(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.channel;
  if (!channel || !channel.isSendable()) {
    await interaction.editReply('I can\'t post in this channel.');
    return;
  }

  const players = await getRankings();
  const message = await channel.send({ embeds: [buildLeaderboardEmbed(players, siteUrl)] });
  await setRankingsRef({ channelId: message.channelId, messageId: message.id });

  await interaction.editReply('Posted. This message will now update automatically after every reveal.');
}

/** Refresh the remembered rankings message. Silently skips when not configured;
 *  logs-and-continues when the message/channel was deleted or is inaccessible. */
export async function updateRankingsMessage(client: Client, siteUrl: string): Promise<void> {
  const cfg = await getConfig();
  if (!cfg.rankingsChannelId || !cfg.rankingsMessageId) return;

  try {
    const channel = await client.channels.fetch(cfg.rankingsChannelId);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(cfg.rankingsMessageId);
    const players = await getRankings();
    await message.edit({ embeds: [buildLeaderboardEmbed(players, siteUrl)] });
    console.log('[leaderboard] rankings message updated');
  } catch (e) {
    console.warn(
      '[leaderboard] could not update the rankings message (deleted, or missing access?) —',
      e instanceof Error ? e.message : e,
    );
  }
}
