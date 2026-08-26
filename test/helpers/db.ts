import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * A real Postgres, not a mock. The three guards this server depends on -
 * `SELECT ... FOR UPDATE` on TopicSkill and on roundsBanked, and the
 * compare-and-set on targetDay - have no meaning against a fake client, and
 * they are the parts most worth proving.
 */
let container: StartedPostgreSqlContainer | undefined;
let client: PrismaClient | undefined;

export async function startDatabase(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();

  // `migrate deploy` applies the same migrations a production deploy would, so
  // a broken migration fails here rather than on Vercel.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function stopDatabase(): Promise<void> {
  await client?.$disconnect();
  await container?.stop();
  client = undefined;
  container = undefined;
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
