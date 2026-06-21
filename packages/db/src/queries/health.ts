import { getDb } from '../client';
import { config } from '../schema';
import { eq } from 'drizzle-orm';

export async function getHealth(): Promise<{ ok: boolean; season: number }> {
  const [row] = await getDb()
    .select({ currentSeason: config.currentSeason })
    .from(config)
    .where(eq(config.id, 1))
    .limit(1);

  return { ok: true, season: row?.currentSeason ?? 1 };
}
