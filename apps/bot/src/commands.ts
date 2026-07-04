import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Interaction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getUserByDiscordId, listAwardsForPlayer } from '@inazuma/db';
import { handleLeaderboard, handlePostLeaderboard } from './leaderboard.js';
import { resetAllNicknames, syncNicknames } from './nicknameSync.js';
import { snapshotVoiceChannel } from './voicePresence.js';

const definitions = [
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the current INAZUMA FC rankings'),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription("Show a player's profile card")
    .addUserOption(o => o.setName('user').setDescription('Player to look up (defaults to you)')),
  new SlashCommandBuilder()
    .setName('syncnicks')
    .setDescription('Admin: re-sync rank nicknames for everyone now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('postleaderboard')
    .setDescription('Admin: post the auto-updating rankings message in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('checkvc')
    .setDescription('Admin: snapshot a voice channel into the website draft pool')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Voice channel to check (defaults to the one you are in)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('resetnicknames')
    .setDescription("Admin: clear EVERYONE's nickname back to their Discord name (one-off cleanup)")
    .addBooleanOption(o =>
      o.setName('confirm')
        .setDescription('This clears every member’s nickname, including ones people set themselves')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

/** Guild-scoped registration — instant, and only needs the bot token. */
export async function registerCommands(client: Client<true>, guildId: string): Promise<void> {
  await client.application.commands.set(definitions.map(d => d.toJSON()), guildId);
  console.log(`[commands] registered ${definitions.length} slash commands for guild ${guildId}`);
}

async function handleProfile(
  interaction: ChatInputCommandInteraction,
  siteUrl: string,
): Promise<void> {
  await interaction.deferReply();

  const target = interaction.options.getUser('user') ?? interaction.user;
  const row = await getUserByDiscordId(target.id);

  if (!row || !row.initialised || row.isBlacklisted || !row.publicId) {
    await interaction.editReply(
      `**${target.globalName ?? target.username}** hasn't set up a profile yet — sign in at ${siteUrl} to join the league.`,
    );
    return;
  }

  const awards = await listAwardsForPlayer(row.publicId);
  const rankLine = row.provisional
    ? `Provisional — ${row.gamesPlayed}/5 placement games`
    : row.rank != null ? `Rank **#${row.rank}**` : 'Unranked';

  const accent = row.accentColor && /^#[0-9a-f]{6}$/i.test(row.accentColor)
    ? parseInt(row.accentColor.slice(1), 16)
    : 0xff7a1a;

  const embed = new EmbedBuilder()
    .setTitle(row.title ? `${row.displayName} — ${row.title}` : row.displayName)
    .setURL(`${siteUrl}/p/${row.publicId}`)
    .setDescription(
      [
        rankLine,
        `Elo **${Math.round(parseFloat(row.elo as unknown as string))}** · ${row.gamesPlayed} games`,
        awards.length > 0 ? `🏅 ${awards.length} award${awards.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join('\n'),
    )
    .setColor(accent)
    .setFooter({ text: `Full profile → ${siteUrl}/p/${row.publicId}` });

  if (row.avatarUrl) embed.setThumbnail(row.avatarUrl);

  await interaction.editReply({ embeds: [embed] });
}

async function handleCheckVc(
  interaction: ChatInputCommandInteraction,
  ctx: { siteUrl: string; readOnly: boolean },
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (ctx.readOnly) {
    await interaction.editReply('The bot is in read-only test mode — voice checks are disabled. Unset BOT_READ_ONLY to enable them.');
    return;
  }

  const guild = interaction.guild ?? await interaction.client.guilds.fetch(interaction.guildId!);

  // Target: the channel option if given, otherwise the caller's current voice channel.
  let channelId = interaction.options.getChannel('channel')?.id ?? null;
  if (!channelId) {
    const me = await guild.members.fetch(interaction.user.id).catch(() => null);
    channelId = me?.voice.channelId ?? null;
  }
  if (!channelId) {
    await interaction.editReply('Join a voice channel first, or pass one with the **channel** option.');
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) {
    await interaction.editReply('That channel is not a voice channel — pick a voice channel and try again.');
    return;
  }

  const result = await snapshotVoiceChannel(channel);
  if (result.total === 0) {
    await interaction.editReply(`🔇 **${result.channelName}** is empty — nobody to add to the draft pool.`);
    return;
  }

  const lines = [
    `📋 Checked **${result.channelName}** — **${result.total}** in voice.`,
    result.added > 0
      ? `Added **${result.added}** to the draft pool${result.alreadyPooled > 0 ? ` (${result.alreadyPooled} already staged).` : '.'}`
      : `Everyone was already in the pool (${result.alreadyPooled}).`,
    `Open the tournament's **Draft Board** on the site to build teams.`,
  ];
  await interaction.editReply(lines.join('\n'));
}

export async function dispatch(
  interaction: Interaction,
  ctx: { siteUrl: string; readOnly: boolean },
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) return;

  try {
    switch (interaction.commandName) {
      case 'leaderboard':
        await handleLeaderboard(interaction, ctx.siteUrl);
        break;
      case 'profile':
        await handleProfile(interaction, ctx.siteUrl);
        break;
      case 'postleaderboard':
        await handlePostLeaderboard(interaction, ctx.siteUrl, ctx.readOnly);
        break;
      case 'checkvc':
        await handleCheckVc(interaction, ctx);
        break;
      case 'syncnicks': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild ?? await interaction.client.guilds.fetch(interaction.guildId);
        const r = await syncNicknames(guild);
        await interaction.editReply(
          `Nicknames synced — ${r.renamed} renamed, ${r.skipped} already correct or unmanageable, ${r.failed} failed.`,
        );
        break;
      }
      case 'resetnicknames': {
        if (!interaction.options.getBoolean('confirm')) {
          await interaction.reply({
            content: 'Cancelled. Re-run with **confirm: True** to clear every member’s nickname back to their Discord name.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
        await interaction.deferReply();
        const guild = interaction.guild ?? await interaction.client.guilds.fetch(interaction.guildId);
        await interaction.editReply(
          'Clearing nicknames back to Discord display names — on a large server this can take several minutes. I’ll report back here when it’s done.',
        );
        const r = await resetAllNicknames(guild);
        const summary =
          `✅ Nickname reset complete — cleared **${r.cleared}**, left **${r.skipped}** untouched (I can’t rename the owner or members with a higher role), **${r.failed}** failed.\n` +
          'Now run **/syncnicks** to re-apply league ranks to your players.';
        try {
          await interaction.editReply(summary);
        } catch {
          // Interaction token can expire on a long sweep — post a fresh message instead.
          if (interaction.channel?.isSendable()) await interaction.channel.send(summary);
        }
        break;
      }
    }
  } catch (e) {
    console.error(`[commands] /${interaction.commandName} failed —`, e);
    const message = 'Something went wrong — try again in a minute.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // interaction expired — nothing left to do
    }
  }
}
