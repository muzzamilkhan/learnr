# API Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Fastify API back into the Next.js web app, so LearnR is one application on Vercel again with no Fly deployment, no `@learnr/core` package, no OpenAPI contract, no generated content packs and no golden corpus.

**Architecture:** The data layer moves from `apps/api/src/data/` to `src/server/`, unchanged. Page renders call it in process. The six play-path writes stay off server actions - they become Next route handlers at the same origin, which is what keeps them out of Next's per-client server-action queue. Everything under `src/lib` and `src/content` is untouched except for two deletions and one move.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 + `@prisma/adapter-pg`, Neon Postgres, Auth.js v5, zod 4, vitest 4, Testcontainers, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-29-api-collapse-design.md`

## Global Constraints

- **`src/lib` and `src/content` stay pure.** No React, no `next`, no `@prisma/client`, no `src/server`. Callers pass in `now` and an `Rng`.
- **No behaviour change.** No screen, rule, threshold, mode, reward or report changes. 553 templates (398 maths, 155 English) at the same ids with the same tags.
- **`null` means could not read; `[]` means nothing there.** Never collapse the two.
- **Recording is best-effort.** A failed write must never block or interrupt play.
- **The answer path makes one session lookup per request and no `auth()` call of its own.** See issue #18.
- **Every task ends green.** `npm test` and `npm run typecheck` both pass before the commit.
- **Node 24.** `npm install` is always run from the repository root.
- **Work on `master`.** Commit per task.

## File Structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `prisma/schema.prisma` | The full 12-model schema and 16 migrations | 1 |
| `src/server/db.ts` | The one Prisma client | 1 |
| `src/server/session.ts` | Resolve a user id from a request's cookies | 3 |
| `src/server/accounts.ts` | Accounts, children, login codes | 2 |
| `src/server/records.ts` | Sittings, attempts, skills, stars, targets | 2 |
| `src/server/sharing.ts` | Invites and grants | 2 |
| `src/server/speed-records.ts` | Speed records, attempts, leaderboard reads | 2 |
| `src/server/reports.ts` | Composes a child's report from several reads | 5 |
| `src/server/play-state.ts` | The screen-shaped read `/play/state` used to serve | 5 |
| `src/app/api/v1/**/route.ts` | The six play-path writes | 4 |
| `src/browser-api.ts` | Unchanged shape, same-origin `BASE` | 4 |
| `vitest.config.ts` | Two projects: `unit` (no Docker) and `db` (Testcontainers) | 2 |

---

### Task 1: The schema and the Prisma client come home

The web app generates its client from `prisma/auth.prisma`, a four-model subset, because `apps/api` owned the schema. It owns the schema again.

**Accepted cost, stated rather than discovered:** the Auth.js adapter selects whole `User` rows on every authenticated request, and `User` has eighteen columns in the full schema against five in the subset. That is a slightly larger session lookup. Keeping two schemas to avoid it would mean two sources of truth for one table, which is the worse trade - and the subset only existed because the schema lived elsewhere.

**Files:**
- Move: `apps/api/prisma/schema.prisma` → `prisma/schema.prisma`
- Move: `apps/api/prisma/migrations/` → `prisma/migrations/` (16 migrations + `migration_lock.toml`)
- Move: `apps/api/src/db.ts` → `src/server/db.ts`
- Delete: `prisma/auth.prisma`, `src/auth-db.ts`
- Modify: `prisma.config.ts`, `src/auth.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/server/db.ts` exporting `prisma: PrismaClient | null` and `isDatabaseConfigured(): boolean`. Everything downstream imports the client from here.

- [ ] **Step 1: Move the schema and migrations**

```bash
cd /home/muzza/code/learnr
git mv apps/api/prisma/schema.prisma prisma/schema.prisma
git mv apps/api/prisma/migrations prisma/migrations
git rm prisma/auth.prisma
```

- [ ] **Step 2: Point `prisma.config.ts` at the schema and give it a migrations path**

The generator block in `schema.prisma` says `output = "../src/generated/prisma"`, which was relative to `apps/api/prisma/`. From `prisma/` it now means `src/generated/prisma` at the root, which is already what `.gitignore` covers and what `src/auth-db.ts` imported. Leave it.

`prisma.config.ts` at the root currently has no `migrations` path, deliberately, because it generated and never migrated. Add one:

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

- [ ] **Step 3: Move the client**

```bash
git mv apps/api/src/db.ts src/server/db.ts
```

Then fix its import of the generated client. It read `./generated/prisma` from `apps/api/src/`; from `src/server/` it is `../generated/prisma`.

- [ ] **Step 4: Repoint Auth.js and delete the old client**

`src/auth.ts` imports its client from `@/auth-db`. Change to `@/server/db`. Then:

```bash
git rm src/auth-db.ts src/auth-db.test.ts 2>/dev/null || git rm src/auth-db.ts
```

**Keep `src/auth.ts`'s explicit `SESSION_COOKIE_NAME` and `SESSION_COOKIE_OPTIONS`.** They are pinned rather than left to Auth.js because `redeemLoginCode` writes the same `Session` row the adapter would and sets the same cookie, and `auth()` can only fail to tell the two paths apart while both agree on the cookie.

- [ ] **Step 5: Add the scripts and regenerate**

In root `package.json`, add alongside `db:generate`:

```json
"db:migrate": "prisma migrate dev",
"db:deploy": "node scripts/migrate.mjs"
```

Then:

```bash
npm run db:generate
```

Expected: generates 12 models into `src/generated/prisma`, not 4.

- [ ] **Step 6: Verify green**

```bash
npm run typecheck && npm test
```

Expected: PASS. Nothing yet imports the new models, so this is purely proving the client still builds and Auth.js still compiles against it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Bring the schema and the Prisma client back to the root

apps/api owned the schema, so the web app generated a four-model subset from
prisma/auth.prisma just to give PrismaAdapter a live client. It owns the schema
again, so there is one schema and one client.

