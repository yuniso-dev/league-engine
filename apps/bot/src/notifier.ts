import type { Client } from 'discord.js';
import { getNewAwardGrants } from '@inazuma/db';

// DM notifier — polls the database for things players should hear about
// directly. Phase 2 ships award-win DMs; signup + drafted DMs join in Phase 3.
// Watermarks are seeded to boot time so a restart NEVER replays old grants
// into people's DMs. Deliberately not gated on an open tournament: award
// ceremonies run after a Frontier completes.

let awardsSince = new Date();

async function dm(client: Client<true>, discordId: string, text: string): Promise<void> {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(text);
  } catch (e) {
    // Closed DMs are common and fine — log and move on.
    console.log(`[notifier] DM to ${discordId} failed — ${e instanceof Error ? e.message : e}`);
  }
}

/** 60s tick. A single cheap indexed query when nothing happened. */
export async function pollNotifier(client: Client<true>, siteUrl: string): Promise<void> {
  const grants = await getNewAwardGrants(awardsSince);
  if (grants.length === 0) return;

  // Advance BEFORE sending — a failed DM must never cause a re-send loop.
  awardsSince = grants[grants.length - 1].awardedAt;

  for (const grant of grants) {
    const cabinet = grant.publicId ? `\nYour trophy cabinet: ${siteUrl}/p/${grant.publicId}` : '';
    await dm(
      client,
      grant.discordId,
      `🏆 You've won **${grant.awardName}**${grant.awardIcon ? ` ${grant.awardIcon}` : ''} — congratulations!${cabinet}`,
    );
  }
  console.log(`[notifier] sent ${grants.length} award DM${grants.length === 1 ? '' : 's'}`);
}
