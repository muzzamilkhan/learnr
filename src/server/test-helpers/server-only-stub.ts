/**
 * What `server-only` resolves to under vitest - see the note in `src/server/db.ts`.
 *
 * The real package's entry point throws on import unless the bundler asks for
 * the `react-server` export condition, which vitest does not, so importing a
 * data module in a test would fail on a guard that is doing its job in the
 * build. Aliased in `vitest.config.mts` for both projects, and nowhere else.
 */
export {};
