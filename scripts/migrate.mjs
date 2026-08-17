import { spawnSync } from 'node:child_process';

/**
 * Applies pending migrations, and is part of `npm run build` so a deploy carries
 * its own schema changes rather than needing someone to remember.
 *
 * Without a database it does nothing and succeeds: the app still runs and plays
 * unconfigured (`isDatabaseConfigured`), so a build must not be the one thing
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

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });

process.exit(result.status ?? 1);