The cost is real and worth naming: the adapter selects whole User rows on every
authenticated request, and User has eighteen columns here against five in the
subset. Two schemas for one table is the worse trade."
```

---

### Task 2: The data layer and its tests

2,005 lines move unchanged. The tests come with them, and the vitest config splits so they do not drag Docker into every unit test run.

**Files:**
- Move: `apps/api/src/data/{accounts,records,sharing,speed-records}.ts` → `src/server/`
- Move: `apps/api/test/data/*.test.ts` → `src/server/*.test.ts`
- Move: `apps/api/test/helpers/{db,factories,global-setup}.ts` → `src/server/test-helpers/`
- Modify: `vitest.config.ts`, `package.json`

**Interfaces:**
- Consumes: `src/server/db.ts` from Task 1.
- Produces: the 40 exported functions listed in the spec, importable as `@/server/records` etc. Notably `readPlayerState(userId): Promise<PlayerState>`, `readObservations(userId, subject): Promise<Observation[] | null>`, `recordAttempt(userId, sessionId, attempt): Promise<AttemptResult | null>`, `submitSpeedRun(userId, run): Promise<SpeedOutcome | null>`.

- [ ] **Step 1: Move the modules and their tests**

```bash
cd /home/muzza/code/learnr
git mv apps/api/src/data/accounts.ts       src/server/accounts.ts
git mv apps/api/src/data/records.ts        src/server/records.ts
git mv apps/api/src/data/sharing.ts        src/server/sharing.ts
git mv apps/api/src/data/speed-records.ts  src/server/speed-records.ts

mkdir -p src/server/test-helpers
git mv apps/api/test/helpers/db.ts           src/server/test-helpers/db.ts
git mv apps/api/test/helpers/factories.ts    src/server/test-helpers/factories.ts
git mv apps/api/test/helpers/global-setup.ts src/server/test-helpers/global-setup.ts

git mv apps/api/test/data/accounts.test.ts      src/server/accounts.test.ts
git mv apps/api/test/data/records.test.ts       src/server/records.test.ts
git mv apps/api/test/data/awards.test.ts        src/server/awards.test.ts
git mv apps/api/test/data/sharing.test.ts       src/server/sharing.test.ts
git mv apps/api/test/data/speed-records.test.ts src/server/speed-records.test.ts
```

- [ ] **Step 2: Rewrite the imports**

Every moved file imports from `@learnr/core/*`. Those become `@/lib/*`:

```bash
cd /home/muzza/code/learnr
sed -i \
  -e "s#@learnr/core/dto#@/lib/dto#g" \
  -e "s#@learnr/core/day#@/lib/day#g" \
  -e "s#@learnr/core/curriculum#@/lib/curriculum#g" \
  -e "s#@learnr/core/children#@/lib/children#g" \
  -e "s#@learnr/core/login-code#@/lib/login-code#g" \
  -e "s#@learnr/core/share-link#@/lib/share-link#g" \
  -e "s#@learnr/core/avatars#@/lib/avatars#g" \
  -e "s#@learnr/core/photo/photo#@/lib/photo/photo#g" \
  -e "s#@learnr/core/session#@/lib/session/session#g" \
  -e "s#@learnr/core/analytics/profile#@/lib/analytics/profile#g" \
  -e "s#@learnr/core/analytics/report#@/lib/analytics/report#g" \
  -e "s#@learnr/core/analytics/errors#@/lib/analytics/errors#g" \
  -e "s#@learnr/core/rewards/stars#@/lib/rewards/stars#g" \
  -e "s#@learnr/core/rewards/streak#@/lib/rewards/streak#g" \
  -e "s#@learnr/core/rewards/target#@/lib/rewards/target#g" \
  -e "s#@learnr/core/speedrun/modes#@/lib/speedrun/modes#g" \
  -e "s#@learnr/core/speedrun/records#@/lib/speedrun/records#g" \
  -e "s#@learnr/core/speedrun/leaderboard#@/lib/speedrun/leaderboard#g" \
  -e "s#@learnr/core/speedrun/history#@/lib/speedrun/history#g" \
  -e "s#@learnr/core/speedrun/summary#@/lib/speedrun/summary#g" \
  -e "s#@learnr/core/figures/types#@/lib/figures/types#g" \
  -e "s#@learnr/core/throttle#@/lib/throttle#g" \
  src/server/*.ts src/server/test-helpers/*.ts
```

Then fix the relative ones by hand. Three shapes to expect:

- **The `.js` suffixes.** `apps/api` is `"type": "module"` under `nodenext`, so its imports are written `from '../helpers/db.js'`. The web app resolves through the bundler and does not want them - drop the extension.
- `from '../helpers/db.js'` in a test becomes `from './test-helpers/db'`.
- `from '../../src/data/records.js'` becomes `from './records'`.

Run `npm run typecheck` and follow the errors - they are exhaustive.

The helpers export `startDatabase`, `stopDatabase`, `truncateAll`, `testPrisma`, `warmPool`, `makeParent(overrides?) => Promise<string>` and `makeChild(parentId, overrides?) => Promise<string>`. Both factories return an **id**, not a row.

- [ ] **Step 3: Split the vitest config into two projects**

Replace `vitest.config.ts` entirely:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;
const alias = { '@': resolve(rootDir, 'src') };

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
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
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
```

- [ ] **Step 4: Add the scripts and the dev dependency**

In root `package.json`:

```json
"test": "vitest run",
"test:unit": "vitest run --project unit",
"test:db": "vitest run --project db",
```

```bash
npm install -D @testcontainers/postgresql@^10.28.0
```

`global-setup.ts` runs `npx prisma migrate deploy` against the container. From the root that now resolves the root `prisma.config.ts`, which is correct.

- [ ] **Step 5: Run the fast half and verify it needs no Docker**

```bash
npm run test:unit
```

Expected: PASS, in seconds, with Docker stopped.

- [ ] **Step 6: Run the database half**

```bash
npm run test:db
```

Expected: PASS. Five files, Testcontainers pulls `postgres:17-alpine` on a cold machine. The three concurrency guards must still be covered - `SELECT ... FOR UPDATE` on `TopicSkill` and on `roundsBanked`, and the compare-and-set on `targetDay`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move the data layer into src/server, with its tests

2,005 lines unchanged. They go to src/server rather than back to src/lib where
they were before the split - the split is what made 'everything in src/lib is
pure' honest, and that is worth keeping.

The two suites cannot merge into one runner: the data tests need Docker, a
globalSetup that starts Testcontainers before any module is imported, and no
file parallelism. Folding that into the web suite would make every unit test
need Docker. Two vitest projects instead, and test:unit is the fast half."
```

---

### Task 3: Session resolution without the API

The route handlers in Task 4 need a user id from a request. They must not call `auth()` - see issue #18, where that cost 717ms on a cold Prisma client and decided nothing.

**Files:**
- Move: `apps/api/src/auth/session.ts` → `src/server/session.ts`
- Move: `apps/api/test/auth/session.test.ts` → `src/server/session.test.ts`
- Reference for the multi-cookie logic: `apps/api/src/auth/plugin.ts:65-105`

**Interfaces:**
- Consumes: `src/server/db.ts`.
- Produces:
  - `resolveUserId(token: string | undefined): Promise<string | null>`
  - `userIdFrom(request: Request): Promise<string | null>`
  - `requireUser(request: Request): Promise<string>` - throws `Unauthorized`
  - `requireParent(request: Request): Promise<string>` - throws `Unauthorized` or `Forbidden`

- [ ] **Step 1: Write the failing test**

Create `src/server/session.test.ts` by moving the API's, then add this case for the multi-cookie path:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeParent } from './test-helpers/factories';
import { userIdFrom } from './session';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

const withCookies = (value: string) =>
  new Request('https://learnr.test/api/v1/sessions', { headers: { cookie: value } });

describe('userIdFrom', () => {
  it('tries every session cookie, so a stale one cannot mask a live one', async () => {
    const parentId = await makeParent();
    const live = await signIn(parentId);

    // Two cookies of the same name: the browser sends both, oldest first. The
    // host-only one written before the Domain was added is the stale one, and
    // returning on the first match let it speak for the live one - every call
    // the page made was a 401. See ba5453f.
    const name = '__Secure-authjs.session-token';
    expect(await userIdFrom(withCookies(`${name}=stale; ${name}=${live}`))).toBe(parentId);
  });

  it('answers null when no cookie resolves', async () => {
    await makeParent();
    expect(await userIdFrom(withCookies('__Secure-authjs.session-token=nothing'))).toBeNull();
  });

  it('answers null when there is no cookie header at all', async () => {
    expect(await userIdFrom(new Request('https://learnr.test/api/v1/sessions'))).toBeNull();
  });
});
```

**`SESSION_COOKIE_NAME` is `__Secure-` prefixed only when `useSecureCookies` is on** (`src/auth.ts:24`), so in a test environment it is the bare `authjs.session-token`. Read the constant in the test rather than writing either literal - the point of the test is the duplicate, not the prefix.

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run test:db -- src/server/session.test.ts
```

Expected: FAIL - `userIdFrom` is not exported.

- [ ] **Step 3: Implement it**

Add to `src/server/session.ts`, keeping the moved `resolveUserId` as it is:

```ts
import { SESSION_COOKIE_NAME } from '@/auth';

/**
 * Every value a request carries under the session cookie's name, oldest first.
 *
 * There is normally one. There can be two: a `Set-Cookie` carrying a `Domain`
 * writes a *second* cookie of the same name rather than replacing a host-only
 * one already in the browser, and signing in again cannot fix that because
 * signing in is what writes it. Returning on the first match let the stale
 * cookie speak for the live one.
 *
 * Same-origin means nothing writes a `Domain` any more, so this is insurance for
 * browsers still holding a pair from before the collapse rather than an ongoing
 * hazard. It is cheap and it is already proven, so it stays.
 *
 * `next/headers`' cookie API returns one value per name, so the raw header is
 * what has to be read.
 */
