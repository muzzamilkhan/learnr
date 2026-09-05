import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from './db';
import {
  GRANT_TTL_MS,
  VERIFICATION_CODE_TTL_MS,
  type VerifyStatus,
  codeIdentifier,
  emailFromIdentifier,
  grantIdentifier,
  normaliseEmail,
  normaliseVerificationCode,
} from '@/lib/verification-code';
import { hashPassword, parsePassword, verifyPassword } from '@/lib/password';

/**
 * The Prisma side of signing in with a password.
 *
 * A sibling of `accounts.ts` rather than more of it, the way `sharing.ts` is.
 *
 * **This is not an Auth.js provider**, and cannot be: Auth.js refuses a
 * Credentials provider alongside database sessions (`UnsupportedStrategy`). So
 * it does what `redeemLoginCode` does - writes the very `Session` row the Prisma
 * adapter would have written - and `src/app/actions.ts` sets the cookie. `auth()`
 * cannot tell the three paths apart, which is the property worth preserving.
 */

/** A session made this way does not expire on a schedule. See `accounts.ts`. */
const SESSION_LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1000;

export type PasswordSignInResult =
  | { status: 'authenticated'; session: { token: string; expires: Date; userId: string } }
  /** The address, the password, or the account is wrong. One answer for all three. */
  | { status: 'rejected' }
  /** No database, or a read that threw. Never reported as a wrong password. */
  | { status: 'unavailable' };

export async function signInWithPassword(
  email: string,
  password: string,
  now = new Date(),
): Promise<PasswordSignInResult> {
  if (!prisma) return { status: 'unavailable' };

  const address = normaliseEmail(email);
  if (!address) return { status: 'rejected' };

  const db = prisma;
  try {
    const user = await db.user.findUnique({
      where: { email: address },
      select: {
        id: true,
        role: true,
        emailVerified: true,
        password: { select: { hash: true } },
      },
    });

    // One answer for four different failures. Telling them apart would make
    // this form a way to ask whether an address has an account here.
    if (!user) return { status: 'rejected' };
    if (user.role !== 'parent') return { status: 'rejected' };
    if (!user.emailVerified) return { status: 'rejected' };
    if (!user.password) return { status: 'rejected' };

    if (!(await verifyPassword(password, user.password.hash))) return { status: 'rejected' };

    const token = randomUUID();
    const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await db.session.create({ data: { sessionToken: token, userId: user.id, expires } });
    return { status: 'authenticated', session: { token, expires, userId: user.id } };
  } catch (error) {
    // `redeemLoginCode`'s reason: Neon accepts a connection while its compute is
    // still waking, so a read here can throw against a database that is fine a
    // second later. Telling somebody their password is wrong for that is the
    // lie the three-answer status exists to prevent.
    console.error('Failed to sign in with a password', error);
    return { status: 'unavailable' };
  }
}

/**
 * Both kinds of row live in Auth.js's own `VerificationToken` table, which has
 * been in the schema since it was written and unused, because this app has never
 * had an email provider. The prefix on `identifier` is what keeps a code from
 * being spendable as a grant - see `verification-code.ts`.
 */

/**
 * Issuing replaces rather than adds. A code left working after a second one was
 * asked for is a live credential sitting in an old mail nobody is watching.
 */
export async function issueVerificationCode(
  email: string,
  code: string,
  now = new Date(),
): Promise<boolean> {
  if (!prisma) return false;
  const address = normaliseEmail(email);
  if (!address) return false;

  const db = prisma;
  try {
    const identifier = codeIdentifier(address);
    await db.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { identifier } });
      await tx.verificationToken.create({
        data: { identifier, token: code, expires: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS) },
      });
    });
    return true;
  } catch (error) {
    console.error('Failed to issue a verification code', error);
    return false;
  }
}

/**
 * The code is spent in the same transaction the grant is written in, so a code
 * cannot buy two grants however fast it is submitted twice.
 */
export async function spendVerificationCode(
  email: string,
  code: string,
  grant: string,
  now = new Date(),
): Promise<VerifyStatus> {
  if (!prisma) return 'unavailable';
  const address = normaliseEmail(email);
  const typed = normaliseVerificationCode(code);
  if (!address || !typed) return 'rejected';

  const db = prisma;
  try {
    return await db.$transaction<VerifyStatus>(async (tx) => {
      const spent = await tx.$queryRaw<{ identifier: string }[]>`
        DELETE FROM "VerificationToken"
        WHERE "identifier" = ${codeIdentifier(address)}
          AND "token" = ${typed}
          AND "expires" > ${now}
        RETURNING "identifier"
      `;
      if (spent.length === 0) return 'rejected';

      const identifier = grantIdentifier(address);
      await tx.verificationToken.deleteMany({ where: { identifier } });
      await tx.verificationToken.create({
        data: { identifier, token: grant, expires: new Date(now.getTime() + GRANT_TTL_MS) },
      });
      return 'verified';
    });
  } catch (error) {
    console.error('Failed to spend a verification code', error);
    return 'unavailable';
  }
}

/**
 * The last step, and the one that decides which of the spec's four states the
 * address was in. The grant is only spent once a password has been accepted:
 * a refused password leaves it alive, because the grown-up is standing at the
 * screen and will type another one.
 */
export async function setPasswordWithGrant(
  grant: string,
  password: string,
  now = new Date(),
): Promise<PasswordSignInResult> {
  if (!prisma) return { status: 'unavailable' };

  const chosen = parsePassword(password);
  if (!chosen) return { status: 'rejected' };

  const db = prisma;
  try {
    const held = await db.verificationToken.findUnique({ where: { token: grant } });
    if (!held || held.expires <= now) return { status: 'rejected' };

    const address = emailFromIdentifier(held.identifier);
    if (!address || held.identifier !== grantIdentifier(address)) return { status: 'rejected' };

    const hash = await hashPassword(chosen, randomBytes);
    const token = randomUUID();
    const expires = new Date(now.getTime() + SESSION_LIFETIME_MS);

    return await db.$transaction<PasswordSignInResult>(async (tx) => {
      const spent = await tx.verificationToken.deleteMany({ where: { token: grant } });
      // Somebody else spent it between the read above and here.
      if (spent.count === 0) return { status: 'rejected' };

      const existing = await tx.user.findUnique({
        where: { email: address },
        select: { id: true, role: true },
      });

      let userId: string;
      if (!existing) {
        // Created with the role already set, which is a different statement
        // from `claimParentRole`'s compare-and-set and has nothing to race.
        const created = await tx.user.create({
          data: { email: address, emailVerified: now, role: 'parent' },
          select: { id: true },
        });
        userId = created.id;
      } else {
        if (existing.role === 'child') return { status: 'rejected' };
        // The healing case, for an account that predates the role column.
        await tx.user.update({
          where: { id: existing.id },
          data: { emailVerified: now, ...(existing.role === null ? { role: 'parent' } : {}) },
        });
        userId = existing.id;
      }

      await tx.parentPassword.upsert({
        where: { userId },
        create: { userId, hash },
        update: { hash },
      });

      await tx.session.create({ data: { sessionToken: token, userId, expires } });
      return { status: 'authenticated', session: { token, expires, userId } };
    });
  } catch (error) {
    console.error('Failed to set a password', error);
    return { status: 'unavailable' };
  }
}
