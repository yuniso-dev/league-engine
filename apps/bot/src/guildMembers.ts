import type { Collection, Guild, GuildMember } from 'discord.js';

// guild.members.fetch() is a GATEWAY request (opcode 8), which Discord
// rate-limits separately from normal REST calls. A couple of quick restarts
// (Railway redeploys) plus back-to-back fetches is enough to trip it, and the
// fetch then rejects with "Retry after N seconds" — killing whatever pass it
// was part of. Honour that delay and retry instead of failing.

const FALLBACK_WAIT_MS = 30_000;

export async function fetchAllMembers(
  guild: Guild,
  attempts = 3,
): Promise<Collection<string, GuildMember>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await guild.members.fetch();
    } catch (e) {
      if (attempt >= attempts) throw e;
      const message = e instanceof Error ? e.message : String(e);
      const suggested = /retry after ([\d.]+)/i.exec(message);
      const waitMs = suggested
        ? Math.ceil(parseFloat(suggested[1]) * 1000) + 1_000
        : FALLBACK_WAIT_MS;
      console.warn(
        `[bot] member fetch rate-limited — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${attempts})`,
      );
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}
