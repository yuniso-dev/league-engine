import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getDb } from '../client';
import { adminActions, config } from '../schema';

export type ConfigRow = InferSelectModel<typeof config>;

// Matches the column defaults in schema.ts — used when the singleton row
// hasn't been created yet (mirrors DEFAULT_ELO_CONFIG's fallback role).
const DEFAULT_CONFIG: ConfigRow = {
  id: 1,
  currentSeason: 1,
  guildId: null,
  rankingsMessageId: null,
  rankingsChannelId: null,
  eloBase: '1000',
  kPlacement: 60,
  kEstablished: 24,
  placementGames: 5,
  decayWeeks: 4,
  movMultiplierCap: '1.75',
  lastRevealAt: null,
  updatedAt: new Date(),
};

export async function getConfig(): Promise<ConfigRow> {
  const [row] = await getDb().select().from(config).limit(1);
  return row ?? DEFAULT_CONFIG;
}

export async function updateConfig(
  adminId: string,
  data: {
    currentSeason: number;
    eloBase: number;
    kPlacement: number;
    kEstablished: number;
    placementGames: number;
    movMultiplierCap: number;
    guildId: string | null;
    rankingsMessageId: string | null;
  },
): Promise<void> {
  const now = new Date();
  const values = {
    currentSeason: data.currentSeason,
    eloBase: data.eloBase.toFixed(2),
    kPlacement: data.kPlacement,
    kEstablished: data.kEstablished,
    placementGames: data.placementGames,
    movMultiplierCap: data.movMultiplierCap.toFixed(2),
    guildId: data.guildId,
    rankingsMessageId: data.rankingsMessageId,
    updatedAt: now,
  };

  await getDb()
    .insert(config)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: config.id, set: values });

  await getDb().insert(adminActions).values({ adminId, action: 'config.update', details: values });
}
