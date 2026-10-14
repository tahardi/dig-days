import { buildCatalog } from '@/db/catalog';
import type { Db } from '@/db/db';

import { seedDay, seedFeature, seedTrail } from '../helpers/seed';
import { createTestDb } from '../helpers/testDb';

describe('buildCatalog', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  test('returns an empty catalog for an empty database', async () => {
    expect(await buildCatalog(db)).toEqual({ trails: [], tools: [] });
  });

  test('lists trails and features ordered by name', async () => {
    const south = await seedTrail(db, 'South Loop');
    const north = await seedTrail(db, 'North Ridge');
    const switchback = await seedFeature(db, north, 'Switchback');
    const berm = await seedFeature(db, north, 'Berm');

    expect(await buildCatalog(db)).toEqual({
      trails: [
        {
          id: north,
          name: 'North Ridge',
          features: [
            { id: berm, name: 'Berm' },
            { id: switchback, name: 'Switchback' },
          ],
        },
        { id: south, name: 'South Loop', features: [] },
      ],
      tools: [],
    });
  });

  test('lists distinct tool names sorted by name', async () => {
    const trail = await seedTrail(db, 'North Ridge');
    await seedDay(db, { trailId: trail, startedAt: '2026-10-01T15:00:00Z', minutes: 60, tools: ['Shovel', 'Mcleod'] });
    await seedDay(db, { trailId: trail, startedAt: '2026-10-02T15:00:00Z', minutes: 60, tools: ['Shovel', 'Rake'] });

    expect((await buildCatalog(db)).tools).toEqual(['Mcleod', 'Rake', 'Shovel']);
  });

  test('groups tools case-insensitively and keeps the most used spelling', async () => {
    const trail = await seedTrail(db, 'North Ridge');
    await seedDay(db, { trailId: trail, startedAt: '2026-10-01T15:00:00Z', minutes: 60, tools: ['Rock Bar'] });
    await seedDay(db, { trailId: trail, startedAt: '2026-10-02T15:00:00Z', minutes: 60, tools: ['rock bar'] });
    await seedDay(db, { trailId: trail, startedAt: '2026-10-03T15:00:00Z', minutes: 60, tools: ['rock bar'] });

    expect((await buildCatalog(db)).tools).toEqual(['rock bar']);
  });

  test('breaks spelling ties alphabetically', async () => {
    const trail = await seedTrail(db, 'North Ridge');
    await seedDay(db, { trailId: trail, startedAt: '2026-10-01T15:00:00Z', minutes: 60, tools: ['rock bar'] });
    await seedDay(db, { trailId: trail, startedAt: '2026-10-02T15:00:00Z', minutes: 60, tools: ['Rock Bar'] });

    expect((await buildCatalog(db)).tools).toEqual(['Rock Bar']);
  });

  test('excludes tools from days that are not saved', async () => {
    const trail = await seedTrail(db, 'North Ridge');
    await seedDay(db, { trailId: trail, startedAt: '2026-10-01T15:00:00Z', minutes: 60, tools: ['Shovel'] });
    await seedDay(db, {
      trailId: trail,
      startedAt: '2026-10-02T15:00:00Z',
      minutes: 60,
      tools: ['Chainsaw'],
      status: 'needs_review',
    });

    expect((await buildCatalog(db)).tools).toEqual(['Shovel']);
  });
});
