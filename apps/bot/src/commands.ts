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
import { getConfig, getLinkedLiveTournaments, getUserByDiscordId, listAwardsForPlayer } from '@inazuma/db';
import { handleLeaderboard, handlePostLeaderboard } from './leaderboard.js';
import { resetAllNicknames, syncNicknames } from './nicknameSync.js';
import { snapshotVoiceChannel } from './voicePresence.js';
import { fetchClubsInfo, searchClubs } from './eaClient.js';
import { armFriendlyTest, disarmFriendlyTest, friendlyTestStatus, resolveClub } from './friendlyTest.js';
import { CLUB_PICK_ID, armClubMenuTimeout, buildClubMenu, cancelClubSession, clubSessionStatus, handleClubPick, startClubSession } from './clubSetup.js';
import { closeAwardPoll, startAwardPoll } from './awardPoll.js';
import { handleSpinOrder } from './spinOrder.js';
import { handleFrontierIntro } from './frontierIntro.js';
import { frontierWatchState, syncFrontierMatches } from './frontierSync.js';

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
    .setName('findclub')
    .setDescription('Admin: search EA clubs by name (or ID) and pick from a menu')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Club name (or part of it) — or paste the numeric club ID')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('frontierclubstart')
    .setDescription('Admin: set up the Frontier — pick each team’s club and linked teams are created')
    .addSubcommand(s =>
      s.setName('begin')
        .setDescription('Start collecting clubs for the current Frontier')
        .addIntegerOption(o =>
          o.setName('teams')
            .setDescription('How many teams are playing (2–8)')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(8)))
    .addSubcommand(s =>
      s.setName('status').setDescription('Show the club-setup progress'))
    .addSubcommand(s =>
      s.setName('cancel').setDescription('Cancel the club-setup session'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('testfriendly')
    .setDescription('Admin: READ-ONLY test — watch two clubs and report their next friendly here')
    .addSubcommand(s =>
      s.setName('watch')
        .setDescription('Arm the test: play one friendly between the two clubs and the stats appear here')
        .addStringOption(o =>
          o.setName('club1').setDescription('First club — EA club ID or club name').setRequired(true))
        .addStringOption(o =>
          o.setName('club2').setDescription('Second club — EA club ID or club name').setRequired(true)))
    .addSubcommand(s =>
      s.setName('status').setDescription('Is a friendly test armed right now?'))
    .addSubcommand(s =>
      s.setName('stop').setDescription('Disarm the friendly test'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('resetnicknames')
    .setDescription("Admin: clear EVERYONE's nickname back to their Discord name (one-off cleanup)")
    .addBooleanOption(o =>
      o.setName('confirm')
        .setDescription('This clears every member’s nickname, including ones people set themselves')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('awardpoll')
    .setDescription('Admin: run the voted-honour polls (Xavier Frost / Wallside’s Award)')
    .addSubcommand(s =>
      s.setName('start')
        .setDescription('Post a 24h native poll for a voted honour in this channel')
        .addStringOption(o =>
          o.setName('kind').setDescription('Which honour').setRequired(true)
            .addChoices(
              { name: 'Xavier Frost — Player of the Tournament', value: 'pott' },
              { name: "Wallside's Award — Best Defender", value: 'defender' },
            ))
        .addUserOption(o => o.setName('nominee1').setDescription('First nominee').setRequired(true))
        .addUserOption(o => o.setName('nominee2').setDescription('Second nominee').setRequired(true))
        .addUserOption(o => o.setName('nominee3').setDescription('Third nominee'))
        .addUserOption(o => o.setName('nominee4').setDescription('Fourth nominee')))
    .addSubcommand(s =>
      s.setName('close')
        .setDescription('End the poll and announce the winner')
        .addStringOption(o =>
          o.setName('kind').setDescription('Which honour').setRequired(true)
            .addChoices(
              { name: 'Xavier Frost — Player of the Tournament', value: 'pott' },
              { name: "Wallside's Award — Best Defender", value: 'defender' },
            )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('spinorder')
    .setDescription('Admin: spin the wheel — random captain order + the snake draft sequence')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('frontierstatus')
    .setDescription('Admin: health check — EA polling state, linked clubs, unscored fixtures')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('frontiersync')
    .setDescription('Admin: force an EA poll pass right now (e.g. after a bot restart)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('frontierintro')
    .setDescription('Admin: draft the Frontier intro post (captains, honours, rules, signup link)')
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
    ? `Provisional — ${row.gamesPlayed}/${(await getConfig()).placementGames} placement games`
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

const rel = (d: Date | null): string => (d ? `<t:${Math.floor(d.getTime() / 1000)}:R>` : '—');

async function handleFrontierStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [tournaments, cfg] = await Promise.all([getLinkedLiveTournaments(), getConfig()]);
  const w = frontierWatchState();

  const eaLine = w.eaDownAlerted
    ? `🔌 **DOWN** — ${w.consecutiveDownPasses} failing passes (admins alerted)`
    : w.consecutiveDownPasses > 0
      ? `⚠️ shaky — ${w.consecutiveDownPasses} failing pass${w.consecutiveDownPasses === 1 ? '' : 'es'}`
      : '✅ healthy';

  const lines = [
    '🩺 **FRONTIER SYNC STATUS**',
    `Polling every 2 min on \`${w.matchTypes.join(', ')}\` · platform \`${cfg.eaPlatform || 'common-gen5'}\``,
    `Last pass: ${rel(w.lastPassAt)} · last EA success: ${rel(w.lastEaSuccessAt)}`,
    `EA API: ${eaLine}`,
    `Last auto-record: ${w.lastIngest ? `**${w.lastIngest.line}** ${rel(w.lastIngest.at)}` : 'none since the bot started'}`,
    '',
    tournaments.length === 0
      ? 'No live tournament with ≥2 linked clubs — polling is idle. (Counters reset when the bot restarts.)'
      : tournaments
          .map(t => {
            const oldest = t.unscoredFixtures[0];
            return (
              `⚡ **${t.tournamentName}** — ${t.clubs.length} linked clubs · ` +
              `${t.unscoredFixtures.length} unscored fixture${t.unscoredFixtures.length === 1 ? '' : 's'}` +
              (oldest ? ` (oldest created ${rel(oldest.createdAt)})` : '')
            );
          })
          .join('\n'),
  ];

  await interaction.editReply(lines.join('\n'));
}

async function handleFrontierSyncNow(
  interaction: ChatInputCommandInteraction,
  readOnly: boolean,
): Promise<void> {
  if (readOnly) {
    await interaction.reply({
      content: '⚠ Bot is in read-only test mode — a forced sync would write results. Unset BOT_READ_ONLY for the real run.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const s = await syncFrontierMatches(interaction.client);
  await interaction.editReply(
    s.liveTournaments === 0
      ? 'Nothing to poll — no live tournament has ≥2 EA-linked clubs. (Link clubs on the teams, set the Frontier live.)'
      : `Forced a pass: ${s.liveTournaments} live tournament${s.liveTournaments === 1 ? '' : 's'}, ` +
        `${s.clubsPolled} clubs polled, ${s.fetchAttempts} EA fetches` +
        `${s.fetchFailures > 0 ? ` (⚠ ${s.fetchFailures} failed)` : ''}, ` +
        `**${s.ingested} result${s.ingested === 1 ? '' : 's'} ingested**.` +
        (s.ingested === 0 && s.fetchFailures === 0 ? ' No new games between linked clubs since the last pass.' : ''),
  );
}

async function handleFindClub(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = interaction.options.getString('name', true).trim();
  const cfg = await getConfig();
  const platform = cfg.eaPlatform || 'common-gen5';

  // A pasted numeric ID skips EA search entirely — EA's search index misses
  // some clubs (usually small/new ones) that still fully exist by ID, and
  // their own website has the same blind spot.
  if (/^\d{1,12}$/.test(name)) {
    const info = await fetchClubsInfo([name], platform);
    const found = info.get(name);
    if (!found) {
      await interaction.editReply(
        `EA returned no club for ID **${name}** on \`${platform}\` — double-check the ID (or EA may be temporarily unreachable).`,
      );
      return;
    }
    const reply = await interaction.editReply({
      content: `🔎 Club ID **${name}** → **${found.name}** — select it to confirm:`,
      components: [buildClubMenu([{ clubId: name, name: found.name, members: null, record: null, stadium: null }])],
    });
    armClubMenuTimeout(interaction, reply.id, name);
    return;
  }

  let clubs;
  try {
    clubs = await searchClubs(name, platform);
  } catch (e) {
    // Surface the REAL failure (status code etc.) instead of the generic error.
    await interaction.editReply(
      `EA club search failed: \`${e instanceof Error ? e.message : e}\`\n` +
      `If this keeps happening EA may be rate-limiting or blocking the host — ` +
      `you can always use the numeric club ID directly (it's in the club page URL on EA's Pro Clubs site).`,
    );
    return;
  }

  if (clubs.length === 0) {
    await interaction.editReply(
      `No EA club matching **${name}** on \`${platform}\`. ` +
      `Try more (or fewer) letters of the club's in-game name — or paste the numeric club ID into /findclub. ` +
      `(EA's search index misses some small/new clubs; their own site has the same gap.)`,
    );
    return;
  }

  const reply = await interaction.editReply({
    content: `🔎 ${clubs.length} club${clubs.length === 1 ? '' : 's'} matching **${name}** — select the right one (menu expires in 2 minutes):`,
    components: [buildClubMenu(clubs)],
  });
  armClubMenuTimeout(interaction, reply.id, name);
}

async function handleFrontierClubStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    await interaction.reply({ content: clubSessionStatus(), flags: MessageFlags.Ephemeral });
    return;
  }
  if (sub === 'cancel') {
    const was = cancelClubSession();
    await interaction.reply({
      content: was ? 'Club setup cancelled.' : 'No session was running.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // begin
  await interaction.deferReply();
  const teams = interaction.options.getInteger('teams', true);
  await interaction.editReply(await startClubSession(teams, interaction.user.id));
}

async function handleTestFriendly(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const w = friendlyTestStatus();
    await interaction.reply({
      content: w
        ? `🧪 Armed: **${w.clubA.name}** vs **${w.clubB.name}** — watching since <t:${Math.floor(w.armedAt / 1000)}:R>, ${w.polls} poll${w.polls === 1 ? '' : 's'} so far. Play the friendly and the report lands in <#${w.channelId}>.`
        : 'No friendly test armed. Start one with `/testfriendly watch`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'stop') {
    const was = disarmFriendlyTest();
    await interaction.reply({
      content: was ? '🧪 Friendly test disarmed.' : 'Nothing was armed.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // watch
  await interaction.deferReply();
  const cfg = await getConfig();
  const platform = cfg.eaPlatform || 'common-gen5';

  const [resA, resB] = await Promise.all([
    resolveClub(interaction.options.getString('club1', true), platform),
    resolveClub(interaction.options.getString('club2', true), platform),
  ]);
  if (!resA.ok || !resB.ok) {
    const problems = [
      !resA.ok ? `**club1**: ${resA.error}` : null,
      !resB.ok ? `**club2**: ${resB.error}` : null,
    ].filter(Boolean);
    await interaction.editReply(problems.join('\n'));
    return;
  }
  const clubA = { id: resA.id, name: resA.name };
  const clubB = { id: resB.id, name: resB.name };
  if (clubA.id === clubB.id) {
    await interaction.editReply('Those are the same club — pass two different clubs.');
    return;
  }

  const probe = await armFriendlyTest(clubA, clubB, interaction.channelId);
  const probeLines = probe.map(p =>
    p.ok
      ? `\`${p.matchType}\` ✅ endpoint OK (${p.count} recent on record)`
      : `\`${p.matchType}\` ❌ ${p.error ?? 'failed'}`,
  );

  await interaction.editReply(
    `🧪 **Friendly test armed** — **${clubA.name}** (\`${clubA.id}\`) vs **${clubB.name}** (\`${clubB.id}\`)\n\n` +
    `Endpoint probe (does EA serve each match type for ${clubA.name}?):\n${probeLines.join('\n')}\n\n` +
    `Now **play one friendly between the two clubs and let it fully finish**. I check every 60 seconds — ` +
    `when the game shows up, the full stat report appears in this channel. ` +
    `**Read-only: nothing is written to the site.** Auto-expires in 2 hours; \`/testfriendly stop\` to cancel.`,
  );
}

export async function dispatch(
  interaction: Interaction,
  ctx: { siteUrl: string; readOnly: boolean },
): Promise<void> {
  // Component interactions: the club-pick select menu.
  if (interaction.isStringSelectMenu() && interaction.customId === CLUB_PICK_ID) {
    try {
      await handleClubPick(interaction, ctx.readOnly);
    } catch (e) {
      console.error('[commands] club pick failed —', e);
      await interaction.update({ content: 'Something went wrong — run /findclub again.', components: [] }).catch(() => {});
    }
    return;
  }

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
      case 'findclub':
        await handleFindClub(interaction);
        break;
      case 'frontierclubstart':
        await handleFrontierClubStart(interaction);
        break;
      case 'testfriendly':
        await handleTestFriendly(interaction);
        break;
      case 'awardpoll':
        if (interaction.options.getSubcommand() === 'start') await startAwardPoll(interaction);
        else await closeAwardPoll(interaction, ctx.siteUrl);
        break;
      case 'spinorder':
        await handleSpinOrder(interaction);
        break;
      case 'frontierintro':
        await handleFrontierIntro(interaction, ctx.siteUrl);
        break;
      case 'frontierstatus':
        await handleFrontierStatus(interaction);
        break;
      case 'frontiersync':
        await handleFrontierSyncNow(interaction, ctx.readOnly);
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
