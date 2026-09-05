/**
 * Times the screens a signed-in grown-up and their child actually navigate
 * between, against dev or against production.
 *
 * **Signed out, none of these screens are the ones anybody uses.** `/` renders
 * the landing page and `/progress` redirects, so an anonymous timing run
 * measures four screens the app barely has - which is why this needs the test
 * account (`scripts/test-account.ts`) and why that script exists at all.
 *
 * **It mints a `Session` row rather than driving the sign-in form.** Signing in
 * with a password is a server action, and a server action is addressed by a
 * build-specific id - a harness that posted one would break on every deploy,
 * which is the opposite of what a harness is for. `redeemLoginCode` already
 * writes this exact row by hand for the child's path, and `CLAUDE.md` is
 * explicit that `auth()` cannot tell the two apart, so the session this makes
 * is not a special case the app might treat differently. The row is deleted
 * again at the end, whether or not the run succeeded.
 *
 * **Cold and warm are reported apart, because they are different questions.**
 * The first request to an instance pays for resolving and compiling the page's
 * whole module graph; every one after it does not. A single average over the
 * two says nothing true about either, and the gap between them *is* the finding
 * - `resolve page components` was measured at 17.6s p50 in production against
 * a database that answered in 67ms. So the first hit on each path is reported
 * on its own line and the rest as a median.
 *
 *   npx tsx scripts/timings.ts                          # http://localhost:3000
 *   npx tsx scripts/timings.ts https://learnr.muzza.tech
 *
 * It only ever issues GETs, so it records nothing and awards nothing. The
 * screens it asks for are the ones a parent and a child move between; the play
 * screen is included because entering a lesson is half of what this was written
 * to measure.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { verifyPassword } from '../src/lib/password';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

/** How many times each path is asked for after the first. */
const WARM_RUNS = 5;

/** Far enough out never to arrive, the way a redeemed code's session is. */
const SESSION_YEARS = 1;

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const connectionString = process.env.DATABASE_URL;
const email = process.env.TEST_ACCOUNT_EMAIL?.trim().toLowerCase();
const password = process.env.TEST_ACCOUNT_PASSWORD;

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!connectionString || connectionString.includes('user:password@host')) {
  die('No DATABASE_URL - the session this signs in with is a row in it.');
}
if (!email || !password) die('Set TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD in .env.');

// The cookie's name is decided by whether the app it is being sent to is
// running in production, which here is the same question as whether the URL is
// https - so it is read off the target rather than off this process, which is
// never NODE_ENV=production and would otherwise always pick the dev name.
const secure = base.startsWith('https://');
const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function timeGet(path: string, cookie: string): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    headers: { cookie, 'user-agent': 'learnr-timings' },
    redirect: 'manual',
  });
  await response.arrayBuffer();
  const ms = performance.now() - started;
  if (response.status >= 500) console.error(`  ! ${path} answered ${response.status}`);
  return ms;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] as number)
    : (((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

async function main() {
  const parent = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: { select: { hash: true } }, children: { select: { id: true } } },
  });

  if (!parent) die(`No account for ${email}. Run: npx tsx scripts/test-account.ts`);

  // Proves the password the app would be handed is the password it would
  // accept - the same call `signInWithPassword` makes. It is checked here
  // rather than assumed because this script does not use the sign-in form, and
  // a harness that silently stopped agreeing with the real way in would be
  // measuring a door nobody else can open.
  if (!parent.password) die(`${email} has no password row. Re-run scripts/test-account.ts.`);
  if (!(await verifyPassword(password as string, parent.password.hash))) {
    die(`TEST_ACCOUNT_PASSWORD does not match the stored hash. Re-run scripts/test-account.ts.`);
  }
  console.log(`Password verifies for ${email} - /signin/password will accept it.`);

  const child = parent.children[0]?.id ?? null;
  const sessionToken = randomUUID();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + SESSION_YEARS);

  await prisma.session.create({ data: { sessionToken, userId: parent.id, expires } });
  const cookie = `${cookieName}=${sessionToken}`;

  try {
    const paths = [
      '/',
      '/progress',
      child ? `/progress?child=${child}&subject=maths` : '/progress',
      '/children',
      '/speed',
      '/speed/multiply.7',
      '/play?subject=maths&level=3',
      '/curriculum',
    ];

    console.log(`\n${base}   (cold = first hit, warm = median of ${WARM_RUNS})\n`);
    console.log('  cold     warm   path');

    for (const path of paths) {
      const cold = await timeGet(path, cookie);
      const warm: number[] = [];
      for (let run = 0; run < WARM_RUNS; run++) warm.push(await timeGet(path, cookie));

      const flag = cold > 3 * median(warm) + 500 ? '  <- cold start' : '';
      console.log(
        `  ${Math.round(cold).toString().padStart(6)}ms ${Math.round(median(warm))
          .toString()
          .padStart(5)}ms  ${path}${flag}`,
      );
    }
  } finally {
    // The session goes whether or not the run finished. A harness that left
    // one behind on every invocation would quietly build a pile of live
    // credentials in the production database.
    await prisma.session.deleteMany({ where: { sessionToken } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
