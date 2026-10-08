import { buildCsvExport } from '@/export/csv';
import type { ExportData, WorkDay } from '@/db/types';

const HEADER = 'date,trail,feature,duration_minutes,summary,tools,lat,lon,started_at,ended_at';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += c;
    }
  }
  return rows;
}

function workDay(overrides: Partial<WorkDay>): WorkDay {
  return {
    id: 1,
    status: 'saved',
    startedAt: '2026-06-01T14:00:00.000Z',
    endedAt: '2026-06-01T16:30:00.000Z',
    durationMinutes: 150,
    lat: 40.5,
    lon: -74.25,
    audioPath: '/audio/1.m4a',
    transcript: 'raw',
    draftJson: '{"draft":true}',
    processError: null,
    trailId: 1,
    featureId: 1,
    summary: 'Cleared brush',
    tools: ['pulaski', 'loppers'],
    ...overrides,
  };
}

function data(workDays: WorkDay[]): ExportData {
  return {
    trails: [{ id: 1, name: 'Ridge', notes: null, createdAt: '2026-05-01T00:00:00.000Z' }],
    features: [{ id: 1, trailId: 1, name: 'Switchback', notes: null, createdAt: '2026-05-01T00:00:00.000Z' }],
    workDays,
    photos: [],
  };
}

describe('buildCsvExport', () => {
  test('writes the exact header and ends lines with CRLF', () => {
    const got = buildCsvExport(data([workDay({})]));

    expect(got.startsWith(`${HEADER}\r\n`)).toBe(true);
    expect(got.endsWith('\r\n')).toBe(true);
    expect(got.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  test('writes one row with trail, feature, tools joined, and coordinates', () => {
    const got = parseCsv(buildCsvExport(data([workDay({})])));

    expect(got).toEqual([
      HEADER.split(','),
      [
        '2026-06-01',
        'Ridge',
        'Switchback',
        '150',
        'Cleared brush',
        'pulaski; loppers',
        '40.5',
        '-74.25',
        '2026-06-01T14:00:00.000Z',
        '2026-06-01T16:30:00.000Z',
      ],
    ]);
  });

  test('uses General when the feature is null', () => {
    const got = parseCsv(buildCsvExport(data([workDay({ featureId: null })])));

    expect(got[1][2]).toBe('General');
  });

  test('leaves coordinates and end time empty when missing', () => {
    const got = parseCsv(buildCsvExport(data([workDay({ lat: null, lon: null, endedAt: null })])));

    expect([got[1][6], got[1][7], got[1][9]]).toEqual(['', '', '']);
  });

  test('round-trips a summary with quotes, commas, and newlines', () => {
    const summary = 'Devil\'s "Staircase", upper\nsection';

    const got = parseCsv(buildCsvExport(data([workDay({ summary })])));

    expect(got).toHaveLength(2);
    expect(got[1][4]).toBe(summary);
  });

  test('exports only saved days ordered by start time', () => {
    const days = [
      workDay({ id: 1, summary: 'late', startedAt: '2026-06-03T14:00:00.000Z' }),
      workDay({ id: 2, summary: 'draft', status: 'needs_review' }),
      workDay({ id: 3, summary: 'early', startedAt: '2026-06-02T14:00:00.000Z' }),
    ];

    const got = parseCsv(buildCsvExport(data(days)));

    expect(got.slice(1).map((r) => r[4])).toEqual(['early', 'late']);
  });

  test('uses the local date across midnight UTC', () => {
    const got = parseCsv(buildCsvExport(data([workDay({ startedAt: '2026-06-02T02:30:00.000Z' })])));

    expect(got[1][0]).toBe('2026-06-01');
  });
});
