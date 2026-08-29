import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `vercel env pull` writes .env.local, so load that first - dotenv keeps the
// first value it sees, which gives .env.local precedence over .env, matching
// how Next.js resolves them.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

/**
 * This app owns the schema and the migrations, so the config generates *and*
 * migrates - `npm run db:migrate` writes one, `npm run db:deploy` applies them.
 *
 * `prisma generate` needs no datasource, but the config must still name one.
 * Falling back to the .env.example placeholder - which `isDatabaseConfigured`
 * reads as "no database" - keeps `npm install` working on a fresh clone with no
 * .env at all.
 */
const PLACEHOLDER = 'postgresql://user:password@host/dbname?sslmode=require';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url: process.env.DATABASE_URL ?? PLACEHOLDER },
});
