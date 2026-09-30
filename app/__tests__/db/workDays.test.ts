import type { Db } from '@/db/db';
import {
  attachAudio,
  getActiveWorkDay,
  getWorkDay,
  listQueue,
  markProcessed,
  markProcessError,
  saveReview,
  startWorkDay,
  stopWorkDay,
} from '@/db/workDays';
import { listTrails } from '@/db/trails';
import { trailTotals } from '@/db/totals';
import { createTestDb } from '../helpers/testDb';

const START = new Date('2026-10-03T13:00:00Z');
const STOP = new Date('2026-10-03T16:29:40Z');
const PIN = { lat: 44.5, lon: -73.2 };
const REVIEW = {
  trail: { newName: 'White Wolf' },
  feature: null,
  summary: 'Cleared drains',
  tools: ['rock bar'],
  durationMinutes: 210,
};

async function toNeedsReview(db: Db, start = START, stop = STOP): Promise<number> {
  const id = await startWorkDay(db, start, PIN);
  await stopWorkDay(db, id, stop);
  await attachAudio(db, id, '/audio/a.m4a');
  await markProcessed(db, id, 'transcript', '{}');
  return id;
}

describe('workDays', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it('happy path - start stores the pin and is returned as active', async () => {
    // given
    const id = await startWorkDay(db, START, PIN);

    // when
    const got = await getActiveWorkDay(db);

    // then
    expect(got).toMatchObject({
      id,
      status: 'active',
      startedAt: START.toISOString(),
      lat: 44.5,
      lon: -73.2,
      tools: [],
    });
  });

  it('happy path - start with null pin stores null lat and lon', async () => {
    // given
    const id = await startWorkDay(db, START, null);

    // when
    const got = await getWorkDay(db, id);

    // then
    expect(got?.lat).toBeNull();
    expect(got?.lon).toBeNull();
  });

  it('error - second active day throws', async () => {
    // given
    await startWorkDay(db, START, null);

    // when
    const result = startWorkDay(db, START, null);

    // then
    await expect(result).rejects.toThrow('a dig day is already active');
  });

  it.each([
    ['same day', START, STOP, 210],
    ['across midnight UTC', new Date('2026-10-03T22:00:00Z'), new Date('2026-10-04T01:30:00Z'), 210],
    ['clock skew clamps to zero', START, new Date('2026-10-03T12:00:00Z'), 0],
  ])('happy path - stop computes duration %s', async (_name, start, stop, minutes) => {
    // given
    const id = await startWorkDay(db, start, null);

    // when
    await stopWorkDay(db, id, stop);

    // then
    const got = await getWorkDay(db, id);
    expect(got).toMatchObject({
      status: 'needs_recording',
      durationMinutes: minutes,
      endedAt: stop.toISOString(),
    });
  });

  it('error - stop from non-active status throws', async () => {
    // given
    const id = await startWorkDay(db, START, null);
    await stopWorkDay(db, id, STOP);

    // when
    const result = stopWorkDay(db, id, STOP);

    // then
    await expect(result).rejects.toThrow();
  });

  it('happy path - attachAudio moves to needs_processing', async () => {
    // given
    const id = await startWorkDay(db, START, null);
    await stopWorkDay(db, id, STOP);

    // when
    await attachAudio(db, id, '/audio/a.m4a');

    // then
    const got = await getWorkDay(db, id);
    expect(got).toMatchObject({ status: 'needs_processing', audioPath: '/audio/a.m4a' });
  });

  it('error - attachAudio from active throws', async () => {
    // given
    const id = await startWorkDay(db, START, null);

    // when
    const result = attachAudio(db, id, '/audio/a.m4a');

    // then
    await expect(result).rejects.toThrow();
  });

  it('happy path - listQueue includes pending statuses in start order', async () => {
    // given
    const saved = await toNeedsReview(db, new Date('2026-10-01T13:00:00Z'), new Date('2026-10-01T14:00:00Z'));
    await saveReview(db, saved, REVIEW);
    const review = await toNeedsReview(db, new Date('2026-10-03T13:00:00Z'), new Date('2026-10-03T14:00:00Z'));
    const recording = await startWorkDay(db, new Date('2026-10-02T13:00:00Z'), null);
    await stopWorkDay(db, recording, new Date('2026-10-02T14:00:00Z'));
    const processing = await startWorkDay(db, new Date('2026-10-04T13:00:00Z'), null);
    await stopWorkDay(db, processing, new Date('2026-10-04T14:00:00Z'));
    await attachAudio(db, processing, '/audio/b.m4a');
    await startWorkDay(db, new Date('2026-10-05T13:00:00Z'), null);

    // when
    const queue = await listQueue(db);

    // then
    expect(queue.map((w) => w.id)).toEqual([recording, review, processing]);
  });

  it('happy path - markProcessed moves to needs_review and is idempotent', async () => {
    // given
    const id = await toNeedsReview(db);

    // when
    await markProcessed(db, id, 'other', '{"x":1}');

    // then
    const got = await getWorkDay(db, id);
    expect(got).toMatchObject({ status: 'needs_review', transcript: 'transcript', draftJson: '{}' });
  });

  it('happy path - markProcessError keeps status and later steps clear it', async () => {
    // given
    const id = await startWorkDay(db, START, null);
    await stopWorkDay(db, id, STOP);
    await attachAudio(db, id, '/audio/a.m4a');

    // when
    await markProcessError(db, id, 'boom');

    // then
    expect(await getWorkDay(db, id)).toMatchObject({ status: 'needs_processing', processError: 'boom' });
    await markProcessed(db, id, 't', '{}');
    expect((await getWorkDay(db, id))?.processError).toBeNull();
  });

  it('happy path - attachAudio clears the process error', async () => {
    // given
    const id = await startWorkDay(db, START, null);
    await stopWorkDay(db, id, STOP);
    await db.runAsync('UPDATE work_days SET process_error = ? WHERE id = ?', 'boom', id);

    // when
    await attachAudio(db, id, '/audio/a.m4a');

    // then
    expect((await getWorkDay(db, id))?.processError).toBeNull();
  });

  it('happy path - saveReview reuses an existing trail case-insensitively', async () => {
    // given
    const existing = await db.runAsync(
      'INSERT INTO trails (name, created_at) VALUES (?, ?)',
      'White Wolf',
      START.toISOString(),
    );
    const id = await toNeedsReview(db);

    // when
    await saveReview(db, id, { ...REVIEW, trail: { newName: 'white wolf' } });

    // then
    const got = await getWorkDay(db, id);
    expect(got?.trailId).toBe(existing.lastInsertRowId);
    expect(await listTrails(db)).toHaveLength(1);
  });

  it('happy path - saveReview creates trail and feature and totals include the day', async () => {
    // given
    const id = await toNeedsReview(db);

    // when
    await saveReview(db, id, { ...REVIEW, feature: { newName: 'Upper Loop' }, tools: ['rock bar', 'sledge'] });

    // then
    const got = await getWorkDay(db, id);
    expect(got).toMatchObject({ status: 'saved', summary: 'Cleared drains', tools: ['rock bar', 'sledge'] });
    expect(got?.trailId).not.toBeNull();
    expect(got?.featureId).not.toBeNull();
    expect(await trailTotals(db, got!.trailId!)).toMatchObject({ minutes: 210, days: 1 });
  });

  it('happy path - saveReview edits a saved day', async () => {
    // given
    const id = await toNeedsReview(db);
    await saveReview(db, id, REVIEW);

    // when
    await saveReview(db, id, { ...REVIEW, summary: 'Edited', durationMinutes: 60 });

    // then
    expect(await getWorkDay(db, id)).toMatchObject({ status: 'saved', summary: 'Edited', durationMinutes: 60 });
  });

  it('error - saveReview rolls back when the feature violates a foreign key', async () => {
    // given
    const id = await toNeedsReview(db);

    // when
    const result = saveReview(db, id, { ...REVIEW, feature: { id: 999 } });

    // then
    await expect(result).rejects.toThrow();
    expect(await listTrails(db)).toHaveLength(0);
    expect((await getWorkDay(db, id))?.status).toBe('needs_review');
  });

  it('error - saveReview rejects negative duration', async () => {
    // given
    const id = await toNeedsReview(db);

    // when
    const result = saveReview(db, id, { ...REVIEW, durationMinutes: -5 });

    // then
    await expect(result).rejects.toThrow();
  });

  it('error - saveReview from active throws', async () => {
    // given
    const id = await startWorkDay(db, START, null);

    // when
    const result = saveReview(db, id, REVIEW);

    // then
    await expect(result).rejects.toThrow();
  });
});
