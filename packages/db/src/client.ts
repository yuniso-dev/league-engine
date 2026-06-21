import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// DATABASE_URL = pooled Transaction connection, port 6543.
// prepare: false is REQUIRED for PgBouncer transaction mode.
// max: 1 keeps Vercel serverless from exhausting pool connections.
const queryClient = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
});

export const db = drizzle(queryClient, { schema });
