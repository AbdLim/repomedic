import { z } from 'zod';

export const submitRepairSchema = z
    .object({ issue_url: z.string().min(1), environment: z.any().nullable() })
    .strict();
export const idSchema = z.uuid();
