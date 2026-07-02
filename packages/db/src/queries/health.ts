import { getDb } from '../client';
import { config } from '../schema';
import { eq } from 'drizzle-orm';

export type HealthResult = {
  ok: boolean;
  db: 'connected' | 'error';
  host: string | null;
  port: string | null;
  latencyMs: number;
  season?: number;
  error?: string;
};

// Parse host/port from DATABASE_URL for diagnosis. NEVER expose user/password.
// Port is the tell: 6543 = transaction pooler (correct on Vercel), 5432 = direct.
function connectionTarget(): { host: string | null; port: string | null } {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return { host: u.hostname || null, port: u.port || null };
  } catch {
    return { host: null, port: null };
  }
}

// Browser-readable diagnostic that ALWAYS returns fast, even if the DB is
// unreachable — the query is raced against a short timer so /api/health never
// itself hits the Vercel function timeout.
export async function getHealth(): Promise<HealthResult> {
  const { host, port } = connectionTarget();
  const started = Date.now();

  // Guarded so it ALWAYS resolves (never rejects). If the race times out first,
  // this promise's late rejection is already handled here and can't become an
  // unhandled rejection that crashes the serverless function.
  const query: Promise<{ ok: true; season: number } | { ok: false; error: string }> = getDb()
    .select({ currentSeason: config.currentSeason })
    .from(config)
    .where(eq(config.id, 1))
    .limit(1)
    .then(rows => ({ ok: true as const, season: rows[0]?.currentSeason ?? 1 }))
    .catch(e => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));

  const timeout = new Promise<{ ok: false; error: string }>(resolve =>
    setTimeout(
      () => resolve({ ok: false, error: 'DB did not respond within 6s (query blocked on a lock, or database unreachable/paused)' }),
      6000,
    ),
  );

  const outcome = await Promise.race([query, timeout]);
  const latencyMs = Date.now() - started;

  return outcome.ok
    ? { ok: true, db: 'connected', host, port, latencyMs, season: outcome.season }
    : { ok: false, db: 'error', host, port, latencyMs, error: outcome.error };
}
