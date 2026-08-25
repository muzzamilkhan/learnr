# LearnR API Server Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract LearnR's five database-touching modules into a standalone Fastify REST API server, with the pure engine shared as a versioned package, and point the existing Next.js web app at it without changing what a user sees.

**Architecture:** The pure engine (`src/lib` minus the five impure files, plus `src/content`) is published as `@learnr/core`, consumed by both the web app and the API server. The API server owns Prisma, the schema and migrations, and exposes the endpoints from the design spec. The web app keeps the engine and its UI, drops Prisma, and calls the API from its server components and actions. Auth.js stays in the web app and shares session state with the API through the `Session` table.

**Tech Stack:** Node 24, TypeScript 5, Fastify 5, zod 4, `fastify-type-provider-zod` (schemas generate the OpenAPI document), Prisma 7 with `@prisma/adapter-pg`, Vitest 4, Testcontainers (`@testcontainers/postgresql`).

**Spec:** `docs/superpowers/specs/2026-08-26-ios-port-design.md`

## Global Constraints

- **Node** >= 24. **TypeScript** strict mode, matching `learnr`'s `tsconfig.json`.
- **`null` means the read failed; `[]` means nothing was recorded.** A failed read is HTTP `503`, never `200 []`.
- **Ownership is the `where` clause, never a separate check.** No fetch-then-compare in any handler.
- **Play-path writes are best-effort; account writes report success.**
- **Prisma 7** with the `PrismaPg` driver adapter, exactly as `src/lib/db.ts` does today.
- **`isDatabaseConfigured`** treats a connection string containing `user:password@host` as absent. Preserve this — it is what lets the app run unconfigured.
- **Every extracted function keeps its existing signature and its existing failure convention.** This plan moves code; it does not redesign it.
- **No behaviour change visible to a user.** The web app must look and act identically when this plan is done.
- **Every `Date` crossing the wire is an ISO 8601 string, revived to a `Date` by the web client.** The data modules return real `Date` objects in a dozen places; JSON has no date type, so an unrevived read hands a component a string where it expects a `Date` and `.getTime()` throws at render. Task 11a is the boundary that makes this systematic rather than per-field.
- Commit after every task. Never commit a red test.

## Prerequisites

Before Task 1, the machine needs a container runtime for Testcontainers. Docker is
**not** currently installed here. Either is fine:

```bash
brew install colima docker && colima start   # lightweight, no Docker Desktop
# or install Docker Desktop and launch it
docker info                                   # must succeed before Task 3
```

Tasks 1 and 2 do not need it. Task 3 onward do.

## Why the pure engine becomes a package

`records.ts` alone imports nine pure modules; across the five impure files the
closure is `analytics/profile`, `analytics/report`, `curriculum`, `figures/types`,
`rewards/streak`, `rewards/stars`, `rewards/target`, `day`, `session/session`,
`avatars`, `login-code`, `share-link`, `children`, `photo/photo`,
`speedrun/records`, `speedrun/modes`, `speedrun/leaderboard`, `speedrun/history`,
`speedrun/summary` — essentially the whole pure core.

Both the API server and the web app need all of it. Vendoring a copy would start
drifting immediately, which is the exact failure this whole design exists to
prevent. So it is published once and consumed twice.

## Testing note: these five files have no tests today

Every `.test.ts` in `src/lib` covers a pure module. `records.ts`, `accounts.ts`,
`sharing.ts`, `speed-records.ts` and `db.ts` have **no test coverage at all**.

This plan therefore writes their first tests as it extracts them. Three
concurrency guards matter most and are the reason for a real Postgres rather than
a mock:

1. `updateTopicSkill` — `SELECT ... FOR UPDATE` plus a retry on the insert race.
2. `awardRoundStars` — `SELECT ... FOR UPDATE` on `roundsBanked`.
3. `awardDailyTarget` — compare-and-set in a `where` on `targetDay`.

A mocked Prisma cannot test any of them.

## File Structure

### New repo: `learnr-api`

```
src/
  server.ts             Fastify instance, plugin registration, OpenAPI generation
  env.ts                Environment parsing; isDatabaseConfigured
  db.ts                 Prisma client (moved from learnr/src/lib/db.ts)
  auth/
    session.ts          Resolve a request to a userId, by cookie or bearer token
    plugin.ts           Fastify plugin decorating the request with `user`
  data/
    records.ts          Moved from learnr/src/lib/records.ts
    accounts.ts         Moved from learnr/src/lib/accounts.ts
    sharing.ts          Moved from learnr/src/lib/sharing.ts
    speed-records.ts    Moved from learnr/src/lib/speed-records.ts
  routes/
    auth.ts             POST /auth/redeem, GET /me
    sessions.ts         Play recording and awards
    children.ts         Parent CRUD and login codes
    reports.ts          Computed parent analytics
    shares.ts           Invites and grants
    speed.ts            Speed runs and records
  schemas/
    common.ts           Shared zod schemas (YearLevel, ids, error envelope)
    play.ts             Attempt, session DTOs
    account.ts          Account, ChildProfile DTOs
prisma/
  schema.prisma         Moved from learnr/prisma/
  migrations/           Moved from learnr/prisma/
test/
  helpers/
    db.ts               Testcontainers lifecycle, migration, truncation
    factories.ts        Build users, children, sessions, attempts
```

### New package: `@learnr/core`

Published from `learnr` (its existing pure modules), consumed by both apps. No
new code — a `package.json`, a build, and an export map over files that already
exist.

### Modified: `learnr`

- Delete `src/lib/{db,records,accounts,sharing,speed-records}.ts`.
- Add `src/lib/api.ts` — a typed client generated from the API's OpenAPI document.
- Rewrite server actions and server-component reads to call the API.
- Drop `prisma`, `@prisma/client`, `@prisma/adapter-pg` from `package.json`.

---

