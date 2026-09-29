import type { Db } from './db';

const SCHEMA_V1 = `
CREATE TABLE trails (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE features (
  id INTEGER PRIMARY KEY,
  trail_id INTEGER NOT NULL REFERENCES trails(id),
  name TEXT NOT NULL COLLATE NOCASE,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (trail_id, name)
);

CREATE TABLE work_days (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active','needs_recording','needs_processing','needs_review','saved')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER,
  lat REAL,
  lon REAL,
  audio_path TEXT,
  transcript TEXT,
  draft_json TEXT,
  process_error TEXT,
  trail_id INTEGER REFERENCES trails(id),
  feature_id INTEGER REFERENCES features(id),
  summary TEXT,
  tools_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE photos (
  id INTEGER PRIMARY KEY,
  work_day_id INTEGER NOT NULL REFERENCES work_days(id),
  path TEXT NOT NULL,
  taken_at TEXT
);

PRAGMA user_version = 1;
`;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = 'wal'");
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= 1) {
    return;
  }
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(SCHEMA_V1);
  });
}
