import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': resolve(rootDir, 'src') },
  },
});
