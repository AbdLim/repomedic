import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { logger } from './config/logger.js';
import { repairRouter } from './modules/repairs/repair.routes.js';
import { HttpError, messageOf } from './shared/errors.js';

export function createApp() {
    const app = express();
    app.use(helmet());
    app.use(
        cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }),
    );
    app.use(express.json({ limit: '32kb' }));
    app.get('/health', (_req, res) =>
        res.json({ status: 'ok', service: 'repomedic-api' }),
    );
    app.use('/api/v1/repairs', repairRouter);
    app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
    app.use(
        (
            err: unknown,
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            const status =
                err instanceof HttpError
                    ? err.status
                    : err instanceof ZodError
                      ? 400
                      : 500;
            if (status === 500) logger.error({ err }, 'Unhandled API error');
            res.status(status).json({
                error:
                    status === 500 ? 'Internal server error' : messageOf(err),
            });
        },
    );
    return app;
}
