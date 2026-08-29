/**
 * Moved to the repository root (`src/server/test-helpers/global-setup.ts`) as
 * part of collapsing the API back into the web app - `apps/api` is deleted
 * whole in a later step of that collapse. This shim exists only to keep
 * `apps/api`'s own vitest config, which still names this path, working until
 * then.
 */
export * from '../../../../src/server/test-helpers/global-setup';
