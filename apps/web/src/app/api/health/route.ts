import { getHealth } from '@inazuma/db';

export const runtime = 'nodejs';

export async function GET() {
  const result = await getHealth();
  return Response.json(result);
}
