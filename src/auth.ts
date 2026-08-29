import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma, isDatabaseConfigured, claimParentRole } from '@/server/db';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/session-cookie';

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
