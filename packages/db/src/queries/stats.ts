import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../client';
import {
  adminActions,
  matches,
  matchParticipants,
  teams,
  tournaments,
  users,
} from '../schema';

// Match statistics: goals / assists / clean sheets / tackles / MOTM per
// participant — written by the admin ⚽ STATS form, aggregated for the
// Frontier stat boards.

// ── Admin: per-match stat entry ───────────────────────────────────────────────

export type MatchStatsEntry = {
  publicId: string;
  displayName: string;
  side: 'home' | 'away';
  goals: number;
  assists: number;
  cleanSheet: boolean;
  tackles: number;
  mom: boolean;
};

export type MatchStatsSheet = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  entries: MatchStatsEntry[];
};

/** Everything the per-match stats editor needs. Null if the match is unknown. */
export async function getMatchStatsEntries(matchId: string): Promise<MatchStatsSheet | null> {
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return null;

  const teamRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, [match.homeTeamId, match.awayTeamId]));
  const nameOf = new Map(teamRows.map(t => [t.id, t.name]));

  const rows = await db
    .select({
      publicId: users.publicId,
      displayName: users.displayName,
      teamId: matchParticipants.teamId,
      goals: matchParticipants.goals,
      assists: matchParticipants.assists,
      cleanSheet: matchParticipants.cleanSheet,
      tackles: matchParticipants.tackles,
      mom: matchParticipants.mom,
    })
    .from(matchParticipants)
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(asc(users.displayName));

  return {
    matchId,
    homeTeamName: nameOf.get(match.homeTeamId) ?? '?',
    awayTeamName: nameOf.get(match.awayTeamId) ?? '?',
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    entries: rows
      .filter((r): r is typeof r & { publicId: string } => r.publicId != null)
      .map(r => ({
        publicId: r.publicId,
        displayName: r.displayName,
        side: r.teamId === match.homeTeamId ? 'home' as const : 'away' as const,
        goals: r.goals,
        assists: r.assists,
        cleanSheet: r.cleanSheet,
        tackles: r.tackles,
        mom: r.mom,
      })),
  };
}

/** Write goals/assists/clean-sheet/tackles/MOTM for a match's participants. */
export async function updateMatchStats(
  adminId: string,
  matchId: string,
  stats: { publicId: string; goals: number; assists: number; cleanSheet: boolean; tackles: number; mom: boolean }[],
): Promise<void> {
  const db = getDb();
  const [match] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) throw new Error('Unknown match.');

  for (const s of stats) {
    if (!Number.isInteger(s.goals) || s.goals < 0 || s.goals > 99) throw new Error('Goals must be 0–99.');
    if (!Number.isInteger(s.assists) || s.assists < 0 || s.assists > 99) throw new Error('Assists must be 0–99.');
    if (!Number.isInteger(s.tackles) || s.tackles < 0 || s.tackles > 99) throw new Error('Tackles must be 0–99.');
  }

  const publicIds = stats.map(s => s.publicId);
  const userRows = publicIds.length
    ? await db
        .select({ publicId: users.publicId, discordId: users.discordId })
        .from(users)
        .where(inArray(users.publicId, publicIds))
    : [];
  const idOf = new Map(userRows.map(r => [r.publicId!, r.discordId]));

  await db.transaction(async tx => {
    for (const s of stats) {
      const userId = idOf.get(s.publicId);
      if (!userId) continue; // unknown player rows are skipped, not fatal
      await tx
        .update(matchParticipants)
        .set({ goals: s.goals, assists: s.assists, cleanSheet: s.cleanSheet, tackles: s.tackles, mom: s.mom })
        .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));
    }
  });

  await getDb().insert(adminActions).values({
    adminId,
    action: 'match.stats',
    details: { matchId, players: stats.length },
  });
}

// ── Public: stat leaderboards ─────────────────────────────────────────────────

export type StatLeader = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  value: number;
};

export type StatLeaderboards = {
  topScorers: StatLeader[];
  topAssisters: StatLeader[];
  topCleanSheets: StatLeader[];
};

type StatTotals = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  goals: number;
  assists: number;
  cleanSheets: number;
  tackles: number;
  motm: number;
  wins: number;
};

