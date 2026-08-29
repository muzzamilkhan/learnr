import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The one Prisma connection in the app, and the one every server-side read
 * and write goes through.
 *
 * The database is optional: without a real DATABASE_URL the app still runs
 * and plays, it just persists nothing and signs nobody in
 * (`isDatabaseConfigured`). The placeholder from `.env.example` counts as no
 * database, which is what keeps a fresh clone with no `.env` at all working.
 */
const connectionString = process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(
  connectionString && !connectionString.includes('user:password@host'),
);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient | null {
  if (!isDatabaseConfigured) return null;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: PrismaClient | null = globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections through hot reloads in dev.
if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma;

/**
 * A Google sign-in is a grown-up by definition, claimed on the sign-in event
 * itself. This is the same compare-and-set the API's own `claimParentRole`
 * writes, duplicated here because this one runs *during* the OAuth callback,
 * before the session cookie the rest of the app authenticates by exists - the
 * one caller that cannot go through an ordinary request.
 *
 * It stays safe to duplicate because it is a compare-and-set and says so:
 * `role IS NULL`. A role already set is never overwritten however many places
 * write it, so a managed child cannot be promoted by any path.
 */
export async function claimParentRole(userId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    const written = await prisma.user.updateMany({
      where: { id: userId, role: null },
      data: { role: 'parent' },
    });
    return written.count > 0;
  } catch (error) {
    console.error('Failed to claim the parent role', error);
    return false;
  }
}
