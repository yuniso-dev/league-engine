import { getConfig, ingestCasualMatches, type CasualMatchInput } from '@inazuma/db';
import { fetchClubMatches, type EaMatchType, type EaRawMatch } from './eaClient.js';

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
      position: p.pos ? String(p.pos) : null,
      rating: p.rating != null ? num(p.rating) : null,
      goals: num(p.goals),
      assists: num(p.assists),
      tackles: num(p.tacklesmade),
      cleanSheet: num(p.cleansheetsany) > 0,
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

/** One poll pass over every configured club. Failures are logged, never thrown —
 *  the EA API is unofficial and flaky, and the next pass simply tries again. */
export async function syncCasualMatches(): Promise<void> {
  const cfg = await getConfig();
  const clubIds = (cfg.eaClubIds ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (clubIds.length === 0) return; // not configured — nothing to do

  const platform = cfg.eaPlatform || 'common-gen5';

  for (const clubId of clubIds) {
    for (const matchType of ['leagueMatch', 'playoffMatch'] as const) {
      try {
        const raw = await fetchClubMatches(clubId, platform, matchType);
        const parsed = raw
          .map(m => parseEaMatch(m, clubId, matchType))
          .filter((m): m is CasualMatchInput => m !== null);
        const added = await ingestCasualMatches(parsed);
        if (added > 0) {
          console.log(`[casual] club ${clubId}: +${added} new ${matchType === 'playoffMatch' ? 'playoff' : 'league'} match${added === 1 ? '' : 'es'}`);
        }
      } catch (e) {
        console.error(`[casual] ${matchType} fetch failed for club ${clubId} —`, e instanceof Error ? e.message : e);
      }
    }
  }
}
