# The API extraction: where it got to

**Updated:** 2026-08-26, after the move into this repo and the first Fly deploy.
Supersedes the two-repo handoff written before either happened.

## What exists now

The API server is finished, tested and deployed. It has no callers yet - the web
app still talks to Prisma directly, which is what Task 11 changes.

| | Where | State |
| --- | --- | --- |
| API source | `apps/api` (this repo) | 103 tests, typecheck clean |
| Shared engine | `packages/core` -> symlink to `src` | `@learnr/core/*` |
| Contract | `apps/api/contract/openapi.yaml` | generated, 28 paths |
| API deploy | `learnr-api-syd.fly.dev`, Fly, `syd` | one machine, always on |
| Web deploy | `learnr.muzza.tech`, Vercel, `syd1` | unchanged |

Tasks 1-10 and 11a are done. Tasks 11 and 12 remain.

```bash
npm install                        # from the repository root
npm test --workspace apps/api      # Docker must be running
npm run typecheck --workspace apps/api
fly deploy --ha=false              # from the repository root
```

## There is no learnr-api repo any more

It was folded in with `git subtree`, so all twenty of its commits are in this
repo's history. `file:../learnr/packages/core` pointed outside the repository,
which no single-repo build can resolve - it is what broke the first Vercel deploy
and would equally have broken Fly.

**The Docker build context is the repository root, not `apps/api`**, because
`packages/core/src` is a symlink to this repo's `src/`. A context of `apps/api`
alone rebuilds exactly the dangling symlink that started this.

## What is left

**Task 11** points the web app at the API: `src/lib/api.ts`, then every server
action and server-component read, then delete `src/lib/{db,records,accounts,
sharing,speed-records}.ts` and Prisma - keeping one trimmed client for Auth.js,
which needs a live `PrismaClient` in-process and cannot speak REST. `src/auth.ts`
is the only file outside `src/lib` that imports `db.ts`, so that compromise is
one file. Then `LEARNR_API_URL` in `.env.example` and in Vercel.

Measured: **18 files, 28 import sites** - 7 `accounts`, 8 `records`, 6 `sharing`,
6 `speed-records`, 1 `db`.

**Task 12** is mostly done by the Fly deploy. What remains is pointing the web
app's production environment at the API and checking the pair by hand.

## Rulings that still bind

1. **`fastify-type-provider-zod` must be v6+.** Only v6 accepts zod 4.
2. **`packages/core/src` is a committed symlink.** Node rejects an `exports`
   target outside the package directory, so every target starts with `./`.
3. **The engine may not use the `@` alias.** It resolves only inside the web
   app's tooling. A guard test in `packages/core/test/exports.test.ts` walks
   `src/lib` and `src/content`; its exemption list is the five files Task 11
   deletes and should shrink, never grow.
4. **DTOs are declared once**, in `src/lib/dto.ts` (`@learnr/core/dto`), and the
   data modules re-export them. Two declarations drift on the first change.
5. **The test container starts in a vitest `globalSetup`.** The data modules read
   the singleton in `apps/api/src/db.ts`, built from `DATABASE_URL` at import
   time; a per-file `beforeAll` is too late and every function returns null.
   `fileParallelism` is off because the files share one database.
6. **A concurrency test on a cold pool proves nothing.** Prisma opens connections
   lazily, so the first callers queue instead of racing and a guard test passes
   against code whose lock has been deleted. `warmPool()` exists for this. All
   three guards were checked by deleting them and watching the right test go red.
7. **Values off the wire go through the existing parsers** - `parseFigure`,
   `parseAvatar`, `parseTarget`, `parsePhoto`, `parseMode`. An unknown avatar is
   a 400; a malformed figure is dropped rather than costing the answer.
8. **`@fastify/swagger` only sees routes inside registered plugins.** `/health`
   and `/openapi.json` are declared on the root instance and are absent from the
   contract - correct for both, but a new endpoint must live in a plugin.
9. **The build is an esbuild bundle, not `tsc` output.** `@learnr/core` ships
   TypeScript with extensionless relative imports, which tsx and vitest resolve
   and plain `node` does not. `tsc --noEmit` still typechecks.
10. **The web app keeps Prisma for Auth.js alone.** `PrismaAdapter` needs a live
    client in-process.

## Where the plan is wrong

`docs/superpowers/plans/2026-08-26-api-server-extraction.md` predates some of the
code. Check every signature against the source before writing a test around it.

- `chooseRole(userId, role)` does not exist; `learnr#671f719` replaced it with
  `claimParentRole(userId)`.
- Its `awardDailyTarget` test used a target of five questions, below the floor of
  ten `TARGET_LIMITS` enforces, so `parseTarget` refused it.
- Its route code declared only success responses, so every 404/503 failed to
  typecheck.
- Its children routes passed `request.body` straight to `createChild`, which
  wants a different shape.
- **Its endpoint list was the spec's, not the web app's.** Ten functions the web
  app calls had no endpoint; six routes were added to cover them. The sharpest:
  `GET /children` is a parent's *own* children, while every parent screen reads
  `readViewableChildren` - own **plus shared**. `/children/viewable` is separate
  for that reason, and no test would have caught the difference.

## Production notes

`apps/api/.env` holds the **production** Neon URL and is gitignored. Tests are
unaffected - `globalSetup` overrides `DATABASE_URL` before any test module loads,
verified to resolve to `localhost` and never `neon.tech`. But `db:deploy` and
`prisma migrate dev` do read it and will reach production.

Neon warns that `sslmode=require` is deprecated in favour of `verify-full`.
Harmless today; worth fixing when the connection string is next touched.

**Answered:** there are no self-declared children in production
(`role = 'child' AND parentId IS NULL` returns 0), so nothing needs
grandfathering or migrating.
