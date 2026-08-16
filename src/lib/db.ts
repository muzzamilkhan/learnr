import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The database is optional in development: without DATABASE_URL the app still
 * runs and plays, it just does not persist anything. That keeps the engines and
 * UI workable before the Neon integration is provisioned.
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

export const prisma: PrismaClient | null =
  globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections through hot reloads in dev.
if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma;
