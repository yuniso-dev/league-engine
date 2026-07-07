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
    /** "1" on the club whose opponent quit — the score may be a forfeit. */
    winnerByDnf?: string | number;
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
    redcards?: string | number;
    /** In-game seconds — 5400 ≈ a full 90'. Short = abandoned/glitched game. */
    secondsPlayed?: string | number;
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
  /** Home stadium name when the endpoint provides it. */
  stadium: string | null;
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
      const stadium = e.stadName ?? info.stadName ?? e.stadiumName ?? info.stadiumName ?? null;
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
        stadium: stadium != null && String(stadium).trim() !== '' ? String(stadium).trim() : null,
      };
    })
    .filter((c): c is EaClubSummary => c !== null);
}

/** Sort key vs the query: exact name → prefix → substring → the rest. */
export function relevance(clubName: string, query: string): number {
  const n = clubName.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return 3;
}

/** EA's search is finicky about the exact query string, so we probe a few
 *  bounded variants of the name and merge the results. Returns { queries,
 *  broad }: `queries` are what to send EA (deduped, ≤3); `broad` is the
 *  distinctive token used to keep the wider net's results relevant. */
export function buildSearchVariants(name: string): { queries: string[]; broad: string | null } {
  const raw = name.trim();
  const collapsed = raw.replace(/\s+/g, ' ');
  const tokens = collapsed.split(' ').filter(Boolean);
  // The longest word is the most distinctive ("lille" beats "VFL"); searching
  // it alone pulls every club containing it, which we then filter locally.
  const longest = tokens.reduce((a, b) => (b.length > a.length ? b : a), '');
  const broad = tokens.length > 1 && longest.length >= 3 && longest.toLowerCase() !== collapsed.toLowerCase()
    ? longest
    : null;

  const queries: string[] = [];
  for (const q of [raw, collapsed, broad]) {
    if (q && !queries.some(existing => existing.toLowerCase() === q.toLowerCase())) queries.push(q);
  }
  return { queries, broad };
}

/** Search clubs by name. EA splits search across two endpoints — clubs/search
 *  (exact-ish) and allTimeLeaderboard/search (partial) — and neither is a
 *  superset of the other, AND both are picky about the exact query string. So
 *  we fan out a few query variants across BOTH endpoints and merge, or e.g.
 *  "VFL LILLE" hides "VFL Lille X". 404 means "no results", not an outage.
 *
 *  Hard ceiling: this can only return clubs EA actually indexes — a brand-new
 *  club with ~zero games isn't searchable by ANY tool; use its numeric ID. */
export async function searchClubs(name: string, platform: string): Promise<EaClubSummary[]> {
  const { queries, broad } = buildSearchVariants(name);

  const urls = queries.flatMap(q => [
    `${BASE}/clubs/search?clubName=${encodeURIComponent(q)}&platform=${encodeURIComponent(platform)}`,
    `${BASE}/allTimeLeaderboard/search?clubName=${encodeURIComponent(q)}&platform=${encodeURIComponent(platform)}`,
  ]);

  const settled = await Promise.allSettled(urls.map(async url => parseClubList(await getJson(url))));

  const byId = new Map<string, EaClubSummary>();
  let lastError: unknown = null;
  for (const result of settled) {
    if (result.status === 'rejected') {
      if (result.reason instanceof EaApiError && result.reason.status === 404) continue; // no results here
      lastError = result.reason; // blocked/down — another variant/endpoint may still answer
      continue;
    }
    for (const club of result.value) {
      const prev = byId.get(club.clubId);
      byId.set(club.clubId, prev
        ? {
            ...prev,
            members: prev.members ?? club.members,
            record: prev.record ?? club.record,
            stadium: prev.stadium ?? club.stadium,
          }
        : club);
    }
  }

  // A hard failure only matters if it left us empty-handed.
  if (byId.size === 0 && lastError) throw lastError;

  // The broad-token query casts a wide net; keep only clubs that actually
  // relate to what was typed (contain the full query OR the distinctive token).
  const q = name.trim().toLowerCase();
  const b = broad?.toLowerCase() ?? null;
  const relevant = [...byId.values()].filter(c => {
    const n = c.name.toLowerCase();
    return n.includes(q) || (b !== null && n.includes(b));
  });

  return relevant
    .sort((a, b) => relevance(a.name, name) - relevance(b.name, name) || a.name.localeCompare(b.name))
    .slice(0, 25);
}

/** Look up clubs by ID (name + crest identity) — validates pasted IDs and puts
 *  real names on reports instead of "club 118660". teamId/crestAssetId pick
 *  the in-game crest artwork (used by the site's club tracker). */
export async function fetchClubsInfo(
  clubIds: string[],
  platform: string,
): Promise<Map<string, { name: string; teamId: string | null; crestAssetId: string | null }>> {
  const out = new Map<string, { name: string; teamId: string | null; crestAssetId: string | null }>();
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
    if (typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    if (v.name == null) continue;
    const kit = (typeof v.customKit === 'object' && v.customKit !== null ? v.customKit : {}) as Record<string, unknown>;
    out.set(String(id), {
      name: String(v.name),
      teamId: v.teamId != null ? String(v.teamId) : null,
      crestAssetId: kit.crestAssetId != null ? String(kit.crestAssetId) : null,
    });
  }
  return out;
}

/** Career club stats — clubs/overallStats. Fetched one club at a time so a
 *  malformed entry for one club can't poison a batch. Returns EA's raw
 *  (stringly-typed) record, or null when EA has nothing. */
export async function fetchClubOverall(
  clubId: string,
  platform: string,
): Promise<Record<string, unknown> | null> {
  const url = `${BASE}/clubs/overallStats?platform=${encodeURIComponent(platform)}&clubIds=${encodeURIComponent(clubId)}`;
  const data = await getJson(url);
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? Object.values(data)
      : [];
  const first = list.find(e => typeof e === 'object' && e !== null);
  return (first as Record<string, unknown> | undefined) ?? null;
}

/** Per-member career stats — members/stats. Raw EA member records. */
export async function fetchClubMembers(
  clubId: string,
  platform: string,
): Promise<Record<string, unknown>[]> {
  const url = `${BASE}/members/stats?platform=${encodeURIComponent(platform)}&clubId=${encodeURIComponent(clubId)}`;
  const data = await getJson(url);
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { members?: unknown }).members)
      ? (data as { members: unknown[] }).members
      : [];
  return list.filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null);
}
