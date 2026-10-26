import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { closeDatabase } from '../database/index.js';
import { runAiRepair } from '../integrations/ai-service/ai.client.js';
import {
    claimRepair,
    failRepair,
    finishRepair,
    recoverExpiredRepairs,
} from '../modules/repairs/repair.repository.js';
import { messageOf } from '../shared/errors.js';

export interface RepairWorkerHandle {
    workerId: string;
    stop: () => Promise<void>;
}

export function startRepairWorker(customWorkerId?: string): RepairWorkerHandle {
    const workerId = customWorkerId || env.WORKER_ID || randomUUID();
    let stopping = false;
    let pauseResolve: (() => void) | null = null;
    let loopPromise: Promise<void> | null = null;

    const pause = (ms: number) =>
        new Promise<void>(resolve => {
            pauseResolve = resolve;
            const timer = setTimeout(() => {
                pauseResolve = null;
                resolve();
            }, ms);
            timer.unref?.();
        });

    const runLoop = async () => {
        logger.info({ workerId }, 'Repair worker started');
        while (!stopping) {
            try {
                await recoverExpiredRepairs();
                const job = await claimRepair(workerId, env.WORKER_LEASE_SECONDS);
                if (!job) {
                    await pause(env.WORKER_POLL_MS);
                    continue;
                }
                try {
                    const result = await runAiRepair({
                        issue_url: job.issueUrl,
                        repository: job.repository,
                        commit_sha: job.commitSha,
                    });
                    await finishRepair(job.id, workerId, result);
                    logger.info(
                        { repairId: job.id, status: result.status },
                        'Repair finished',
                    );
                } catch (e) {
                    logger.error({ err: e, repairId: job.id }, 'Repair failed');
                    await failRepair(job.id, workerId, messageOf(e));
                }
            } catch (e) {
                logger.error({ err: e }, 'Worker loop error');
                await pause(env.WORKER_POLL_MS);
            }
        }
        logger.info({ workerId }, 'Repair worker stopped');
    };

    loopPromise = runLoop();

    return {
        workerId,
        stop: async () => {
            if (stopping) return;
            stopping = true;
            if (pauseResolve) {
                pauseResolve();
                pauseResolve = null;
            }
            if (loopPromise) {
                await loopPromise;
            }
        },
    };
}

// Standalone CLI execution (yarn dev:worker / yarn start:worker)
const isDirectExecution =
    (typeof require !== 'undefined' && require.main === module) ||
    Boolean(
        process.argv[1] &&
            (process.argv[1].endsWith('repair.worker.ts') ||
                process.argv[1].endsWith('repair.worker.js')),
    );

if (isDirectExecution) {
    const worker = startRepairWorker();
    const shutdown = async () => {
        logger.info('Stopping standalone worker...');
        await worker.stop();
        await closeDatabase();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
