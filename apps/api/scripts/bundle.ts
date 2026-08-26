import { build } from 'esbuild';

/**
 * @learnr/core ships TypeScript source with extensionless relative imports.
 * tsx and vitest resolve those; plain `node` does not, so a tsc build alone
 * produces a server that cannot start. Bundling the engine in resolves it once,
 * at build time, and leaves a single file to ship.
 *
 * Runtime dependencies stay external - they are ordinary published JavaScript
 * and resolve fine - so only our own code and the engine are inlined.
 */
const EXTERNAL = [
  'fastify',
  '@fastify/swagger',
  'fastify-plugin',
  'fastify-type-provider-zod',
  'zod',
  '@prisma/client',
  '@prisma/adapter-pg',
];

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: EXTERNAL,
  sourcemap: true,
  logLevel: 'info',
});
