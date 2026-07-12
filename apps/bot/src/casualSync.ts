import type { Client } from 'discord.js';
import { normalizePosition } from '@inazuma/core';
import { getConfig, ingestCasualMatches, type CasualMatchInput } from '@inazuma/db';
import { fetchClubMatches, type EaMatchType, type EaRawMatch } from './eaClient.js';
import { casualResultEmbed, sendToChannel } from './channels.js';

// CASUAL realm ingestion: polls the EA Clubs API for the configured club(s)
// and merges any new matches into the database (idempotent — EA matchIds are
// unique). The website's Casual tab reads only from the DB, never from EA.
// Configure in Admin → Settings: EA Club ID(s) + platform.

const num = (v: string | number | undefined | null): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

/** Parse one raw EA match into our ingest shape. Null = malformed / not ours. */
export function parseEaMatch(raw: EaRawMatch, clubId: string, matchType: EaMatchType): CasualMatchInput | null {
  const ours = raw.clubs?.[clubId];
  if (!ours) return null;

  const oppId = Object.keys(raw.clubs).find(id => id !== clubId);
  const opp = oppId ? raw.clubs[oppId] : undefined;

  const ourGoals = num(ours.goals);
  const oppGoals = num(ours.goalsAgainst ?? opp?.goals);

  const playersOfClub = raw.players?.[clubId] ?? {};
  const players = Object.values(playersOfClub)
    .filter(p => (p.playername ?? '').trim().length > 0)
    .map(p => ({
      eaName: p.playername!.trim(),
      position: normalizePosition(p.pos) ?? (p.pos ? String(p.pos) : null),
      rating: p.rating != null ? num(p.rating) : null,
      goals: num(p.goals),
      assists: num(p.assists),
      tackles: num(p.tacklesmade),
      // EA's cleansheetsany field is unreliable (often always 0) — derive it
      // from the scoreline instead: shutout = clean sheet for the whole side.
      cleanSheet: oppGoals === 0,
      saves: num(p.saves),
      shots: num(p.shots),
      passesMade: num(p.passesmade),
      passAttempts: num(p.passattempts),
      mom: num(p.mom) > 0,
    }));

  return {
    matchId: String(raw.matchId),
    clubId,
    matchType: matchType === 'playoffMatch' ? 'playoff' : 'league',
    playedAt: new Date(num(raw.timestamp) * 1000),
    opponentName: opp?.details?.name ?? opp?.name ?? null,
    ourGoals,
    oppGoals,
    result: ourGoals > oppGoals ? 'win' : ourGoals < oppGoals ? 'loss' : 'draw',
    players,
  };
}

// Warn once per boot when the realm is unconfigured, so "why are my stats not
// moving?" is answerable from the logs instead of by reading this file.
let warnedNoClub = false;

/** One poll pass over every configured club. Failures are logged, never thrown —
 *  the EA API is unofficial and flaky, and the next pass simply tries again. */
export async function syncCasualMatches(client: Client<true>): Promise<void> {
  const cfg = await getConfig();
  const clubIds = (cfg.eaClubIds ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (clubIds.length === 0) {
    if (!warnedNoClub) {
      warnedNoClub = true;
      console.log('[casual] no EA Club ID configured — casual sync is idle (set EA Club ID(s) in Admin → Settings)');
    }
    return;
  }
  warnedNoClub = false;

  const platform = cfg.eaPlatform || 'common-gen5';

  for (const clubId of clubIds) {
    for (const matchType of ['leagueMatch', 'playoffMatch'] as const) {
      try {
        const raw = await fetchClubMatches(clubId, platform, matchType);
        const parsed = raw
          .map(m => parseEaMatch(m, clubId, matchType))
          .filter((m): m is CasualMatchInput => m !== null);
        const added = await ingestCasualMatches(parsed);
        if (added.length > 0) {
          console.log(`[casual] club ${clubId}: +${added.length} new ${matchType === 'playoffMatch' ? 'playoff' : 'league'} match${added.length === 1 ? '' : 'es'}`);

          // Results feed: post each NEW game (only ones the insert actually
          // landed — a restart can never re-announce). Oldest first so the
          // channel reads chronologically. Post failures are swallowed by
          // sendToChannel and never affect the ingested data.
          if (cfg.casualResultsChannelId) {
            const newIds = new Set(added);
            const rawById = new Map(raw.map(r => [String(r.matchId), r]));
            const fresh = parsed
              .filter(m => newIds.has(m.matchId))
              .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
            for (const m of fresh) {
              const ours = rawById.get(m.matchId)?.clubs?.[clubId];
              await sendToChannel(client, cfg.casualResultsChannelId, {
                embeds: [casualResultEmbed({
                  clubId,
                  clubName: ours?.details?.name ?? ours?.name ?? `Club ${clubId}`,
                  opponentName: m.opponentName,
                  ourGoals: m.ourGoals,
                  oppGoals: m.oppGoals,
                  result: m.result,
                  matchType: m.matchType,
                  playedAt: m.playedAt,
                  players: m.players.map(p => ({
                    eaName: p.eaName,
                    rating: p.rating,
                    goals: p.goals,
                    assists: p.assists,
                    saves: p.saves,
                    mom: p.mom,
                  })),
                })],
              });
            }
          }
        }
      } catch (e) {
        console.error(`[casual] ${matchType} fetch failed for club ${clubId} —`, e instanceof Error ? e.message : e);
      }
    }
  }
}
