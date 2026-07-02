import { getHealth } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getHealth();
    // 200 when the DB is reachable, 503 when it isn't — but always JSON.
    return Response.json(result, { status: result.ok ? 200 : 503 });
  } catch (e) {
    return Response.json(
      { ok: false, db: 'error', error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