### Task 1: Scaffold `learnr-api` and prove it boots

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.mts`, `.gitignore`, `.env.example`
- Create: `src/env.ts`, `src/server.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildServer(): FastifyInstance` — the app factory every later task registers routes on and every test drives. `isDatabaseConfigured: boolean` and `DATABASE_URL: string | undefined` from `src/env.ts`.

- [ ] **Step 1: Write the failing test**

`test/server.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('the server', () => {
  it('answers a health check', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/server'`.

- [ ] **Step 3: Write the config files**

`package.json`:

```json
{
  "name": "learnr-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "fastify-type-provider-zod": "^4.0.2",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^24",
    "tsx": "^4.19.2",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`vitest.config.mts`:

```ts
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
```

`.gitignore`:

```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 4: Write `src/env.ts`**

```ts
/**
 * The database is optional, exactly as it is in the web app: without a real
 * DATABASE_URL the server still boots and answers, it just cannot persist.
 * The placeholder from `.env.example` counts as absent, so copying that file
 * as-is is enough to start.
 */
const connectionString = process.env.DATABASE_URL;

export const DATABASE_URL = connectionString;

export const isDatabaseConfigured = Boolean(
  connectionString && !connectionString.includes('user:password@host'),
);

export const PORT = Number(process.env.PORT ?? 3001);
```

- [ ] **Step 5: Write `src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get('/health', async () => ({ ok: true }));

  return app;
}
```

- [ ] **Step 6: Write `src/main.ts`**

```ts
import { buildServer } from './server';
import { PORT } from './env';

const app = buildServer();

app.listen({ port: PORT, host: '0.0.0.0' }).catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 7: Write `.env.example`**

```
# Postgres. The placeholder below counts as no database, so the server boots
# without persistence on a fresh clone.
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
PORT=3001
```

- [ ] **Step 8: Install and run the test**

```bash
npm install
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold the API server and prove it boots"
```

---

### Task 2: Publish the pure engine as `@learnr/core`

**Files:**
- Create (in `learnr`): `packages/core/package.json`, `packages/core/tsconfig.json`
- Modify (in `learnr`): `package.json` (workspaces)
- Test: `packages/core/test/exports.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the package `@learnr/core`, re-exporting every pure module the API server and web app need. Import paths are subpath exports: `@learnr/core/analytics/profile`, `@learnr/core/curriculum`, `@learnr/core/session`, and so on — mirroring today's `src/lib/*` layout so the moved files' import statements change prefix only.

This task does not move any source. It wraps `learnr/src/lib` and `learnr/src/content` in a package boundary so both apps can depend on one copy.

- [ ] **Step 1: Write the failing test**

`packages/core/test/exports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseYearLevel, YEAR_LEVELS } from '@learnr/core/curriculum';
import { emptyProfile } from '@learnr/core/analytics/profile';
import { createRng } from '@learnr/core/rng';

describe('@learnr/core', () => {
  it('exports the curriculum vocabulary', () => {
    expect(YEAR_LEVELS).toEqual(['K', '1', '2', '3', '4', '5', '6']);
    expect(parseYearLevel('03')).toBe('3');
    expect(parseYearLevel('nope')).toBeNull();
  });

  it('exports an empty learner profile', () => {
    expect(emptyProfile().skills).toEqual([]);
  });

  it('exports a deterministic rng', () => {
    const first = createRng('seed').next();
    const second = createRng('seed').next();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- packages/core
```

Expected: FAIL — `Cannot find package '@learnr/core'`.

- [ ] **Step 3: Turn `learnr` into a workspace root**

Add to `learnr/package.json`, at the top level:

```json
  "workspaces": ["packages/*"],
```

- [ ] **Step 4: Write `packages/core/package.json`**

The `exports` map points at the existing sources. `src` stays where it is; the
package is a window onto it, not a copy.

```json
{
  "name": "@learnr/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    "./rng": "../../src/lib/rng.ts",
    "./day": "../../src/lib/day.ts",
    "./curriculum": "../../src/lib/curriculum.ts",
    "./avatars": "../../src/lib/avatars.ts",
    "./children": "../../src/lib/children.ts",
    "./login-code": "../../src/lib/login-code.ts",
    "./share-link": "../../src/lib/share-link.ts",
    "./photo/photo": "../../src/lib/photo/photo.ts",
    "./figures/types": "../../src/lib/figures/types.ts",
    "./session": "../../src/lib/session/session.ts",
    "./analytics/profile": "../../src/lib/analytics/profile.ts",
    "./analytics/report": "../../src/lib/analytics/report.ts",
    "./analytics/errors": "../../src/lib/analytics/errors.ts",
    "./rewards/stars": "../../src/lib/rewards/stars.ts",
    "./rewards/streak": "../../src/lib/rewards/streak.ts",
    "./rewards/target": "../../src/lib/rewards/target.ts",
    "./speedrun/modes": "../../src/lib/speedrun/modes.ts",
    "./speedrun/records": "../../src/lib/speedrun/records.ts",
    "./speedrun/leaderboard": "../../src/lib/speedrun/leaderboard.ts",
    "./speedrun/history": "../../src/lib/speedrun/history.ts",
    "./speedrun/summary": "../../src/lib/speedrun/summary.ts",
    "./content/catalog": "../../src/content/catalog.ts"
  }
}
```

- [ ] **Step 5: Run the test**

```bash
npm install
npm test -- packages/core
```

Expected: PASS.

- [ ] **Step 6: Confirm the existing suite is untouched**

```bash
npm test && npm run typecheck
```

Expected: PASS — this task added a package boundary and changed no behaviour.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Publish the pure engine as @learnr/core"
```

---

### Task 3: Move the schema, and stand up a real Postgres for tests

**Files:**
- Create (in `learnr-api`): `prisma/schema.prisma`, `prisma/migrations/` (moved), `prisma.config.ts`, `src/db.ts`, `test/helpers/db.ts`
- Test: `test/db.test.ts`

**Interfaces:**
- Consumes: `isDatabaseConfigured`, `DATABASE_URL` from `src/env.ts` (Task 1).
- Produces: `prisma: PrismaClient | null` from `src/db.ts`. From `test/helpers/db.ts`: `startDatabase(): Promise<void>`, `stopDatabase(): Promise<void>`, `truncateAll(): Promise<void>`, and `testPrisma(): PrismaClient` — the client every later test uses.

- [ ] **Step 1: Copy the schema and migrations across**

```bash
cp -R ../learnr/prisma ./prisma
cp ../learnr/prisma.config.ts ./prisma.config.ts
```

The schema is moved verbatim. Its `generator client` output path needs updating:
open `prisma/schema.prisma` and change

```prisma
  output   = "../src/generated/prisma"
```

to

```prisma
  output   = "../src/generated/prisma"
```

(unchanged — the relative path resolves the same way from the new repo root).

- [ ] **Step 2: Add the Prisma dependencies**

```bash
npm install @prisma/client@^7.9.1 @prisma/adapter-pg@^7.9.1
npm install -D prisma@^7.9.1 @testcontainers/postgresql@^10.13.2 dotenv@^17.4.2
```

Add to `package.json` scripts:

```json
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "postinstall": "prisma generate"
```

- [ ] **Step 3: Write `src/db.ts`**

Moved from `learnr/src/lib/db.ts`, with the import path adjusted and the
`isDatabaseConfigured` computation now living in `env.ts`.

```ts
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL, isDatabaseConfigured } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient | null {
  if (!isDatabaseConfigured) return null;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}

export const prisma: PrismaClient | null = globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections through hot reloads in dev.
if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Write the failing test**

`test/db.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './helpers/db';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('the test database', () => {
  it('has the schema applied', async () => {
    const user = await testPrisma().user.create({
      data: { name: 'Ada', role: 'parent' },
    });

    expect(user.id).toBeTypeOf('string');
    expect(user.stars).toBe(0);
    expect(user.playStreak).toBe(0);
  });

  it('is empty at the start of each test', async () => {
    expect(await testPrisma().user.count()).toBe(0);
  });
});
```

- [ ] **Step 5: Run it and watch it fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './helpers/db'`.

- [ ] **Step 6: Write `test/helpers/db.ts`**

```ts
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * A real Postgres, not a mock. The three guards this server depends on -
 * `SELECT ... FOR UPDATE` on TopicSkill and on roundsBanked, and the
 * compare-and-set on targetDay - have no meaning against a fake client, and
 * they are the parts most worth proving.
 */
let container: StartedPostgreSqlContainer | undefined;
let client: PrismaClient | undefined;

export async function startDatabase(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();

  // `migrate deploy` applies the same migrations a production deploy would, so
  // a broken migration fails here rather than on Vercel.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function stopDatabase(): Promise<void> {
  await client?.$disconnect();
  await container?.stop();
  client = undefined;
  container = undefined;
}

export function testPrisma(): PrismaClient {
  if (!client) throw new Error('startDatabase() has not run');
  return client;
}

/**
 * Truncating every table between tests is faster than recreating the schema and
 * keeps each test starting from nothing. CASCADE handles the foreign keys.
 */
export async function truncateAll(): Promise<void> {
  const db = testPrisma();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
```

- [ ] **Step 7: Run the test**

Docker must be running (see Prerequisites).

```bash
npm test
```

Expected: PASS. The first run pulls `postgres:17-alpine` and is slow; later runs are not.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Move the schema across and run tests against a real Postgres"
```

---

### Task 4: Move `accounts.ts`, and test the login-code path

**Files:**
- Create: `src/data/accounts.ts` (moved from `learnr/src/lib/accounts.ts`)
- Create: `test/helpers/factories.ts`
- Test: `test/data/accounts.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `testPrisma`/`truncateAll` (Task 3), `@learnr/core/*` (Task 2).
- Produces: from `src/data/accounts.ts`, unchanged signatures —
  - `parseRole(value: string | null | undefined): Role | null`
  - `readAccount(userId: string): Promise<Account | null>`
  - `chooseRole(userId: string, role: Role): Promise<boolean>`
  - `listChildren(parentId: string): Promise<ChildProfile[] | null>`
  - `createChild(parentId: string, input: ChildInput): Promise<string | null>`
  - `updateChild(parentId: string, childId: string, input: ChildInput): Promise<boolean>`
  - `removeChild(parentId: string, childId: string): Promise<boolean>`
  - `issueLoginCode(parentId: string, childId: string, now?: Date): Promise<string | null>`
  - `redeemLoginCode(input: string, now?: Date): Promise<RedeemedSession | null>`
  - types `Role`, `Account`, `ChildProfile`, `ChildInput`, `RedeemedSession`

  From `test/helpers/factories.ts`:
  - `makeParent(overrides?): Promise<string>` — returns the new parent's id
  - `makeChild(parentId: string, overrides?): Promise<string>` — returns the child's id

- [ ] **Step 1: Move the file**

```bash
mkdir -p src/data
cp ../learnr/src/lib/accounts.ts src/data/accounts.ts
```

Then edit the import block at the top. Remove `import 'server-only';` — it is a
Next.js construct with no meaning here — and repoint the rest:

```ts
import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { parseAvatar, type Avatar } from '@learnr/core/avatars';
import { codeExpiry, generateLoginCode, normaliseCode } from '@learnr/core/login-code';
import type { YearLevel } from '@learnr/core/curriculum';
import { parseTarget, type DailyTarget } from '@learnr/core/rewards/target';
import { parsePhoto } from '@learnr/core/photo/photo';
```

Everything below the imports is unchanged.

- [ ] **Step 2: Write `test/helpers/factories.ts`**

```ts
import { testPrisma } from './db';

/** A parent who signed in with Google. */
export async function makeParent(
  overrides: { name?: string; email?: string } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'parent',
      name: overrides.name ?? 'Parent',
      email: overrides.email ?? `parent-${crypto.randomUUID()}@example.com`,
    },
  });
  return user.id;
}

/** A managed child: no email, no Account row, a parent who owns them. */
export async function makeChild(
  parentId: string,
  overrides: { name?: string; level?: string; avatar?: string } = {},
): Promise<string> {
  const user = await testPrisma().user.create({
    data: {
      role: 'child',
      parentId,
      name: overrides.name ?? 'Child',
      selectedLevel: overrides.level ?? '3',
      avatar: overrides.avatar ?? 'fox',
    },
  });
  return user.id;
}
```

- [ ] **Step 3: Write the failing test**

`test/data/accounts.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import {
  chooseRole,
  issueLoginCode,
  listChildren,
  readAccount,
  redeemLoginCode,
  removeChild,
} from '../../src/data/accounts';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('readAccount', () => {
  it('reads a parent', async () => {
    const parentId = await makeParent({ name: 'Ada' });
    const account = await readAccount(parentId);

    expect(account).toMatchObject({ id: parentId, role: 'parent', parentId: null });
  });

  it('returns null for someone who does not exist', async () => {
    expect(await readAccount('nobody')).toBeNull();
  });
});

describe('chooseRole', () => {
  it('sets a role that was not set', async () => {
    const user = await testPrisma().user.create({ data: { name: 'New' } });
    expect(await chooseRole(user.id, 'parent')).toBe(true);
    expect((await readAccount(user.id))?.role).toBe('parent');
  });

  it('refuses to overwrite a role that is already set', async () => {
    const parentId = await makeParent();
    expect(await chooseRole(parentId, 'child')).toBe(false);
    expect((await readAccount(parentId))?.role).toBe('parent');
  });
});

describe('listChildren', () => {
  it('lists only this parent-s children', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    await makeChild(mine, { name: 'Mine' });
    await makeChild(theirs, { name: 'Theirs' });

    const children = await listChildren(mine);

    expect(children).toHaveLength(1);
    expect(children?.[0]?.name).toBe('Mine');
  });
});

describe('removeChild', () => {
  it('refuses to remove a child belonging to someone else', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    expect(await removeChild(mine, theirChild)).toBe(false);
    expect(await readAccount(theirChild)).not.toBeNull();
  });
});

