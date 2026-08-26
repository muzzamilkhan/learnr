import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * A real Postgres, not a mock. The three guards this server leans on -
 * SELECT ... FOR UPDATE on TopicSkill and on roundsBanked, and the
 * compare-and-set on targetDay - have no meaning against a fake client, and
 * they are the parts most worth proving.
 *
 * This runs before any test module is imported, which is the point. The data
 * modules reach for the singleton in src/db.ts, and that client is built from
 * DATABASE_URL at import time - so the variable has to name the container
 * before a worker loads anything. Starting it per-file in beforeAll is too
 * late: every data function would see `prisma === null` and return null.
 *
 * One container serves the whole run; test files share it and truncate between
 * tests.
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();

  // `migrate deploy` applies the same migrations a production deploy would, so
  // a broken migration fails here rather than on Vercel.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  process.env.DATABASE_URL = url;
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
}
