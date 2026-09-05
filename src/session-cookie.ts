/**
 * The session cookie's name and options - the one thing both `src/auth.ts` and
 * `src/server/session.ts` need to agree on, and why this lives apart from
 * both.
 *
 * Pinned rather than left to Auth.js's implicit naming: Auth.js switches the
 * name between dev and prod (the `__Secure-` prefix) internally, and
 * `redeemLoginCode` writes the very same `Session` row the `PrismaAdapter`
 * would - `src/app/actions.ts` sets this cookie by hand for that path, so
 * `auth()` can only fail to tell the two paths apart while both agree on the
 * cookie.
 *
 * Split out of `src/auth.ts` because that module calls `NextAuth({...})` at
 * import time - constructing the whole Auth.js instance, Google provider and
 * `PrismaAdapter` included, as a side effect of the import itself. Every
 * request handler that needs only the cookie's name to find its token would
 * otherwise pay for that construction on every import, for a string it never
 * uses. `src/auth.ts` re-exports both constants, so nothing that already
 * imports them from there has to change.
 */

/**
 * The cookie is host-only, and there is no longer a setting that widens it.
 *
 * There was: `AUTH_COOKIE_DOMAIN`, set in production to `learnr.muzza.tech` so
 * the cookie reached that host *and* its subdomains - `api.learnr.muzza.tech`
 * among them, back when the browser called a Fastify API on Fly for everything
 * a child did while playing. The collapse put those six writes back on this
 * origin as `/api/v1` route handlers, and a same-origin request carries a
 * host-only cookie perfectly well.
 *
 * So the widening had outlived its reason, and a `Domain` nothing needs is a
 * cookie sent to hosts that have no business reading it. Deleted rather than
 * left unset, because a variable still read is a variable somebody can set:
 * production went on carrying `learnr.muzza.tech` months after the API it was
 * for stopped existing, which is exactly how `tokensFrom` in
 * `src/server/session.ts` came to describe a hazard the deployed config was
 * still creating.
 *
 * `tokensFrom` stays, and is what makes removing this safe: a browser holding
 * both the old domain-scoped cookie and a new host-only one sends both, and it
 * tries each until one resolves rather than letting the first speak for the
 * live one.
 */
const useSecureCookies = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = useSecureCookies
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

export const SESSION_COOKIE_OPTIONS: {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
} = {
  httpOnly: true,
  // What stands between this cookie and a cross-site write, now that the
  // browser posts to `/api/v1` itself rather than through a server action and
  // Next's origin check. Lax withholds the cookie from a cross-site POST,
  // which is the shape every one of these calls has.
  sameSite: 'lax',
  path: '/',
  secure: useSecureCookies,
};
