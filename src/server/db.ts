import 'server-only';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The one Prisma connection in the app, and the one every server-side read
 * and write goes through.
 *
 * **`server-only` sits on this file and nowhere else in `src/server`.** Every
 * data module imports `prisma` from here, so one line poisons the whole
 * directory for a client bundle: a `'use client'` file that reaches a data
 * module - directly, or through any component that imports one - fails the
 * build with a message naming the import chain, rather than shipping a Prisma
 * client and a `DATABASE_URL` to a browser. It matters more now than it did:
 * `src/components/speed-scores.tsx` imports a data module directly, which is
 * exactly the shape this guard exists to catch. The guard used to live on
 * `src/api.ts` and went with it.
 *
 * vitest aliases the package to an empty stub (`vitest.config.mts`), because
 * `server-only`'s own entry point throws outside the `react-server` condition
 * and both test projects import these modules in plain node. The alias is the
 * test runner's alone, so `next build` resolves the real package and the guard
 * is live in production.
 *
 * The database is optional: without a real DATABASE_URL the app still runs
 * and plays, it just persists nothing and signs nobody in
 * (`isDatabaseConfigured`). The placeholder from `.env.example` counts as no
 * database, which is what keeps a fresh clone with no `.env` at all working.
 */
const connectionString = process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(
  connectionString && !connectionString.includes('user:password@host'),
);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient | null {
  if (!isDatabaseConfigured) return null;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: PrismaClient | null = globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections through hot reloads in dev.
if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma;
