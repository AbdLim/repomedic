import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function runMigrations() {
    const cwdMigrations = path.resolve(process.cwd(), 'drizzle');
    const relativeMigrations = path.resolve(
        __dirname,
        process.env.NODE_ENV === 'production' ? '../../drizzle' : '../../drizzle',
    );

    const migrationsFolder = fs.existsSync(cwdMigrations)
        ? cwdMigrations
        : relativeMigrations;

    logger.info({ migrationsFolder }, 'Checking database migrations...');

    const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
    try {
        const db = drizzle(migrationClient);
        await migrate(db, { migrationsFolder });
        logger.info('Database migrations applied successfully');
    } catch (error) {
        logger.error({ err: error }, 'Database migration failed');
        throw error;
    } finally {
        await migrationClient.end();
    }
}

// Standalone CLI execution (yarn db:migrate / node dist/database/migrate.js)
const isDirectExecution =
    (typeof require !== 'undefined' && require.main === module) ||
    Boolean(
        process.argv[1] &&
            (process.argv[1].endsWith('migrate.ts') ||
                process.argv[1].endsWith('migrate.js')),
    );

if (isDirectExecution) {
    runMigrations()
        .then(() => {
            logger.info('Migration script finished');
            process.exit(0);
        })
        .catch(err => {
            logger.fatal({ err }, 'Migration script crashed');
            process.exit(1);
        });
}
