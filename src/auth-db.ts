import 'server-only';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The one Prisma connection left in the web app, and it exists for Auth.js
 * alone.
 *
 * **Nothing else may import this.** `apps/api` owns the database - the schema,
 * the migrations and every read and write this app used to do here - and
 * `src/api.ts` is how the rest of the app reaches it. What could not follow
 * is `PrismaAdapter`: it needs a live `PrismaClient` in-process and cannot speak
 * REST without a custom adapter written from scratch. `src/auth.ts` was the only
 * file outside `src/lib` that ever imported the old `db.ts`, so the compromise
 * is one file wide and this is it - and it sits here beside `auth.ts` rather
 * than in `src/lib`, which is the pure engine and has no business holding a
 * database connection. If a second caller appears, the fix is an endpoint, not
 * a second import.
 *
 * The database stays optional in development: without `DATABASE_URL` the app
 * runs and plays, it just persists nothing and signs nobody in.
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
 * itself. `POST /me/claim-parent` is the same write and is what `/` calls to
 * heal an account that predates the column - but this one runs *during* the
 * OAuth callback, before the session cookie the API authenticates by has
 * reached the browser, so it is the one caller that cannot go over the wire.
 *
 * A third copy of the statement, then, beside the API's and the one
 * `acceptShareInvite` runs inside its transaction. It stays safe to duplicate
 * because it is a compare-and-set and says so: `role IS NULL`. A role already
 * set is never overwritten however many places write it, so a managed child
 * cannot be promoted by any path.
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
