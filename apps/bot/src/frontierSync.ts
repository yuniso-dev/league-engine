import type { Client } from 'discord.js';
import {
  getAdminDiscordIds,
  getConfig,
  getLinkedLiveTournaments,
  ingestFrontierResult,
  isEaMatchIngested,
  type FrontierIngestPlayer,
} from '@inazuma/db';
import { eaNum, fetchClubMatches, type EaMatchType, type EaRawMatch } from './eaClient.js';
import { sendDm } from './notifier.js';

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

// ── Watchdog state (in-memory; resets on restart) ─────────────────────────────
// EA has real multi-day outages, and it only serves the last ~5-10 games per
// club — an unnoticed outage during a live Frontier can lose results forever.
// Track pass health here; /frontierstatus reads it, and sustained failure
// during a live tournament DMs the admins once (with a recovery all-clear).

const DOWN_PASSES_BEFORE_ALERT = 3; // ≈6 minutes of solid failures

export type FrontierWatchState = {
  lastPassAt: Date | null;
  lastEaSuccessAt: Date | null;
  lastIngest: { line: string; at: Date } | null;
  consecutiveDownPasses: number;
  eaDownAlerted: boolean;
  matchTypes: EaMatchType[];
};

const watch: FrontierWatchState = {
  lastPassAt: null,
  lastEaSuccessAt: null,
  lastIngest: null,
  consecutiveDownPasses: 0,
  eaDownAlerted: false,
  matchTypes: MATCH_TYPES,
};

export function frontierWatchState(): FrontierWatchState {
  return watch;
}

export type FrontierSyncSummary = {
  liveTournaments: number;
  clubsPolled: number;
  fetchAttempts: number;
  fetchFailures: number;
  ingested: number;
};

