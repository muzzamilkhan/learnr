/**
 * Creates (or removes) the account live testing signs in as.
 *
 * **Why a script rather than the real three screens.** A password account is
 * only reachable through email → code → password, and no `User` row is written
 * until the mailbox answers - which is the whole design and not something to
 * weaken for convenience. But a test account is a *fixture*, not a test of
 * signing up: what is wanted is a parent that exists, with a password, so that
 * everything behind a sign-in can be measured and clicked. So this writes the
 * two rows the real flow would have left behind, and nothing else changes.
 *
 * **It reuses `hashPassword` rather than reimplementing scrypt.** A second
 * hasher here would be a second opinion about how a password is stored, free to
 * drift from the one the app verifies against - and the first symptom would be
 * an account that cannot sign in for reasons nothing explains.
 *
 * **The credentials are environment, never argument and never committed.**
 * `learnr` is a public repository. `TEST_ACCOUNT_EMAIL` and
 * `TEST_ACCOUNT_PASSWORD` live in the gitignored `.env` beside every other
 * credential, and `.env.example` carries the names with empty values the way it
 * does for the rest. A password on a command line would be in a shell history.
 *
 * **It writes to whatever `DATABASE_URL` names**, which in this repository is
 * production unless a Neon branch has been pointed at (see **Setup** in
 * `CLAUDE.md`). That is deliberate rather than careless: there is one database,
 * "live testing" means the live one, and the way to get a disposable one is the
 * branch the setup notes already describe. It prints which host it is about to
 * write to before it writes.
 *
 *   npx tsx scripts/test-account.ts            # create or update, idempotent
 *   npx tsx scripts/test-account.ts --remove   # delete the parent and its child
 *
 * Removing deletes the parent row, and `onDelete: Cascade` takes the password,
 * the sessions and the child - and the child's answers - with it. That is the
 * same promise the "remove a child" copy makes to a parent.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword, parsePassword } from '../src/lib/password';

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

/** The child the parent gets, so the screens behind a sign-in have something on them. */
const CHILD_NAME = 'Test Child';
const CHILD_LEVEL = '3';
const CHILD_SUBJECTS = ['maths', 'english'];

const connectionString = process.env.DATABASE_URL;
const email = process.env.TEST_ACCOUNT_EMAIL?.trim().toLowerCase();
const password = process.env.TEST_ACCOUNT_PASSWORD;
const remove = process.argv.includes('--remove');

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!connectionString || connectionString.includes('user:password@host')) {
  die('No DATABASE_URL. This script needs a real one - it is the whole of what it does.');
}
if (!email) die('Set TEST_ACCOUNT_EMAIL in .env.');

// The same normaliser the real form is held to, so a password that would be
// refused on `/password/set` cannot be smuggled in through here and then leave
// somebody wondering why the rules seem not to apply.
const chosen = remove ? null : parsePassword(password ?? '');
if (!remove && chosen === null) {
  die('Set TEST_ACCOUNT_PASSWORD in .env to something the app would accept (10-200 characters).');
}

// Says where, before it writes. The credentials never print; the host is the
// one fact worth being sure of, because production and a branch differ by a
// word in a URL nobody reads twice.
console.log(`${remove ? 'Removing from' : 'Writing to'} ${new URL(connectionString).host}`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Wrapped rather than top-level: `tsx` compiles a `.ts` in this package as CJS,
// where top-level await is not available. `probe-templates.ts` beside it is a
// `.ts` too, and one extension for both is worth one function call.
async function main() {
  try {
    if (remove) {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!existing) {
        console.log(`No account for ${email}. Nothing to remove.`);
      } else {
        await prisma.user.delete({ where: { id: existing.id } });
        console.log(`Removed ${email}, its password, its sessions and its child.`);
      }
    } else {
      const hash = await hashPassword(chosen as string, randomBytes);

      // `emailVerified` is set because the real flow only ever writes this row
      // after the mailbox has answered - an account here that claimed otherwise
      // would be a shape the app never makes.
      const parent = await prisma.user.upsert({
        where: { email },
        create: { email, emailVerified: new Date(), role: 'parent', name: 'Test Parent' },
        update: { emailVerified: new Date(), role: 'parent' },
        select: { id: true },
      });

      await prisma.parentPassword.upsert({
        where: { userId: parent.id },
        create: { userId: parent.id, hash },
        update: { hash },
      });

      // One child, so the report, the profiles screen and the play path all have
      // something to draw. Found by name rather than upserted on a key, because a
      // managed child has no email and nothing else unique to match on.
      const child = await prisma.user.findFirst({
        where: { parentId: parent.id, name: CHILD_NAME },
        select: { id: true },
      });

      if (!child) {
        await prisma.user.create({
          data: {
            name: CHILD_NAME,
            role: 'child',
            parentId: parent.id,
            selectedLevel: CHILD_LEVEL,
            subjects: CHILD_SUBJECTS,
            avatar: 'fox',
          },
        });
      }

      console.log(`Ready: ${email} is a parent with a password and one child.`);
      console.log('Sign in at /signin/password.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
