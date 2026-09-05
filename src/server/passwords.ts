import { randomUUID } from 'node:crypto';
import { prisma } from './db';
import { normaliseEmail } from '@/lib/verification-code';
import { verifyPassword } from '@/lib/password';

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
