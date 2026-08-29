import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;
const alias = { '@': resolve(rootDir, 'src') };

/**
 * Two projects, because the two suites cannot share a runner.
 *
 * `unit` is node-only, parallel and needs nothing - the engine, the content and
 * the components. `db` needs Docker, a globalSetup that starts Testcontainers
 * *before any module is imported*, and no file parallelism because every file
 * shares one Postgres and truncates between tests.
 *
 * Folding them into one run would make every unit test require Docker, which is
 * most of what makes this repo quick to work on. `npm run test:unit` is the fast
 * half on its own.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: [
            'src/**/*.test.ts',
            'packages/*/test/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
          exclude: ['src/server/**'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          include: ['src/server/**/*.test.ts'],
          globalSetup: ['./src/server/test-helpers/global-setup.ts'],
          // The globalSetup has to stay a globalSetup. The data modules build
          // their Prisma client from DATABASE_URL at import time, so the
          // variable has to name the container before a worker loads anything.
          // A per-file beforeAll leaves `prisma` null and every data function
          // returning null against a database that is running perfectly well.
          fileParallelism: false,
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // src/server/session.ts reads SESSION_COOKIE_NAME off '@/auth', which
          // pulls in next-auth. Externalized (the vitest default for anything in
          // node_modules), next-auth loads through Node's native ESM resolver,
          // which - unlike Vite's - refuses the extensionless `next/server`
          // specifier next-auth imports internally. Inlining routes it through
          // Vite's resolver instead, which behaves like Next's own bundler here.
          server: { deps: { inline: ['next-auth', '@auth/prisma-adapter'] } },
        },
      },
    ],
  },
});
