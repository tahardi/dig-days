import type { ApiResult, BackendConfig, Catalog, ProcessResponse } from '@/api/types';
import { buildCatalog } from '@/db/catalog';
import type { Db } from '@/db/db';
import { getWorkDay } from '@/db/workDays';
import { processAll, type ProcessDeps } from '@/processing/processAll';

import { seedDay, seedTrail } from '../helpers/seed';
import { createTestDb } from '../helpers/testDb';

const config: BackendConfig = { url: 'http://127.0.0.1:8080', key: 'secret' };

const fixture: ProcessResponse = {
  transcript: 'We cleared the berm.',
  draft: {
    trail: { existing_id: 1, new_name: null },
    feature: { existing_id: null, new_name: 'Berm' },
    summary: 'Cleared the berm.',
    tools: ['Shovel'],
    break_minutes: 10,
    notes: '',
  },
};

const audio = new Blob(['audio']);

async function seedQueued(db: Db, startedAt: string, status: string): Promise<number> {
  const trailId = await seedTrail(db, `Trail ${startedAt}`);
  const id = await seedDay(db, { trailId, startedAt, minutes: 60, status });
  await db.runAsync('UPDATE work_days SET audio_path = ? WHERE id = ?', `file:///clip-${id}.m4a`, id);
  return id;
}

function depsFor(db: Db, process: ProcessDeps['process']): ProcessDeps {
  return { db, config, process, readAudio: () => audio };
}

describe('processAll', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  test('happy path - moves every waiting day to review with the stored draft', async () => {
    const first = await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const second = await seedQueued(db, '2026-10-02T15:00:00Z', 'needs_processing');
    const process = jest.fn().mockResolvedValue({ ok: true, value: fixture });

    const summary = await processAll(depsFor(db, process));

    expect(summary).toEqual({ processed: 2, failed: 0 });
    for (const id of [first, second]) {
      const day = await getWorkDay(db, id);
      expect(day?.status).toBe('needs_review');
      expect(day?.transcript).toBe(fixture.transcript);
      expect(JSON.parse(day?.draftJson ?? '')).toEqual(fixture.draft);
    }
  });

  test('error - a failed day keeps its status and the next day still runs', async () => {
    const first = await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const second = await seedQueued(db, '2026-10-02T15:00:00Z', 'needs_processing');
    const process = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: 'unreachable', message: 'offline' })
      .mockResolvedValueOnce({ ok: true, value: fixture });

    const summary = await processAll(depsFor(db, process));

    expect(summary).toEqual({ processed: 1, failed: 1 });
    expect(await getWorkDay(db, first)).toMatchObject({
      status: 'needs_processing',
      processError: "Can't reach backend",
    });
    expect((await getWorkDay(db, second))?.status).toBe('needs_review');
  });

  test.each([
    ['unreachable', "Can't reach backend"],
    ['unauthorized', 'Wrong key'],
    ['no_speech', 'No speech found in the recording'],
    ['too_large', 'Recording is too large'],
    ['bad_request', 'Backend error'],
    ['upstream', 'Backend error'],
    ['invalid_response', 'Backend error'],
  ])('error - %s is stored as "%s"', async (kind, message) => {
    const id = await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const process = jest.fn().mockResolvedValue({ ok: false, kind, message: 'raw' });

    await processAll(depsFor(db, process));

    expect((await getWorkDay(db, id))?.processError).toBe(message);
  });

  test('happy path - only needs_processing days are sent', async () => {
    const waiting = await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    await seedQueued(db, '2026-10-02T15:00:00Z', 'needs_recording');
    await seedQueued(db, '2026-10-03T15:00:00Z', 'needs_review');
    await seedQueued(db, '2026-10-04T15:00:00Z', 'saved');
    const reads: string[] = [];
    const process = jest.fn().mockResolvedValue({ ok: true, value: fixture });

    await processAll({
      ...depsFor(db, process),
      readAudio: (uri) => {
        reads.push(uri);
        return audio;
      },
    });

    expect(process).toHaveBeenCalledTimes(1);
    expect(reads).toEqual([`file:///clip-${waiting}.m4a`]);
  });

  test('happy path - sends days one at a time in start order', async () => {
    const later = await seedQueued(db, '2026-10-02T15:00:00Z', 'needs_processing');
    const earlier = await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const order: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const process = jest.fn(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { ok: true, value: fixture } as ApiResult<ProcessResponse>;
    });

    await processAll({
      ...depsFor(db, process),
      readAudio: (uri) => {
        order.push(uri);
        return audio;
      },
    });

    expect(order).toEqual([`file:///clip-${earlier}.m4a`, `file:///clip-${later}.m4a`]);
    expect(maxRunning).toBe(1);
  });

  test('happy path - concurrent calls send each day once', async () => {
    await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    await seedQueued(db, '2026-10-02T15:00:00Z', 'needs_processing');
    const process = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, value: fixture } as ApiResult<ProcessResponse>;
    });
    const deps = depsFor(db, process);

    const [a, b] = await Promise.all([processAll(deps), processAll(deps)]);

    expect(process).toHaveBeenCalledTimes(2);
    expect(a).toEqual({ processed: 2, failed: 0 });
    expect(b).toEqual(a);
  });

  test('happy path - a later call after the first finishes runs again', async () => {
    await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const process = jest.fn().mockResolvedValue({ ok: false, kind: 'unreachable', message: 'offline' });

    await processAll(depsFor(db, process));
    await processAll(depsFor(db, process));

    expect(process).toHaveBeenCalledTimes(2);
  });

  test('happy path - passes the catalog from the database', async () => {
    await seedQueued(db, '2026-10-01T15:00:00Z', 'needs_processing');
    const seen: Catalog[] = [];
    const process = jest.fn(async (_config: BackendConfig, _audio: Blob, catalog: Catalog) => {
      seen.push(catalog);
      return { ok: true, value: fixture } as ApiResult<ProcessResponse>;
    });

    await processAll(depsFor(db, process));

    expect(seen).toEqual([await buildCatalog(db)]);
    expect(process).toHaveBeenCalledWith(config, audio, expect.anything());
  });
});
