import { defineConfig } from 'drizzle-kit';

// DIRECT_URL = port 5432 direct connection — introspection only, never deployed to Vercel
export default defineConfig({
  out: './src/migrations',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
