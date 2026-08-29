# Collapsing the API back into the web app

**Status:** designed, not yet implemented.
**Supersedes:** `2026-08-26-ios-port-design.md` (steps 1, 4 and 5), and the API half
of `2026-08-26-content-extraction-design.md` and `2026-08-26-fixture-generation-design.md`.

LearnR becomes one Next.js application on Vercel again. The Fastify API, the Fly
deployment, the `@learnr/core` package, the OpenAPI contract, the golden corpus
and the iOS client all go. Nothing about the content, the engine, the rules, the
rewards, the parent screens or the UI changes.

## Why this, and why not a revert

The ask was to go back to before the split. The last pre-split commit is
**`671f719`**, "Make a Google sign-in only ever a parent" - the commit
immediately before `f3d5263`, which designed the split. It is a clean cut: 294
files, no `apps/`, no `packages/`, and `src/lib/{db,records,accounts,sharing,
speed-records}.ts` still in place.

**Reverting there is the wrong mechanism, and the history says so plainly.**
There are 132 commits between it and `master`:

| | commits |
| --- | --- |
| Touch only API paths (`apps/`, `packages/`, `fly.toml`, `src/api.ts`, `src/browser-api.ts`) | **12** |
| Touch nothing API-related at all | **98** |
| Interleaved - both | **22** |

So a revert discards 120 commits that are not the split, and they are not
separable by inspection: the NSW strand pass that brought maths to 39.7 / 40.2 /
20.1, the eleven option-set leaks closed by measurement, `MAX_PROMPT_CHARS`
coming from 140 to 105, the `timeline` figure kind, the keyboard route to the
figure zoom, the repaired `logo-mark.png`, and the App Store icon cut from the
master.

**The decisive argument is smaller than any of those.** `src/browser-api.ts`
already posts the six play-path writes with `fetch` rather than through a server
action - which is the single most valuable thing the split turned up. Reverting
would put the seven server actions back and then require rebuilding it by hand.

So the work goes **forward**: delete the API and absorb what it holds. The
destination is identical and every finding is kept rather than reimplemented.

## The destination

One Next.js application at the repository root, deployed to Vercel, reading and
writing Neon directly.

```
src/app/            routes, and api/ route handlers for the six writes
src/lib/            the pure engine - no React, no network, no clock, no database
src/server/         the impure half: db, records, accounts, sharing, speed-records
src/content/        maths and english, as they are
src/components/     UI, unchanged
prisma/             the full schema and its sixteen migrations
```

**`src/lib` stays exactly the pure engine, and this is the one improvement the
collapse keeps rather than undoes.** At `671f719` the five Prisma modules lived
*inside* `src/lib`, in the directory whose rule is that everything in it is pure.
The split is what made that rule honest by moving them out. They come back to
`src/server/` rather than to where they were, so the rule stays true without
exception.

`packages/core/test/exports.test.ts` is deleted with the package, but **its job
is not.** It walked `src/lib` and `src/content` and failed on any `@/` import,
with no exemption list. The alias is legal again, so the import rule goes - but
the purity rule it stood beside does not. It is replaced by a test under
`src/lib/` asserting that nothing in `src/lib` or `src/content` imports React,
`next`, `@prisma/client`, or `src/server`.

**Reads become in-process function calls.** A page render calls
`src/server/records.ts` directly. There is no HTTP on a read at all, which is
better than the current stack *and* better than `671f719`, where a read was at
least a Prisma round trip from whichever serverless instance answered.

## The move, in five parts

### 1. The data layer comes back

`apps/api/src/data/` moves to `src/server/`, unchanged - 2,005 lines across four
files:

| from | to | lines |
| --- | --- | --- |
| `apps/api/src/data/accounts.ts` | `src/server/accounts.ts` | 327 |
| `apps/api/src/data/records.ts` | `src/server/records.ts` | 815 |
| `apps/api/src/data/sharing.ts` | `src/server/sharing.ts` | 422 |
| `apps/api/src/data/speed-records.ts` | `src/server/speed-records.ts` | 441 |

`apps/api/src/db.ts` becomes `src/server/db.ts` and replaces `src/auth-db.ts`.

**The route files are not only routing.** `apps/api/src/routes/reports.ts`
composes the child's report from several reads, and `/play/state` collapses five
reads into one screen-shaped answer. That composition is real logic and moves
into `src/server/` beside the data modules rather than being inlined into the
pages that used to call it over the wire.

### 2. The schema comes back whole

`apps/api/prisma/` moves to `prisma/`: the full schema, twelve models, and all
sixteen migrations. It replaces `prisma/auth.prisma`.

**`prisma/auth.prisma` is deleted, along with the rule that it may only ever
shrink.** It existed because `PrismaAdapter` needs a live client in-process and
the web app no longer owned the schema. It owns the schema again, so the adapter
reads the same models as everything else.

`prisma.config.ts` regains a `migrations` path. `scripts/migrate.mjs` keeps its
P1002 retry: Neon accepts a connection while its compute is still coming out of
autosuspend, then the migration advisory lock times out against a fixed 10s
Prisma gives no way to raise. Two production builds died that way before the
retry existed.

