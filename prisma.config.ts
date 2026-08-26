import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `vercel env pull` writes .env.local, so load that first - dotenv keeps the
// first value it sees, which gives .env.local precedence over .env, matching
// how Next.js resolves them.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

/**
 * `prisma generate` for Auth.js, and nothing more.
 *
 * **There is no `migrations` path here, on purpose.** `apps/api` owns the
 * schema and the migrations, and its deploy runs `db:deploy` as a release
 * command - so this package has no `db:migrate` and no `db:deploy` left to
 * point anywhere. What remains is generating a client from the four Auth.js
 * tables (`prisma/auth.prisma`) so `PrismaAdapter` has one, which is the single
 * thing the extraction could not move.
 *
 * `prisma generate` needs no datasource, but the config must still name one.
 * Falling back to the .env.example placeholder - which `isDatabaseConfigured`
 * reads as "no database" - keeps `npm install` working on a fresh clone with no
 * .env at all.
 */
const PLACEHOLDER = 'postgresql://user:password@host/dbname?sslmode=require';

export default defineConfig({
  schema: 'prisma/auth.prisma',
  datasource: { url: process.env.DATABASE_URL ?? PLACEHOLDER },
});
