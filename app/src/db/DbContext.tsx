import { createContext, useContext, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { Db } from './db';

const DbContext = createContext<Db | null>(null);

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error('useDb must be used inside a DbProvider');
  }
  return db;
}

export function DbTestProvider({ db, children }: { db: Db; children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function DbProvider({ children }: { children: ReactNode }) {
  const sqliteDb = useSQLiteContext() as unknown as Db;
  return <DbContext.Provider value={sqliteDb}>{children}</DbContext.Provider>;
}