async function aggregateStats(
  filter: { tournamentId?: string | null; season?: number | null } = {},
): Promise<StatTotals[]> {
  const db = getDb();
  const conditions: SQL[] = [eq(users.isBlacklisted, false)];
  if (filter.tournamentId) conditions.push(eq(matches.tournamentId, filter.tournamentId));
  if (filter.season != null) conditions.push(eq(tournaments.season, filter.season));

  const rows = await db
    .select({
      publicId: users.publicId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      goals: sql<number>`coalesce(sum(${matchParticipants.goals}), 0)::int`,
      assists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
      cleanSheets: sql<number>`(count(*) filter (where ${matchParticipants.cleanSheet}))::int`,
      tackles: sql<number>`coalesce(sum(${matchParticipants.tackles}), 0)::int`,
      motm: sql<number>`(count(*) filter (where ${matchParticipants.mom}))::int`,
      wins: sql<number>`(count(*) filter (where ${matchParticipants.result} = 'win'))::int`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(users, eq(matchParticipants.userId, users.discordId))
    .where(and(...conditions))
    .groupBy(users.publicId, users.displayName, users.avatarUrl);

  return rows
    .filter((r): r is typeof r & { publicId: string } => r.publicId != null)
    .map(r => ({
      publicId: r.publicId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      goals: r.goals,
      assists: r.assists,
      cleanSheets: r.cleanSheets,
      tackles: r.tackles,
      motm: r.motm,
      wins: r.wins,
    }));
}

type StatKey = 'goals' | 'assists' | 'cleanSheets' | 'tackles' | 'motm' | 'wins';

function top(totals: StatTotals[], key: StatKey, limit: number): StatLeader[] {
  return totals
    .filter(t => t[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
    .map(t => ({
      publicId: t.publicId,
      displayName: t.displayName,
      avatarUrl: t.avatarUrl,
      value: t[key],
    }));
}

/** Per-tournament leaders (goals, assists, clean sheets). */
export async function getTournamentStats(tournamentId: string, limit = 10): Promise<StatLeaderboards> {
  const totals = await aggregateStats({ tournamentId });
  return {
    topScorers: top(totals, 'goals', limit),
    topAssisters: top(totals, 'assists', limit),
    topCleanSheets: top(totals, 'cleanSheets', limit),
  };
}

/** All-time Frontier records across every tournament. */
export async function getAllTimeStats(limit = 10): Promise<StatLeaderboards> {
  const totals = await aggregateStats();
  return {
    topScorers: top(totals, 'goals', limit),
    topAssisters: top(totals, 'assists', limit),
    topCleanSheets: top(totals, 'cleanSheets', limit),
  };
}

// The Frontier realm's stat boards: six categories, top 3 on display with a
// "show top 25" expansion. season=null → all-time; a season number → that
// season only (the LIVE STATS tab).
export type FrontierStatBoards = {
  goals: StatLeader[];
  assists: StatLeader[];
  tackles: StatLeader[];
  cleanSheets: StatLeader[];
  motm: StatLeader[];
  gamesWon: StatLeader[];
};

export async function getFrontierStatBoards(
  season: number | null,
  limit = 25,
): Promise<FrontierStatBoards> {
  const totals = await aggregateStats({ season });
  return {
    goals: top(totals, 'goals', limit),
    assists: top(totals, 'assists', limit),
    tackles: top(totals, 'tackles', limit),
    cleanSheets: top(totals, 'cleanSheets', limit),
    motm: top(totals, 'motm', limit),
    gamesWon: top(totals, 'wins', limit),
  };
}

// ── Public: player milestone counters ─────────────────────────────────────────

export type PlayerMilestones = {
  tournamentsPlayed: number;
  matchesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  frontiersWon: number;
};

/** One round trip: every counter the profile milestone wall needs. */
export async function getPlayerMilestones(publicId: string): Promise<PlayerMilestones> {
  const rows = await getDb().execute(sql`
    with me as (
      select discord_id from users where public_id = ${publicId} and is_blacklisted = false
    )
    select
      (select count(distinct m.tournament_id)::int
         from match_participants mp
         join matches m on m.id = mp.match_id
        where mp.user_id in (select discord_id from me))            as tournaments_played,
      (select count(*)::int from match_participants mp
        where mp.user_id in (select discord_id from me))            as matches_played,
      (select count(*)::int from match_participants mp
        where mp.user_id in (select discord_id from me)
          and mp.result = 'win')                                    as wins,
      (select coalesce(sum(mp.goals), 0)::int from match_participants mp
        where mp.user_id in (select discord_id from me))            as goals,
      (select coalesce(sum(mp.assists), 0)::int from match_participants mp
        where mp.user_id in (select discord_id from me))            as assists,
      (select count(*)::int from match_participants mp
        where mp.user_id in (select discord_id from me)
          and mp.clean_sheet)                                       as clean_sheets,
      (select count(*)::int from tournaments t
        where t.winner_team_id in (
          select tm.team_id from team_members tm
          where tm.user_id in (select discord_id from me)))         as frontiers_won
  `);

  const row = rows[0] as Record<string, number> | undefined;
  return {
    tournamentsPlayed: row?.tournaments_played ?? 0,
    matchesPlayed: row?.matches_played ?? 0,
    wins: row?.wins ?? 0,
    goals: row?.goals ?? 0,
    assists: row?.assists ?? 0,
    cleanSheets: row?.clean_sheets ?? 0,
    frontiersWon: row?.frontiers_won ?? 0,
  };
}

// ── Group-stage league table ──────────────────────────────────────────────────

export type LeagueTableRow = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

/** Classic table from the tournament's played group-stage fixtures.
 *  Every team appears, even with zero games. Sorted pts / GD / GF / name. */
export async function computeGroupTable(tournamentId: string): Promise<LeagueTableRow[]> {
  const db = getDb();

  const teamRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId))
    .orderBy(asc(teams.createdAt));
  if (teamRows.length === 0) return [];

  const rows = new Map<string, LeagueTableRow>(
    teamRows.map(t => [t.id, {
      teamId: t.id, teamName: t.name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    }]),
  );

  const played = await db
    .select({
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.stage, 'group')));

  for (const m of played) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = rows.get(m.homeTeamId);
    const away = rows.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) { home.won++; away.lost++; home.points += 3; }
    else if (m.homeScore < m.awayScore) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }

  const table = [...rows.values()];
  for (const r of table) r.goalDiff = r.goalsFor - r.goalsAgainst;
  table.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
  return table;
}