describe('the login code', () => {
  it('is spent at redemption, so it works exactly once', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);

    const code = await issueLoginCode(parentId, childId);
    expect(code).toBeTypeOf('string');

    const first = await redeemLoginCode(code!);
    expect(first).not.toBeNull();

    const second = await redeemLoginCode(code!);
    expect(second).toBeNull();
  });

  it('will not redeem an expired code', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId, new Date(Date.now() - 2 * 60 * 60 * 1000));

    expect(await redeemLoginCode(code!)).toBeNull();
  });

  it('will not issue a code for another parent-s child', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);

    expect(await issueLoginCode(mine, theirChild)).toBeNull();
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npm test test/data/accounts.test.ts
```

Expected: FAIL — the module or its `@learnr/core` imports do not resolve yet.

- [ ] **Step 5: Wire `@learnr/core` into this repo**

The package lives in the `learnr` checkout next door. Link it:

```bash
npm install ../learnr/packages/core
```

Confirm `package.json` gained `"@learnr/core": "file:../learnr/packages/core"`.

- [ ] **Step 6: Run the test**

```bash
npm test test/data/accounts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move accounts.ts across, with its first tests"
```

---

### Task 5: Move `records.ts`, and prove the two star guards

**Files:**
- Create: `src/data/records.ts` (moved from `learnr/src/lib/records.ts`)
- Test: `test/data/records.test.ts`, `test/data/awards.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), factories (Task 4), `@learnr/core/*` (Task 2).
- Produces: from `src/data/records.ts`, unchanged signatures —
  - `readSelectedLevel(userId: string): Promise<string | null>`
  - `writeSelectedLevel(userId: string, level: YearLevel): Promise<void>`
  - `recordSessionStart(input: StartRecordInput): Promise<string | null>`
  - `recordAttempt(userId: string, learningSessionId: string, attempt: Attempt): Promise<AttemptResult | null>`
  - `recordSessionEnd(userId: string, learningSessionId: string): Promise<void>`
  - `readPlayStreak(userId: string): Promise<PlayStreak>`
  - `awardRoundStars(userId: string, learningSessionId: string): Promise<number | null>`
  - `readPlayerState(userId: string): Promise<PlayerState>`
  - `readTargetSettings(userId: string): Promise<TargetSettings>`
  - `readRecentAnswers(userId: string, sinceMs: number): Promise<TargetAnswer[] | null>`
  - `awardDailyTarget(userId: string, learningSessionId: string, options: { now: number; offsetMinutes: number }): Promise<boolean>`
  - `readLearnerProfile(userId: string, subject: string): Promise<LearnerProfile>`
  - `readRecentTopics(userId: string, subject: string, level: YearLevel, count: number): Promise<string[]>`
  - `readObservations(userId: string, subject: string, limit?: number): Promise<Observation[] | null>`
  - `readAnsweredQuestions(userId: string, subject: string, limit?: number): Promise<AnsweredQuestion[] | null>`
  - `readSittings(userId: string, subject: string, limit?: number): Promise<Sitting[] | null>`
  - `TARGET_WINDOW_MS: number`

- [ ] **Step 1: Move the file**

```bash
cp ../learnr/src/lib/records.ts src/data/records.ts
```

Rewrite the import block. Drop `import 'server-only';` and repoint:

```ts
import {
  emptyProfile,
  nextSkill,
  type LearnerProfile,
  type Observation,
  type TopicSkill,
} from '@learnr/core/analytics/profile';
import { EXAMPLE_ANSWERS, type AnsweredQuestion } from '@learnr/core/analytics/report';
import { parseYearLevel, type YearLevel } from '@learnr/core/curriculum';
import { prisma } from '../db';
import { parseFigure } from '@learnr/core/figures/types';
import { nextPlayStreak, startedNewDay, noStreak, type PlayStreak } from '@learnr/core/rewards/streak';
import { rounds } from '@learnr/core/rewards/stars';
import {
  TARGET_STARS,
  dayProgress,
  dayTotal,
  parseTarget,
  type DailyTarget,
  type TargetAnswer,
} from '@learnr/core/rewards/target';
import { localDay } from '@learnr/core/day';
import type { Attempt } from '@learnr/core/session';
```

Everything below is unchanged.

- [ ] **Step 2: Write the recording test**

`test/data/records.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import {
  readLearnerProfile,
  readObservations,
  recordAttempt,
  recordSessionStart,
} from '../../src/data/records';
import type { Attempt } from '@learnr/core/session';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

function anAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: '4',
    correct: true,
    timeTakenMs: 1500,
    answeredAt: Date.now(),
    offsetMinutes: 600,
    ...overrides,
  };
}

async function aSession(childId: string): Promise<string> {
  const id = await recordSessionStart({
    userId: childId,
    subject: 'maths',
    level: '3',
    seed: 'seed-1',
  });
  if (!id) throw new Error('the session did not start');
  return id;
}

describe('recordAttempt', () => {
  it('writes the attempt and folds it into the topic skill', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    const result = await recordAttempt(childId, sessionId, anAttempt());

    expect(result).not.toBeNull();
    expect(await testPrisma().attempt.count()).toBe(1);

    const skill = await testPrisma().topicSkill.findFirst({ where: { userId: childId } });
    expect(skill).toMatchObject({ topic: 'addition', level: '3', attempts: 1, correct: 1 });
  });

  it('refuses an attempt on a session belonging to someone else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const sessionId = await aSession(theirs);

    expect(await recordAttempt(mine, sessionId, anAttempt())).toBeNull();
    expect(await testPrisma().attempt.count()).toBe(0);
  });

  it('folds many answers onto one skill row rather than racing them away', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    // Answered at once, as two tabs or a fast child would.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        recordAttempt(childId, sessionId, anAttempt({ answeredAt: Date.now() + i })),
      ),
    );

    const skills = await testPrisma().topicSkill.findMany({ where: { userId: childId } });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.attempts).toBe(10);
  });
});

describe('readObservations', () => {
  it('returns [] for a child who has never played, not null', async () => {
    const childId = await makeChild(await makeParent());
    expect(await readObservations(childId, 'maths')).toEqual([]);
  });
});

describe('readLearnerProfile', () => {
  it('rebuilds the same profile the live fold produced', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = await aSession(childId);

    await recordAttempt(childId, sessionId, anAttempt({ correct: true }));
    await recordAttempt(childId, sessionId, anAttempt({ correct: false, response: '5' }));

    const profile = await readLearnerProfile(childId, 'maths');
    const skill = profile.skills.find((s) => s.topic === 'addition');

    expect(skill).toMatchObject({ attempts: 2, correct: 1 });
  });
});
```

The third test is the one that matters most: it is the first-ever coverage of the
`SELECT ... FOR UPDATE` in `updateTopicSkill`. Without the lock it fails, because
ten concurrent read-fold-writes lose answers.

- [ ] **Step 3: Write the awards test**

`test/data/awards.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import {
  awardDailyTarget,
  awardRoundStars,
  recordAttempt,
  recordSessionStart,
} from '../../src/data/records';
import type { Attempt } from '@learnr/core/session';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

const NOW = Date.UTC(2026, 7, 26, 9, 0, 0);
const OFFSET = 600; // Ten hours east: a Sydney evening.

function anAttempt(index: number, correct: boolean): Attempt {
  return {
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: correct ? '4' : '5',
    correct,
    timeTakenMs: 1000,
    answeredAt: NOW + index * 1000,
    offsetMinutes: OFFSET,
  };
}

async function playRound(childId: string, sessionId: string, correct: number): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await recordAttempt(childId, sessionId, anAttempt(i, i < correct));
  }
}

describe('awardRoundStars', () => {
  it('pays three stars for a clean round', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);

    expect(await awardRoundStars(childId, sessionId)).toBe(3);
  });

  it('pays for a round exactly once, however many times it is asked', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);

    const first = await awardRoundStars(childId, sessionId);
    const second = await awardRoundStars(childId, sessionId);

    expect(first).toBe(3);
    expect(second).toBeNull();

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(3);
  });

  it('pays once when two calls race, not twice', async () => {
    const childId = await makeChild(await makeParent());
    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(childId, sessionId, 10);

    await Promise.all([
      awardRoundStars(childId, sessionId),
      awardRoundStars(childId, sessionId),
    ]);

    const child = await testPrisma().user.findUnique({ where: { id: childId } });
    expect(child?.stars).toBe(3);
  });

  it('does not pay for a round belonging to someone else-s session', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const sessionId = (await recordSessionStart({
      userId: theirs, subject: 'maths', level: '3', seed: 's',
    }))!;

    await playRound(theirs, sessionId, 10);

    expect(await awardRoundStars(mine, sessionId)).toBeNull();
  });
});

describe('awardDailyTarget', () => {
  it('pays the day-s target once, and not again that day', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 5 },
    });

    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    for (let i = 0; i < 5; i++) {
      await recordAttempt(childId, sessionId, anAttempt(i, true));
    }

    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(true);
    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(false);
  });

  it('does not pay before the target is reached', async () => {
    const childId = await makeChild(await makeParent());
    await testPrisma().user.update({
      where: { id: childId },
      data: { targetKind: 'questions', targetValue: 20 },
    });

    const sessionId = (await recordSessionStart({
      userId: childId, subject: 'maths', level: '3', seed: 's',
    }))!;
    await recordAttempt(childId, sessionId, anAttempt(0, true));

    expect(await awardDailyTarget(childId, sessionId, { now: NOW, offsetMinutes: OFFSET })).toBe(false);
  });
});
```

- [ ] **Step 4: Run both and watch them fail**

```bash
npm test test/data/records.test.ts test/data/awards.test.ts
```

Expected: FAIL — `src/data/records.ts` does not resolve until Step 1's edits are complete.

- [ ] **Step 5: Run them again once the imports are right**

```bash
npm test test/data/records.test.ts test/data/awards.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move records.ts across, and cover the star guards"
```

---

### Task 6: Move `sharing.ts` and `speed-records.ts`

**Files:**
- Create: `src/data/sharing.ts`, `src/data/speed-records.ts`
- Test: `test/data/sharing.test.ts`, `test/data/speed-records.test.ts`

**Interfaces:**
- Consumes: `prisma`, factories, `@learnr/core/*`, `listChildren` and `readAccount` from `src/data/accounts.ts` (Task 4).
- Produces: from `src/data/sharing.ts` — `readShareInvite`, `createShareInvite`, `cancelShareInvite`, `acceptShareInvite`, `listPendingInvites`, `listSharedViewers`, `revokeShare`, `leaveShare`, `readViewableChildren`. From `src/data/speed-records.ts` — `readSpeedAttempts`, `readSpeedSummaries`, `submitSpeedRun`, `readUnseenRecords`, `dismissSpeedRecords`, `readFamilyRecords`.

Both files keep their existing signatures exactly; consult the sources for the
precise parameter lists, which are unchanged by this move.

**Invariant to preserve.** `sharing.ts`'s private `listSharedWithMe` deliberately
never selects the login-code columns and hard-codes `code: null,
codeExpiresAt: null` in its mapping. A viewer a child was shared with must never
be handed that child's login code — it would let them sign in *as* the child.
The file moves verbatim, so this survives; do not "tidy" it into a shared mapper
with `listChildren`, which legitimately does return the code to the owning parent.