### 3. Eleven call sites stop going over the wire

These import `@/api` and call `src/server/*` instead:

```
src/app/page.tsx                        src/app/(parent)/parent.ts
src/app/play/page.tsx                   src/app/(parent)/progress/page.tsx
src/app/viewer.ts                       src/app/(parent)/progress/lab/page.tsx
src/app/actions.ts                      src/app/(parent)/children/page.tsx
src/app/speed/actions.ts                src/app/share/[token]/page.tsx
src/components/speed-scores.tsx
```

**`reviveDates` goes with them.** Dates crossed as ISO strings because there was
a wire boundary; a Prisma read returns a `Date`. `src/lib/revive.ts` and
`src/lib/dto.ts` are deleted - the DTO shapes existed to be shared with a client
that could not import TypeScript, and there is no such client.

**`viewerKind` stays** (`src/lib/viewer.ts`). It is the one thing born of the
split that is still true without it: Neon is a network hop, so a read can fail
while the app renders perfectly well, and a null account still means *signed
out* or *the read failed* rather than "not a parent". The four answers, and the
three screens that branch on them, are unchanged.

**The null convention stays**, for the same reason. `null` means could not read;
`[]` means nothing there. `readObservations` returning `[]` renders as "your
child has never practised", and that must not be what a hiccup looks like.

### 4. Six writes become route handlers

The play path stays off server actions. `src/browser-api.ts` keeps its shape and
its `BASE` points at this app:

| endpoint | what it does |
| --- | --- |
| `POST /api/v1/sessions` | open a sitting |
| `POST /api/v1/sessions/:id/attempts` | record answers |
| `POST /api/v1/sessions/:id/award-round` | bank a round's stars |
| `POST /api/v1/sessions/:id/award-target` | bank the day's goal |
| `POST /api/v1/sessions/:id/end` | close the sitting |
| `POST /api/v1/speed/runs` | submit a speed run |

**Route handlers rather than server actions, because Next serialises
server-action requests from one client.** The calls a single answer makes queued
behind each other while every one of them reported a healthy server-side
duration - a wait that existed only in the browser and appeared in no log. That
was true in the monolith all along and was invisible only because each call was
fast. See #17.

**Each handler resolves the session once and gates there.** It does not open
with `auth()` and then check again; that double lookup is #18, measured at 717ms
on a cold Prisma client against about 5ms warm, and paid up to twice per answer.
One service means one lookup is both necessary and sufficient.

