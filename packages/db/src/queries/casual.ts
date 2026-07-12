import { sql } from 'drizzle-orm';
import { getDb } from '../client';
import { casualMatches, casualMatchPlayers } from '../schema';

// CASUAL realm: FC Clubs matches ingested from the EA Clubs API.
// The bot writes (ingestCasualMatches); the website reads everything else.
// Players are joined to users at query time via lower(ea_name) — linking an
// EA ID later retroactively claims every already-ingested match.

// ── Bot: ingestion ────────────────────────────────────────────────────────────

export type CasualPlayerLine = {
  eaName: string;
  position: string | null;
  rating: number | null;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheet: boolean;
  saves: number;
  shots: number;
  passesMade: number;
  passAttempts: number;
  mom: boolean;
};

export type CasualMatchInput = {
  matchId: string;
  clubId: string;
  matchType: string; // 'league' | 'playoff'
  playedAt: Date;
  opponentName: string | null;
  ourGoals: number;
  oppGoals: number;
  result: 'win' | 'loss' | 'draw';
  players: CasualPlayerLine[];
};

/** Merge freshly fetched matches. EA matchIds are globally unique, so re-polls
 *  are no-ops for matches we already hold. Returns the matchIds that were NEW —
 *  the bot posts exactly these to the casual results feed, so a restart can
 *  never re-announce a game the database already had. */
export async function ingestCasualMatches(matches: CasualMatchInput[]): Promise<string[]> {
  if (matches.length === 0) return [];
  const db = getDb();
  const added: string[] = [];

  for (const m of matches) {
    const inserted = await db
      .insert(casualMatches)
      .values({
        matchId: m.matchId,
        clubId: m.clubId,
        matchType: m.matchType,
        opponentName: m.opponentName,
        ourGoals: m.ourGoals,
        oppGoals: m.oppGoals,
        result: m.result,
        playedAt: m.playedAt,
      })
      .onConflictDoNothing()
      .returning({ matchId: casualMatches.matchId });

    if (inserted.length === 0) continue; // already ingested
    added.push(m.matchId);

    if (m.players.length > 0) {
      await db
        .insert(casualMatchPlayers)
        .values(m.players.map(p => ({
          matchId: m.matchId,
          eaName: p.eaName,
          position: p.position,
          rating: p.rating != null ? p.rating.toFixed(2) : null,
          goals: p.goals,
          assists: p.assists,
          tackles: p.tackles,
          cleanSheet: p.cleanSheet,
          saves: p.saves,
          shots: p.shots,
          passesMade: p.passesMade,
          passAttempts: p.passAttempts,
          mom: p.mom,
        })))
        .onConflictDoNothing();
    }
  }
  return added;
}

// ── Website: reads (public-safe — publicId only, never discordId) ─────────────

export type CasualLeaderRow = {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  eaName: string;
  apps: number;
  avgRating: number;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheets: number;
};

/** Every linked player, ordered by average match rating (the order setter). */
export async function getCasualLeaderboard(): Promise<CasualLeaderRow[]> {
  const rows = await getDb().execute(sql`
    select u.public_id                                  as "publicId",
           u.display_name                               as "displayName",
           u.avatar_url                                 as "avatarUrl",
           u.country                                    as "country",
           u.ea_name                                    as "eaName",
           count(p.match_id)::int                       as "apps",
           coalesce(avg(p.rating), 0)::float            as "avgRating",
           coalesce(sum(p.goals), 0)::int               as "goals",
           coalesce(sum(p.assists), 0)::int             as "assists",
           coalesce(sum(p.tackles), 0)::int             as "tackles",
           (count(*) filter (where p.clean_sheet))::int as "cleanSheets"
      from users u
      left join casual_match_players p on lower(p.ea_name) = lower(u.ea_name)
     where u.ea_name is not null
       and u.initialised = true
       and u.is_blacklisted = false
     group by u.public_id, u.display_name, u.avatar_url, u.country, u.ea_name
     order by "avgRating" desc, "apps" desc, u.display_name asc
  `);
  return (rows as unknown as CasualLeaderRow[]).map(r => ({
    ...r,
    avgRating: Number(r.avgRating),
  }));
}

