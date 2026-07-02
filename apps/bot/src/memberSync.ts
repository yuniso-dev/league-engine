import type { Guild, GuildMember, PartialGuildMember } from 'discord.js';
import { listTrackedUsers, setUserInactive, syncGuildMember } from '@inazuma/db';

// IMPORTANT: displayName here must come from user.globalName ?? user.username,
// NEVER from member.displayName — that is the guild nickname, which this bot
// itself sets to "#3 Name | ST/GK". Feeding it back into users.displayName
// (which formatNickname consumes) would create a feedback loop.
function toSyncData(member: GuildMember) {
  return {
    discordId: member.id,
    username: member.user.username,
    displayName: member.user.globalName ?? member.user.username,
    avatarUrl: member.user.displayAvatarURL({ size: 128 }),
  };
}

/** Full sync: upsert every human member, then mark tracked-but-absent players
 *  inactive (hides them from rankings until they re-join). */
export async function syncAllMembers(guild: Guild): Promise<{ synced: number; deactivated: number }> {
  const members = await guild.members.fetch(); // needs the SERVER MEMBERS intent

  let synced = 0;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const blocked = await syncGuildMember(toSyncData(member));
    if (!blocked) synced++;
  }

  // Reconciliation: anyone we track as active who is no longer in the guild.
  let deactivated = 0;
  const tracked = await listTrackedUsers();
  for (const t of tracked) {
    if (!t.isInactive && !members.has(t.discordId)) {
      await setUserInactive(t.discordId, true);
      deactivated++;
    }
  }

  console.log(`[memberSync] synced ${synced} members, deactivated ${deactivated} leavers`);
  return { synced, deactivated };
}

export async function onMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  await syncGuildMember(toSyncData(member)); // also reactivates a re-joining leaver
  console.log(`[memberSync] joined: ${member.user.username}`);
}

export async function onMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user?.bot) return;
  await setUserInactive(member.id, true);
  console.log(`[memberSync] left: ${member.user?.username ?? member.id}`);
}
