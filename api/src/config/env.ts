import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    GITHUB_TOKEN: z.string().optional(),
    AI_SERVICE_URL: z.url().default('http://localhost:8000'),
    AI_REPAIR_PATH: z.string().startsWith('/').default('/repair'),
    AI_SERVICE_TOKEN: z.string().optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),
    WORKER_POLL_MS: z.coerce.number().int().positive().default(3000),
    WORKER_LEASE_SECONDS: z.coerce.number().int().positive().default(900),
    WORKER_ID: z.string().optional(),
    ENABLE_WORKER: z
        .preprocess(
            val =>
                val === undefined
                    ? true
                    : val !== 'false' && val !== '0' && val !== false,
            z.boolean(),
        )
        .default(true),
    RUN_MIGRATIONS: z
        .preprocess(
            val =>
                val === undefined
                    ? true
                    : val !== 'false' && val !== '0' && val !== false,
            z.boolean(),
        )
        .default(true),
});

export const env = schema.parse(process.env);
