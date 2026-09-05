import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma, isDatabaseConfigured } from '@/server/db';
import { claimParentRole } from '@/server/accounts';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/session-cookie';
import { googleConfigured, sessionsReadable, type AuthEnv } from '@/lib/auth-config';

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
 * Re-exported rather than defined here - see `src/session-cookie.ts` for why
 * they live apart from the `NextAuth({...})` call below, and for the two
 * constants themselves. Every existing importer of these two names from
 * `@/auth` keeps working unchanged.
 */
export { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS };

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseConfigured && prisma ? PrismaAdapter(prisma) : undefined,
  providers: [
    /**
     * The flag links a Google sign-in onto an existing account with the same
     * address instead of throwing `OAuthAccountNotLinked`. It is called
     * dangerous because on its own it links on a bare address match and
     * consults no verification claim - so it is never on its own here: the
     * `signIn` callback below refuses anything Google will not vouch for.
     *
     * The order is what makes that work, and it was read off the installed
     * source rather than assumed: `@auth/core/lib/actions/callback/index.js`
     * calls `handleAuthorized` - the callback - before `handleLoginOrRegister`,
     * which is where both the flag and the throw live.
     */
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
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
    /**
     * **Every** Google sign-in with an unverified address is refused, not only
     * the ones that would link. An account made from a claim Google will not
     * stand behind is a row holding an address its real owner may verify here
     * later, which is the collision this whole design exists to avoid.
     *
     * Returning a string redirects, which is how this reaches `/signin` with an
     * `?error=` of its own rather than the generic `AccessDenied`.
     */
    signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if ((profile as { email_verified?: boolean } | undefined)?.email_verified !== true) {
        return '/signin?error=GoogleEmailUnverified';
      }
      return true;
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
     * The one caller of it that cannot go through an ordinary page render: this
     * runs during the OAuth callback, before the session cookie the rest of the
     * app authenticates by exists. `/` calls the same function directly for the
     * healing case, where there is one.
     */
    async signIn({ user }) {
      if (user.id) await claimParentRole(user.id);
    },
  },
});

const authEnv: AuthEnv = {
  secret: process.env.AUTH_SECRET,
  database: isDatabaseConfigured,
  googleId: process.env.AUTH_GOOGLE_ID,
  googleSecret: process.env.AUTH_GOOGLE_SECRET,
};

/**
 * May a session exist and be read? See `sessionsReadable` for why this needs
 * no Google credentials - a password session is a `Session` row and a cookie,
 * and every call site that only wants to know whether calling `auth()` is
 * worth the round trip belongs on this, not on `isGoogleConfigured`.
 */
export const isSessionReadable = sessionsReadable(authEnv);

/**
 * Is Google sign-in itself set up? This is the one place "auth is configured"
 * still means what it used to: whether to offer the Google button, or to say
 * sign-in has not been set up at all. It answers a narrower question than it
 * looks like it should - a deployment can have this false and still run a
 * full password sign-in - so nothing that only needs a readable session
 * should reach for it.
 */
export const isGoogleConfigured = googleConfigured(authEnv);
