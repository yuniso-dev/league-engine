import { EmbedBuilder, type Client } from 'discord.js';
import { getConfig, listLinkedCasualPlayers } from '@inazuma/db';
import { eaNum, fetchClubMatches, fetchClubsInfo, searchClubs, type EaMatchType, type EaRawMatch } from './eaClient.js';

// /testfriendly — the dress-rehearsal probe for Frontier auto-ingest.
// Watches two EA clubs and posts a full stat report to Discord the moment a
// NEW match between them appears on EA's API. Strictly READ-ONLY: nothing is
// ever written to the database, so real site stats cannot be harmed. It also
// answers the open question of WHICH match type EA serves club friendlies on.

const ALL_TYPES: EaMatchType[] = ['friendlyMatch', 'leagueMatch', 'playoffMatch'];
const EXPIRE_MS = 2 * 60 * 60_000; // auto-disarm after 2 hours

type Watch = {
  clubA: { id: string; name: string };
  clubB: { id: string; name: string };
  channelId: string;
  platform: string;
  armedAt: number;
  polls: number;
  /** EA matchIds already visible when armed — only NEW games fire the report. */
  seen: Set<string>;
};

let watch: Watch | null = null;

export type ResolveClubResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

/** Digits → treat as a club ID; anything else → search EA by name.
 *  Failures come back with the REAL reason so admins aren't guessing. */
export async function resolveClub(input: string, platform: string): Promise<ResolveClubResult> {
  const trimmed = input.trim();
  if (/^\d{1,12}$/.test(trimmed)) {
    // Look up the real name so reports don't say "club 118660".
    const info = await fetchClubsInfo([trimmed], platform);
    return { ok: true, id: trimmed, name: info.get(trimmed)?.name ?? `club ${trimmed}` };
  }

  try {
    const results = await searchClubs(trimmed, platform);
    if (results.length === 0) {
      return {
        ok: false,
        error: `EA found no club matching “${trimmed}”. Try more (or fewer) letters of the in-game name — or paste the numeric club ID instead.`,
      };
    }
    return { ok: true, id: results[0].clubId, name: results[0].name };
  } catch (e) {
    return {
      ok: false,
      error: `EA club search failed (${e instanceof Error ? e.message : e}). You can paste the numeric club ID instead — it skips the search entirely.`,
    };
  }
}

export type ProbeLine = { matchType: EaMatchType; ok: boolean; count: number; error?: string };

/** One immediate pass per match type — instantly shows whether EA serves
 *  friendlies at all, before anyone plays anything. */
