import type { Db } from './db';
import type { Feature, Trail } from './types';

type TrailRow = { id: number; name: string; notes: string | null; created_at: string };
type FeatureRow = TrailRow & { trail_id: number };

function toTrail(row: TrailRow): Trail {
  return { id: row.id, name: row.name, notes: row.notes, createdAt: row.created_at };
}

function toFeature(row: FeatureRow): Feature {
  return { id: row.id, trailId: row.trail_id, name: row.name, notes: row.notes, createdAt: row.created_at };
}

export async function listTrails(db: Db): Promise<Trail[]> {
  const rows = await db.getAllAsync<TrailRow>('SELECT * FROM trails ORDER BY name');
  return rows.map(toTrail);
}

export async function getTrail(db: Db, id: number): Promise<Trail | null> {
  const row = await db.getFirstAsync<TrailRow>('SELECT * FROM trails WHERE id = ?', id);
  return row ? toTrail(row) : null;
}

export async function listFeatures(db: Db, trailId: number): Promise<Feature[]> {
  const rows = await db.getAllAsync<FeatureRow>('SELECT * FROM features WHERE trail_id = ? ORDER BY name', trailId);
  return rows.map(toFeature);
}

export async function getFeature(db: Db, id: number): Promise<Feature | null> {
  const row = await db.getFirstAsync<FeatureRow>('SELECT * FROM features WHERE id = ?', id);
  return row ? toFeature(row) : null;
}

export async function listAllFeatures(db: Db): Promise<Feature[]> {
  const rows = await db.getAllAsync<FeatureRow>('SELECT * FROM features ORDER BY id');
  return rows.map(toFeature);
}
