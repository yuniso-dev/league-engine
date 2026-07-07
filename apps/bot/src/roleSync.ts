import type { Guild, Role } from 'discord.js';
import { getConfig, getLatestOpenTournament, getSignupDiscordIds, listActiveSanctions } from '@inazuma/db';

// Keeps two Discord roles mirroring the database, reconciling every minute:
//   • signed-up role — exactly who's signed up for the open Frontier; empties
//     itself when the Frontier completes (or when nothing is open)
//   • punished role  — exactly who's currently suspended
// Only the diff is touched, so the steady state costs zero Discord API calls.
// Both roles are optional — configured in Admin → Settings.

/** Role IDs already warned about (missing / above the bot) — warn once, not every minute. */
const warned = new Set<string>();

async function resolveRole(guild: Guild, roleId: string, label: string): Promise<Role | null> {
  const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    if (!warned.has(roleId)) {
      warned.add(roleId);
      console.warn(`[roles] ${label} role ${roleId} doesn't exist in this server — fix the ID in Admin → Settings.`);
    }
    return null;
  }
  if (!role.editable) {
    if (!warned.has(roleId)) {
      warned.add(roleId);
      console.warn(`[roles] I can't manage the ${label} role "${role.name}" — drag my bot role ABOVE it in Server Settings → Roles.`);
    }
    return null;
  }
  warned.delete(roleId);
  return role;
}

async function reconcile(guild: Guild, role: Role, want: Set<string>, label: string): Promise<void> {
  let added = 0;
  let removed = 0;

  for (const [id, member] of role.members) {
    if (want.has(id)) continue;
    try {
      await member.roles.remove(role, 'INAZUMA role sync');
      removed++;
    } catch (e) {
      console.log(`[roles] couldn't remove ${label} from ${member.user.tag} — ${e instanceof Error ? e.message : e}`);
    }
  }

  for (const id of want) {
    const member = guild.members.cache.get(id) ?? await guild.members.fetch(id).catch(() => null);
    if (!member || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, 'INAZUMA role sync');
      added++;
    } catch (e) {
      console.log(`[roles] couldn't add ${label} to ${member.user.tag} — ${e instanceof Error ? e.message : e}`);
    }
  }

  if (added + removed > 0) console.log(`[roles] ${label}: +${added} / −${removed}`);
}

/** 60s tick (also called right after /punish and /pardon for instant feedback). */
export async function syncRoles(guild: Guild): Promise<void> {
  const cfg = await getConfig();
  if (!cfg.signupRoleId && !cfg.punishedRoleId) return;

  if (cfg.signupRoleId) {
    const role = await resolveRole(guild, cfg.signupRoleId, 'signed-up');
    if (role) {
      const open = await getLatestOpenTournament();
      const want = new Set(open ? await getSignupDiscordIds(open.id) : []);
      await reconcile(guild, role, want, 'signed-up');
    }
  }

  if (cfg.punishedRoleId) {
    const role = await resolveRole(guild, cfg.punishedRoleId, 'punished');
    if (role) {
      const want = new Set((await listActiveSanctions()).map(s => s.discordId));
      await reconcile(guild, role, want, 'punished');
    }
  }
}
