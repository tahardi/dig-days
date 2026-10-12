import type { ExportData } from '@/db/types';

const HEADER = [
  'date',
  'trail',
  'feature',
  'duration_minutes',
  'summary',
  'tools',
  'lat',
  'lon',
  'started_at',
  'ended_at',
];

function field(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function localDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function buildCsvExport(data: ExportData): string {
  const trails = new Map(data.trails.map((t) => [t.id, t.name]));
  const features = new Map(data.features.map((f) => [f.id, f.name]));
  const rows = data.workDays
    .filter((w) => w.status === 'saved')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((w) => [
      localDate(w.startedAt),
      w.trailId === null ? '' : (trails.get(w.trailId) ?? ''),
      w.featureId === null ? 'General' : (features.get(w.featureId) ?? 'General'),
      w.durationMinutes,
      w.summary,
      w.tools.join('; '),
      w.lat,
      w.lon,
      w.startedAt,
      w.endedAt,
    ]);
  return [HEADER, ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n';
}
