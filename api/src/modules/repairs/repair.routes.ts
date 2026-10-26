import { Router } from 'express';
import * as controller from './repair.controller.js';

export const repairRouter = Router();

repairRouter.post('/', controller.create);
repairRouter.get('/', controller.list);
repairRouter.get('/:id', controller.detail);
repairRouter.get('/:id/events', controller.events);
repairRouter.get('/:id/patch', controller.patch);
