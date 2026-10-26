import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import process from 'process';
export default defineConfig({
    schema: './src/database/schema/*.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
