import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Testcontainers needs room to pull an image on a cold machine.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
