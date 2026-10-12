import { addPhoto } from '@/db/photos';
import { listAllForExport } from '@/db/export';
import { saveReview, startWorkDay, stopWorkDay, attachAudio, markProcessed } from '@/db/workDays';
import { createTestDb } from '../helpers/testDb';

describe('listAllForExport', () => {
  test('returns every table including unsaved days', async () => {
    const db = await createTestDb();
    const saved = await startWorkDay(db, new Date('2026-06-01T14:00:00Z'), null);
    await stopWorkDay(db, saved, new Date('2026-06-01T15:00:00Z'));
    await attachAudio(db, saved, '/a.m4a');
    await markProcessed(db, saved, 't', '{}');
    await saveReview(db, saved, {
      trail: { newName: 'Ridge' },
      feature: { newName: 'Switchback' },
      summary: 's',
      tools: ['pulaski'],
      durationMinutes: 60,
    });
    await addPhoto(db, saved, '/p/1.jpg', null);
    await startWorkDay(db, new Date('2026-06-02T14:00:00Z'), null);

    const got = await listAllForExport(db);

    expect(got.trails.map((t) => t.name)).toEqual(['Ridge']);
    expect(got.features.map((f) => f.name)).toEqual(['Switchback']);
    expect(got.workDays).toHaveLength(2);
    expect(got.photos).toHaveLength(1);
  });
});
