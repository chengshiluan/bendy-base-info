import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '@/lib/env';
import * as schema from './schema';

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!database) {
    const raw = env.database.url || './local.db';
    // accept libsql-style "file:..." urls as well as plain paths
    const path = raw.replace(/^file:/, '');
    const sqlite = new Database(path);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    database = drizzle(sqlite, { schema });
  }

  return database;
}

export const db = getDb();
export { schema };
