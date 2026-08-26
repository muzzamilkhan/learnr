import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { prisma as appPrisma } from '../../src/db.js';

/**
 * The container itself is started once per run by global-setup.ts, which also
 * applies the migrations and exports DATABASE_URL. By the time a test file is
 * imported the variable already names that container, so this only has to open
 * a client against it - and src/db.ts, built from the same variable, is
 * pointing at the same database.
 */
let client: PrismaClient | undefined;

export async function startDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('global-setup.ts did not run: DATABASE_URL is unset');

  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function stopDatabase(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

export function testPrisma(): PrismaClient {
  if (!client) throw new Error('startDatabase() has not run');
  return client;
}

/**
 * Truncating every table between tests is faster than recreating the schema and
 * keeps each test starting from nothing. CASCADE handles the foreign keys.
 */
export async function truncateAll(): Promise<void> {
  const db = testPrisma();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

/**
 * Open several connections before a test that means to race.
 *
 * Prisma's pool is lazy, and the data modules run their guards inside
 * interactive transactions - one connection each. On a cold pool the first
 * eight concurrent callers simply queue, so they never overlap and a
 * concurrency test passes against code whose lock has been deleted. Measured:
 * the first race in a fresh process banks a round once either way; the second,
 * on a warm pool, banks it eight times without the lock.
 *
 * This warms the pool the data modules actually use - the singleton in
 * src/db.ts - not the test's own client.
 */
export async function warmPool(size = 8): Promise<void> {
  if (!appPrisma) throw new Error('src/db.ts has no client: is DATABASE_URL set?');
  await Promise.all(Array.from({ length: size }, () => appPrisma!.$queryRaw`SELECT 1`));
}
