import { spawnSync } from 'node:child_process';

/**
 * Applies pending migrations. `npm run db:deploy` runs it as a release
 * command, so a deploy carries its own schema changes rather than needing
 * someone to remember.
 *
 * Without a database it does nothing and succeeds: the app still runs and plays
 * unconfigured (`isDatabaseConfigured`), so a deploy must not be the one thing
 * that insists on Postgres. The placeholder from `.env.example` counts as no
 * database, for the same reason.
 */

// The URL may only be in a file, exactly as `prisma.config.ts` reads it. dotenv
// is a dev dependency, so a production install without it just uses the env.
try {
  const { config } = await import('dotenv');
  config({ path: '.env.local', quiet: true });
  config({ quiet: true });
} catch {
  // No dotenv here — process.env is the whole story.
}

const url = process.env.DATABASE_URL;

if (!url || url.includes('user:password@host')) {
  console.log('No DATABASE_URL configured — skipping migrations.');
  process.exit(0);
}

/**
 * A serverless Postgres suspends when nobody is using it, and a deploy is very
 * often the first thing to knock. The connection is accepted while the compute
 * is still waking, so Prisma gets as far as taking its migration advisory lock
 * and then times out against a fixed 10s it gives no way to raise (P1002).
 *
 * That is a cold database, not a broken migration, and the answer is to knock
 * again. Only this one error is retried — a migration that actually fails
 * should fail now, on the first attempt, and say why.
 */
const COLD = /P1002|advisory lock/i;
const ATTEMPTS = 3;
const BACKOFF_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; ; attempt += 1) {
  // Captured rather than inherited, because deciding whether to retry means
  // reading what Prisma said. It is echoed on either path, so a build log still
  // shows the whole story.
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { encoding: 'utf8' });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) process.exit(0);

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (attempt >= ATTEMPTS || !COLD.test(output)) process.exit(result.status ?? 1);

  console.log(
    `Database was still waking up — retrying migrations in ${BACKOFF_MS / 1000}s ` +
      `(attempt ${attempt + 1} of ${ATTEMPTS}).`,
  );
  await sleep(BACKOFF_MS);
}
