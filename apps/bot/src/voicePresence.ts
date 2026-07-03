import type { Guild, VoiceState } from 'discord.js';
import { clearVoicePresence, replaceVoicePresence, setVoicePresence, syncGuildMember } from '@inazuma/db';

// Mirrors who's in voice channels into the voice_presence table so the
// website can show a live "in voice now" card. All writes are skipped in
// read-only test mode (gated by the caller).

/** Startup: replace the table with the guild's current voice occupancy. */
export async function scanVoicePresence(guild: Guild): Promise<number> {
  const entries: { discordId: string; channelName: string }[] = [];
  for (const [, state] of guild.voiceStates.cache) {
    if (!state.channelId || !state.member || state.member.user.bot) continue;
    entries.push({
      discordId: state.member.id,
      channelName: state.channel?.name ?? 'Voice',
    });
  }
  // Rows FK to users — make sure everyone in VC exists first (member sync
  // usually has, but a scan can race a brand-new joiner).
  for (const e of entries) {
    const member = guild.members.cache.get(e.discordId);
    if (member) {
      await syncGuildMember({
        discordId: member.id,
        username: member.user.username,
        displayName: member.user.globalName ?? member.user.username,
        avatarUrl: member.user.displayAvatarURL({ size: 128 }),
      });
    }
  }
  await replaceVoicePresence(entries);
  console.log(`[voice] presence scan: ${entries.length} in voice`);
  return entries.length;
}

/** Live updates: joins, leaves and channel moves. */
export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  if (newState.channelId) {
    // FK safety: the row needs a users entry (also reactivates re-joiners).
    const blocked = await syncGuildMember({
      discordId: member.id,
      username: member.user.username,
      displayName: member.user.globalName ?? member.user.username,
      avatarUrl: member.user.displayAvatarURL({ size: 128 }),
    });
    if (blocked) return;
    await setVoicePresence(member.id, newState.channel?.name ?? 'Voice');
  } else {
    await clearVoicePresence(member.id);
  }
}
