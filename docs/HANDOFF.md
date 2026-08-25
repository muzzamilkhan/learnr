# Handoff: continuing the API extraction on another machine

**Written:** 2026-08-26
**State:** Task 1 of 13 complete and reviewed. Tasks 2-12 remain.
**Why:** This work needs Docker (Testcontainers). It moves to a machine that has it.
The original laptop keeps only the iOS work, which needs Xcode and cannot start yet.

## What you are picking up

LearnR is a maths and English practice app for children — Next.js, Prisma, Neon
Postgres, deployed on Vercel. It is being split into three repos plus a shared
contract, so a native iOS app can play offline while a single API owns the data.

Read these two documents first, in this order:

1. `docs/superpowers/specs/2026-08-26-ios-port-design.md` — the design and the
   reasoning. The binding authority.
2. `docs/superpowers/plans/2026-08-26-api-server-extraction.md` — the plan you are
   executing. Thirteen tasks; Task 1 is done.

## Repos

| Repo | Where | State |
| --- | --- | --- |
| `muzzamilkhan/learnr-api` | this repo | `main`, 6 commits, Task 1 complete |
| `muzzamilkhan/learnr` | existing, live on Vercel | `master` untouched; Tasks 11a and 11 land on a new branch |
| `learnr-ios` | not created | Nothing to do yet — needs build-order steps 2 and 3 first |

Clone both `learnr-api` and `learnr` side by side, in the same parent directory.
**This matters:** Task 2 symlinks `packages/core/src -> ../../src` inside `learnr`,
and Task 4 installs it into `learnr-api` via `file:../learnr/packages/core`. A
different layout breaks both.

```
~/Projects/
  learnr/        git@github.com:muzzamilkhan/learnr.git
  learnr-api/    git@github.com:muzzamilkhan/learnr-api.git
```

## Prerequisites on the new machine

- **Node 24+** (`node --version`).
- **Docker or Colima, running.** Tasks 3 through 10 need it for Testcontainers
  Postgres. `docker info` must succeed. Colima is the lighter option:
  `brew install colima docker && colima start`.
- **A Neon connection string** is NOT required to run the tests — Testcontainers
  provides its own Postgres. It is only needed for Task 12's deploy.

## Where Task 1 got to

Commit `16be89c`. A Fastify scaffold that boots and answers `/health`:

```
src/env.ts        isDatabaseConfigured, DATABASE_URL, PORT
src/server.ts     buildServer(): FastifyInstance  <- tasks 8, 9, 10 register onto this
src/main.ts       listen
test/server.test.ts
```

Reviewed clean: spec ✅, quality Approved. Strict mode verified by injecting an
implicit `any` and confirming `tsc` rejects it.

Verify it still works before continuing:

```bash
npm install     # must be clean: no peer warnings, no --legacy-peer-deps
npm test        # 1 passed
npm run typecheck
```

## Rulings already made — do not re-litigate these

Four decisions were taken during planning and setup. Each is in the plan; they are
repeated here because they are the ones most likely to look wrong without context.

**1. `fastify-type-provider-zod` must be v6+, not v4.**
v4 and v5 peer-depend on zod 3; only v6 accepts zod 4. v6 also peer-depends on
`@fastify/swagger` and `openapi-types`, so both are already direct dependencies.
If `npm install` ever needs `--legacy-peer-deps`, the versions are wrong — fix the
versions, do not pass the flag.

**2. Task 2 symlinks the engine; it does not copy or move it.**
Node rejects an `exports` target outside the package directory
(`ERR_INVALID_PACKAGE_TARGET`, "targets must start with ./"). This was verified by
experiment. So `packages/core/src` is a symlink to `../../src`, every export target
starts with `./`, and the sources stay where they are. The symlink is committed —
a fresh clone needs it. Verified working end to end: npm workspace link, cross-repo
`file:` install, and Vitest resolving TypeScript source through both symlinks.

