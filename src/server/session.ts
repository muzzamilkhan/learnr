import { prisma } from './db';
import { SESSION_COOKIE_NAME } from '@/session-cookie';

/**
 * A token is a `Session` row, whoever wrote it. Auth.js writes one when a parent
 * signs in with Google; `POST /auth/redeem` writes one when a child spends their
 * code. The caller cannot tell the two apart and does not need to.
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

/**
 * Every value a request carries under the session cookie's name, oldest first.
 *
 * There is normally one. There can be two: a `Set-Cookie` carrying a `Domain`
 * writes a *second* cookie of the same name rather than replacing a host-only
 * one already in the browser, and signing in again cannot fix that because
 * signing in is what writes it. Returning on the first match let the stale
 * cookie speak for the live one.
 *
 * Nothing writes a `Domain` any more, and now that is a property of the code
 * rather than of a variable: `AUTH_COOKIE_DOMAIN` is gone from
 * `src/session-cookie.ts`. It was still set in production to
 * `learnr.muzza.tech` long after the Fly-era API it widened the cookie for
 * stopped existing, so this was describing a hazard the deployment was
 * actively creating, not one it had left behind.
 *
 * That makes this insurance rather than an ongoing hazard - for browsers
 * holding a pair from before the collapse, and now for browsers holding one
 * from before that variable went. It is cheap and it is already proven, so it
 * stays.
 *
 * `next/headers`' cookie API returns one value per name, so the raw header is
 * what has to be read.
 */
function tokensFrom(request: Request): string[] {
  const header = request.headers.get('cookie');
  if (!header) return [];
  const prefix = `${SESSION_COOKIE_NAME}=`;
  return header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => part.slice(prefix.length))
    // Capped: each attempt is a query and the header is whatever the caller
    // sent, so an uncapped loop is an unauthenticated caller choosing how many
    // queries to cost us.
    .slice(0, 4);
}

export async function userIdFrom(request: Request): Promise<string | null> {
  for (const token of tokensFrom(request)) {
    const userId = await resolveUserId(token);
    if (userId) return userId;
  }
  return null;
}

export class Unauthorized extends Error {}
export class Forbidden extends Error {}

export async function requireUser(request: Request): Promise<string> {
  const userId = await userIdFrom(request);
  if (!userId) throw new Unauthorized();
  return userId;
}
