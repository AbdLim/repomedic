import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        env: { DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused' },
    },
});
