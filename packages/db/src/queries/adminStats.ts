import { sql } from 'drizzle-orm';
import { getDb } from '../client';

// Dashboard tiles — one round trip for every count. Scalar subqueries with
// ::int casts so postgres.js hands back numbers, not bigint strings.

export type AdminStats = {
  players: number;
  provisional: number;
  tournaments: number;
  liveTournaments: number;
  awards: number;
  grants: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const rows = await getDb().execute(sql`
    select
      (select count(*)::int from users
        where initialised = true and is_blacklisted = false)          as players,
      (select count(*)::int from users
        where initialised = true and is_blacklisted = false
          and provisional = true)                                     as provisional,
      (select count(*)::int from tournaments)                         as tournaments,
      (select count(*)::int from tournaments where status = 'live')   as live_tournaments,
      (select count(*)::int from awards)                              as awards,
      (select count(*)::int from user_awards)                         as grants
  `);

  const row = rows[0] as Record<string, number> | undefined;
  return {
    players: row?.players ?? 0,
    provisional: row?.provisional ?? 0,
    tournaments: row?.tournaments ?? 0,
    liveTournaments: row?.live_tournaments ?? 0,
    awards: row?.awards ?? 0,
    grants: row?.grants ?? 0,
  };
}
