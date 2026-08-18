import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// `vercel env pull` writes .env.local, so load that first - dotenv keeps the
// first value it sees, which gives .env.local precedence over .env, matching
// how Next.js resolves them.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
