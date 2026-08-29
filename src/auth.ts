import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma, isDatabaseConfigured, claimParentRole } from '@/auth-db';

/**
 * Google is the only NextAuth provider. The other way in - a child redeeming a
 * code their parent generated - is deliberately *not* a provider: Auth.js refuses
 * to combine a Credentials provider with database sessions
 * (`UnsupportedStrategy`), and moving the whole app to JWT sessions to get around
 * that would cost server-side session state for no gain. Instead
 * `POST /auth/redeem` writes a `Session` row and `redeemLoginCodeAction` sets the
 * cookie by hand. `auth()` doesn't care how a valid session came to exist.
 */

/**
 * The session cookie, pinned rather than left to Auth.js's implicit naming. Auth.js
 * switches the name between dev and prod (the `__Secure-` prefix) internally; the
 * code-redemption path has to set the very same cookie, so the name and options are
 * written down once here and imported there rather than guessed at in two places.
 */
const useSecureCookies = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = useSecureCookies
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseConfigured && prisma ? PrismaAdapter(prisma) : undefined,
  providers: [Google],
  session: { strategy: isDatabaseConfigured ? 'database' : 'jwt' },
  pages: { signIn: '/signin' },
  cookies: {
    sessionToken: { name: SESSION_COOKIE_NAME, options: SESSION_COOKIE_OPTIONS },
  },
  callbacks: {
    session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? (token?.sub as string);
      }
      return session;
    },
  },
  events: {
    /**
     * Signing in with Google *is* saying you are a grown-up, so it is taken as
     * the answer rather than followed by a screen asking the question. There is
     * no child to choose: a child is a profile their parent made, with no email
     * and no `Account` row, and they arrive by code rather than through here.
     *
     * On the event rather than in a page because a role is what every parent
     * screen gates on, and a page is not the only door - it also has to reach the
     * accounts that predate the column, which a create-time hook never would.
     * `claimParentRole` is a compare-and-set, so every sign-in after the first
     * writes nothing.
     *
     * The one caller of it that cannot go through the API: this runs during the
     * OAuth callback, before the session cookie the API authenticates by exists.
     * `/` calls `POST /me/claim-parent` for the healing case, where there is
     * one.
     */
    async signIn({ user }) {
      if (user.id) await claimParentRole(user.id);
    },
  },
});

export const isAuthConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET,
);
