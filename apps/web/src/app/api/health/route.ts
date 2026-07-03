import { getHealth, resetDb, runResilient } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    // runResilient: if this instance's pool is wedged (dead pooled sockets
    // after a lambda thaw), the first probe times out, the pool is rebuilt
    // and the second probe answers — so hitting /api/health also UNWEDGES
    // the instance for every other visitor.
    const result = await runResilient(() => getHealth(), 6000);
    // 200 when the DB is reachable, 503 when it isn't — but always JSON.
    return Response.json(result, { status: result.ok ? 200 : 503 });
  } catch (e) {
    resetDb();
    return Response.json(
      { ok: false, db: 'error', error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
