import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';

export const sql = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20 });
export const db = drizzle(sql);
export async function closeDatabase() {
    await sql.end();
}
export { runMigrations } from './migrate.js';
