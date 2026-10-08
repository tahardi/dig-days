import { buildJsonExport } from '@/export/json';
import type { ExportData } from '@/db/types';

const NOW = new Date('2026-06-05T12:00:00.000Z');

const DATA: ExportData = {
  trails: [{ id: 1, name: 'The "Ridge"\nLoop', notes: 'n', createdAt: '2026-05-01T00:00:00.000Z' }],
  features: [{ id: 2, trailId: 1, name: 'Switchback', notes: null, createdAt: '2026-05-02T00:00:00.000Z' }],
  workDays: [
    {
      id: 3,
      status: 'saved',
      startedAt: '2026-06-01T14:00:00.000Z',
      endedAt: '2026-06-01T16:30:00.000Z',
      durationMinutes: 150,
      lat: 40.5,
      lon: -74.25,
      audioPath: '/audio/3.m4a',
      transcript: 'raw talk',
      draftJson: '{"draft":true}',
      processError: null,
      trailId: 1,
      featureId: 2,
      summary: 'Said "hi"\nthen left',
      tools: ['pulaski', 'loppers'],
    },
  ],
  photos: [{ id: 4, workDayId: 3, path: '/photos/some/dir/IMG_1.jpg', takenAt: '2026-06-01T15:00:00.000Z' }],
};

function keysDeep(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((v) => keysDeep(v, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keysDeep(v, out);
    }
  }
  return out;
}

describe('buildJsonExport', () => {
  test('writes the schema version, timestamp, and all four arrays', () => {
    const got = JSON.parse(buildJsonExport(DATA, NOW));

    expect(got.schema_version).toBe(1);
    expect(got.exported_at).toBe('2026-06-05T12:00:00.000Z');
    expect(Object.keys(got)).toEqual(['schema_version', 'exported_at', 'trails', 'features', 'work_days', 'photos']);
    expect(got.trails).toHaveLength(1);
    expect(got.features).toHaveLength(1);
    expect(got.work_days).toHaveLength(1);
    expect(got.photos).toHaveLength(1);
  });

  test('uses snake_case keys and a tools array', () => {
    const got = JSON.parse(buildJsonExport(DATA, NOW));

    expect(got.work_days[0]).toMatchObject({
      id: 3,
      started_at: '2026-06-01T14:00:00.000Z',
      duration_minutes: 150,
      trail_id: 1,
      feature_id: 2,
      tools: ['pulaski', 'loppers'],
    });
    expect(got.features[0].trail_id).toBe(1);
    expect(got.trails[0].created_at).toBe('2026-05-01T00:00:00.000Z');
  });

  test('omits draft, audio, and tools_json keys', () => {
    const keys = keysDeep(JSON.parse(buildJsonExport(DATA, NOW)));

    expect(keys).not.toContain('draft_json');
    expect(keys).not.toContain('audio_path');
    expect(keys).not.toContain('tools_json');
    expect(keys).not.toContain('draftJson');
    expect(keys).not.toContain('audioPath');
  });

  test('keeps only taken_at and file name for photos', () => {
    const got = JSON.parse(buildJsonExport(DATA, NOW));

    expect(got.photos[0]).toEqual({
      id: 4,
      work_day_id: 3,
      file_name: 'IMG_1.jpg',
      taken_at: '2026-06-01T15:00:00.000Z',
    });
  });

  test('keeps names and summaries with quotes and newlines', () => {
    const got = JSON.parse(buildJsonExport(DATA, NOW));

    expect(got.trails[0].name).toBe('The "Ridge"\nLoop');
    expect(got.work_days[0].summary).toBe('Said "hi"\nthen left');
  });

  test('pretty-prints with 2-space indent', () => {
    expect(buildJsonExport(DATA, NOW)).toContain('\n  "schema_version": 1,');
  });
});