export async function probeClub(clubId: string, platform: string): Promise<ProbeLine[]> {
  const out: ProbeLine[] = [];
  for (const matchType of ALL_TYPES) {
    try {
      const matches = await fetchClubMatches(clubId, platform, matchType);
      out.push({ matchType, ok: true, count: matches.length });
    } catch (e) {
      out.push({ matchType, ok: false, count: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** Arm the watch. Returns the baseline probe so the reply can show it. */
export async function armFriendlyTest(
  clubA: { id: string; name: string },
  clubB: { id: string; name: string },
  channelId: string,
): Promise<ProbeLine[]> {
  const cfg = await getConfig();
  const platform = cfg.eaPlatform || 'common-gen5';

  const seen = new Set<string>();
  const probe = await probeClub(clubA.id, platform);
  // Seed with everything currently visible so an OLD game can't fire the report.
  for (const matchType of ALL_TYPES) {
    const matches = await fetchClubMatches(clubA.id, platform, matchType).catch(() => [] as EaRawMatch[]);
    for (const m of matches) seen.add(String(m.matchId));
  }

  watch = { clubA, clubB, channelId, platform, armedAt: Date.now(), polls: 0, seen };
  return probe;
}

export function disarmFriendlyTest(): boolean {
  const was = watch !== null;
  watch = null;
  return was;
}

export function friendlyTestStatus(): Watch | null {
  return watch;
}

function playerLines(m: EaRawMatch, clubId: string): string[] {
  return Object.values(m.players?.[clubId] ?? {})
    .filter(p => (p.playername ?? '').trim().length > 0)
    .map(p => {
      const bits = [
        `**${p.playername!.trim()}**${p.pos ? ` (${String(p.pos).toUpperCase()})` : ''}`,
        p.rating != null ? `${eaNum(p.rating).toFixed(1)}` : null,
        `${eaNum(p.goals)}G ${eaNum(p.assists)}A`,
        `${eaNum(p.tacklesmade)}T`,
        eaNum(p.saves) > 0 ? `${eaNum(p.saves)} saves` : null,
        eaNum(p.mom) > 0 ? '⭐MOTM' : null,
      ].filter(Boolean);
      return bits.join(' · ');
    })
    .slice(0, 11);
}

/** 60s tick, registered once at startup — a free no-op unless a test is armed. */
export async function pollFriendlyTest(client: Client<true>): Promise<void> {
  if (!watch) return;

  if (Date.now() - watch.armedAt > EXPIRE_MS) {
    const expired = watch;
    watch = null;
    const channel = await client.channels.fetch(expired.channelId).catch(() => null);
    if (channel?.isSendable()) {
      await channel.send('🧪 Friendly test expired after 2 hours with no new match between the two clubs. Re-arm with `/testfriendly watch` when ready.').catch(() => {});
    }
    return;
  }

  watch.polls += 1;

  for (const matchType of ALL_TYPES) {
    let matches: EaRawMatch[];
    try {
      matches = await fetchClubMatches(watch.clubA.id, watch.platform, matchType);
    } catch {
      continue; // transient EA hiccup — next tick tries again
    }

    for (const m of matches) {
      const eaMatchId = String(m.matchId);
      if (watch.seen.has(eaMatchId)) continue;
      watch.seen.add(eaMatchId);

      const clubIds = Object.keys(m.clubs ?? {});
      if (!clubIds.includes(watch.clubA.id) || !clubIds.includes(watch.clubB.id)) continue;

      // ── This is the one — build the report and disarm. ──
      const w = watch;
      watch = null;

      const aGoals = eaNum(m.clubs[w.clubA.id]?.goals);
      const bGoals = eaNum(m.clubs[w.clubB.id]?.goals);
      const playedAt = new Date(eaNum(m.timestamp) * 1000);

      // Which players would link to site accounts (read-only check).
      const linked = await listLinkedCasualPlayers().catch(() => []);
      const linkedNames = new Set(linked.map(p => p.eaName.toLowerCase()));
      const allNames = [w.clubA.id, w.clubB.id].flatMap(id =>
        Object.values(m.players?.[id] ?? {})
          .map(p => (p.playername ?? '').trim())
          .filter(Boolean),
      );
      const unmatched = allNames.filter(n => !linkedNames.has(n.toLowerCase()));

      const embed = new EmbedBuilder()
        .setTitle('🧪 FRIENDLY TEST — MATCH DETECTED')
        .setColor(0x2fbe8d)
        .setDescription(
          `**${w.clubA.name} ${aGoals}–${bGoals} ${w.clubB.name}**\n` +
          `Found on \`${matchType}\` · played <t:${Math.floor(playedAt.getTime() / 1000)}:R> · detected after ${w.polls} poll${w.polls === 1 ? '' : 's'}\n\n` +
          `**Read-only test — nothing was saved.** In a live Frontier with these clubs linked, this exact result and every stat line below would auto-record.`,
        )
        .addFields(
          {
            name: w.clubA.name.slice(0, 250),
            value: playerLines(m, w.clubA.id).join('\n').slice(0, 1024) || '_no player data_',
          },
          {
            name: w.clubB.name.slice(0, 250),
            value: playerLines(m, w.clubB.id).join('\n').slice(0, 1024) || '_no player data_',
          },
          {
            name: 'Site account check',
            value: (unmatched.length === 0
              ? `✅ All ${allNames.length} players have a linked EA ID — every stat line would attach.`
              : `✅ ${allNames.length - unmatched.length}/${allNames.length} linked · ⚠️ no EA ID on file for: ${unmatched.join(', ')}`
            ).slice(0, 1024),
          },
        )
        .setFooter({ text: `EA match ${eaMatchId} · watch disarmed` });

      const channel = await client.channels.fetch(w.channelId).catch(() => null);
      if (channel?.isSendable()) {
        await channel.send({ embeds: [embed] }).catch(e =>
          console.error('[friendly-test] report send failed —', e instanceof Error ? e.message : e));
      }
      console.log(`[friendly-test] ✔ detected ${w.clubA.name} ${aGoals}–${bGoals} ${w.clubB.name} on ${matchType}`);
      return;
    }
  }
}
