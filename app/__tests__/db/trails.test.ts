import type { Db } from '@/db/db';
import { getFeature, getTrail, listFeatures, listTrails } from '@/db/trails';
import { createTestDb } from '../helpers/testDb';

describe('trails', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it('happy path - listTrails orders by name', async () => {
    // given
    await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', 'b trail', '2026-10-01T00:00:00Z');
    await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', 'A trail', '2026-10-01T00:00:00Z');

    // when
    const got = await listTrails(db);

    // then
    expect(got.map((t) => t.name)).toEqual(['A trail', 'b trail']);
  });

  it('happy path - getTrail, listFeatures and getFeature map columns', async () => {
    // given
    const trail = await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', 'A', '2026-10-01T00:00:00Z');
    const feature = await db.runAsync(
      'INSERT INTO features (trail_id, name, created_at) VALUES (?, ?, ?)',
      trail.lastInsertRowId,
      'Loop',
      '2026-10-01T00:00:00Z',
    );

    // when
    const gotTrail = await getTrail(db, trail.lastInsertRowId);
    const features = await listFeatures(db, trail.lastInsertRowId);
    const gotFeature = await getFeature(db, feature.lastInsertRowId);

    // then
    expect(gotTrail).toEqual({ id: trail.lastInsertRowId, name: 'A', notes: null, createdAt: '2026-10-01T00:00:00Z' });
    expect(features).toEqual([gotFeature]);
    expect(gotFeature?.trailId).toBe(trail.lastInsertRowId);
  });

  it('happy path - missing ids return null', async () => {
    // when
    const trail = await getTrail(db, 1);
    const feature = await getFeature(db, 1);

    // then
    expect(trail).toBeNull();
    expect(feature).toBeNull();
  });
});
