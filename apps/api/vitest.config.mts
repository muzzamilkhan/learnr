import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/helpers/global-setup.ts'],
    // Every test file shares the one Postgres and truncates between tests, so
    // two files running at once would wipe each other's rows mid-test. These
    // are database-bound anyway - there is little parallelism to win back.
    fileParallelism: false,
    environment: 'node',
    // Testcontainers needs room to pull an image on a cold machine.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
