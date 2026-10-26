import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('health', () => {
    it('returns success', async () => {
        const r = await request(createApp()).get('/health');
        expect(r.status).toBe(200);
        expect(r.body.status).toBe('ok');
    });
    it('rejects an invalid repair submission', async () => {
        const r = await request(createApp()).post('/api/v1/repairs').send({});
        expect(r.status).toBe(400);
    });
});