- [ ] **Step 1: Move both files**

```bash
cp ../learnr/src/lib/sharing.ts src/data/sharing.ts
cp ../learnr/src/lib/speed-records.ts src/data/speed-records.ts
```

In `src/data/sharing.ts`, drop `import 'server-only';` and repoint:

```ts
import { randomInt } from 'node:crypto';
import { prisma } from '../db';
import { parseAvatar, type Avatar } from '@learnr/core/avatars';
import { listChildren, type ChildProfile } from './accounts';
import { mergeViewable, groupViewers, type ChildAccess, type SharedViewer } from '@learnr/core/children';
import { generateShareToken, inviteExpiry, normaliseToken } from '@learnr/core/share-link';
import { parseTarget } from '@learnr/core/rewards/target';
import { parsePhoto } from '@learnr/core/photo/photo';
```

`isUniqueViolation` (the Prisma `P2002` check) is written out three times across
`records.ts`, `accounts.ts` and `speed-records.ts`. Leave the copies alone in this
task — the files move verbatim so the move stays reviewable as a move. Folding
them into one `src/data/prisma-errors.ts` is a worthwhile follow-up commit once
all three are across and their tests are green.

In `src/data/speed-records.ts`, drop `import 'server-only';` and repoint:

```ts
import { prisma } from '../db';
import { isRecord } from '@learnr/core/speedrun/records';
import { modeKey, type Mode } from '@learnr/core/speedrun/modes';
import { parseAvatar } from '@learnr/core/avatars';
import { parsePhoto } from '@learnr/core/photo/photo';
import { readAccount } from './accounts';
import { extendHouseholdWithShares, householdId } from '@learnr/core/children';
import { standingChange, type FamilyRecord, type StandingChange } from '@learnr/core/speedrun/leaderboard';
import { HISTORY_RUNS, type SpeedAttempt } from '@learnr/core/speedrun/history';
import type { SummaryRun } from '@learnr/core/speedrun/summary';
```

- [ ] **Step 2: Write the sharing test**

`test/data/sharing.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import {
  acceptShareInvite,
  createShareInvite,
  readViewableChildren,
  revokeShare,
} from '../../src/data/sharing';
import { issueLoginCode } from '../../src/data/accounts';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

describe('a share invite', () => {
  it('is spent at acceptance, so one link admits one person', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();
    const other = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    expect(invite?.token).toBeTypeOf('string');

    const first = await acceptShareInvite(invite!.token, viewer);
    expect(first.ok).toBe(true);

    const second = await acceptShareInvite(invite!.token, other);
    expect(second.ok).toBe(false);
  });

  it('grants the viewer a read of that child and nothing else', async () => {
    const owner = await makeParent();
    const shared = await makeChild(owner, { name: 'Shared' });
    await makeChild(owner, { name: 'Private' });
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [shared]);
    await acceptShareInvite(invite!.token, viewer);

    const viewable = await readViewableChildren(viewer);
    expect(viewable?.map((child) => child.name)).toEqual(['Shared']);
  });

  it('cannot be created over a child the issuer does not own', async () => {
    const owner = await makeParent();
    const stranger = await makeParent();
    const childId = await makeChild(owner);

    const invite = await createShareInvite(stranger, [childId]);
    const viewer = await makeParent();

    // The issuer owns nothing, so either the link is refused outright or it
    // grants nothing when accepted. Both are correct; neither may leak a child.
    if (invite) {
      await acceptShareInvite(invite.token, viewer);
      expect(await readViewableChildren(viewer)).toEqual([]);
    } else {
      expect(invite).toBeNull();
    }
  });
});

describe('a shared child', () => {
  it('never carries their login code to a viewer', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();

    await issueLoginCode(owner, childId);

    const invite = await createShareInvite(owner, [childId]);
    await acceptShareInvite(invite!.token, viewer);

    const viewable = await readViewableChildren(viewer);

    // A viewer holding the code could sign in as the child.
    expect(viewable?.[0]?.code).toBeNull();
    expect(viewable?.[0]?.codeExpiresAt).toBeNull();
  });
});

describe('revokeShare', () => {
  it('takes the read back', async () => {
    const owner = await makeParent();
    const childId = await makeChild(owner);
    const viewer = await makeParent();

    const invite = await createShareInvite(owner, [childId]);
    await acceptShareInvite(invite!.token, viewer);

    expect(await revokeShare(owner, viewer, childId)).toBe(true);
    expect(await readViewableChildren(viewer)).toEqual([]);
  });
});
```

- [ ] **Step 3: Write the speed-records test**

`test/data/speed-records.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import { readSpeedAttempts, submitSpeedRun } from '../../src/data/speed-records';
import { parseMode } from '@learnr/core/speedrun/modes';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

const MODE = parseMode('multiply.7')!;

describe('submitSpeedRun', () => {
  it('records the first run as a personal best without announcing a record', async () => {
    const childId = await makeChild(await makeParent());

    const outcome = await submitSpeedRun(childId, MODE, 12);

    expect(outcome).toMatchObject({ previousBest: null, best: 12, isRecord: false });
  });

  it('announces a genuine improvement', async () => {
    const childId = await makeChild(await makeParent());

    await submitSpeedRun(childId, MODE, 12);
    const outcome = await submitSpeedRun(childId, MODE, 20);

    expect(outcome).toMatchObject({ previousBest: 12, best: 20, isRecord: true });
  });

  it('keeps the best when a later run is worse, but still keeps the run', async () => {
    const childId = await makeChild(await makeParent());

    await submitSpeedRun(childId, MODE, 20);
    const outcome = await submitSpeedRun(childId, MODE, 8);

    expect(outcome).toMatchObject({ best: 20, isRecord: false });

    const attempts = await readSpeedAttempts(childId);
    expect(attempts).toHaveLength(2);
  });

  it('is idempotent under a race, because a record is a maximum', async () => {
    const childId = await makeChild(await makeParent());

    await Promise.all([
      submitSpeedRun(childId, MODE, 15),
      submitSpeedRun(childId, MODE, 15),
    ]);

    const records = await testPrisma().speedRecord.findMany({ where: { userId: childId } });
    expect(records).toHaveLength(1);
    expect(records[0]?.best).toBe(15);
  });
});
```

- [ ] **Step 4: Run both and watch them fail, then pass**

```bash
npm test test/data/sharing.test.ts test/data/speed-records.test.ts
```

Expected: FAIL before the Step 1 edits are complete, PASS after.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: PASS — every data module is now moved and covered.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move sharing.ts and speed-records.ts across, with tests"
```

---

### Task 7: Authenticate a request

**Files:**
- Create: `src/auth/session.ts`, `src/auth/plugin.ts`
- Test: `test/auth/session.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `readAccount` (Task 4).
- Produces:
  - `resolveUserId(token: string | undefined): Promise<string | null>` — looks up a live `Session` row by token.
  - `authPlugin: FastifyPluginAsync` — decorates every request with `request.userId: string | null`, read from either the Auth.js session cookie or an `Authorization: Bearer` header.
  - `requireUser(request): string` — throws a 401 if there is no user.
  - `requireParent(request): Promise<string>` — throws 401 if absent, 403 if the account is not a parent.

The API does not mint parent sessions: Auth.js does that in the web app, writing a
`Session` row. The API reads the same table. A child's bearer token is the same
kind of row, returned by `POST /auth/redeem` instead of set as a cookie.

- [ ] **Step 1: Write the failing test**

`test/auth/session.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeParent } from '../helpers/factories';
import { resolveUserId } from '../../src/auth/session';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function aSessionToken(userId: string, expires: Date): Promise<string> {
  const token = crypto.randomUUID();
  await testPrisma().session.create({ data: { sessionToken: token, userId, expires } });
  return token;
}

describe('resolveUserId', () => {
  it('resolves a live session to its user', async () => {
    const userId = await makeParent();
    const token = await aSessionToken(userId, new Date(Date.now() + 60_000));

    expect(await resolveUserId(token)).toBe(userId);
  });

  it('refuses an expired session', async () => {
    const userId = await makeParent();
    const token = await aSessionToken(userId, new Date(Date.now() - 60_000));

    expect(await resolveUserId(token)).toBeNull();
  });

  it('refuses a token nobody issued', async () => {
    expect(await resolveUserId(crypto.randomUUID())).toBeNull();
  });

  it('refuses no token at all', async () => {
    expect(await resolveUserId(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test test/auth/session.test.ts
```

Expected: FAIL — `Cannot find module '../../src/auth/session'`.

- [ ] **Step 3: Write `src/auth/session.ts`**

```ts
import { prisma } from '../db';

/**
 * A token is a `Session` row, whoever wrote it. Auth.js writes one when a parent
 * signs in with Google; `POST /auth/redeem` writes one when a child spends their
 * code. The API cannot tell the two apart and does not need to.
 */
export async function resolveUserId(token: string | undefined): Promise<string | null> {
  if (!prisma || !token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: { userId: true, expires: true },
    });

    if (!session) return null;
    if (session.expires.getTime() <= Date.now()) return null;

    return session.userId;
  } catch (error) {
    console.error('Failed to resolve a session', error);
    return null;
  }
}
```

- [ ] **Step 4: Run the test**

```bash
npm test test/auth/session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write `src/auth/plugin.ts`**

```ts
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { resolveUserId } from './session';
import { readAccount } from '../data/accounts';

const COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
}

function tokenFrom(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  const cookie = request.headers.cookie;
  if (!cookie) return undefined;

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }

  return undefined;
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('userId', null);

  app.addHook('onRequest', async (request) => {
    request.userId = await resolveUserId(tokenFrom(request));
  });
});

