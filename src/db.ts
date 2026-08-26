import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL, isDatabaseConfigured } from './env.js';

/**
 * The database is optional, exactly as it is in the web app: without a real
 * DATABASE_URL the server still boots and answers, it just cannot persist.
 * `isDatabaseConfigured` now lives in env.ts; everything else is unchanged
 * from learnr/src/lib/db.ts.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient | null {
  if (!isDatabaseConfigured) return null;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}

export const prisma: PrismaClient | null = globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections through hot reloads in dev.
if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma;
