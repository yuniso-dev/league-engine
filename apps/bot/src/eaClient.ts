// Thin client for EA's (unofficial, unauthenticated) FC Clubs API — the same
// endpoints community club-tracker sites use. It is undocumented and can
// change or rate-limit without warning, so: browser-ish UA, short timeout,
// defensive parsing, and every caller treats a failure as "no new data".
// EA_API_BASE overrides the base URL if EA moves it for a new title year.

const BASE = process.env.EA_API_BASE ?? 'https://proclubs.ea.com/api/fc';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export type EaMatchType = 'leagueMatch' | 'playoffMatch' | 'friendlyMatch';

/** Coerce EA's stringly-typed numbers. Shared by the casual + frontier parsers. */
export const eaNum = (v: string | number | undefined | null): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

export type EaRawMatch = {
  matchId: string;
  timestamp: number; // unix seconds
  clubs: Record<string, {
    goals?: string | number;
    goalsAgainst?: string | number;
    details?: { name?: string } | null;
    name?: string;
  }>;
  players: Record<string, Record<string, {
    playername?: string;
    pos?: string;
    rating?: string | number;
    goals?: string | number;
    assists?: string | number;
    tacklesmade?: string | number;
    cleansheetsany?: string | number;
    saves?: string | number;
    shots?: string | number;
    passesmade?: string | number;
    passattempts?: string | number;
    mom?: string | number;
  }>>;
};

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`EA API ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Recent matches for a club (EA returns roughly the last 5–10 per type). */
export async function fetchClubMatches(
  clubId: string,
  platform: string,
  matchType: EaMatchType,
): Promise<EaRawMatch[]> {
  const url = `${BASE}/clubs/matches?matchType=${matchType}&platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}`;
  const data = await getJson(url);
  if (!Array.isArray(data)) throw new Error('EA API returned an unexpected shape (not an array)');
  return data.filter(
    (m): m is EaRawMatch =>
      typeof m === 'object' && m !== null &&
      'matchId' in m && 'clubs' in m && 'players' in m,
  );
}

export type EaClubSummary = {
  clubId: string;
  name: string;
  members: number | null;
};

/** Search clubs by name — how admins find a captain's fresh club ID. EA has
 *  returned both array and keyed-object shapes for this endpoint over the
 *  years, so accept either. */
export async function searchClubs(name: string, platform: string): Promise<EaClubSummary[]> {
  const url = `${BASE}/clubs/search?clubName=${encodeURIComponent(name)}&platform=${encodeURIComponent(platform)}`;
  const data = await getJson(url);
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? Object.values(data)
      : [];

  return list
    .map(entry => {
      if (typeof entry !== 'object' || entry === null) return null;
      const e = entry as Record<string, unknown>;
      const info = (typeof e.clubInfo === 'object' && e.clubInfo !== null ? e.clubInfo : {}) as Record<string, unknown>;
      const clubId = e.clubId ?? info.clubId;
      const clubName = e.name ?? info.name;
      if (clubId == null || clubName == null) return null;
      const members = e.membersCount ?? e.memberCount ?? null;
      return {
        clubId: String(clubId),
        name: String(clubName),
        members: members != null ? eaNum(members as string | number) : null,
      };
    })
    .filter((c): c is EaClubSummary => c !== null);
}
