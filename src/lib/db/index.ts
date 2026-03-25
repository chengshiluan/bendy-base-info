import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '@/lib/env';
import * as schema from './schema';

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!env.database.enabled || !env.database.url) {
    return null;
  }

  if (!database) {
    const sql = neon(env.database.url);
    database = drizzle(sql, { schema });
  }

  return database;
}

export const db = getDb();
export { schema };
