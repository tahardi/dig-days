import type { Db } from '@/db/db';

export async function seedTrail(db: Db, name: string): Promise<number> {
  const result = await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', name, '2026-10-01T00:00:00Z');
  return result.lastInsertRowId;
}

export async function seedFeature(db: Db, trailId: number, name: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO features (trail_id, name, created_at) VALUES (?, ?, ?)',
    trailId,
    name,
    '2026-10-01T00:00:00Z',
  );
  return result.lastInsertRowId;
}

export async function seedDay(
  db: Db,
  day: {
    trailId: number;
    featureId?: number | null;
    startedAt: string;
    minutes: number;
    summary?: string;
    tools?: string[];
    status?: string;
  },
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO work_days (status, started_at, duration_minutes, trail_id, feature_id, summary, tools_json) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
    day.status ?? 'saved',
    day.startedAt,
    day.minutes,
    day.trailId,
    day.featureId ?? null,
    day.summary ?? 'did work',
    JSON.stringify(day.tools ?? []),
  );
  return result.lastInsertRowId;
}
