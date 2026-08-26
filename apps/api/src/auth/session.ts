import { prisma } from '../db.js';

/**
 * A token is a `Session` row, whoever wrote it. Auth.js writes one when a parent
 * signs in with Google; `POST /auth/redeem` writes one when a child spends their
 * code. The API cannot tell the two apart and does not need to.
 */
export async function resolveUserId(token: string | undefined): Promise<string | null> {
  if (!prisma || !token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: { userId: true, expires: true },
    });

    if (!session) return null;
    if (session.expires.getTime() <= Date.now()) return null;

    return session.userId;
  } catch (error) {
    console.error('Failed to resolve a session', error);
    return null;
  }
}
