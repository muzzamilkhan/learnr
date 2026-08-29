import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { resolveUserId } from './session.js';
import { readAccount } from '../data/accounts.js';

const COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
}

/**
 * At most this many tokens are tried for one request.
 *
 * Each attempt is a database query, and the cookie header is whatever the
 * caller sent - so without a cap, a request carrying two hundred cookies of
 * the same name would be two hundred queries, unauthenticated. Two is the
 * number a real browser can present (see `tokensFrom`); the rest of the
 * allowance is slack.
 */
const MAX_TOKENS = 4;

/**
 * Every token a request offers, in the order it offered them.
 *
 * **It is a list rather than one token because a browser can hold two cookies
 * of the same name**, and on 2026-08-29 one did, which took child sign-in down.
 * The session cookie used to be host-only; scoping it to
 * `Domain=learnr.muzza.tech` so it would reach this API does not replace the
 * host-only cookie a browser already has - a `Set-Cookie` carrying a `Domain`
 * writes a *second* cookie of the same name. Signing in again cannot fix that,
 * because signing in is what writes the second one.
 *
 * This used to return on the first match, which made the winner a matter of
 * which parser read the header: Auth.js saw a live session and rendered the
 * page, while this saw the stale one and answered 401 to every call that page
 * then made. A caller offering a dead token and a live one is asking to be let
 * in, so the dead one must not be able to speak for the live one.
 *
 * A `Bearer` header still wins outright when there is one - that is the iOS
 * client, which sends exactly one token and never a cookie.
 */
function tokensFrom(request: FastifyRequest): string[] {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return [header.slice('Bearer '.length)];

  const cookie = request.headers.cookie;
  if (!cookie) return [];

  const tokens: string[] = [];
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) tokens.push(decodeURIComponent(rest.join('=')));
    if (tokens.length === MAX_TOKENS) break;
  }

  return tokens;
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('userId', null);

  app.addHook('onRequest', async (request) => {
    // Timed separately from the request as a whole because it is the one part
    // of it the web app has already paid for once - see `timingPlugin`. A
    // request carrying no token skips the query entirely and leaves `authMs`
    // null, which is why the reading is nullable rather than zero.
    const started = performance.now();
    const tokens = tokensFrom(request);

    // The first that resolves wins. Two tokens costs a second query only when
    // the first one fails, which is the case this exists for and not the
    // common one.
    for (const token of tokens) {
      request.userId = await resolveUserId(token);
      if (request.userId) break;
    }

    if (tokens.length > 0) request.authMs = performance.now() - started;
  });
});

/** The gate for anything a signed-in user may do. */
export function requireUser(request: FastifyRequest): string {
  if (!request.userId) {
    const error = new Error('Not signed in') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
  return request.userId;
}

/** The gate for the parent screens. A child reaching one is a 403, not a 404. */
export async function requireParent(request: FastifyRequest): Promise<string> {
  const userId = requireUser(request);
  const account = await readAccount(userId);

  if (account?.role !== 'parent') {
    const error = new Error('Not a parent') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return userId;
}