/** One poll pass. Failures log and wait for the next tick — never fatal. */
export async function syncFrontierMatches(client: Client<true>): Promise<FrontierSyncSummary> {
  watch.lastPassAt = new Date();

  const tournaments = await getLinkedLiveTournaments();
  const summary: FrontierSyncSummary = {
    liveTournaments: tournaments.length,
    clubsPolled: 0,
    fetchAttempts: 0,
    fetchFailures: 0,
    ingested: 0,
  };
  if (tournaments.length === 0) return summary; // nothing live & linked — free no-op

  const cfg = await getConfig();
  const platform = cfg.eaPlatform || 'common-gen5';
  const seenThisPass = new Set<string>(); // both linked clubs report the same EA match

  for (const t of tournaments) {
    const teamOfClub = new Map(t.clubs.map(c => [c.clubId, c]));

    for (const { clubId } of t.clubs) {
      summary.clubsPolled += 1;
      for (const matchType of MATCH_TYPES) {
        summary.fetchAttempts += 1;
        let raw: EaRawMatch[];
        try {
          raw = await fetchClubMatches(clubId, platform, matchType);
        } catch (e) {
          summary.fetchFailures += 1;
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

          // A side quitting turns the score into a forfeit (a 90'-quit draw
          // becomes 3–0) while the real stats survive — tag it and tell the
          // admin, so "that 3–0 wasn't real" never becomes an argument.
          const dnf =
            eaNum(m.clubs[clubId]?.winnerByDnf) > 0 || eaNum(m.clubs[oppId]?.winnerByDnf) > 0;

          const playersOf = (cId: string, teamId: string, concededByTeam: number): FrontierIngestPlayer[] =>
            Object.values(m.players?.[cId] ?? {})
              .filter(p => (p.playername ?? '').trim().length > 0)
              .map(p => ({
                teamId,
                eaName: p.playername!.trim(),
                goals: eaNum(p.goals),
                assists: eaNum(p.assists),
                tackles: eaNum(p.tacklesmade),
                // EA's cleansheetsany is unreliable (often always 0) — derive
                // from the scoreline: shutout = clean sheet for the whole side.
                cleanSheet: concededByTeam === 0,
                saves: eaNum(p.saves),
                redCards: eaNum(p.redcards),
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
            dnf,
            players: [
              ...playersOf(clubId, ourTeam.teamId, oppGoals),
              ...playersOf(oppId, oppTeam.teamId, ourGoals),
            ],
          });

          if (outcome.ok) {
            // Fixture is filled — stop matching further EA games onto it this pass.
            t.unscoredFixtures.splice(t.unscoredFixtures.indexOf(fixture), 1);
            summary.ingested += 1;
            watch.lastIngest = {
              line: `${ourTeam.teamName} ${ourGoals}–${oppGoals} ${oppTeam.teamName}${dnf ? ' (DNF)' : ''}`,
              at: new Date(),
            };
            console.log(
              `[frontier] ✔ auto-recorded ${ourTeam.teamName} ${ourGoals}–${oppGoals} ${oppTeam.teamName}` +
              (dnf ? ' (DNF)' : '') +
              ` (${outcome.participants} player stat lines` +
              (outcome.unmatched.length > 0 ? `; no site account for: ${outcome.unmatched.join(', ')}` : '') + ')',
            );
            if (dnf) {
              await alertAdminsDnf(client, m, clubId, oppId, ourTeam.teamName, oppTeam.teamName, ourGoals, oppGoals);
            }
          } else if (outcome.reason !== 'already-ingested') {
            console.warn(`[frontier] EA match ${eaMatchId} not ingested — ${outcome.reason}`);
          }
        }
      }
    }
  }

  await trackEaHealth(client, summary);
  return summary;
}

/** The watchdog: sustained all-fetches-failing during a live Frontier alerts
 *  the admins ONCE; the first healthy pass afterwards sends the all-clear. */
async function trackEaHealth(client: Client<true>, summary: FrontierSyncSummary): Promise<void> {
  if (summary.fetchAttempts === 0) return;

  if (summary.fetchFailures === summary.fetchAttempts) {
    watch.consecutiveDownPasses += 1;
    if (watch.consecutiveDownPasses >= DOWN_PASSES_BEFORE_ALERT && !watch.eaDownAlerted) {
      watch.eaDownAlerted = true;
      await alertAdmins(
        client,
        `🔌 **EA API unreachable while a Frontier is live** — every poll for the last ~${watch.consecutiveDownPasses * 2} minutes failed. ` +
        `Results backfill automatically when EA recovers, but EA only keeps the last ~5–10 games per club — ` +
        `if the outage outlasts the games being played, record those scores manually. ` +
        `Check \`/frontierstatus\` for live state; I'll DM again when EA recovers.`,
      );
    }
    return;
  }

  // At least one fetch worked — EA is (at least partly) up.
  watch.lastEaSuccessAt = new Date();
  if (watch.eaDownAlerted) {
    await alertAdmins(client, '✅ **EA API recovered** — polling is healthy again; games still inside EA\'s history window backfill now.');
  }
  watch.consecutiveDownPasses = 0;
  watch.eaDownAlerted = false;
}

/** DM every site owner/admin. */
async function alertAdmins(client: Client<true>, text: string): Promise<void> {
  const admins = await getAdminDiscordIds().catch(() => [] as string[]);
  for (const discordId of admins) {
    await sendDm(client, discordId, text);
  }
}

/** DM every site owner/admin about a forfeit-decided result. The individual
 *  player goals are real even when the score is a forfeit, so their sum hints
 *  at what the scoreline probably was at the quit (own goals excepted). */
async function alertAdminsDnf(
  client: Client<true>,
  m: EaRawMatch,
  ourClubId: string,
  oppClubId: string,
  ourName: string,
  oppName: string,
  ourGoals: number,
  oppGoals: number,
): Promise<void> {
  const statGoals = (cId: string) =>
    Object.values(m.players?.[cId] ?? {}).reduce((sum, p) => sum + eaNum(p.goals), 0);
  const statOur = statGoals(ourClubId);
  const statOpp = statGoals(oppClubId);
  const differs = statOur !== ourGoals || statOpp !== oppGoals;

  await alertAdmins(
    client,
    `⚠️ **DNF result auto-recorded**: **${ourName} ${ourGoals}–${oppGoals} ${oppName}** — a side quit, ` +
    `so EA's score may be a forfeit (a 90'-quit draw becomes 3–0).` +
    (differs ? `\nPlayer goals suggest the real score was **${statOur}–${statOpp}**.` : '') +
    `\nIf they're replaying it: hit **VOID** on the result (admin tournament page) — the fixture reopens ` +
    `and the replay auto-records. If the score just needs correcting: delete the result and re-enter it ` +
    `manually. The result is tagged DNF on the site either way.`,
  );
}