/** The gate for anything a signed-in user may do. */
export function requireUser(request: FastifyRequest): string {
  if (!request.userId) {
    const error = new Error('Not signed in') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
  return request.userId;
}

/** The gate for the parent screens. A child reaching one is a 403, not a 404. */
export async function requireParent(request: FastifyRequest): Promise<string> {
  const userId = requireUser(request);
  const account = await readAccount(userId);

  if (account?.role !== 'parent') {
    const error = new Error('Not a parent') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return userId;
}
```

- [ ] **Step 6: Install `fastify-plugin` and run the suite**

```bash
npm install fastify-plugin@^5.0.1
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Authenticate a request from the session table"
```

---

### Task 8: The play and auth routes

**Files:**
- Create: `src/schemas/common.ts`, `src/schemas/play.ts`, `src/routes/auth.ts`, `src/routes/sessions.ts`
- Modify: `src/server.ts`
- Test: `test/routes/auth.test.ts`, `test/routes/sessions.test.ts`

**Interfaces:**
- Consumes: `buildServer` (Task 1), `authPlugin`/`requireUser` (Task 7), `records.ts` (Task 5), `accounts.ts` (Task 4).
- Produces: the endpoints `POST /auth/redeem`, `GET /me`, `POST /sessions`, `POST /sessions/:id/attempts`, `POST /sessions/:id/award-round`, `POST /sessions/:id/award-target`, `POST /sessions/:id/end`. `yearLevelSchema` and `attemptSchema` from `src/schemas/*`, used by later route tasks.

This task implements the spec's **client-supplied session id**, which is what lets
iOS mint a sitting offline. `POST /sessions` is idempotent on that id.

- [ ] **Step 1: Write `src/schemas/common.ts`**

```ts
import { z } from 'zod';

export const yearLevelSchema = z.enum(['K', '1', '2', '3', '4', '5', '6']);

export const idSchema = z.string().min(1).max(64);

/** Every failure answers in this shape, so a client parses one thing. */
export const errorSchema = z.object({
  error: z.string(),
});
```

- [ ] **Step 2: Write `src/schemas/play.ts`**

```ts
import { z } from 'zod';
import { idSchema, yearLevelSchema } from './common';

export const attemptSchema = z.object({
  id: z.uuid(),
  templateId: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().min(1),
  level: yearLevelSchema,
  prompt: z.string(),
  expected: z.string(),
  response: z.string(),
  correct: z.boolean(),
  timeTakenMs: z.number().int().min(0),
  answeredAt: z.number().int(),
  offsetMinutes: z.number().int().min(-840).max(840),
  figure: z.unknown().optional(),
});

export const createSessionSchema = z.object({
  id: z.uuid(),
  subject: z.string().min(1),
  level: yearLevelSchema,
  seed: z.string().min(1),
});

export const sessionSchema = z.object({ id: idSchema });

export const attemptsBodySchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(200),
});

export const attemptResultSchema = z.object({
  streak: z.number().int().min(0),
  streakAdvanced: z.boolean(),
});
```

- [ ] **Step 3: Write the failing route test**

`test/routes/sessions.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import { buildServer } from '../../src/server';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

function anAttempt(index: number, correct: boolean) {
  return {
    id: crypto.randomUUID(),
    templateId: 'maths.3.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '3' as const,
    prompt: 'What is 2 + 2?',
    expected: '4',
    response: correct ? '4' : '5',
    correct,
    timeTakenMs: 1000,
    answeredAt: Date.now() + index * 1000,
    offsetMinutes: 600,
  };
}

describe('POST /sessions', () => {
  it('refuses a caller who is not signed in', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { id: crypto.randomUUID(), subject: 'maths', level: '3', seed: 's' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('opens a sitting at the id the client chose', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = crypto.randomUUID();

    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id });
  });

  it('is idempotent, so a retried flush does not open a second sitting', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = crypto.randomUUID();
    const payload = { id, subject: 'maths', level: '3', seed: 's' };

    const first = await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` }, payload,
    });
    const second = await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` }, payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(await testPrisma().learningSession.count()).toBe(1);
  });
});

describe('POST /sessions/:id/attempts', () => {
  it('records a batch, as an offline flush sends it', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = crypto.randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/sessions/${id}/attempts`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attempts: [anAttempt(0, true), anAttempt(1, true)] },
    });

    expect(response.statusCode).toBe(200);
    expect(await testPrisma().attempt.count()).toBe(2);
  });

  it('does not double-count a replayed batch', async () => {
    const childId = await makeChild(await makeParent());
    const token = await signIn(childId);
    const id = crypto.randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const batch = { attempts: [anAttempt(0, true), anAttempt(1, true)] };
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({ method: 'POST', url: `/sessions/${id}/attempts`, headers, payload: batch });
    await app.inject({ method: 'POST', url: `/sessions/${id}/attempts`, headers, payload: batch });

    expect(await testPrisma().attempt.count()).toBe(2);

    const skill = await testPrisma().topicSkill.findFirst({ where: { userId: childId } });
    expect(skill?.attempts).toBe(2);
  });

  it('refuses a sitting belonging to someone else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId);
    const theirs = await makeChild(parentId);
    const myToken = await signIn(mine);
    const theirToken = await signIn(theirs);
    const id = crypto.randomUUID();

    await app.inject({
      method: 'POST', url: '/sessions',
      headers: { authorization: `Bearer ${theirToken}` },
      payload: { id, subject: 'maths', level: '3', seed: 's' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/sessions/${id}/attempts`,
      headers: { authorization: `Bearer ${myToken}` },
      payload: { attempts: [anAttempt(0, true)] },
    });

    expect(response.statusCode).toBe(404);
    expect(await testPrisma().attempt.count()).toBe(0);
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npm test test/routes/sessions.test.ts
```

Expected: FAIL — the routes are not registered.

- [ ] **Step 5: Add the client-supplied attempt id to the schema**

The spec requires `Attempt.id` be client-supplied so a retried flush dedupes.
In `prisma/schema.prisma`, change the `Attempt` model's id line from

```prisma
  id                String   @id @default(cuid())
```

to

```prisma
  /// Client-supplied, so a retried offline flush writes each answer exactly
  /// once. A server default would make every replay a new row, and the child's
  /// TopicSkill would count their answers twice.
  id                String   @id
```

Then create the migration:

```bash
npx prisma migrate dev --name client_supplied_attempt_id
```

- [ ] **Step 6: Write `src/routes/sessions.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin';
import { prisma } from '../db';
import {
  attemptResultSchema,
  attemptsBodySchema,
  createSessionSchema,
  sessionSchema,
} from '../schemas/play';
import {
  awardDailyTarget,
  awardRoundStars,
  recordAttempt,
  recordSessionEnd,
  recordSessionStart,
} from '../data/records';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * The id comes from the client so a child can open a sitting with no network
   * and reconcile later, and so one sitting can never be confused with another.
   * Repeating the call is how a retried flush behaves, so it answers 200 rather
   * than opening a second row.
   */
  app.post('/sessions', {
    schema: { body: createSessionSchema, response: { 200: sessionSchema, 201: sessionSchema } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id, subject, level, seed } = request.body;

    const existing = await prisma?.learningSession.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (existing) return reply.code(200).send({ id });

    const created = await recordSessionStart({ id, userId, subject, level, seed });
    if (!created) return reply.code(503).send({ error: 'Could not open the sitting' });

    return reply.code(201).send({ id: created });
  });

  app.post('/sessions/:id/attempts', {
    schema: {
      params: z.object({ id: z.string() }),
      body: attemptsBodySchema,
      response: { 200: attemptResultSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const { id } = request.params;

    let last = { streak: 0, streakAdvanced: false };

    for (const attempt of request.body.attempts) {
      const result = await recordAttempt(userId, id, attempt);
      if (!result) return reply.code(404).send({ error: 'No such sitting' });
      last = result;
    }

    return reply.send(last);
  });

  app.post('/sessions/:id/award-round', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ stars: z.number().int().nullable() }) },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const stars = await awardRoundStars(userId, request.params.id);
    return reply.send({ stars });
  });

  app.post('/sessions/:id/award-target', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ offsetMinutes: z.number().int().min(-840).max(840) }),
      response: { 200: z.object({ awarded: z.boolean() }) },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const awarded = await awardDailyTarget(userId, request.params.id, {
      now: Date.now(),
      offsetMinutes: request.body.offsetMinutes,
    });
    return reply.send({ awarded });
  });

  app.post('/sessions/:id/end', {
    schema: { params: z.object({ id: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    await recordSessionEnd(userId, request.params.id);
    return reply.code(204).send();
  });
};
```

- [ ] **Step 7: Teach `recordSessionStart` and `recordAttempt` the client-supplied ids**

In `src/data/records.ts`, add `id` to `StartRecordInput` and pass it through to
the `create`:

```ts
export interface StartRecordInput {
  /** Client-supplied, so an offline sitting can be opened before it syncs. */
  id?: string;
  userId: string;
  subject: string;
  level: YearLevel;
  seed: string;
}
```

and in the `learningSession.create` call, include `...(input.id ? { id: input.id } : {})`
in `data`.

Guard the skill fold so a replay does not double-count. `updateTopicSkill`
increments `attempts` and is **not** idempotent, so it must run only when the row
was newly created. `foldPlayStreak` is a different matter: it already guards on
`playStreakDay: { lt: next.lastDay }`, so a replay writes nothing and reports
`streakAdvanced: false` — it is safe to call either way, and calling it is what
gives the caller the right `AttemptResult`.

Restructure the body of `recordAttempt` so the whole thing reads:

```ts
    if (!(await ownsSession(userId, learningSessionId))) return null;

    // A retried offline flush re-sends answers already written. The attempt
    // row itself dedupes on its client-supplied id, but `updateTopicSkill`
    // increments a counter and would count the answer twice - so a replay
    // must skip the fold. `foldPlayStreak` is guarded already and is safe to
    // run either way, and is what produces the result the caller expects.
    const already = await db.attempt.findUnique({
      where: { id: attempt.id },
      select: { id: true },
    });

    if (already) return await foldPlayStreak(userId, attempt);

    await db.attempt.create({
      data: {
        id: attempt.id,
        learningSessionId,
        // ...every other field exactly as it is today, figure spread included
      },
    });

    await updateTopicSkill(userId, attempt);
    return await foldPlayStreak(userId, attempt);
```

`foldPlayStreak` is the existing private helper in this file; do not add a new
one. Keep the `figure` spread and its comment exactly as they are — the comment
explains why the spread cannot become a cast.

- [ ] **Step 8: Write `src/routes/auth.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin';
import { readAccount, redeemLoginCode } from '../data/accounts';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * The whole of the iOS sign-in surface. The code is spent at redemption and
   * the session it buys does not expire on a schedule: the window protects the
   * handoff from parent to child, and once the child is in they stay in.
   */
  app.post('/auth/redeem', {
    schema: {
      body: z.object({ code: z.string().min(1).max(16) }),
      response: {
        200: z.object({
          token: z.string(),
          childId: z.string(),
          expiresAt: z.string(),
        }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const redeemed = await redeemLoginCode(request.body.code);
    if (!redeemed) return reply.code(401).send({ error: 'That code did not work' });

    return reply.send({
      token: redeemed.token,
      childId: redeemed.userId,
      expiresAt: redeemed.expires.toISOString(),
    });
  });

  app.get('/me', {
    schema: { response: { 200: z.unknown() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const account = await readAccount(userId);
    if (!account) return reply.code(503).send({ error: 'Could not read the account' });
    return reply.send(account);
  });
};
```

Note: `redeemLoginCode` currently returns `{ token, expires }`. Add `userId` to
`RedeemedSession` and to the returned object in `src/data/accounts.ts` — the raw
`UPDATE ... RETURNING "id"` already has it in hand.

- [ ] **Step 9: Write `test/routes/auth.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import { buildServer } from '../../src/server';
import { issueLoginCode } from '../../src/data/accounts';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

beforeEach(truncateAll);

describe('POST /auth/redeem', () => {
  it('trades a live code for a token', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    const response = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ childId });
    expect(response.json().token).toBeTypeOf('string');
  });

  it('refuses a code that has already been spent', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    await app.inject({ method: 'POST', url: '/auth/redeem', payload: { code } });
    const second = await app.inject({ method: 'POST', url: '/auth/redeem', payload: { code } });

    expect(second.statusCode).toBe(401);
  });

  it('refuses a code nobody issued', async () => {
    const response = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code: 'ZZZZ' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /me', () => {
  it('needs a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/me' });
    expect(response.statusCode).toBe(401);
  });

  it('answers with the account the token belongs to', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const code = await issueLoginCode(parentId, childId);

    const redeemed = await app.inject({
      method: 'POST', url: '/auth/redeem', payload: { code },
    });
    const { token } = redeemed.json();

    const response = await app.inject({
      method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: childId, role: 'child' });
  });
});
```

- [ ] **Step 10: Register both plugins in `src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin';
import { authRoutes } from './routes/auth';
import { sessionRoutes } from './routes/sessions';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) console.error(error);
    reply.code(status).send({ error: error.message });
  });

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(sessionRoutes);

  app.get('/health', async () => ({ ok: true }));

  return app;
}
```

- [ ] **Step 11: Run the suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Serve the play and auth routes"
```

