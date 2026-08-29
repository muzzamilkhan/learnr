/**
 * `db.ts` moved to the repository root (`src/server/db.ts`) as part of
 * collapsing the API back into the web app - `apps/api` is deleted whole in a
 * later step of that collapse. This shim exists only to keep the workspace
 * typechecking cleanly until then.
 */
export { prisma, isDatabaseConfigured } from '../../../src/server/db';
