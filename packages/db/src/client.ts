import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;

// Lazy: postgres() is NOT called at import time so next build never opens a
// connection to Supabase. The client is created on the first query call.
export function getDb(): Db {
  if (!_db) {
    const queryClient = postgres(process.env.DATABASE_URL!, {
      prepare: false,        // required for PgBouncer transaction mode (port 6543)
      max: 1,                // one connection per serverless instance
      idle_timeout: 20,      // close idle conns so a reused lambda never grabs a dead one
      max_lifetime: 60 * 30, // recycle a connection every 30 min
      connect_timeout: 10,   // fail fast if the DB is unreachable
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
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}
