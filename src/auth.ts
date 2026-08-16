import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma, isDatabaseConfigured } from '@/lib/db';

/**
 * Google is the only provider — a parent signs in once on the iPad and the child
 * keeps using that session. Parent-specific controls come later.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseConfigured && prisma ? PrismaAdapter(prisma) : undefined,
  providers: [Google],
  session: { strategy: isDatabaseConfigured ? 'database' : 'jwt' },
  pages: { signIn: '/signin' },
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
