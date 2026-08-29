import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

/**
 * `server-only` is aliased to an empty stub, for both projects.
 *
 * `src/server/db.ts` imports the real package so a `'use client'` file that
 * reaches a data module fails `next build` rather than shipping Prisma to a
 * browser. Its entry point throws on import unless the bundler asks for the
 * `react-server` export condition, and vitest asks for neither - so without
 * this every test that touches a data module would fail on a guard that is
 * working correctly.
 *
 * It is shared rather than sitting on the `db` project alone: `unit` reaches
 * `src/server` transitively through the components that render a wall of
 * scores, and would break the same way. The alias is vitest's only, so the
 * guard is live everywhere it matters.
 */
const alias = {
  '@': resolve(rootDir, 'src'),
  'server-only': resolve(rootDir, 'src/server/test-helpers/server-only-stub.ts'),
};

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
        },
      },
    ],
  },
});
