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
 * Which hosts the session cookie is sent to.
 *
 * Unset, the cookie is host-only: the browser sends it back to
 * `learnr.muzza.tech` and nowhere else. That was right while this app was the
 * only thing that ever read it, and it is not now - the browser calls the API
 * directly for everything a child does while playing, and a host-only cookie
 * would not go with those calls.
 *
 * So production sets it to `learnr.muzza.tech`, which reaches that host *and*
 * its subdomains, `api.learnr.muzza.tech` among them. That is also why the API
 * is a subdomain of this app rather than a sibling like `learnr-api.muzza.tech`:
 * a sibling could only be reached by widening this to `muzza.tech`, which would
 * send a child's session cookie to every host under that name.
 *
 * `__Secure-` permits a `Domain`; it is `__Host-` that forbids one. Left unset
 * in development, where the web app and the API are two ports on localhost and
 * a host-only cookie already reaches both.
 */
const useSecureCookies = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = useSecureCookies
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

export const SESSION_COOKIE_OPTIONS: {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  domain?: string;
} = {
  httpOnly: true,
  // What stands between a cookie this widely scoped and a cross-site write, now
  // that the browser posts to the API itself rather than through a server
  // action and Next's origin check. Lax withholds the cookie from a cross-site
  // POST, which is the shape every one of these calls has.
  sameSite: 'lax',
  path: '/',
  secure: useSecureCookies,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};
