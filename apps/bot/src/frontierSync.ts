import {
  getConfig,
  getLinkedLiveTournaments,
  ingestFrontierResult,
  isEaMatchIngested,
  type FrontierIngestPlayer,
} from '@inazuma/db';
import { eaNum, fetchClubMatches, type EaMatchType, type EaRawMatch } from './eaClient.js';

// Frontier automation, phase 1: while a tournament is LIVE and its teams have
// EA clubs linked, poll the EA API and fill unscored fixtures automatically —
// score + every player's goals/assists/tackles/rating/saves. Replaces score7
// and screenshot entry; the site's table/knockout update on their own.
//
// Match types polled are configurable because EA's (unofficial) API is only
// community-documented: club friendlies are EXPECTED on 'friendlyMatch', but
// day-one logs are the proof. Override with EA_FRONTIER_MATCH_TYPES if needed.

const MATCH_TYPES: EaMatchType[] = (process.env.EA_FRONTIER_MATCH_TYPES ?? 'friendlyMatch,leagueMatch')
  .split(',')
  .map(s => s.trim())
  .filter((s): s is EaMatchType => s === 'friendlyMatch' || s === 'leagueMatch' || s === 'playoffMatch');

/** One poll pass. Failures log and wait for the next tick — never fatal. */
export async function syncFrontierMatches(): Promise<void> {
  const tournaments = await getLinkedLiveTournaments();
  if (tournaments.length === 0) return; // nothing live & linked — free no-op

  const cfg = await getConfig();
  const platform = cfg.eaPlatform || 'common-gen5';
  const seenThisPass = new Set<string>(); // both linked clubs report the same EA match

  for (const t of tournaments) {
    const teamOfClub = new Map(t.clubs.map(c => [c.clubId, c]));

    for (const { clubId } of t.clubs) {
      for (const matchType of MATCH_TYPES) {
        let raw: EaRawMatch[];
        try {
          raw = await fetchClubMatches(clubId, platform, matchType);
        } catch (e) {
          console.error(`[frontier] ${matchType} fetch failed for club ${clubId} —`, e instanceof Error ? e.message : e);
          continue;
        }

        for (const m of raw) {
          const eaMatchId = String(m.matchId);
          if (seenThisPass.has(eaMatchId)) continue;
          seenThisPass.add(eaMatchId);

          const clubIds = Object.keys(m.clubs ?? {});
          const oppId = clubIds.find(id => id !== clubId);
          if (!oppId) continue;

          const ourTeam = teamOfClub.get(clubId);
          const oppTeam = teamOfClub.get(oppId);
          // Only matches where BOTH clubs belong to this tournament count —
          // random friendlies against outside clubs are ignored.
          if (!ourTeam || !oppTeam) continue;

          if (await isEaMatchIngested(eaMatchId)) continue;

          // Oldest unscored fixture between these two teams, either orientation.
          const fixture = t.unscoredFixtures.find(
            f =>
              (f.homeTeamId === ourTeam.teamId && f.awayTeamId === oppTeam.teamId) ||
              (f.homeTeamId === oppTeam.teamId && f.awayTeamId === ourTeam.teamId),
          );
          if (!fixture) {
            console.warn(`[frontier] EA match ${eaMatchId} (${ourTeam.teamName} vs ${oppTeam.teamName}) has no unscored fixture — skipped`);
            continue;
          }

          const ourGoals = eaNum(m.clubs[clubId]?.goals);
          const oppGoals = eaNum(m.clubs[clubId]?.goalsAgainst ?? m.clubs[oppId]?.goals);
          const homeIsUs = fixture.homeTeamId === ourTeam.teamId;

          const playersOf = (cId: string, teamId: string): FrontierIngestPlayer[] =>
            Object.values(m.players?.[cId] ?? {})
              .filter(p => (p.playername ?? '').trim().length > 0)
              .map(p => ({
                teamId,
                eaName: p.playername!.trim(),
                goals: eaNum(p.goals),
                assists: eaNum(p.assists),
                tackles: eaNum(p.tacklesmade),
                cleanSheet: eaNum(p.cleansheetsany) > 0,
                saves: eaNum(p.saves),
                mom: eaNum(p.mom) > 0,
                rating: p.rating != null ? eaNum(p.rating) : null,
                position: p.pos ? String(p.pos) : null,
              }));

          const outcome = await ingestFrontierResult({
            matchId: fixture.matchId,
            eaMatchId,
            playedAt: new Date(eaNum(m.timestamp) * 1000),
            homeScore: homeIsUs ? ourGoals : oppGoals,
            awayScore: homeIsUs ? oppGoals : ourGoals,
            players: [
              ...playersOf(clubId, ourTeam.teamId),
              ...playersOf(oppId, oppTeam.teamId),
            ],
          });

          if (outcome.ok) {
            // Fixture is filled — stop matching further EA games onto it this pass.
            t.unscoredFixtures.splice(t.unscoredFixtures.indexOf(fixture), 1);
            console.log(
              `[frontier] ✔ auto-recorded ${ourTeam.teamName} ${ourGoals}–${oppGoals} ${oppTeam.teamName}` +
              ` (${outcome.participants} player stat lines` +
              (outcome.unmatched.length > 0 ? `; no site account for: ${outcome.unmatched.join(', ')}` : '') + ')',
            );
          } else if (outcome.reason !== 'already-ingested') {
            console.warn(`[frontier] EA match ${eaMatchId} not ingested — ${outcome.reason}`);
          }
        }
      }
    }
  }
}
