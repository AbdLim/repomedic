import type { Request, Response } from 'express';
import { HttpError } from '../../shared/errors.js';
import * as repo from './repair.repository.js';
import * as service from './repair.service.js';
import { idSchema, submitRepairSchema } from './repair.validation.js';

function id(req: Request): string {
    const result = idSchema.safeParse(req.params.id);
    if (!result.success) throw new HttpError(400, 'Invalid repair ID');
    return result.data;
}

export async function create(req: Request, res: Response) {
    const body = submitRepairSchema.safeParse(req.body);
    if (!body.success)
        throw new HttpError(
            400,
            'Expected { "issue_url": "https://github.com/.../issues/1" }',
        );
    const repair = await service.submitRepair(body.data.issue_url);
    res.status(202)
        .location(`/api/v1/repairs/${repair.id}`)
        .json({ data: repair });
}

export async function list(_req: Request, res: Response) {
    res.json({ data: await repo.listRepairs() });
}

export async function detail(req: Request, res: Response) {
    res.json({ data: await service.requireRepair(id(req)) });
}

export async function events(req: Request, res: Response) {
    const repairId = id(req);
    await service.requireRepair(repairId);
    res.json({ data: await repo.getEvents(repairId) });
}

export async function patch(req: Request, res: Response) {
    const repairId = id(req);
    await service.requireRepair(repairId);
    const content = await repo.getPatch(repairId);
    if (!content) throw new HttpError(404, 'No patch available');
    res.setHeader('Content-Type', 'text/x-diff; charset=utf-8');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="repomedic-${repairId}.patch"`,
    );
    res.send(content);
}
