import { createTestDb } from '../helpers/testDb';
import { migrate } from '@/db/migrate';

describe('migrate', () => {
  it('happy path - creates version 1 schema', async () => {
    // given
    const db = await createTestDb();

    // when
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('trails','features','work_days','photos')",
    );

    // then
    expect(version?.user_version).toBe(1);
    expect(tables.map((t) => t.name).sort()).toEqual(['features', 'photos', 'trails', 'work_days']);
  });

  it('happy path - running twice is a no-op', async () => {
    // given
    const db = await createTestDb();

    // when
    await migrate(db);

    // then
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(1);
  });

  it('error - rejects trail names that differ only by case', async () => {
    // given
    const db = await createTestDb();
    await db.runAsync('INSERT INTO trails (name, created_at) VALUES (?, ?)', 'White Wolf', '2026-10-03T13:00:00Z');

    // when
    const result = db.runAsync(
      'INSERT INTO trails (name, created_at) VALUES (?, ?)',
      'white wolf',
      '2026-10-03T13:00:00Z',
    );

    // then
    await expect(result).rejects.toThrow(/UNIQUE/);
  });
});