function tokensFrom(request: Request): string[] {
  const header = request.headers.get('cookie');
  if (!header) return [];
  const prefix = `${SESSION_COOKIE_NAME}=`;
  return header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => part.slice(prefix.length))
    // Capped: each attempt is a query and the header is whatever the caller
    // sent, so an uncapped loop is an unauthenticated caller choosing how many
    // queries to cost us.
    .slice(0, 4);
}

export async function userIdFrom(request: Request): Promise<string | null> {
  for (const token of tokensFrom(request)) {
    const userId = await resolveUserId(token);
    if (userId) return userId;
  }
  return null;
}

export class Unauthorized extends Error {}
export class Forbidden extends Error {}

export async function requireUser(request: Request): Promise<string> {
  const userId = await userIdFrom(request);
  if (!userId) throw new Unauthorized();
  return userId;
}

export async function requireParent(request: Request): Promise<string> {
  const userId = await requireUser(request);
  const account = await readAccount(userId);
  if (account?.role !== 'parent') throw new Forbidden();
  return userId;
}
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:db -- src/server/session.test.ts
```

Expected: PASS, both cases.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Resolve a session from a request, without going through auth()

The route handlers need a user id and must not call auth() for it - that was a
Prisma query that decided nothing, measured at 717ms on a cold client and paid
up to twice per answer (#18). This is the targeted query the API used, moved.

Keeps the multi-cookie loop from ba5453f. Same origin means nothing writes a
Domain any more, so it is insurance for browsers still holding a pair from
before the collapse rather than a live hazard - but it is cheap and proven."
```

---

### Task 4: The six write route handlers

