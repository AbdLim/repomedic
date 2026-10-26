import { and, asc, desc, eq } from 'drizzle-orm';
import { db, sql } from '../../database/index.js';
import {
    repairArtifacts,
    repairEvents,
    repairs,
} from '../../database/schema/repairs.js';

export type RepairRecord = typeof repairs.$inferSelect;

export async function createRepair(
    data: Pick<
        typeof repairs.$inferInsert,
        'issueUrl' | 'repository' | 'issueNumber' | 'issueTitle' | 'commitSha'
    >,
) {
    return db.transaction(async tx => {
        const [repair] = await tx.insert(repairs).values(data).returning();
        await tx.insert(repairEvents).values({
            repairId: repair.id,
            type: 'queued',
            message: 'Repair queued',
        });
        return repair;
    });
}

export async function listRepairs() {
    return db.select().from(repairs).orderBy(desc(repairs.createdAt)).limit(50);
}

export async function getRepair(id: string) {
    const [row] = await db.select().from(repairs).where(eq(repairs.id, id));
    return row ?? null;
}

export async function getEvents(id: string) {
    return db
        .select()
        .from(repairEvents)
        .where(eq(repairEvents.repairId, id))
        .orderBy(asc(repairEvents.createdAt));
}

export async function getPatch(id: string) {
    const [row] = await db
        .select()
        .from(repairArtifacts)
        .where(
            and(
                eq(repairArtifacts.repairId, id),
                eq(repairArtifacts.kind, 'patch'),
            ),
        );
    return row?.content ?? null;
}

export async function claimRepair(
    workerId: string,
    leaseSeconds: number,
): Promise<RepairRecord | null> {
    // The condition prevents multiple workers from claiming work concurrently.
    const rows = await sql<{ id: string }[]>`
    UPDATE repairs SET status='investigating', worker_id=${workerId},
      attempts=attempts+1, started_at=COALESCE(started_at,NOW()), updated_at=NOW(),
      lease_expires_at=NOW() + (${leaseSeconds} * INTERVAL '1 second')
    WHERE id=(SELECT id FROM repairs WHERE status='queued' AND NOT EXISTS (SELECT 1 FROM repairs active WHERE active.status='investigating') ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`;
    if (!rows[0]) return null;
    await db.insert(repairEvents).values({
        repairId: rows[0].id,
        type: 'investigating',
        message: 'AI investigation started',
    });
    return getRepair(rows[0].id);
}

export async function finishRepair(
    id: string,
    workerId: string,
    result: Record<string, unknown>,
) {
    const rawStatus =
        typeof result.status === 'string' ? result.status.toLowerCase() : '';
    const verification = rawStatus === 'verified' ? 'verified' : 'unverified';
    const patch =
        typeof result.patch === 'string' && result.patch.trim()
            ? result.patch
            : null;
    await db.transaction(async tx => {
        const [updated] = await tx
            .update(repairs)
            .set({
                status: 'completed',
                verification,
                report: result,
                error: null,
                workerId: null,
                leaseExpiresAt: null,
                finishedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(eq(repairs.id, id), eq(repairs.workerId, workerId)))
            .returning({ id: repairs.id });
        if (!updated) return;
        if (patch)
            await tx
                .insert(repairArtifacts)
                .values({ repairId: id, kind: 'patch', content: patch });
        await tx.insert(repairEvents).values({
            repairId: id,
            type: 'completed',
            message: `Repair finished: ${verification}`,
        });
    });
}

export async function failRepair(
    id: string,
    workerId: string,
    message: string,
) {
    await db.transaction(async tx => {
        const [updated] = await tx
            .update(repairs)
            .set({
                status: 'failed',
                error: message,
                workerId: null,
                leaseExpiresAt: null,
                finishedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(eq(repairs.id, id), eq(repairs.workerId, workerId)))
            .returning({ id: repairs.id });
        if (updated)
            await tx
                .insert(repairEvents)
                .values({ repairId: id, type: 'failed', message });
    });
}

export async function recoverExpiredRepairs() {
    // Mark stale attempts failed rather than retrying them, since the remote execution may still be running.
    const rows = await sql<
        { id: string }[]
    >`UPDATE repairs SET status='failed', error='Worker lease expired', finished_at=NOW(), updated_at=NOW(), worker_id=NULL,lease_expires_at=NULL WHERE status='investigating' AND lease_expires_at < NOW() RETURNING id`;
    for (const row of rows)
        await db.insert(repairEvents).values({
            repairId: row.id,
            type: 'failed',
            message: 'Worker lease expired',
        });
}
