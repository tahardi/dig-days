export type BindValue = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: BindValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: BindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: BindValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: Db) => Promise<void>): Promise<void>;
}
