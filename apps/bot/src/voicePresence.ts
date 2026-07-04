import type { VoiceBasedChannel } from 'discord.js';
import {
  addDiscordIdsToDraftPool,
  ensurePublicId,
  replaceVoicePresence,
  syncGuildMember,
} from '@inazuma/db';

// On-demand voice snapshot. Nothing tracks voice continuously anymore — this
// runs ONLY when an admin invokes /checkvc. It grabs everyone currently in a
// specific voice channel (regardless of whether they ever signed into the
// website), stages them in the draft pool, and refreshes the live-voice mirror
// so the site's "in voice" indicators reflect the moment of the check.

export type VoiceCheckResult = {
  channelName: string;
  total: number;        // non-bot members found in the channel
  added: number;        // newly added to the draft pool this check
  alreadyPooled: number;
};

/** Snapshot a voice channel into the draft pool + voice mirror. */
export async function snapshotVoiceChannel(channel: VoiceBasedChannel): Promise<VoiceCheckResult> {
  const members = [...channel.members.values()].filter(m => !m.user.bot);

  const discordIds: string[] = [];
  const presence: { discordId: string; channelName: string }[] = [];

  for (const m of members) {
    // Make sure a users row exists (creates one for people who never used the
    // site) and skip anyone blacklisted.
    const blocked = await syncGuildMember({
      discordId: m.id,
      username: m.user.username,
      displayName: m.user.globalName ?? m.user.username,
      avatarUrl: m.user.displayAvatarURL({ size: 128 }),
    });
    if (blocked) continue;

    // Give them a public_id so they're draftable, without marking them
    // initialised (they stay off the public ladder until they sign up properly).
    await ensurePublicId(m.id);

    discordIds.push(m.id);
    presence.push({ discordId: m.id, channelName: channel.name });
  }

  // Mirror this snapshot so the site's live-voice card/dots reflect the check.
  await replaceVoicePresence(presence);
  const added = await addDiscordIdsToDraftPool(
    discordIds.map(id => ({ discordId: id, source: 'vc' })),
  );

  return {
    channelName: channel.name,
    total: discordIds.length,
    added,
    alreadyPooled: discordIds.length - added,
  };
}
