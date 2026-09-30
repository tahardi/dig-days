import type { Db } from './db';
import type { NameOrId, Pin, ReviewInput, WorkDay, WorkDayStatus } from './types';

type WorkDayRow = {
  id: number;
  status: WorkDayStatus;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  lat: number | null;
  lon: number | null;
  audio_path: string | null;
  transcript: string | null;
  draft_json: string | null;
  process_error: string | null;
  trail_id: number | null;
  feature_id: number | null;
  summary: string | null;
  tools_json: string;
};

function toWorkDay(row: WorkDayRow): WorkDay {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
    lat: row.lat,
    lon: row.lon,
    audioPath: row.audio_path,
    transcript: row.transcript,
    draftJson: row.draft_json,
    processError: row.process_error,
    trailId: row.trail_id,
    featureId: row.feature_id,
    summary: row.summary,
    tools: JSON.parse(row.tools_json) as string[],
  };
}

export async function startWorkDay(db: Db, now: Date, pin: Pin | null): Promise<number> {
  let id = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const active = await txn.getFirstAsync<{ id: number }>("SELECT id FROM work_days WHERE status = 'active'");
    if (active) {
      throw new Error('a dig day is already active');
    }
    const result = await txn.runAsync(
      "INSERT INTO work_days (status, started_at, lat, lon) VALUES ('active', ?, ?, ?)",
      now.toISOString(),
      pin?.lat ?? null,
      pin?.lon ?? null,
    );
    id = result.lastInsertRowId;
  });
  return id;
}

export async function getWorkDay(db: Db, id: number): Promise<WorkDay | null> {
  const row = await db.getFirstAsync<WorkDayRow>('SELECT * FROM work_days WHERE id = ?', id);
  return row ? toWorkDay(row) : null;
}

export async function getActiveWorkDay(db: Db): Promise<WorkDay | null> {
  const row = await db.getFirstAsync<WorkDayRow>("SELECT * FROM work_days WHERE status = 'active'");
  return row ? toWorkDay(row) : null;
}

export async function stopWorkDay(db: Db, id: number, now: Date): Promise<void> {
  const row = await db.getFirstAsync<{ started_at: string }>(
    "SELECT started_at FROM work_days WHERE id = ? AND status = 'active'",
    id,
  );
  if (!row) {
    throw new Error('work day is not active');
  }
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(row.started_at).getTime()) / 60000));
  const result = await db.runAsync(
    "UPDATE work_days SET ended_at = ?, duration_minutes = ?, status = 'needs_recording' " +
      "WHERE id = ? AND status = 'active'",
    now.toISOString(),
    minutes,
    id,
  );
  if (result.changes === 0) {
    throw new Error('work day is not active');
  }
}

export async function attachAudio(db: Db, id: number, path: string): Promise<void> {
  const result = await db.runAsync(
    "UPDATE work_days SET audio_path = ?, process_error = NULL, status = 'needs_processing' " +
      "WHERE id = ? AND status = 'needs_recording'",
    path,
    id,
  );
  if (result.changes === 0) {
    throw new Error('work day is not waiting for a recording');
  }
}

export async function listQueue(db: Db): Promise<WorkDay[]> {
  const rows = await db.getAllAsync<WorkDayRow>(
    "SELECT * FROM work_days WHERE status IN ('needs_recording', 'needs_processing', 'needs_review') " +
      'ORDER BY started_at',
  );
  return rows.map(toWorkDay);
}

export async function markProcessed(db: Db, id: number, transcript: string, draftJson: string): Promise<void> {
  await db.runAsync(
    "UPDATE work_days SET transcript = ?, draft_json = ?, process_error = NULL, status = 'needs_review' " +
      "WHERE id = ? AND status = 'needs_processing'",
    transcript,
    draftJson,
    id,
  );
}

export async function markProcessError(db: Db, id: number, message: string): Promise<void> {
  await db.runAsync('UPDATE work_days SET process_error = ? WHERE id = ?', message, id);
}

async function resolveTrail(db: Db, trail: NameOrId, now: string): Promise<number> {
  if ('id' in trail) {
    return trail.id;
  }
  await db.runAsync(
    'INSERT INTO trails (name, created_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
    trail.newName,
    now,
  );
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM trails WHERE name = ?', trail.newName);
  return row!.id;
}

async function resolveFeature(db: Db, trailId: number, feature: NameOrId | null, now: string): Promise<number | null> {
  if (!feature) {
    return null;
  }
  if ('id' in feature) {
    return feature.id;
  }
  await db.runAsync(
    'INSERT INTO features (trail_id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(trail_id, name) DO NOTHING',
    trailId,
    feature.newName,
    now,
  );
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM features WHERE trail_id = ? AND name = ?',
    trailId,
    feature.newName,
  );
  return row!.id;
}

export async function saveReview(db: Db, id: number, input: ReviewInput): Promise<void> {
  if (input.durationMinutes < 0) {
    throw new Error('duration must not be negative');
  }
  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await txn.getFirstAsync<{ status: WorkDayStatus }>('SELECT status FROM work_days WHERE id = ?', id);
    if (current?.status !== 'needs_review' && current?.status !== 'saved') {
      throw new Error('work day is not ready to save');
    }
    const now = new Date().toISOString();
    const trailId = await resolveTrail(txn, input.trail, now);
    const featureId = await resolveFeature(txn, trailId, input.feature, now);
    await txn.runAsync(
      'UPDATE work_days SET trail_id = ?, feature_id = ?, summary = ?, tools_json = ?, duration_minutes = ?, ' +
        "status = 'saved' WHERE id = ?",
      trailId,
      featureId,
      input.summary,
      JSON.stringify(input.tools),
      input.durationMinutes,
      id,
    );
  });
}

export async function listWorkDays(
  db: Db,
  filter: { trailId?: number; featureId?: number | null },
): Promise<WorkDay[]> {
  const trailId = filter.trailId ?? null;
  const filterFeature = filter.featureId === undefined ? 0 : 1;
  const featureId = filter.featureId ?? null;
  const rows = await db.getAllAsync<WorkDayRow>(
    "SELECT * FROM work_days WHERE status = 'saved' AND (? IS NULL OR trail_id = ?) " +
      'AND (? = 0 OR feature_id IS ?) ORDER BY started_at DESC',
    trailId,
    trailId,
    filterFeature,
    featureId,
  );
  return rows.map(toWorkDay);
}