**3. Task 8 uses `foldPlayStreak`, not `readStreakOnly`.**
The first draft of the plan called a function that does not exist. The real helper
is `foldPlayStreak(userId, attempt)`, private to `records.ts`, returning
`AttemptResult | null`. It is already idempotent — it guards on
`playStreakDay: { lt: next.lastDay }` — so a replayed attempt writes nothing and
reports `streakAdvanced: false`. The dedupe guard's actual job is skipping
`updateTopicSkill`, which increments `attempts` and is not idempotent.

**4. The web app keeps a Prisma client for Auth.js alone.**
`PrismaAdapter` needs a live client in-process and cannot speak REST. `src/auth.ts`
is the only file outside `src/lib` that imports `db.ts`, so the compromise is one
file. Everything else in the web app goes through the API.

## The three guards that must not break

The whole reason the tests use a real Postgres rather than a mock. None of these
had any test coverage before this plan; Tasks 5 and 6 write their first ones.

1. `updateTopicSkill` — `SELECT ... FOR UPDATE` plus a retry on the insert race.
   Without the lock, ten concurrent answers lose some of their folds.
2. `awardRoundStars` — `SELECT ... FOR UPDATE` on `roundsBanked`. Without it, a
   retried award pays twice.
3. `awardDailyTarget` — compare-and-set in the `where` on `targetDay`. Without it,
   a day's target pays more than once.

A mocked Prisma cannot test any of them. If a future change makes these tests slow
or awkward, fix the test, not the guard.

## How to run the remaining tasks

The plan was being executed with `superpowers:subagent-driven-development`: a fresh
subagent per task, a review after each, a whole-branch review at the end. Continue
that way or execute the tasks by hand — the plan is written to be followed either
way, with the complete code in every step.

If you continue with the skill, the ledger lives at
`.superpowers/sdd/2026-08-26-api-server-extraction/progress.md`. It is git-ignored,
so **it did not travel with the push**. The relevant contents are reproduced here:
Task 1 complete at `d03cd32..16be89c`, review clean, two deferred minors (a
`.superpowers/` line in `.gitignore`, and an interim `--legacy-peer-deps` detour
that no longer exists in the committed state). Start a fresh ledger; Task 2 is next.

### Task order and what needs Docker

| Task | Repo | Docker? |
| --- | --- | --- |
| 2. `@learnr/core` package | learnr | no |
| 3. Schema + Testcontainers | learnr-api | **yes** |
| 4. `accounts.ts` | learnr-api | yes |
| 5. `records.ts` + star guards | learnr-api | yes |
| 6. `sharing.ts`, `speed-records.ts` | learnr-api | yes |
| 7. Auth from the Session table | learnr-api | yes |
| 8. Play and auth routes | learnr-api | yes |
| 9. Parent routes | learnr-api | yes |
| 10. OpenAPI generation | learnr-api | no |
| 11a. Date reviver | learnr | no |
| 11. Point web at the API | learnr | no |
| 12. Deploy | both | no |

Task 2 lands in `learnr` on `master` — it only adds a package boundary and changes
no behaviour. Tasks 11a and 11 must land on a branch (`api-cutover` or similar):
Task 11 deletes Prisma and rewrites every server action in a live app.

## Known open questions

Neither blocks the plan.

- **Existing self-declared children.** Before Task 12, query production for
  `role = 'child' AND parentId IS NULL`. Post-`learnr#3` these can no longer be
  created, but any that already exist need a decision: grandfather or migrate.
- **Content update cadence on iOS.** Not this plan — it belongs to build-order
  step 2. An `ETag` makes any choice cheap.

## What happens after this plan

The spec's build order continues. None of it can start until step 1 is done:

2. **Content extraction** — 505 templates from TypeScript literals to versioned
   JSON. Needed by both engines.
3. **Fixture generation** — the golden corpus, TypeScript engine as oracle. Must
   precede any Swift, or there is nothing to port against.
4. **Swift engine** — bottom-up: rng, expr, generate, figures, session.
5. **iOS app** — UI, sync queue, offline store.

Steps 4 and 5 are the ones staying on the original laptop.
