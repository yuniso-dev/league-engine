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
      prepare: false,      // required for PgBouncer transaction mode (port 6543)
      max: 1,              // keep Vercel serverless from exhausting the pool
      idle_timeout: 20,    // release idle lambda connections back to Supabase quickly
      connect_timeout: 10, // fail fast instead of hanging a request
    });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}