---

### Task 9: The parent routes

**Files:**
- Create: `src/schemas/account.ts`, `src/routes/children.ts`, `src/routes/reports.ts`, `src/routes/shares.ts`, `src/routes/speed.ts`
- Modify: `src/server.ts`
- Test: `test/routes/children.test.ts`, `test/routes/reports.test.ts`

**Interfaces:**
- Consumes: `requireParent` (Task 7), `accounts.ts` (Task 4), `records.ts` (Task 5), `sharing.ts` and `speed-records.ts` (Task 6), `@learnr/core/analytics/report` and `@learnr/core/analytics/errors` (Task 2).
- Produces: the parent endpoints listed in the spec. `GET /children/:id/report` returns the computed report — this is where `report.ts` runs server-side, so the web app renders rather than computes.

- [ ] **Step 1: Write `src/schemas/account.ts`**

```ts
import { z } from 'zod';
import { yearLevelSchema } from './common';

export const childInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.string().min(1),
  level: yearLevelSchema,
  targetKind: z.enum(['questions', 'minutes']).nullable(),
  targetValue: z.number().int().positive().nullable(),
  photo: z.string().nullable(),
});

export const loginCodeSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});
```

- [ ] **Step 2: Write the failing children test**

`test/routes/children.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import { buildServer } from '../../src/server';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

describe('GET /children', () => {
  it('refuses a child asking', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(childId);

    const response = await app.inject({
      method: 'GET', url: '/children', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lists this parent-s children and nobody else-s', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    await makeChild(mine, { name: 'Mine' });
    await makeChild(theirs, { name: 'Theirs' });
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'GET', url: '/children', headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((c: { name: string }) => c.name)).toEqual(['Mine']);
  });
});

describe('POST /children/:id/login-code', () => {
  it('issues a code for a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'POST',
      url: `/children/${childId}/login-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().code).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('refuses a child another parent owns', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'POST',
      url: `/children/${theirChild}/login-code`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /children/:id', () => {
  it('refuses to delete a child another parent owns', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'DELETE',
      url: `/children/${theirChild}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(await testPrisma().user.findUnique({ where: { id: theirChild } })).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npm test test/routes/children.test.ts
```

Expected: FAIL — the routes are not registered.

- [ ] **Step 4: Write `src/routes/children.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent } from '../auth/plugin';
import { childInputSchema, loginCodeSchema } from '../schemas/account';
import {
  createChild,
  issueLoginCode,
  listChildren,
  removeChild,
  updateChild,
} from '../data/accounts';

export const childRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/children', {
    schema: { response: { 200: z.array(z.unknown()) } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const children = await listChildren(parentId);

    // null is a failed read, [] is a parent with no children. They must not
    // look the same to the screen that renders them.
    if (children === null) return reply.code(503).send({ error: 'Could not read the children' });

    return reply.send(children);
  });

  app.post('/children', {
    schema: { body: childInputSchema, response: { 201: z.object({ id: z.string() }) } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const id = await createChild(parentId, request.body);
    if (!id) return reply.code(400).send({ error: 'Could not add that child' });
    return reply.code(201).send({ id });
  });

  app.patch('/children/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: childInputSchema,
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await updateChild(parentId, request.params.id, request.body);
    if (!ok) return reply.code(404).send({ error: 'No such child' });
    return reply.code(204).send();
  });

  app.delete('/children/:id', {
    schema: { params: z.object({ id: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await removeChild(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: 'No such child' });
    return reply.code(204).send();
  });

  app.post('/children/:id/login-code', {
    schema: { params: z.object({ id: z.string() }), response: { 200: loginCodeSchema } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const code = await issueLoginCode(parentId, request.params.id);
    if (!code) return reply.code(404).send({ error: 'No such child' });

    return reply.send({
      code,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  });
};
```

- [ ] **Step 5: Write `src/routes/reports.ts`**

This is where the parent analytics run server-side. The web app stops computing.

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent } from '../auth/plugin';
import { readViewableChildren } from '../data/sharing';
import { readAnsweredQuestions, readObservations, readSittings } from '../data/records';
import {
  dueForReview,
  headline,
  problemTopics,
  progressOverTime,
  strengths,
  topicReports,
} from '@learnr/core/analytics/report';
import { errorClusters } from '@learnr/core/analytics/errors';

/** A parent may read a child they own, or one shared with them - and no other. */
async function mayRead(parentId: string, childId: string): Promise<boolean> {
  const viewable = await readViewableChildren(parentId);
  return Boolean(viewable?.some((child) => child.id === childId));
}

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/children/:id/report', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({ subject: z.string().default('maths') }),
      response: { 200: z.unknown() },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;
    const { subject } = request.query;

    if (!(await mayRead(parentId, id))) return reply.code(404).send({ error: 'No such child' });

    const observations = await readObservations(id, subject);
    const answers = await readAnsweredQuestions(id, subject);
    const sittings = await readSittings(id, subject);

    if (observations === null || answers === null || sittings === null) {
      return reply.code(503).send({ error: 'Could not read the record' });
    }

    const now = Date.now();
    const reports = topicReports(observations, now);

    return reply.send({
      headline: headline(observations, { now }),
      topics: reports,
      problems: problemTopics(reports),
      due: dueForReview(reports),
      strengths: strengths(reports),
      progress: progressOverTime(observations, { now }),
      clusters: errorClusters(answers),
      sittings,
    });
  });

  app.get('/children/:id/answers', {
    schema: {
      params: z.object({ id: z.string() }),
      querystring: z.object({
        subject: z.string().default('maths'),
        // The third argument to readAnsweredQuestions is answers *per topic*,
        // not a row cap - it defaults to EXAMPLE_ANSWERS (3). Naming it
        // `limit` here would quietly change what the parent screen asks for.
        perTopic: z.coerce.number().int().min(1).max(50).default(3),
      }),
      response: { 200: z.array(z.unknown()) },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const { id } = request.params;

    if (!(await mayRead(parentId, id))) return reply.code(404).send({ error: 'No such child' });

    const answers = await readAnsweredQuestions(id, request.query.subject, request.query.perTopic);
    if (answers === null) return reply.code(503).send({ error: 'Could not read the answers' });

    return reply.send(answers);
  });
};
```

- [ ] **Step 6: Write `test/routes/reports.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from '../helpers/db';
import { makeChild, makeParent } from '../helpers/factories';
import { buildServer } from '../../src/server';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