export type CasualHistoryMatch = {
  matchId: string;
  playedAt: string;          // ISO — serialised for the client
  matchType: string;
  opponentName: string | null;
  ourGoals: number;
  oppGoals: number;
  result: string;
  position: string | null;
  rating: number | null;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheet: boolean;
  saves: number;
  mom: boolean;
};

/** A player's casual match history, newest first. */
export async function getCasualHistory(publicId: string, limit = 25): Promise<CasualHistoryMatch[]> {
  const rows = await getDb().execute(sql`
    select m.match_id       as "matchId",
           m.played_at      as "playedAt",
           m.match_type     as "matchType",
           m.opponent_name  as "opponentName",
           m.our_goals      as "ourGoals",
           m.opp_goals      as "oppGoals",
           m.result         as "result",
           p.position       as "position",
           p.rating::float  as "rating",
           p.goals          as "goals",
           p.assists        as "assists",
           p.tackles        as "tackles",
           p.clean_sheet    as "cleanSheet",
           p.saves          as "saves",
           p.mom            as "mom"
      from casual_match_players p
      join casual_matches m on m.match_id = p.match_id
      join users u on lower(u.ea_name) = lower(p.ea_name)
     where u.public_id = ${publicId}
       and u.is_blacklisted = false
     order by m.played_at desc
     limit ${limit}
  `);
  return (rows as unknown as (Omit<CasualHistoryMatch, 'playedAt' | 'rating'> & { playedAt: Date; rating: number | null })[])
    .map(r => ({
      ...r,
      playedAt: new Date(r.playedAt).toISOString(),
      rating: r.rating != null ? Number(r.rating) : null,
    }));
}

export type CasualCareer = {
  eaName: string;
  apps: number;
  avgRating: number;
  bestRating: number | null;
  goals: number;
  assists: number;
  tackles: number;
  cleanSheets: number;
  saves: number;
  motm: number;
  wins: number;
  draws: number;
  losses: number;
};

/** Career aggregates at EA-ID level for one player. Null when not linked. */
export async function getCasualCareer(publicId: string): Promise<CasualCareer | null> {
  const rows = await getDb().execute(sql`
    select u.ea_name                                    as "eaName",
           count(p.match_id)::int                       as "apps",
           coalesce(avg(p.rating), 0)::float            as "avgRating",
           max(p.rating)::float                         as "bestRating",
           coalesce(sum(p.goals), 0)::int               as "goals",
           coalesce(sum(p.assists), 0)::int             as "assists",
           coalesce(sum(p.tackles), 0)::int             as "tackles",
           (count(*) filter (where p.clean_sheet))::int as "cleanSheets",
           coalesce(sum(p.saves), 0)::int               as "saves",
           (count(*) filter (where p.mom))::int         as "motm",
           (count(*) filter (where m.result = 'win'))::int  as "wins",
           (count(*) filter (where m.result = 'draw'))::int as "draws",
           (count(*) filter (where m.result = 'loss'))::int as "losses"
      from users u
      left join casual_match_players p on lower(p.ea_name) = lower(u.ea_name)
      left join casual_matches m on m.match_id = p.match_id
     where u.public_id = ${publicId}
       and u.ea_name is not null
       and u.is_blacklisted = false
     group by u.ea_name
  `);
  const list = rows as unknown as CasualCareer[];
  if (list.length === 0) return null;
  const r = list[0];
  return {
    ...r,
    avgRating: Number(r.avgRating),
    bestRating: r.bestRating != null ? Number(r.bestRating) : null,
  };
}

export type LinkedCasualPlayer = {
  publicId: string;
  displayName: string;
  eaName: string;
};

/** Everyone with an EA ID linked — powers the player picker. */
export async function listLinkedCasualPlayers(): Promise<LinkedCasualPlayer[]> {
  const rows = await getDb().execute(sql`
    select u.public_id    as "publicId",
           u.display_name as "displayName",
           u.ea_name      as "eaName"
      from users u
     where u.ea_name is not null
       and u.public_id is not null
       and u.initialised = true
       and u.is_blacklisted = false
     order by u.display_name asc
  `);
  return rows as unknown as LinkedCasualPlayer[];
}
