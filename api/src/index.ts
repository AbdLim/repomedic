import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDatabase, runMigrations } from './database/index.js';
import { startRepairWorker } from './workers/repair.worker.js';

let server: Server | null = null;
let workerHandle: ReturnType<typeof startRepairWorker> | null = null;
let isShuttingDown = false;

async function bootstrap() {
    if (env.RUN_MIGRATIONS) {
        await runMigrations();
    }

    server = createApp().listen(env.PORT, () =>
        logger.info({ port: env.PORT }, 'API listening'),
    );

    if (env.ENABLE_WORKER) {
        workerHandle = startRepairWorker();
    }
}

async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info('Graceful shutdown initiated...');

    const workerStopPromise = workerHandle
        ? workerHandle.stop()
        : Promise.resolve();

    const serverClosePromise = server
        ? new Promise<void>(resolve => server!.close(() => resolve()))
        : Promise.resolve();

    try {
        await Promise.all([serverClosePromise, workerStopPromise]);
    } catch (err) {
        logger.error({ err }, 'Error during server/worker stop');
    } finally {
        await closeDatabase();
        process.exit(0);
    }
}

// Fallback timer if any handles linger during shutdown
function setupFallbackTimer() {
    setTimeout(async () => {
        logger.warn('Forcing process exit after shutdown timeout');
        try {
            await closeDatabase();
        } finally {
            process.exit(1);
        }
    }, 10000).unref();
}

process.on('SIGINT', () => {
    setupFallbackTimer();
    shutdown();
});
process.on('SIGTERM', () => {
    setupFallbackTimer();
    shutdown();
});

bootstrap().catch(err => {
    logger.fatal({ err }, 'Application bootstrap failed');
    process.exit(1);
});
