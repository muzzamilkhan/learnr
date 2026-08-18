import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma, isDatabaseConfigured } from '@/lib/db';

/**
 * Google is the only NextAuth provider. The other way in - a child redeeming a
 * code their parent generated - is deliberately *not* a provider: Auth.js refuses
 * to combine a Credentials provider with database sessions
 * (`UnsupportedStrategy`), and moving the whole app to JWT sessions to get around
 * that would cost server-side session state for no gain. Instead
 * `redeemLoginCode` in `src/lib/accounts.ts` writes a `Session` row and sets the
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

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: useSecureCookies,
} as const;

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
});

export const isAuthConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET,
);
