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

/** HTTP-status-carrying error so callers can tell "no results" (EA answers
 *  404 for an empty club search) from "blocked/down". */
export class EaApiError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`EA API ${status} for ${url}`);
    this.name = 'EaApiError';
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new EaApiError(res.status, url);
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
  /** All-time record when the endpoint provides it (W/D/L). */
  record: { wins: number; ties: number; losses: number } | null;
};

function parseClubList(data: unknown): EaClubSummary[] {
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
      const hasRecord = e.wins != null || e.ties != null || e.losses != null;
      return {
        clubId: String(clubId),
        name: String(clubName),
        members: members != null ? eaNum(members as string | number) : null,
        record: hasRecord
          ? {
              wins: eaNum(e.wins as string | number),
              ties: eaNum(e.ties as string | number),
              losses: eaNum(e.losses as string | number),
            }
          : null,
      };
    })
    .filter((c): c is EaClubSummary => c !== null);
}

/** Search clubs by (partial) name. EA has moved this between endpoints across
 *  title years — clubs/search and allTimeLeaderboard/search — so try both.
 *  404 means "no results" on these endpoints, not an outage. */
export async function searchClubs(name: string, platform: string): Promise<EaClubSummary[]> {
  const urls = [
    `${BASE}/clubs/search?clubName=${encodeURIComponent(name)}&platform=${encodeURIComponent(platform)}`,
    `${BASE}/allTimeLeaderboard/search?clubName=${encodeURIComponent(name)}&platform=${encodeURIComponent(platform)}`,
  ];

  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const clubs = parseClubList(await getJson(url));
      if (clubs.length > 0) return clubs;
      // Endpoint answered but found nothing — try the other endpoint too.
    } catch (e) {
      if (e instanceof EaApiError && e.status === 404) continue; // no results here
      lastError = e; // blocked/down — remember, but still try the fallback
    }
  }
  if (lastError) throw lastError;
  return [];
}

/** Look up clubs by ID (name + record) — validates pasted IDs and puts real
 *  names on reports instead of "club 118660". */
export async function fetchClubsInfo(
  clubIds: string[],
  platform: string,
): Promise<Map<string, { name: string }>> {
  const out = new Map<string, { name: string }>();
  if (clubIds.length === 0) return out;
  const url = `${BASE}/clubs/info?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubIds.join(','))}`;
  let data: unknown;
  try {
    data = await getJson(url);
  } catch {
    return out; // enrichment only — callers fall back to the raw ID
  }
  if (typeof data !== 'object' || data === null) return out;
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null && 'name' in value && (value as { name?: unknown }).name != null) {
      out.set(String(id), { name: String((value as { name: unknown }).name) });
    }
  }
  return out;
}
