import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;
let _client: ReturnType<typeof postgres> | undefined;

// Lazy: postgres() is NOT called at import time so next build never opens a
// connection to Supabase. The client is created on the first query call.
export function getDb(): Db {
  if (!_db) {
    _client = postgres(process.env.DATABASE_URL!, {
      prepare: false,        // required for PgBouncer transaction mode (port 6543)
      // 4 so Promise.all page queries genuinely run in parallel instead of
      // queueing on one connection. Safe through the Supabase pooler (port
      // 6543): PgBouncer multiplexes client connections, and idle_timeout
      // closes them quickly after a serverless burst. Override with DB_POOL_MAX.
      max: Number(process.env.DB_POOL_MAX ?? '4'),
      idle_timeout: 20,      // close idle conns so a reused lambda never grabs a dead one
      max_lifetime: 60 * 30, // recycle a connection every 30 min
      connect_timeout: 10,   // fail fast if the DB is unreachable
      keep_alive: 20,        // TCP keepalive while the process is actually running
      connection: {
        // Cancel any query that runs longer than 15s at the DATABASE, so a query
        // blocked on a lock fails fast instead of hanging until Vercel's function
        // limit (the "canceling statement due to statement timeout" 57014 case,
        // but bounded to 15s instead of 300s).
        statement_timeout: 15_000,
        // Auto-terminate a session left idle inside a transaction (e.g. a
        // serverless function killed mid-request) after 10s, so an abandoned
        // transaction can never keep holding table/row locks and blocking others.
        idle_in_transaction_session_timeout: 10_000,
      },
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

/** Graceful shutdown for long-running processes (the Discord bot). Web never calls this. */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = undefined;
    _db = undefined;
  }
}

/**
 * Abandon a wedged pool so the next getDb() builds a fresh one.
 *
 * Why this exists: a thawed serverless instance can hold TCP sockets the
 * pooler silently closed while the function was frozen. Queries written to
 * those sockets get no reply and no error — EVERY query in that instance
 * just hangs until its timeout, and since one warm instance serves all
 * visitors, the whole site looks down. Dropping the pool is the only cure;
 * reconnecting through the pooler costs ~100ms.
 */
export function resetDb(): void {
  const dead = _client;
  _client = undefined;
  _db = undefined;
  // Best-effort close in the background; dead sockets may never answer.
  if (dead) void dead.end({ timeout: 1 }).catch(() => {});
}

/**
 * Run a DB operation with a client-side time limit; on timeout or failure,
 * reset the pool and retry ONCE on fresh connections. This is what lets a
 * profile save (quote/accent/bio) survive a poisoned pool: attempt one hangs,
 * the pool is rebuilt, attempt two lands in ~100ms.
 */
export async function runResilient<T>(fn: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  const attempt = (): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Database did not respond within ${timeoutMs}ms`)),
        timeoutMs,
      );
      fn().then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });

  try {
    return await attempt();
  } catch (first) {
    console.error('[db] operation failed, rebuilding pool and retrying once:',
      first instanceof Error ? first.message : first);
    resetDb();
    return attempt();
  }
}
