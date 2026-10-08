import type { ExportData } from '@/db/types';

export function buildJsonExport(data: ExportData, now: Date): string {
  return JSON.stringify(
    {
      schema_version: 1,
      exported_at: now.toISOString(),
      trails: data.trails.map((t) => ({ id: t.id, name: t.name, notes: t.notes, created_at: t.createdAt })),
      features: data.features.map((f) => ({
        id: f.id,
        trail_id: f.trailId,
        name: f.name,
        notes: f.notes,
        created_at: f.createdAt,
      })),
      work_days: data.workDays.map((w) => ({
        id: w.id,
        status: w.status,
        started_at: w.startedAt,
        ended_at: w.endedAt,
        duration_minutes: w.durationMinutes,
        lat: w.lat,
        lon: w.lon,
        transcript: w.transcript,
        process_error: w.processError,
        trail_id: w.trailId,
        feature_id: w.featureId,
        summary: w.summary,
        tools: w.tools,
      })),
      photos: data.photos.map((p) => ({
        id: p.id,
        work_day_id: p.workDayId,
        file_name: p.path.split('/').pop(),
        taken_at: p.takenAt,
      })),
    },
    null,
    2,
  );
}
