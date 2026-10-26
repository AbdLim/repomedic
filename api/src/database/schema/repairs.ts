import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';
export const repairs = pgTable(
    'repairs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        issueUrl: text('issue_url').notNull(),
        repository: varchar('repository', { length: 300 }).notNull(),
        issueNumber: integer('issue_number').notNull(),
        issueTitle: text('issue_title').notNull(),
        commitSha: varchar('commit_sha', { length: 40 }).notNull(),
        status: varchar('status', { length: 32 }).notNull().default('queued'),
        verification: varchar('verification', { length: 20 }),
        report: jsonb('report').$type<Record<string, unknown>>(),
        error: text('error'),
        workerId: text('worker_id'),
        leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
        attempts: integer('attempts').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
        startedAt: timestamp('started_at', { withTimezone: true }),
        finishedAt: timestamp('finished_at', { withTimezone: true }),
    },
    t => [index('repairs_status_created_idx').on(t.status, t.createdAt)],
);
export const repairEvents = pgTable(
    'repair_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        repairId: uuid('repair_id')
            .notNull()
            .references(() => repairs.id, { onDelete: 'cascade' }),
        type: varchar('type', { length: 48 }).notNull(),
        message: text('message').notNull(),
        details: jsonb('details').$type<Record<string, unknown>>(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    t => [index('events_repair_created_idx').on(t.repairId, t.createdAt)],
);
export const repairArtifacts = pgTable(
    'repair_artifacts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        repairId: uuid('repair_id')
            .notNull()
            .references(() => repairs.id, { onDelete: 'cascade' }),
        kind: varchar('kind', { length: 32 }).notNull(),
        content: text('content').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    t => [uniqueIndex('artifact_repair_kind_unique').on(t.repairId, t.kind)],
);
