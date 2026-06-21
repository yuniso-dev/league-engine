import { getHealth } from '@inazuma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getHealth();
  return Response.json(result);
}
