import type { Db } from './db';
import type { Photo } from './types';

type PhotoRow = { id: number; work_day_id: number; path: string; taken_at: string | null };

export async function addPhoto(db: Db, workDayId: number, path: string, takenAt: string | null): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO photos (work_day_id, path, taken_at) VALUES (?, ?, ?)',
    workDayId,
    path,
    takenAt,
  );
  return result.lastInsertRowId;
}

export async function listPhotos(db: Db, workDayId: number): Promise<Photo[]> {
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT * FROM photos WHERE work_day_id = ? ORDER BY taken_at, id',
    workDayId,
  );
  return rows.map((row) => ({ id: row.id, workDayId: row.work_day_id, path: row.path, takenAt: row.taken_at }));
}

export async function listPhotosForExport(db: Db): Promise<Photo[]> {
  const rows = await db.getAllAsync<PhotoRow>('SELECT * FROM photos ORDER BY id');
  return rows.map((row) => ({ id: row.id, workDayId: row.work_day_id, path: row.path, takenAt: row.taken_at }));
}
