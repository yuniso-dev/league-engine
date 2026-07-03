import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  MessageFlags,
} from 'discord.js';
import { flagEmoji } from '@inazuma/core';
import { getConfig, getRankings, setRankingsRef, type PublicPlayer } from '@inazuma/db';

const GOLD = 0xffd24a;
const MEDALS = ['🥇', '🥈', '🥉'];

/** Pure builder so the embed is identical in /leaderboard replies and the pinned
 *  message. Ranks + flags, no Elo (the owner wants the numbers to stay on-site). */
export function buildLeaderboardEmbed(
  players: PublicPlayer[],
  siteUrl: string,
  guild?: Guild | null,
): EmbedBuilder {
  const ranked = players.filter(p => !p.provisional && p.rank != null).slice(0, 15);

  const lines = ranked.length === 0
    ? ['No ranked players yet — play some Frontier matches!']
    : ranked.map(p => {
        const medal = p.rank! <= 3 ? MEDALS[p.rank! - 1] : `\`#${String(p.rank).padStart(2, ' ')}\``;
        const flag = flagEmoji(p.country);
        return `${medal} ${flag ? `${flag} ` : ''}**${p.displayName}**${p.title ? ` — *${p.title}*` : ''}`;
      });

  const embed = new EmbedBuilder()
    .setTitle('⚡ INAZUMA FC — RANKINGS')
    .setDescription(lines.join('\n'))
    .setColor(GOLD)
    .setFooter({ text: `Full rankings, profiles & history → ${siteUrl}` })
    .setTimestamp();

  const banner = guild?.bannerURL({ size: 1024 });
  if (banner) embed.setImage(banner);
  const icon = guild?.iconURL({ size: 128 });
  if (icon) embed.setThumbnail(icon);

  return embed;
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  await interaction.deferReply();
  const players = await getRankings();
  await interaction.editReply({
    embeds: [buildLeaderboardEmbed(players, siteUrl, interaction.guild)],
  });
}

/** Posts the embed in the current channel and remembers it — the bot keeps
 *  THIS message edited after every reveal (bots can only edit their own messages). */
export async function handlePostLeaderboard(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
  readOnly = false,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.channel;
  if (!channel || !channel.isSendable()) {
    await interaction.editReply('I can\'t post in this channel.');
    return;
  }

  const players = await getRankings();
  const message = await channel.send({
    embeds: [buildLeaderboardEmbed(players, siteUrl, interaction.guild)],
  });

  if (readOnly) {
    // Test mode: don't persist the rankings-message reference to the shared config.
    await interaction.editReply('Posted (test mode) — not saved as the auto-updating message.');
    return;
  }

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
    const guild = cfg.guildId
      ? await client.guilds.fetch(cfg.guildId).catch(() => null)
      : null;
    await message.edit({ embeds: [buildLeaderboardEmbed(players, siteUrl, guild)] });
    console.log('[leaderboard] rankings message updated');
  } catch (e) {
    console.warn(
      '[leaderboard] could not update the rankings message (deleted, or missing access?) —',
      e instanceof Error ? e.message : e,
    );
  }
}
