import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

/**
 * @learnr/core ships TypeScript source with extensionless relative imports.
 * tsx and vitest resolve those; plain `node` does not, so a tsc build alone
 * produces a server that cannot start. Bundling the engine in resolves it once,
 * at build time, and leaves a single file to ship.
 *
 * Runtime dependencies stay external - they are ordinary published JavaScript
 * and resolve fine from `node_modules` - so only our own code and the engine
 * are inlined.
 *
 * **The external list is read from `package.json` rather than written out
 * here, and that is a fix rather than a tidy-up.** It used to be a hand-kept
 * array, which meant adding a dependency and forgetting to list it made
 * esbuild *bundle* it instead. That is harmless for an ES module and fatal for
 * a CommonJS one: its `require` calls become esbuild's `__require` shim, which
 * throws `Dynamic require of "x" is not supported` the moment it runs.
 *
 * Nothing catches that before deploy. `tsc`, vitest and tsx all resolve
 * CommonJS perfectly well and never look at the bundle, so the first thing to
 * find out is the machine, by failing its health check - which is exactly how
 * `@fastify/cors` took the API down on 2026-08-29. `npm run smoke` is the
 * other half of the answer: it boots the built artifact and asks it for
 * `/health`.
 */

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };

/**
 * The one dependency that must NOT be external: it is the engine, and the whole
 * reason this bundle exists. Everything else in `dependencies` is published
 * JavaScript that `node` can load for itself.
 */
const BUNDLED = new Set(['@learnr/core']);

const external = Object.keys(manifest.dependencies ?? {}).filter((name) => !BUNDLED.has(name));

console.log(`external: ${external.join(', ')}`);

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external,
  sourcemap: true,
  logLevel: 'info',
});
