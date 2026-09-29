import type { Db } from '@/db/db';
import { allTrailMinutes, featureTotals, trailTotals } from '@/db/totals';
import { createTestDb } from '../helpers/testDb';

type Seed = {
  trailId: number;
  featureId: number | null;
  startedAt: string;
  minutes: number;
  tools: string[];
  status?: string;
};

async function seedDay(db: Db, seed: Seed): Promise<void> {
  await db.runAsync(
    'INSERT INTO work_days (status, started_at, duration_minutes, trail_id, feature_id, tools_json) ' +
      'VALUES (?, ?, ?, ?, ?, ?)',
    seed.status ?? 'saved',
    seed.startedAt,
    seed.minutes,
    seed.trailId,
    seed.featureId,
    JSON.stringify(seed.tools),
  );
}

describe('totals', () => {
  let db: Db;
  let trailA: number;
  let trailB: number;
  let trailEmpty: number;
  let feature: number;

  beforeEach(async () => {
    db = await createTestDb();
    const insertTrail = async (name: string) =>
      (await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', name, '2026-10-01T00:00:00Z'))
        .lastInsertRowId;
    trailA = await insertTrail('A');
    trailB = await insertTrail('B');
    trailEmpty = await insertTrail('Empty');
    feature = (
      await db.runAsync(
        'INSERT INTO features (trail_id, name, created_at) VALUES (?, ?, ?)',
        trailA,
        'Upper Loop',
        '2026-10-01T00:00:00Z',
      )
    ).lastInsertRowId;
  });

  it('happy path - trailTotals sums only saved days', async () => {
    // given
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-03T13:00:00Z', minutes: 60, tools: [] });
    await seedDay(db, {
      trailId: trailA,
      featureId: feature,
      startedAt: '2026-10-04T13:00:00Z',
      minutes: 30,
      tools: [],
    });
    await seedDay(db, {
      trailId: trailA,
      featureId: null,
      startedAt: '2026-10-05T13:00:00Z',
      minutes: 500,
      tools: [],
      status: 'needs_review',
    });
    await seedDay(db, { trailId: trailB, featureId: null, startedAt: '2026-10-06T13:00:00Z', minutes: 999, tools: [] });

    // when
    const got = await trailTotals(db, trailA);

    // then
    expect(got).toMatchObject({ minutes: 90, days: 2, firstDate: '2026-10-03', lastDate: '2026-10-04' });
  });

  it('happy path - two saved days on the same local date count as one', async () => {
    // given
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-03T13:00:00Z', minutes: 60, tools: [] });
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-03T20:00:00Z', minutes: 60, tools: [] });

    // when
    const got = await trailTotals(db, trailA);

    // then
    expect(got.days).toBe(1);
    expect(got.minutes).toBe(120);
  });

  it('happy path - local date uses the New York time zone', async () => {
    // given
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-04T02:00:00Z', minutes: 60, tools: [] });

    // when
    const got = await trailTotals(db, trailA);

    // then
    expect(got).toMatchObject({ firstDate: '2026-10-03', lastDate: '2026-10-03' });
  });

  it('happy path - featureTotals with null counts only feature-less days', async () => {
    // given
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-03T13:00:00Z', minutes: 60, tools: [] });
    await seedDay(db, {
      trailId: trailA,
      featureId: feature,
      startedAt: '2026-10-04T13:00:00Z',
      minutes: 30,
      tools: [],
    });

    // when
    const general = await featureTotals(db, trailA, null);
    const named = await featureTotals(db, trailA, feature);

    // then
    expect(general).toMatchObject({ minutes: 60, days: 1 });
    expect(named).toMatchObject({ minutes: 30, days: 1 });
  });

  it('happy path - topTools orders by count then name and groups case-insensitively', async () => {
    // given
    const days: string[][] = [
      ['Rock Bar', 'sledge', 'McLeod'],
      ['rock bar', 'sledge', 'McLeod'],
      ['rock bar', 'shovel'],
      ['pick', 'sledge'],
    ];
    for (const [i, tools] of days.entries()) {
      await seedDay(db, {
        trailId: trailA,
        featureId: null,
        startedAt: `2026-10-0${i + 1}T13:00:00Z`,
        minutes: 1,
        tools,
      });
    }

    // when
    const got = await trailTotals(db, trailA);

    // then
    expect(got.topTools).toEqual(['Rock Bar', 'sledge', 'McLeod']);
  });

  it('happy path - empty trail returns zero totals', async () => {
    // when
    const got = await trailTotals(db, trailEmpty);

    // then
    expect(got).toEqual({ minutes: 0, days: 0, firstDate: null, lastDate: null, topTools: [] });
  });

  it('happy path - allTrailMinutes sums saved minutes per trail', async () => {
    // given
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-03T13:00:00Z', minutes: 60, tools: [] });
    await seedDay(db, { trailId: trailA, featureId: null, startedAt: '2026-10-04T13:00:00Z', minutes: 30, tools: [] });
    await seedDay(db, { trailId: trailB, featureId: null, startedAt: '2026-10-04T13:00:00Z', minutes: 5, tools: [] });
    await seedDay(db, {
      trailId: trailB,
      featureId: null,
      startedAt: '2026-10-05T13:00:00Z',
      minutes: 50,
      tools: [],
      status: 'needs_review',
    });

    // when
    const got = await allTrailMinutes(db);

    // then
    expect(got).toEqual(
      new Map([
        [trailA, 90],
        [trailB, 5],
      ]),
    );
  });
});