describe('GET /children/:id/report', () => {
  it('answers for a child this parent owns', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(parentId);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${childId}/report?subject=maths`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('topics');
  });

  it('refuses a child this parent cannot see', async () => {
    const mine = await makeParent();
    const theirs = await makeParent();
    const theirChild = await makeChild(theirs);
    const token = await signIn(mine);

    const response = await app.inject({
      method: 'GET',
      url: `/children/${theirChild}/report`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 7: Write `src/routes/shares.ts` and `src/routes/speed.ts`**

`src/routes/shares.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin';
import {
  acceptShareInvite,
  cancelShareInvite,
  leaveShare,
  listPendingInvites,
  listSharedViewers,
  createShareInvite,
  revokeShare,
} from '../data/sharing';

export const shareRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/shares', {
    schema: { response: { 200: z.object({ invites: z.array(z.unknown()), viewers: z.array(z.unknown()) }) } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const [invites, viewers] = await Promise.all([
      listPendingInvites(parentId),
      listSharedViewers(parentId),
    ]);

    if (invites === null || viewers === null) {
      return reply.code(503).send({ error: 'Could not read the sharing' });
    }

    return reply.send({ invites, viewers });
  });

  app.post('/shares', {
    schema: {
      body: z.object({ childIds: z.array(z.string()).min(1) }),
      response: { 201: z.object({ token: z.string(), expiresAt: z.string() }) },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const invite = await createShareInvite(parentId, request.body.childIds);
    if (!invite) return reply.code(400).send({ error: 'Could not create the link' });
    return reply.code(201).send({ token: invite.token, expiresAt: invite.expiresAt.toISOString() });
  });

  app.delete('/shares/:id', {
    schema: { params: z.object({ id: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await cancelShareInvite(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: 'No such link' });
    return reply.code(204).send();
  });

  app.post('/shares/:token/accept', {
    schema: { params: z.object({ token: z.string() }), response: { 200: z.unknown() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const result = await acceptShareInvite(request.params.token, userId);
    return reply.send(result);
    // Signature is (token, viewerId) - the token authorizes the call, so this
    // is one of the two deliberate exceptions to ownership-as-where.
  });

  app.delete('/shares/viewers/:viewerId', {
    schema: {
      params: z.object({ viewerId: z.string() }),
      querystring: z.object({ childId: z.string().optional() }),
      response: { 204: z.null() },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await revokeShare(parentId, request.params.viewerId, request.query.childId);
    if (!ok) return reply.code(404).send({ error: 'No such grant' });
    return reply.code(204).send();
  });

  app.delete('/shares/mine/:childId', {
    schema: { params: z.object({ childId: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const ok = await leaveShare(userId, request.params.childId);
    if (!ok) return reply.code(404).send({ error: 'No such grant' });
    return reply.code(204).send();
  });
};
```

`src/routes/speed.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin';
import { MODES, modeKey, parseMode } from '@learnr/core/speedrun/modes';
import {
  dismissSpeedRecords,
  readFamilyRecords,
  readSpeedAttempts,
  readUnseenRecords,
  submitSpeedRun,
} from '../data/speed-records';

const MAX_SCORE = 10_000;

export const speedRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/speed/modes', {
    schema: { response: { 200: z.array(z.unknown()) } },
  }, async () => MODES.map((mode) => ({ key: modeKey(mode), ...mode })));

  app.post('/speed/runs', {
    schema: {
      body: z.object({
        id: z.uuid(),
        mode: z.string().min(1),
        correct: z.number().int().min(0).max(MAX_SCORE),
      }),
      response: { 200: z.unknown() },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const mode = parseMode(request.body.mode);
    if (!mode) return reply.code(400).send({ error: 'No such mode' });

    const outcome = await submitSpeedRun(userId, mode, request.body.correct);
    if (!outcome) return reply.code(503).send({ error: 'Could not record the run' });

    return reply.send(outcome);
  });

  app.get('/speed/records', {
    schema: { response: { 200: z.unknown() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const [attempts, family] = await Promise.all([
      readSpeedAttempts(userId),
      readFamilyRecords(userId),
    ]);

    if (attempts === null || family === null) {
      return reply.code(503).send({ error: 'Could not read the records' });
    }

    return reply.send({ attempts, family });
  });

  app.get('/speed/unseen', {
    schema: { response: { 200: z.array(z.unknown()) } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const records = await readUnseenRecords(parentId);
    if (records === null) return reply.code(503).send({ error: 'Could not read the records' });
    return reply.send(records);
  });

  app.delete('/speed/unseen/:childId', {
    schema: { params: z.object({ childId: z.string() }), response: { 204: z.null() } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    await dismissSpeedRecords(parentId, request.params.childId);
    return reply.code(204).send();
  });
};
```

- [ ] **Step 8: Register everything in `src/server.ts`**

Add the imports and four more `app.register(...)` calls alongside the existing
two:

```ts
  app.register(childRoutes);
  app.register(reportRoutes);
  app.register(shareRoutes);
  app.register(speedRoutes);
```

- [ ] **Step 9: Run the suite**

```bash
npm test && npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Serve the parent routes, with the report computed here"
```

---

### Task 10: Generate the OpenAPI document

**Files:**
- Modify: `src/server.ts`
- Create: `scripts/openapi.ts`, `contract/openapi.yaml` (generated)
- Test: `test/openapi.test.ts`

**Interfaces:**
- Consumes: every route registered in Tasks 8 and 9.
- Produces: `contract/openapi.yaml`, the artifact the web client and (later) the Swift `Codable` types are generated from. `writeOpenApi(): Promise<string>` from `scripts/openapi.ts`.

- [ ] **Step 1: Write the failing test**

`test/openapi.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

let app: FastifyInstance;

beforeAll(async () => {
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('the OpenAPI document', () => {
  it('describes every route the clients depend on', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);

    const paths = Object.keys(response.json().paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/auth/redeem',
        '/me',
        '/sessions',
        '/sessions/{id}/attempts',
        '/sessions/{id}/award-round',
        '/children',
        '/children/{id}/report',
        '/speed/runs',
      ]),
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test test/openapi.test.ts
```

Expected: FAIL — 404, there is no such route.

- [ ] **Step 3: Register the OpenAPI plugins**

```bash
npm install @fastify/swagger@^9.4.0
```

In `src/server.ts`, before the route registrations:

```ts
import fastifySwagger from '@fastify/swagger';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

  app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'LearnR API', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
  });
```

and after them:

```ts
  app.get('/openapi.json', async () => app.swagger());
```

- [ ] **Step 4: Run the test**

```bash
npm test test/openapi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write `scripts/openapi.ts`**

```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { dump } from 'js-yaml';
import { buildServer } from '../src/server';

/**
 * The contract is generated, never hand-written: the zod schemas the routes
 * already validate against are the single source of truth, so a route and its
 * documented shape cannot disagree.
 */
export async function writeOpenApi(): Promise<string> {
  const app = buildServer();
  await app.ready();

  const document = app.swagger();
  await mkdir('contract', { recursive: true });
  await writeFile('contract/openapi.yaml', dump(document), 'utf8');

  await app.close();
  return 'contract/openapi.yaml';
}

writeOpenApi().then((path) => console.log(`Wrote ${path}`));
```

Add the dependency and the script:

```bash
npm install -D js-yaml @types/js-yaml
```

```json
    "contract": "tsx scripts/openapi.ts"
```

- [ ] **Step 6: Generate the contract and commit it**

```bash
npm run contract
npm test
```

Expected: `contract/openapi.yaml` exists; the suite passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Generate the OpenAPI contract from the route schemas"
```

---

### Task 11a: Revive dates at the client boundary

**Files:**
- Create (in `learnr`): `src/lib/revive.ts`
- Test (in `learnr`): `src/lib/revive.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `reviveDates<T>(value: unknown): T` — walks a parsed JSON value and turns every ISO 8601 string into a `Date`. Used by `src/lib/api.ts` in Task 11 so no caller has to remember.

**Why this exists.** The data modules return `Date` objects in many places:
`ChildProfile.codeExpiresAt`, `RedeemedSession.expires`, `ChildRecord.achievedAt`,
`SpeedAttempt.playedAt`, `SummaryRun.playedAt`, `FamilyRecord.achievedAt`,
`PendingInvite.createdAt` and `.expiresAt`, `InviteDetails.expiresAt`. JSON has no
date type. Without a revive step every one of those reaches a component as a
string, and the first `.getTime()` or `toLocaleDateString()` throws — at render
time, in production, on a screen a parent is looking at.

Note `Sitting.startedAt` is already a `number`, and stays one. The reviver must
not touch numbers.

- [ ] **Step 1: Write the failing test**

`src/lib/revive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reviveDates } from './revive';

describe('reviveDates', () => {
  it('turns an ISO string into a Date', () => {
    const revived = reviveDates<{ at: Date }>({ at: '2026-08-26T09:00:00.000Z' });
    expect(revived.at).toBeInstanceOf(Date);
    expect(revived.at.getTime()).toBe(Date.parse('2026-08-26T09:00:00.000Z'));
  });

  it('walks into arrays and nested objects', () => {
    const revived = reviveDates<{ runs: { playedAt: Date }[] }>({
      runs: [{ playedAt: '2026-08-26T09:00:00.000Z' }],
    });
    expect(revived.runs[0].playedAt).toBeInstanceOf(Date);
  });

  it('leaves a number alone, because Sitting.startedAt is one', () => {
    const revived = reviveDates<{ startedAt: number }>({ startedAt: 1756197600000 });
    expect(revived.startedAt).toBe(1756197600000);
  });

  it('leaves an ordinary string alone', () => {
    const revived = reviveDates<{ name: string }>({ name: 'Ada' });
    expect(revived.name).toBe('Ada');
  });

  it('does not mistake a prompt that merely contains digits for a date', () => {
    const revived = reviveDates<{ prompt: string }>({ prompt: 'What is 2026 minus 8?' });
    expect(revived.prompt).toBe('What is 2026 minus 8?');
  });

  it('leaves null and undefined alone', () => {
    const revived = reviveDates<{ a: null; b?: undefined }>({ a: null, b: undefined });
    expect(revived.a).toBeNull();
    expect(revived.b).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/lib/revive.test.ts
```

Expected: FAIL — `Cannot find module './revive'`.

- [ ] **Step 3: Write `src/lib/revive.ts`**

```ts
/**
 * JSON has no date type, and the API's reads are full of them - a code's expiry,
 * when a record was achieved, when a link runs out. Without this every one of
 * them arrives as a string and the first `.getTime()` throws in a component.
 *
 * The pattern is deliberately strict: a full ISO 8601 timestamp with a `T` and a
 * zone, which is what `Date.prototype.toJSON` produces and what a question prompt
 * never does. A looser match would turn "2026" in a maths question into a Date.
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function reviveDates<T>(value: unknown): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return ISO.test(value) ? new Date(value) : value;
  if (Array.isArray(value)) return value.map(walk);

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = walk(inner);
    return out;
  }

  return value;
}
```

- [ ] **Step 4: Run the test**

```bash
npm test -- src/lib/revive.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/revive.ts src/lib/revive.test.ts
git commit -m "Revive ISO dates crossing the API boundary"
```

---

### Task 11: Point the web app at the API

**Files:**
- Create (in `learnr`): `src/lib/api.ts`
- Modify (in `learnr`): `src/app/actions.ts`, `src/app/play/actions.ts`, `src/app/speed/actions.ts`, `src/app/(parent)/parent.ts`, and every page that read the database directly
- Delete (in `learnr`): `src/lib/{db,records,accounts,sharing,speed-records}.ts`, `prisma/`, `prisma.config.ts`, `scripts/migrate.mjs`
- Test: `learnr`'s existing suite must stay green

**Interfaces:**
- Consumes: `contract/openapi.yaml` (Task 10) and the running API server.
- Produces: `api` from `src/lib/api.ts` — a typed client whose methods mirror the endpoints, forwarding the caller's Auth.js session cookie.

The web app keeps its Auth.js configuration and its `Session` rows; the API reads
the same table. Nothing about how a parent signs in changes.

- [ ] **Step 1: Write `src/lib/api.ts`**

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { reviveDates } from './revive';

const BASE = process.env.LEARNR_API_URL ?? 'http://localhost:3001';

/**
 * Every read this app used to do against Prisma now goes over the wire. The
 * caller's session cookie is forwarded as-is: the API resolves it against the
 * same `Session` table Auth.js writes, so who the request is for is decided in
 * exactly one place.
 *
 * A failed read stays distinguishable from an empty one. The API answers 503
 * when it could not read, and this returns null for that - never [].
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const jar = await cookies();
  const cookie = jar.toString();

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie, ...init.headers },
      cache: 'no-store',
    });

    if (response.status === 503) return null;
    if (!response.ok) return null;
    if (response.status === 204) return undefined as T;

    // JSON has no date type. Everything a component treats as a Date arrives
    // here as a string, so it is revived once, at the boundary, rather than
    // remembered at each of a dozen call sites.
    return reviveDates<T>(await response.json());
  } catch (error) {
    console.error(`API request failed: ${path}`, error);
    return null;
  }
}

export const api = {
  me: () => request<{ id: string; role: string | null }>('/me'),

  listChildren: () => request<unknown[]>('/children'),

  createChild: (body: unknown) =>
    request<{ id: string }>('/children', { method: 'POST', body: JSON.stringify(body) }),

  updateChild: (id: string, body: unknown) =>
    request<void>(`/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  removeChild: (id: string) => request<void>(`/children/${id}`, { method: 'DELETE' }),

  issueLoginCode: (id: string) =>
    request<{ code: string; expiresAt: string }>(`/children/${id}/login-code`, { method: 'POST' }),

  report: (id: string, subject: string) =>
    request<unknown>(`/children/${id}/report?subject=${encodeURIComponent(subject)}`),

  startSession: (body: unknown) =>
    request<{ id: string }>('/sessions', { method: 'POST', body: JSON.stringify(body) }),

  recordAttempts: (id: string, attempts: unknown[]) =>
    request<{ streak: number; streakAdvanced: boolean }>(`/sessions/${id}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ attempts }),
    }),

  awardRound: (id: string) =>
    request<{ stars: number | null }>(`/sessions/${id}/award-round`, { method: 'POST' }),

  awardTarget: (id: string, offsetMinutes: number) =>
    request<{ awarded: boolean }>(`/sessions/${id}/award-target`, {
      method: 'POST',
      body: JSON.stringify({ offsetMinutes }),
    }),

  endSession: (id: string) => request<void>(`/sessions/${id}/end`, { method: 'POST' }),

  submitSpeedRun: (body: unknown) =>
    request<unknown>('/speed/runs', { method: 'POST', body: JSON.stringify(body) }),
};
```

- [ ] **Step 2: Rewrite `src/app/play/actions.ts` against the client**

```ts
'use server';

import { auth } from '@/auth';
import { api } from '@/lib/api';
import type { Attempt } from '@/lib/session/session';
import type { YearLevel } from '@/lib/curriculum';

export async function startRecordingAction(
  subject: string,
  level: YearLevel,
  seed: string,
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // The id is the client's to choose, so a sitting is one row whoever retries.
  const id = crypto.randomUUID();
  const started = await api.startSession({ id, subject, level, seed });
  return started?.id ?? null;
}

export async function recordAttemptAction(
  learningSessionId: string,
  attempt: Attempt,
): Promise<{ streak: number; streakAdvanced: boolean } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return api.recordAttempts(learningSessionId, [{ id: crypto.randomUUID(), ...attempt }]);
}

export async function awardRoundAction(learningSessionId: string): Promise<void> {
  await api.awardRound(learningSessionId);
}

export async function awardTargetAction(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<boolean> {
  const result = await api.awardTarget(learningSessionId, offsetMinutes);
  return result?.awarded ?? false;
}

export async function endRecordingAction(learningSessionId: string): Promise<void> {
  await api.endSession(learningSessionId);
}
```

- [ ] **Step 3: Rewrite the parent actions and reads**

Apply the same treatment to `src/app/actions.ts`, `src/app/speed/actions.ts` and
`src/app/(parent)/parent.ts`: replace each direct call into the deleted modules
with the matching `api.*` call. The signatures the components import stay the
same, so no component changes.

- [ ] **Step 4: Delete the extracted modules and Prisma**

```bash
rm src/lib/db.ts src/lib/records.ts src/lib/accounts.ts \
   src/lib/sharing.ts src/lib/speed-records.ts
rm -rf prisma prisma.config.ts scripts/migrate.mjs
npm uninstall prisma @prisma/client @prisma/adapter-pg
```

Auth.js needs its adapter to keep working, and it is the one thing that does not
cleanly extract. `PrismaAdapter` needs a live `PrismaClient` in-process; it cannot
speak REST without writing a custom adapter.

What makes this tractable is that **`src/auth.ts` is the only file outside
`src/lib` that imports `db.ts` at all** — the blast radius is one file. So: keep a
Prisma client in the web app for Auth.js alone, and let the API own everything
else. Restore just what the adapter needs:

```bash
npm install @prisma/client @prisma/adapter-pg
```

and keep a trimmed `src/lib/auth-db.ts` exporting a client used by nothing but
`src/auth.ts`. Note this in the file's header comment so nobody re-grows it.

- [ ] **Step 5: Update the build script**

`npm run build` currently runs `db:deploy` first. Migrations now belong to the
API server, so in `learnr/package.json` change:

```json
    "build": "next build",
```

- [ ] **Step 6: Run both suites and the type checker**

With the API server running on port 3001:

```bash
cd ../learnr-api && npm run dev &
cd ../learnr && npm test && npm run typecheck && npm run build
```

Expected: PASS.

- [ ] **Step 7: Verify by hand**

The app is already running on port 3000 (see `dev.log`). Check, as a parent:

1. Sign in with Google; the dashboard lists your children.
2. Add a child, edit them, issue a login code.
3. Open `/progress`; the report renders with real numbers.
4. Redeem the code in another browser; the child reaches `/play`.
5. Answer ten questions; stars appear.
6. Play a speed run; the score records.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Read and write through the API rather than Prisma"
```

---

### Task 12: Deploy the API server and cut over

**Files:**
- Create (in `learnr-api`): `README.md`, `Dockerfile` or the host's equivalent config
- Modify (in `learnr`): `.env.example`

**Interfaces:**
- Consumes: everything above.
- Produces: a deployed API the web app reads in production.

- [ ] **Step 1: Write the API server's README**

Cover: what it is, how to run it, the environment variables (`DATABASE_URL`,
`PORT`), how to run migrations (`npm run db:deploy`), and that Docker is needed
for the tests.

- [ ] **Step 2: Point the web app's environment at it**

Add to `learnr/.env.example`:

```
# The API server. Everything that used to be a Prisma call goes here.
LEARNR_API_URL="http://localhost:3001"
```

- [ ] **Step 3: Deploy the API server**

Deploy to the same provider as the web app, sharing the Neon connection string.
Run `npm run db:deploy` as the release command, so a deploy carries its own schema
changes — the property `scripts/migrate.mjs` used to provide.

- [ ] **Step 4: Set `LEARNR_API_URL` in the web app's production environment**

- [ ] **Step 5: Verify in production**

Repeat Task 11 Step 7's checks against the deployed pair.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Document and deploy the API server"
```

---

## Self-Review

**Spec coverage.** Every element of the spec's step 1 has a task: the repo
(1), the shared engine (2), the schema and its migrations (3), the four data
modules (4-6), authentication for both cookie and bearer (7), the play and auth
routes including client-supplied session ids and attempt idempotency (8), the
parent routes with the report computed server-side (9), the generated OpenAPI
contract (10), the web app cutover (11), and deployment (12).

The spec's three inherited conventions are enforced in code: `null` versus `[]`
appears as an explicit 503 in `/children`, `/children/:id/report`,
`/shares` and `/speed/records`; ownership-as-`where` is preserved by moving the
data modules unchanged and is tested in Tasks 4, 5, 6, 8 and 9; best-effort play
writes keep their existing convention because `records.ts` moves verbatim.

Steps 2 through 5 of the spec's build order (content extraction, fixtures, the
Swift engine, the iOS app) are deliberately out of scope, as agreed.

**Deferred to a later plan.** The spec's `GET /content/*` endpoints belong with
content extraction (build-order step 2) and are not in this plan; the web app
still imports content directly from `src/content`, which is unchanged and correct
until that step.

**Placeholder scan.** No TBDs, no "add error handling", no "similar to Task N".
Every code step carries the code.

**Type consistency.** `buildServer` (Task 1) is used unchanged in Tasks 8, 9 and
10. `testPrisma`/`truncateAll`/`startDatabase`/`stopDatabase` (Task 3) keep their
names throughout. `makeParent`/`makeChild` (Task 4) are used in Tasks 5, 6, 8 and
9. `requireUser`/`requireParent` (Task 7) are used in Tasks 8 and 9.
`RedeemedSession` gains a `userId` field in Task 8 Step 8, which is the only
signature this plan changes and is called out where it happens.

**One risk worth naming.** Task 11 Step 4 keeps a Prisma client in the web app
for Auth.js alone. That is a deliberate compromise: replacing `PrismaAdapter`
with an HTTP-backed adapter is a larger change than this plan should carry, and
the adapter's surface is stable. `src/auth.ts` is the only file outside `src/lib`
that imports `db.ts`, so the compromise is confined to one file — but it should be
revisited if the web app's Prisma dependency starts growing again.

**Signatures verified against source.** `createShareInvite` returns
`{ token, expiresAt } | null` rather than a bare token; `readAnsweredQuestions`'s
third parameter is answers *per topic* (default `EXAMPLE_ANSWERS` = 3), not a row
cap; `RedeemedSession` is `{ token, expires }` and gains `userId` in Task 8.
Each is used with its real shape above.

**Date handling.** Task 11a adds the reviver, and the Global Constraints record
the rule. Nine fields across the data modules return `Date`; `Sitting.startedAt`
is a `number` and stays one.
