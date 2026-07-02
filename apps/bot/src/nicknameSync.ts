import type { Guild } from 'discord.js';
import { formatNickname } from '@inazuma/core';
import { listPlayersForNicknames } from '@inazuma/db';

const RENAME_DELAY_MS = 350; // polite pacing; discord.js also queues 429s

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type NicknameSyncResult = { renamed: number; skipped: number; failed: number };

/** Rename every ranked member to their formatNickname() form.
 *  Skips members the bot cannot manage (server owner, higher roles) and
 *  members whose nickname already matches. Never throws for a single failure. */
export async function syncNicknames(guild: Guild): Promise<NicknameSyncResult> {
  const players = await listPlayersForNicknames();
  const members = await guild.members.fetch();

  const result: NicknameSyncResult = { renamed: 0, skipped: 0, failed: 0 };

  for (const player of players) {
    const member = members.get(player.discordId);
    if (!member) continue; // signed in on the site but not (currently) in the guild

    const desired = formatNickname(player);
    if (member.nickname === desired) {
      result.skipped++;
      continue;
    }
    // Role hierarchy: the bot can never rename the server owner, nor anyone
    // whose highest role is at/above the bot's. Skip instead of erroring.
    if (!member.manageable) {
      result.skipped++;
      continue;
    }

    try {
      await member.setNickname(desired, 'INZ weekly rank sync');
      result.renamed++;
    } catch (e) {
      result.failed++;
      console.warn(
        `[nicknameSync] could not rename ${member.user.username} —`,
        e instanceof Error ? e.message : e,
      );
    }
    await sleep(RENAME_DELAY_MS);
  }

  console.log(
    `[nicknameSync] renamed ${result.renamed}, skipped ${result.skipped}, failed ${result.failed}`,
  );
  return result;
}