The play path stays off server actions, because Next serialises server-action requests from one client and the queue is invisible to every server log (#17).

**Files:**
- Create: `src/app/api/v1/sessions/route.ts`
- Create: `src/app/api/v1/sessions/[id]/attempts/route.ts`
- Create: `src/app/api/v1/sessions/[id]/award-round/route.ts`
- Create: `src/app/api/v1/sessions/[id]/award-target/route.ts`
- Create: `src/app/api/v1/sessions/[id]/end/route.ts`
- Create: `src/app/api/v1/speed/runs/route.ts`
- Create: `src/app/api/v1/schemas.ts` (from `apps/api/src/schemas/play.ts`)
- Create: `src/app/api/v1/respond.ts` (shared error mapping)
- Modify: `src/browser-api.ts`, `src/lib/day.ts`
- Delete: `src/lib/revive.ts`, `src/lib/revive.test.ts`
- Move: `apps/api/test/routes/sessions.test.ts` → `src/server/routes-sessions.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `Unauthorized` from Task 3; `recordSessionStart`, `recordAttempt`, `awardRoundStars`, `awardDailyTarget`, `recordSessionEnd`, `submitSpeedRun` from Task 2.
- Produces: six `POST` endpoints under `/api/v1`. `src/browser-api.ts` keeps its exported `browserApi` object with the same six methods and the same return types.

- [ ] **Step 1: Add zod and move the request schemas**

```bash
npm install zod@^4.4.3
git mv apps/api/src/schemas/play.ts src/app/api/v1/schemas.ts
```

Keep only the request schemas - `attemptSchema`, `createSessionSchema`, `attemptsBodySchema`. **Delete `attemptResultSchema` and every other response schema.** In the API a response schema was a serializer that silently stripped undeclared fields, which is why `Mirrored` existed; nothing serialises through a schema now, so a response schema would be a second declaration of a shape with no way to be wrong until it was.

Remove `playedAt` from the speed-run request schema. It existed for an offline queue, the browser has never sent it, and `SpeedAttempt.playedAt` keeps its `@default(now())`.

- [ ] **Step 2: Write the shared responder**

Create `src/app/api/v1/respond.ts`:

```ts
import { NextResponse } from 'next/server';
import { Forbidden, Unauthorized } from '@/server/session';

/**
 * One place the four failures a handler can have become responses.
 *
 * `src/browser-api.ts` turns every non-2xx into the same `null`, so the status
 * is for a person reading a log rather than for the caller. It still has to be
 * right: a 401 and a 500 mean very different things when play stops recording.
 */
export function failed(error: unknown): NextResponse {
  if (error instanceof Unauthorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (error instanceof Forbidden) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  console.error(error);
  return NextResponse.json({ error: 'failed' }, { status: 500 });
}
```

- [ ] **Step 3: Write the failing test for the attempts handler**

Create `src/server/routes-sessions.test.ts`, adapting the moved API test to call the handler directly:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDatabase, stopDatabase, truncateAll, testPrisma } from './test-helpers/db';
import { makeChild, makeParent } from './test-helpers/factories';
import { SESSION_COOKIE_NAME } from '@/auth';
import { POST } from '@/app/api/v1/sessions/[id]/attempts/route';

beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(truncateAll);

async function signIn(userId: string): Promise<string> {
  const token = randomUUID();
  await testPrisma().session.create({
    data: { sessionToken: token, userId, expires: new Date(Date.now() + 60_000) },
  });
  return token;
}

async function aSitting(userId: string): Promise<string> {
  const sitting = await testPrisma().learningSession.create({
    data: { userId, subject: 'maths', level: '3', seed: 'seed' },
  });
  return sitting.id;
}

const anAttempt = (correct: boolean) => ({
  id: randomUUID(),
  templateId: 'maths.3.addition.sum',
  subject: 'maths',
  topic: 'addition',
  level: '3' as const,
  prompt: 'What is 2 + 2?',
  expected: '4',
  response: correct ? '4' : '5',
  correct,
  timeTakenMs: 1000,
  answeredAt: Date.now(),
  offsetMinutes: 600,
});

const asRequest = (token: string, sittingId: string, body: unknown) =>
  new Request(`https://learnr.test/api/v1/sessions/${sittingId}/attempts`, {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/v1/sessions/:id/attempts', () => {
  it('records an answer and reports whether the streak advanced', async () => {
    const parentId = await makeParent();
    const childId = await makeChild(parentId);
    const token = await signIn(childId);
    const sittingId = await aSitting(childId);

    const response = await POST(
      asRequest(token, sittingId, { attempts: [anAttempt(true)] }),
      { params: Promise.resolve({ id: sittingId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ streak: 1, streakAdvanced: true });
  });

  it('answers 401 to a request with no live session', async () => {
    const response = await POST(
      asRequest('nothing', 'whatever', { attempts: [] }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(response.status).toBe(401);
  });

  it('answers 404 for a sitting belonging to somebody else', async () => {
    const parentId = await makeParent();
    const mine = await makeChild(parentId, { name: 'Ada' });
    const theirs = await makeChild(parentId, { name: 'Grace' });
    const token = await signIn(mine);
    const sittingId = await aSitting(theirs);

    const response = await POST(
      asRequest(token, sittingId, { attempts: [anAttempt(true)] }),
      { params: Promise.resolve({ id: sittingId }) },
    );
    expect(response.status).toBe(404);
  });
});
```

**The third case is the one worth writing first.** `learningSessionId` round-trips through the browser, so a write that did not scope by the signed-in user would let anybody append answers to anybody's sitting.

- [ ] **Step 4: Run it and watch it fail**

```bash
npm run test:db -- src/server/routes-sessions.test.ts
```

Expected: FAIL - cannot resolve `@/app/api/v1/sessions/[id]/attempts/route`.

- [ ] **Step 5: Write the attempts handler**

Create `src/app/api/v1/sessions/[id]/attempts/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/server/session';
import { recordAttempt } from '@/server/records';
import { parseFigure } from '@/lib/figures/types';
import { attemptsBodySchema } from '../../../schemas';
import { failed } from '../../../respond';

/**
 * A route handler rather than a server action, and that is the whole point.
 *
 * Next serialises server-action requests from one client, so the calls a single
 * answer makes queued behind each other while every one of them reported a
 * healthy server-side duration - a wait that existed only in the browser and
 * appeared in no log. See #17.
 *
 * The session is resolved once, here. No handler on this path calls `auth()`:
 * that was a Prisma query whose result was thrown away, measured at 717ms on a
 * cold client (#18).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUser(request);
    const { id } = await params;

    const body = attemptsBodySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

    let result = null;
    for (const attempt of body.data.attempts) {
      // The stored figure is read back through parseFigure for the reason it is
      // written on the way in: one bad mark fails the whole figure rather than
      // being dropped, because silently losing the tick that said a corner was
      // square would draw a picture buildFigure never produced.
      const figure = attempt.figure ? parseFigure(attempt.figure) : null;
      result = await recordAttempt(userId, id, { ...attempt, figure });
    }

    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return failed(error);
  }
}
```

- [ ] **Step 6: Run the tests**

```bash
npm run test:db -- src/server/routes-sessions.test.ts
```

Expected: PASS, all three.

- [ ] **Step 7: Write the other five handlers**

Same shape. Consult `apps/api/src/routes/sessions.ts:31-118` and `apps/api/src/routes/speed.ts` for the body each one already has - the logic is written and tested, only the framing changes.

- `POST /api/v1/sessions` - mints nothing; the id comes from the client so a retried call opens the same sitting. Answers 200 to an id it has already seen.
- `POST /api/v1/sessions/[id]/award-round` - `awardRoundStars(userId, id)`, returns `{ stars }`.
- `POST /api/v1/sessions/[id]/award-target` - `awardDailyTarget(userId, id, { offsetMinutes })`, returns `{ awarded }`.
- `POST /api/v1/sessions/[id]/end` - `recordSessionEnd(userId, id)`, returns 204.
- `POST /api/v1/speed/runs` - `submitSpeedRun(userId, body)`, returns `SpeedOutcome`. **No `playedAt`**; the column defaults.

- [ ] **Step 8: Move `ISO_TIMESTAMP` and delete `revive.ts`**

`src/lib/day.ts:11` imports `ISO_TIMESTAMP` from `./revive`, and is its only consumer. Inline it into `day.ts`:

```ts
/**
 * A full timestamp with a `T` and a zone. Deliberately strict: a looser pattern
 * would read "2026" inside a maths question as a date.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
```

Then delete `parsePlayedAt` and its tests from `day.ts` - it bounded a client-supplied stamp for an offline queue that no longer exists.

```bash
git rm src/lib/revive.ts src/lib/revive.test.ts
```

- [ ] **Step 9: Write the type-level test that keeps deleting `reviveDates` honest**

`src/browser-api.ts` still parses JSON over HTTP. Deleting date revival is only safe while no response shape carries a `Date`, and that is a property to check rather than to remember. Create `src/browser-api.dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AttemptResult, SpeedOutcome } from '@/lib/dto';

/**
 * `reviveDates` is gone, so a `Date` in any of these would arrive as a string
 * and every caller would be quietly wrong. Both shapes are numbers and booleans
 * today - this fails the build the moment one is not.
 */
type NoDates<T> = T extends Date
  ? never
  : T extends object
    ? { [K in keyof T]: NoDates<T[K]> }
    : T;

type Checked<T> = NoDates<T> extends never ? never : T;

// A compile error here is the test failing.
type _Attempt = Checked<AttemptResult>;
type _Speed = Checked<SpeedOutcome>;

describe('browser-api response shapes', () => {
  it('carries no Date, because nothing revives one any more', () => {
    const attempt: _Attempt = { streak: 1, streakAdvanced: true };
    const speed: _Speed = { previousBest: null, best: 3, isRecord: true, standing: null };
    expect(attempt.streak).toBe(1);
    expect(speed.best).toBe(3);
  });
});
```

- [ ] **Step 10: Repoint `browser-api.ts` at this app**

Three changes and nothing else:

```ts
// Same origin now, so there is no base at all and no NEXT_PUBLIC_ variable to
// get wrong. The six writes are route handlers in this app.
const BASE = '/api/v1';
```

Remove the `reviveDates` import and return `await response.json()` directly. Remove `credentials: 'include'` - same-origin is the default and the cookie is sent regardless.

**Keep `uuid()` and its fallback.** Safari only grew `crypto.randomUUID` in 15.4 and the target device is an iPad that may be older; calling it where it does not exist throws inside a `.then` on the play screen and costs the sitting silently, because the whole path is fire-and-forget.

Delete the doc-comment paragraphs about CORS, the API's hostname and the cookie `Domain`. Keep the paragraph about why these are not server actions - that is the reason the file exists.

- [ ] **Step 11: Verify green**

```bash
npm run typecheck && npm test
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Serve the six play-path writes from this app

Route handlers rather than server actions, because Next serialises
server-action requests from one client and the queue that makes is invisible to
every server log (#17). Same origin, so CORS, the preflight maxAge and the
cookie Domain all go - and with the Domain, the stale duplicate cookie that
widening it caused.

reviveDates goes, but the reason needed checking rather than asserting:
browser-api still parses JSON over HTTP, and it is only safe because neither
response shape carries a Date. A type-level test fails the build if one ever
does. ISO_TIMESTAMP moves to day.ts, its only consumer, and parsePlayedAt goes
with the offline queue it was written for."
```

---

### Task 5: Reads go in-process

Eleven files stop going over the wire. The composition the route files did is real logic and moves with them.

**Files:**
- Create: `src/server/reports.ts` (from `apps/api/src/routes/reports.ts:40-174`)
- Create: `src/server/play-state.ts` (from `apps/api/src/routes/play.ts:28-103`)
- Modify: the eleven files listed below
- Delete: `src/api.ts`, `src/api.test.ts`
- Move: `apps/api/test/routes/{reports,play-state,viewable,children,shares,speed}.test.ts` → `src/server/*.test.ts`

**Interfaces:**
- Consumes: everything from Task 2, plus `requireParent` from Task 3.
- Produces:
  - `readChildRecord(parentId, childId, options): Promise<ChildRecord | null>` - the report screen's whole read
  - `readPlayState(userId, subject, level, recentTopics): Promise<PlayState>` - what `/play/state` served, five reads collapsed into one screen-shaped answer

- [ ] **Step 1: Move the composition out of the route files**

`apps/api/src/routes/reports.ts` is not only routing: it resolves the child against `readViewableChildren`, then runs `readObservations`, `readAnsweredQuestions`, `readSittings`, `readRecentAnswers` and `readSpeedSummaries` in a `Promise.all`. That belongs in `src/server/reports.ts`.

`apps/api/src/routes/play.ts:74-103` does the same for `/play/state` - `readLearnerProfile`, `readRecentTopics`, `readPlayerState` in parallel, then `readRecentAnswers` behind the target check. That belongs in `src/server/play-state.ts`.

**Keep the parallelism.** These were written as `Promise.all` deliberately: asked a function at a time they are a waterfall in front of the first question (`080d996`). In-process they are cheaper but they are still round trips to Neon.

**Keep the authorization.** `readViewableChildren` is what every parent screen resolves `?child=` against - own children first, then shared - so a child not in it is not reachable by typing its id. There is no separate ownership check to drift, and there must not be one.

- [ ] **Step 2: Rewrite the eleven call sites**

Each import of `@/api` becomes a direct call. The mapping is one-to-one:

| `src/api.ts` method | becomes |
| --- | --- |
| `api.me()` | `readAccount(userId)` |
| `api.claimParent()` | `claimParentRole(userId)` |
| `api.player()` | `readPlayerState(userId)` |
| `api.playState(subject, level, n)` | `readPlayState(userId, subject, level, n)` |
| `api.writeLevel(level)` | `writeSelectedLevel(userId, level)` |
| `api.listChildren()` | `listChildren(parentId)` |
| `api.viewableChildren()` | `readViewableChildren(userId)` |
| `api.createChild(body)` | `createChild(parentId, body)` |
| `api.updateChild(id, body)` | `updateChild(parentId, id, body)` |
| `api.removeChild(id)` | `removeChild(parentId, id)` |
| `api.issueLoginCode(id)` | `issueLoginCode(parentId, id)` |
| `api.redeem(code)` | `redeemLoginCode(code)` |
| `api.childRecord(id, opts)` | `readChildRecord(parentId, id, opts)` |
| `api.childAnswers(id, subject, n)` | `readAnsweredQuestions(id, subject, n)` |
| `api.shares()` | `listPendingInvites` + `listSharedViewers` |

The files:

```
src/app/page.tsx                    src/app/(parent)/parent.ts
src/app/play/page.tsx               src/app/(parent)/progress/page.tsx
src/app/viewer.ts                   src/app/(parent)/progress/lab/page.tsx
src/app/actions.ts                  src/app/(parent)/children/page.tsx
src/app/speed/actions.ts            src/app/share/[token]/page.tsx
src/components/speed-scores.tsx
```

**The null convention does not change.** `src/api.ts` turned a 503, a 4xx and a dead connection all into `null`; a data function returns `null` on a failed read for the same reason. `readObservations` returning `[]` renders as "your child has never practised", and that must not be what a hiccup looks like.

**`viewerKind` stays exactly as it is** (`src/lib/viewer.ts`). Neon is still a network hop, so a read can still fail while the app renders perfectly well, and a null account still means *signed out* or *the read failed* rather than "not a parent". The four answers and the three screens that branch on them are unchanged.

**Keep the Suspense boundary in `SpeedScores`.** The tabs are built from the URL alone and only the wall needs the read, so the header, the goal, the subject cards and the tabs still flush while the records are in flight. The fallback stays sized to the cards it replaces rather than becoming a spinner - a child reaching for a card that then moves under their finger is worse than a card that arrives a moment late.

- [ ] **Step 3: Delete the client**

```bash
git rm src/api.ts src/api.test.ts
```

- [ ] **Step 4: Verify no caller is left**

```bash
git grep -l "from '@/api'" src || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Verify green**

```bash
npm run typecheck && npm test
```

Expected: PASS.

- [ ] **Step 6: Run the app and click through every screen**

```bash
npm run dev
```

Check, signed in as a parent and as a child: `/`, `/play`, `/progress`, `/children`, `/curriculum`, `/speed`, `/speed/multiply.7`, `/signin`. A child answering a question must record it; a parent's report must draw its charts and its stored figures.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Read through the data layer in process, not over the wire

Eleven call sites stop making an HTTP request to render a page. The composition
the route files did - the report's six reads, /play/state's five - is real logic
and moves to src/server rather than being inlined into the pages.

The Promise.all stays: these were parallel deliberately, because asked a
function at a time they are a waterfall in front of the first question a child
sees. In process they are cheaper, but they are still round trips to Neon.

readViewableChildren stays the only ownership check, so there is nothing to
drift from it."
```

---

### Task 6: Drop the content packs

**Files:**
- Modify: `src/content/catalog.ts`, `src/lib/dto.ts`, `package.json`
- Delete: `src/content/packs/` (14 JSON files + `manifest.json` + `index.ts`), `scripts/build-content.ts`, `scripts/content-packs.ts`, `scripts/content-packs.test.ts`

**Interfaces:**
- Consumes: `mathsTemplates` from `src/content/maths`, `englishTemplates` from `src/content/english`. Both already exist and are exported.
- Produces: `allTemplates: QuestionTemplate[]`, unchanged in order and contents.

- [ ] **Step 1: Compose the templates directly**

In `src/content/catalog.ts`, replace `import { PACKS } from './packs';` and the `allTemplates` line:

```ts
import { mathsTemplates } from './maths';
import { englishTemplates } from './english';

/**
 * Every shipped template, maths K-6 then English K-6 - the order `allTemplates`
 * has always had.
 *
 * This read the generated packs in `./packs` while the API served them to a
 * client that could not import TypeScript. There is no such client, so a pack
 * is a second copy of the content whose only remaining job was to be kept in
 * step with the first - and `scripts/content-packs.test.ts` existed to redden
 * when it was not. One copy cannot drift.
 */
export const allTemplates: QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];
```

- [ ] **Step 2: Delete the packs and the generator**

```bash
git rm -r src/content/packs
git rm scripts/build-content.ts scripts/content-packs.ts scripts/content-packs.test.ts
```

Remove `"content:build"` from `package.json`'s scripts.

- [ ] **Step 3: Remove the pack shapes from `dto.ts`**

Delete `ContentPack`, `ContentManifestLevel`, `ContentManifestSubject` and `ContentManifest` from `src/lib/dto.ts`. **Leave everything else** - nine web-app files and all four data modules import the rest.

- [ ] **Step 4: Verify the content is unchanged**

```bash
npx tsx -e "
import { allTemplates } from './src/content/catalog.ts';
const maths = allTemplates.filter(t => t.subject === 'maths').length;
const english = allTemplates.filter(t => t.subject === 'english').length;
console.log({ total: allTemplates.length, maths, english });
"
```

Expected: `{ total: 553, maths: 398, english: 155 }`.

- [ ] **Step 5: Run the content suite**

```bash
npm run test:unit -- src/content
```

Expected: PASS. `catalog.test.ts` validates all 553, draws each fifty times against `MAX_PROMPT_CHARS`, checks the id shape and the curriculum citations, and proves every figure template never draws one answer the same way twice. Both `leaks.test.ts` files pass untouched.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Read the content from the TypeScript that authors it

The packs existed so a client that could not import TypeScript could fetch the
content, served by two /content routes that died with the API. With no such
client a pack is a second copy whose only job is to be kept in step with the
first, which is what the drift test was for. One copy cannot drift.

None of the validation moves: catalog.test.ts runs over allTemplates whatever
composes it, and both leaks.test.ts files are untouched. 553 templates, 398
maths and 155 English, in the order allTemplates has always had.

Also removes the cast in packs/index.ts - JSON widened level to string and a
figure's kind with it, and the literals do not."
```

---

### Task 7: Delete the API, the package, the fixtures and the instrumentation

**Files:**
- Delete: `apps/`, `packages/`, `fly.toml`, `fixtures/`, `src/timing.ts`, `src/timing.test.ts`, `src/app/api/timing/`, `scripts/changed-apps.ts`, `scripts/changed-apps.test.ts`, `scripts/build-fixtures.ts`, `scripts/emit-fixtures.ts`, `scripts/fixtures/`
- Move: `scripts/fixtures/expr-traps.ts` → `src/lib/expr/traps.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing. This task only removes.
- Produces: nothing.

- [ ] **Step 1: Rescue the expression traps first**

`scripts/fixtures/expr-traps.ts` is the one fixture set that **asserts rather than records**. Seventy expressions whose values a human wrote down - `round(-2.5)` is `-2`, `-2 ^ 2` is `-4`, `1 && 2` is `true`, `mod(-7, 3)` is `2` where `-7 % 3` is `-1`, `"a" + 1 + 2` is `"a12"` where `1 + 2 + "a"` is `"3a"`. Everywhere else the engine is the oracle and a fixture proves agreement; here a bug would have been recorded as correct.

Harvesting cannot reach these: the shipped templates use `^` not once and never use `ceil`, `trunc`, `sign`, `sqrt` or `isInt`.

Fold the table and its assertions into a plain unit test at `src/lib/expr/traps.test.ts`, importing `evaluate` from `@/lib/expr`. Keep the doc comment about why it exists.

- [ ] **Step 2: Verify the traps still pass**

```bash
npm run test:unit -- src/lib/expr
```

Expected: PASS, all seventy.

- [ ] **Step 3: Delete everything else**

```bash
git rm -r apps packages fixtures scripts/fixtures
git rm fly.toml scripts/changed-apps.ts scripts/changed-apps.test.ts
git rm scripts/build-fixtures.ts scripts/emit-fixtures.ts
git rm src/timing.ts src/timing.test.ts
git rm -r src/app/api/timing
```

- [ ] **Step 4: Drop the workspace and the dead scripts**

In `package.json`, remove the `"workspaces"` block entirely and the `fixtures:build` / `fixtures:emit` scripts. Remove `@learnr/core` from any dependency list.

- [ ] **Step 5: Reinstall from a clean slate**

```bash
rm -rf node_modules package-lock.json
npm install
```

Reinstalling rather than pruning is deliberate: the workspace linked `@learnr/core` into `node_modules` as a symlink, and a stale one resolves imports that should now fail.

- [ ] **Step 6: Verify nothing references the deleted world**

```bash
git grep -l "@learnr/core\|apps/api\|fly\.toml\|@/lib/revive\|LEARNR_API_URL" -- . ':!docs' || echo "clean"
```

Expected: `clean`.

- [ ] **Step 7: Verify green**

```bash
npm run typecheck && npm test && npm run build
```

Expected: PASS, PASS, and a successful production build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Delete the API, the package, the corpus and the instrumentation

packages/core takes five constraints with it, all of which existed only because
the engine lived inside the web app and was published through a symlink: no @/
imports in the engine, no relative import escaping src/, the Docker context
having to be the repository root, tsc walking every engine file twice, and Node
refusing an exports target outside the package directory.

The golden corpus held a Swift port against a TypeScript oracle. With one engine
there is no second implementation to disagree, and catalog.test.ts already draws
every one of the 553 templates fifty times. expr-traps is the exception and is
kept as a unit test: it asserts rather than records, so a bug there would have
been reproduced rather than caught, and harvesting cannot reach it - the shipped
templates use ^ not once.

The timing instrumentation went in to find the Vercel-to-Fly floor. That hop
dies with Fly (#20)."
```

---

### Task 8: One deployment target again

**Files:**
- Modify: `vercel.json`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: a workflow with one job.

- [ ] **Step 1: Let Vercel build on a push again**

`vercel.json` turned git deploys off so an ungated Vercel build could not race the tests. There is nothing left to order:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": true
  }
}
```

**Preview deployments come back with this**, which were the price of the gate.

- [ ] **Step 2: Cut the workflow down to one job**

`.github/workflows/deploy.yml` is 195 lines across an API job, a web job, the `changed-apps` job that decided which to run, and the `if:` spelling out that a skipped dependency counts as met. Replace it with a single job that installs, typechecks, tests and deploys.

**The gate stays, but it is guarding something else now.** It used to exist because the packs were generated and the drift test was the only thing between an edited year file and a stale shipped pack. With the packs gone that hazard goes - but `catalog.test.ts` is what proves 553 templates still validate, still fit the prompt cap and still never anchor a figure to an answer, and `next build` does not run it.

**The test job needs Docker** for the `db` project. GitHub-hosted Ubuntu runners have it. If a run gets slow, `npm run test:unit` is separable - but do not split the gate on speed alone, because the data tests cover the three concurrency guards and those are the parts most worth proving.

Remove `FLY_API_TOKEN` from the repository secrets afterwards. `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are no longer needed either once git deploys are on, though leaving them costs nothing.

- [ ] **Step 3: Verify the workflow parses**

```bash
gh workflow view deploy.yml 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Deploy from one target again, and let previews back

vercel.json turned git deploys off so an ungated Vercel build could not race the
tests while fly deploy waited behind them. There is one artifact now and nothing
to order, so git deploys go back on - and preview deployments come back with
them, which were the price of that gate.

The workflow loses the API job, the Fly step, the dependency if: that spelled
out how Actions reads a skipped dependency, and changed-apps.ts, which existed
to answer which of two halves a push had to move."
```

---

### Task 9: Write down what the app is now

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Delete: `docs/superpowers/notes/2026-08-26-api-extraction-handoff.md`, `.claude/skills/ledger/`

**Interfaces:**
- Consumes: nothing.
- Produces: documentation matching the tree.

- [ ] **Step 1: Rewrite CLAUDE.md's structural sections**

Delete outright: **Where everything lives**'s workspace layout, the three symlink consequences, the API's build and bundle notes, `npm run smoke`, the whole **The iOS app** section, **The golden corpus**, the ledger, the deploy-ordering rules, the `viewerKind` paragraph's framing as an API-unreachable problem (keep the four answers - the reason is now Neon, not the API), the CORS and cookie-`Domain` reasoning, and `reviveDates`.

Rewrite: **Commands** (one set), **Setup** (no `LEARNR_API_URL`, no `apps/api/.env`), **Architecture**'s layout, and the note that the content packs are what ships.

**Keep every rule.** The anchoring rules and both opt-out flags, the answer-type rules, the two syllabus families and the four checks, the NESA copyright rule, the figure kinds and their limits, the session and selection rules, the rewards, the daily target, the speed run, accounts, sharing, narration, the logo notes, and the UI rules. None of them changed.

- [ ] **Step 2: Add a short section recording what the collapse cost and kept**

So the next reader does not re-derive it. Point at the spec and at issues #16-#21.

- [ ] **Step 3: Rewrite the README**

It describes a two-application workspace. One Next.js app, `npm install`, `npm run dev`, `npm test`.

- [ ] **Step 4: Update the working agreements**

Remove "Read the ledger at the start of a session" and the ledger commands. `~/code/learnr-ledger/` is outside this repository - leave the directory alone, but nothing here should reference it.

- [ ] **Step 5: Verify green and commit**

```bash
npm run typecheck && npm test && npm run build
```

```bash
git add -A
git commit -m "Say what the app is, now that it is one application again

Removes the workspace layout, the three symlink consequences, the API's bundle
and smoke notes, the iOS section, the golden corpus, the ledger, the deploy
ordering and the CORS and cookie-Domain reasoning - all of which described a
shape that no longer exists.

Every rule stays. The anchoring rules, the answer types, the two syllabuses and
the four checks, the figure kinds, the selection rules, the rewards, the target,
the speed run, sharing and narration are what they were, because none of them
changed."
```

---

## Self-Review

**Spec coverage.** Every section of the design maps to a task: the data layer → 2, the schema → 1, the eleven call sites → 5, the six route handlers → 4, deployment → 8, the content packs → 6, the deletions → 7, the test split → 2, the validation decision → 4 step 1, documentation → 9. The three spec corrections (`dto.ts` stays, `revive.ts` goes with a type test, `parsePlayedAt` goes) are Task 4 steps 8-10 and Task 6 step 3.

**Type consistency.** `resolveUserId`/`userIdFrom`/`requireUser`/`requireParent` are defined in Task 3 and used with those exact names in Tasks 4 and 5. `readChildRecord` and `readPlayState` are declared in Task 5's Interfaces and used in its own mapping table. `allTemplates` keeps its type and order across Task 6.

**Ordering.** 1 → 2 → 3 → 4 and 5 (both depend on 2 and 3, independent of each other) → 6 (independent, could run any time after 1) → 7 (must be last of the code tasks) → 8 → 9.

**One known risk, and it is in Task 5.** It touches eleven files at once and there is no way to split it that leaves the app green in between - a page either calls `src/api.ts` or calls `src/server/*`, and `src/api.ts` cannot be half-deleted. Step 6 is a manual click-through for that reason: the unit tests do not render pages, and vitest here is node-only so there are no component tests to catch a broken screen.