**`worthBanking` stays** (#19). The day's goal is banked from the answer that
crosses the line onwards, not after every answer. The repair survives - a failed
call is retried by the next answer, and the compare-and-set on `User.targetDay`
still means only one can pay out - and nineteen writes per twenty-question
target do not.

**`uuid()` keeps its fallback.** Safari only grew `crypto.randomUUID` in 15.4 and
the target device is an iPad that may be older. Calling it where it does not
exist throws inside a `.then` on the play screen and costs the sitting silently,
because the whole recording path is fire-and-forget.

**Same origin retires three things at once.** CORS and `LEARNR_WEB_ORIGINS` go;
the preflight `maxAge` reasoning goes with them; and the session cookie no longer
needs a `Domain`, which retires the stale-duplicate-cookie bug that widening it
caused (`ba5453f`, `ac2c6ab`) - a browser holding two
`__Secure-authjs.session-token` cookies, the host-only one masking the live one.

`auth.ts` still pins `SESSION_COOKIE_NAME` and `SESSION_COOKIE_OPTIONS`
explicitly. Login-code redemption writes the same `Session` row the adapter
would and sets the same cookie, so `auth()` cannot tell the two paths apart, and
that only works while both agree on the cookie.

### 5. Deployment goes back to one target

`vercel.json` sets `git.deploymentEnabled: false`. It becomes `true`, and
**preview deployments come back with it** - they were the price of gating an
ungated Vercel build behind the tests, and there is nothing left to order.

`.github/workflows/deploy.yml` loses the API job, the Fly step and its
dependency `if:`. `scripts/changed-apps.ts` is deleted with them: it existed to
answer which of two halves a push had to move.

**The gate stays.** The content packs are generated and the drift test is the
only thing between an edited year file and a stale shipped pack, which neither
`next build` nor Vercel runs. That test has to run before a deploy, whatever
runs it.

## What is deleted

```
apps/                          8.6 MB   the API, its tests, its Dockerfile, its bundle script
packages/                       20 KB   @learnr/core and its committed symlink
fixtures/                      136 KB   the golden corpus digests
apps/api/contract/openapi.yaml          the contract, and the 35 route schemas behind it
fly.toml                                the Fly deployment
src/api.ts, src/api.test.ts             the typed client
src/lib/revive.ts, src/lib/dto.ts       the wire boundary
src/timing.ts, src/app/api/timing       the hop instrumentation
prisma/auth.prisma                      the Auth.js subset schema
scripts/changed-apps.ts                 which halves a push moves
~/code/learnr-ledger/                   the cross-repo handover
```

**`packages/core`'s deletion takes five constraints with it**, all of which
existed only because the engine lived inside the web app and was published
through a symlink: no `@/` imports in the engine, no relative import escaping
`src/`, the Docker context having to be the repository root, `tsc` walking every
engine file twice, and Node refusing an `exports` target outside the package
directory. The `@/` alias works everywhere in the engine again.

**The golden corpus goes, by decision.** Its job was to hold a Swift port
against a TypeScript oracle. With one engine there is no second implementation
to disagree, and `src/content/catalog.test.ts` already draws every one of the
553 shipped templates fifty times, validates it, and proves a figure template
never draws one answer the same way twice. `scripts/fixtures/expr-traps.ts` is
the one part that asserted rather than recorded - seventy expressions whose
values a human wrote down, where the engine is not the oracle. **Keep that
file**, as a plain unit test under `src/lib/expr/`.

**The timing instrumentation goes, by decision** (#20, closed). It was built to
diagnose the ~530ms Vercel-to-Fly floor, and that hop dies with Fly. The lesson
it leaves is that a server log cannot see a queue in the browser, and the device
this is felt on is an iPad with no console to open - so if the play path ever
feels slow again, the instrumentation to reach for is browser-side.

## What does not change

Nothing in `src/lib` but the deletion of two files. Nothing in `src/content` -
553 templates, 398 maths and 155 English, at the same ids, the same tags and the
same generated packs. Nothing in `src/components`. No screen, no rule, no
threshold, no mode, no reward, no report.

Specifically unchanged: the twelve figure kinds and the anchoring rule; the
option-set anchoring checks and both opt-out flags; `MAX_PROMPT_CHARS` at 105
and the sentinel the fitter measures; `MIN_OBSERVATIONS` 4, `SECURE_OBSERVATIONS`
8, `SECURE_DAYS` 2 and the rest of `skillStatus`; `weightTemplates` and the focus
shares; `ROUND_SIZE` 10 and `TARGET_STARS` 10; the twenty-six speed run modes and
`SINGLE_TABLES` without its ten; the four curriculum documents and the four rules
enforced over every template; the palette, and every layout rule the play screen
depends on.

Both reduced-motion fixes stay exactly as written: the prompt fitter measures
with `transition: none` and restores the declaration afterwards, and the speed
run's timer writes its transition `!important` inline. Neither is visible without
the setting on, and both were found by a screenshot tool rather than by a person.

`ChildPhoto` stays its own table. The Auth.js adapter selects whole `User` rows
on every authenticated request, and a photo has no business riding along with a
session lookup.

## Verification

The collapse is done when all of these hold:

1. `npm test` and `npm run typecheck` pass, with the API's own suite absorbed -
   the data-layer tests move to `src/server/` and keep running against a real
   Postgres in Testcontainers. The three concurrency guards are the parts most
   worth proving and mean nothing against a mock: `SELECT ... FOR UPDATE` on
   `TopicSkill` and on `roundsBanked`, and the compare-and-set on `targetDay`.
2. `git grep -l "@learnr/core\|@/lib/revive\|@/lib/dto"` returns nothing, and
   `git grep -l "from '@/api'"` returns nothing. `browser-api` still has its
   three callers - `play-session.tsx`, `speed-run.tsx` and `speed/actions.ts` -
   and that is correct; only its `BASE` changes.
3. A child can play a full sitting signed out, with no database configured, and
   the screen never blocks - `isAuthConfigured` and `isDatabaseConfigured` still
   hold.
4. The play path makes **one** session lookup per write and no `auth()` call of
   its own.
5. `?level=` mismatched against a managed child's `selectedLevel` still
   redirects.
6. A push to `master` produces one deployment, and a pull request produces a
   preview.

## Deliberately not in scope

**Batching recorded attempts** (#21). It is the right change eventually, but the
streak flash and the round's stars read the response, so it changes what the
child sees. Every number that would justify it was taken across a 255ms hop that
no longer exists, so it needs measuring again before it needs deciding.

**Removing English.** It ships, it is tested, and the subject abstraction is only
proven by having two subjects in it. `subject` stays a field on the template and
a column on `LearningSession`, `Attempt` and `TopicSkill`, so this stays a
content decision rather than a structural one.

**The remaining read waterfall** (#16). `auth()` and the account read are
genuinely dependent. Three of the four round trips that issue names stop being
round trips once they are in-process, so re-measure before parallelising
anything.

## Open questions

- **`GET /content/manifest` and `GET /content/:subject/:level` served the packs
  to a client that could not import TypeScript.** With no such client, the packs
  could be dropped and `catalog.ts` could read the year files directly - which
  would delete `npm run content:build`, `scripts/content-packs.test.ts` and the
  "edited a year file, shipped a stale pack" failure mode. Deferred: it is a
  content-pipeline change and does not belong inside a structural refactor.
- **Where the API's 35 route schemas' validation goes.** The six write handlers
  need input validation; zod is already a dependency of the API and not of the
  web app. Either it becomes a web-app dependency or the boundary normalisers in
  `src/lib` (`parseYearLevel`, `parseTarget`, `parsePhoto`, `parseFigure`,
  `parseMode`, `parseOffsetMinutes`) do the whole job. They already do most of it.
