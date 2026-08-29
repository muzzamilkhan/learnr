import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `vercel env pull` writes .env.local, so load that first - dotenv keeps the
// first value it sees, which gives .env.local precedence over .env, matching
// how Next.js resolves them. Neither overrides a variable already exported,
// so the test harness can hand `migrate deploy` a container URL directly.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

// `prisma generate` needs no datasource, but the config must still name one.
// Falling back to the .env.example placeholder - which `isDatabaseConfigured`
// reads as "no database" - keeps `npm install` working on a fresh clone that
// has no .env at all. Anything that truly needs a connection (migrate, deploy)
// fails loudly against this URL rather than silently using it.
const PLACEHOLDER = 'postgresql://user:password@host/dbname?sslmode=require';

// The schema and migrations moved back to the repository root - see
// prisma.config.ts there. apps/api is deleted whole in a later step of the
// API collapse; this points `postinstall`'s `prisma generate` at the schema's
// real location until then, rather than at a path that no longer exists.
export default defineConfig({
  schema: '../../prisma/schema.prisma',
  migrations: { path: '../../prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? PLACEHOLDER },
});
