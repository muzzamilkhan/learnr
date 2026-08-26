# The API extraction: where it got to

**Updated:** 2026-08-26, after the cutover. Supersedes the note written after
the first Fly deploy, which supersedes the two-repo one before that.

## What exists now

The extraction is done. The web app reads and writes through the API for
everything except signing in.

| | Where | State |
| --- | --- | --- |
| API source | `apps/api` (this repo) | 119 tests, typecheck clean |
| Shared engine | `packages/core` -> symlink to `src` | `@learnr/core/*` |
| Contract | `apps/api/contract/openapi.yaml` | generated, 32 paths, fully typed |
| API deploy | `learnr-api-syd.fly.dev`, Fly, `syd` | one machine, always on |
| Web deploy | `learnr.muzza.tech`, Vercel, `syd1` | reads the API |

Tasks 1 - 12 of `docs/superpowers/plans/2026-08-26-api-server-extraction.md` are
done.

```bash
npm install                        # from the repository root
npm test --workspace apps/api      # Docker must be running
npm run typecheck --workspace apps/api
npm run contract --workspace apps/api
fly deploy --ha=false              # from the repository root
```

## Content extraction has landed too

Build-order step 2 - the 505 templates as versioned JSON - is done, ahead of the
fixture generation step the spec puts before it. Fourteen packs
(`src/content/packs/`, one a subject and year, plus a manifest) ship inside the
web app's own bundle and are now also served: `GET /content/manifest` and
`GET /content/:subject/:level` are public, the same way `GET /shares/:token` is,
because content is not personal data. The contract is at **32 paths**.

The compiler is the primary guard here now, not a secondary one. `Mirrored`
compares key sets both ways for a plain object, so a missing field - optional
included - is a compile error. `Mark` and `Mode` go through `Both<>` instead,
which is exact for them only because every field on every arm of both is
required - it cannot see an optional field dropped from one arm. `VarSpec` and
`FigureSpec` carry optional fields per arm (a figure's `rotation`, `mirror`,
`armLength` and the rest), so they go through `CheckEachArm`, which runs that
same key-set comparison once per discriminant - a dropped field names itself
*and* the arm it went missing from. (`CheckEachArm` iterates the DTO's own
discriminants, so an extra schema arm under a `kind` the DTO never takes would
go unnoticed - harmless, since such an arm can never match a real value.)

What the compiler cannot see is a schema that is too *tight*: `integer` where a
real value is `0.67` does not strip, it throws, and the endpoint 500s - the
lesson `serialization.test.ts` exists for, and it still holds. That is the
round-trip tests' job, and each one guards a different seam:
`src/content/packs.test.ts` compares *generated* bytes against *committed*
bytes and never sees a served response, catching drift between the TypeScript
literals and the packs; `apps/api/test/schemas/content.test.ts` round-trips
the templates and the manifest through the schemas; and
`apps/api/test/routes/content.test.ts` is the one comparing a *served* pack
against the committed bytes, which is the one this note's "verify by breaking
the guard" method was run against here too.

## What the cutover actually changed

`src/lib/{db,records,accounts,sharing,speed-records}.ts` are gone, and with them
the web app's copy of the schema, its migrations and `scripts/migrate.mjs`.
Eighteen files and twenty-eight import sites now go through `src/api.ts`.

**Four endpoints had to be added first.** The plan's endpoint list was written
from the spec rather than measured against the web app's call sites, and the gap
only shows when you try to replace them one for one:

- **`GET /children/:id/record`** - the parent's report reads a child's *raw*
  history: observations, sittings, examples per topic, the calendar's window and
  their speed runs. None of it had an endpoint. `/children/:id/report` returns
  the analytics already computed, which is the wrong shape for a screen whose
  every chart folds the observations itself - and `/progress/lab` exists
  precisely to try foldings that are not on the report yet. That endpoint now has
  no caller; it stays as the contract for one.
- **`GET /shares/:token` lost its session.** The share page is public and has to
  be: signing in *is* the acceptance, so gating the page on a session gated it on
  the thing following the link produces. As written, a share link would have
  401'd for exactly the person it was sent to.
- **`GET /speed/records` ranks the household, not the caller.** `householdId` is
  a parent's own id and a child's *parent's*, so passing `userId` ranked a child
  against rows whose `parentId` is the child - nobody. A board of one, silently,
  on every child's screen. `family: null` beside a 200 is now the third state.
- **`GET /me/player`, and `/play/state`'s `level` made optional.** The home
  screen picks the subject and the year, so it has neither to ask about. The play
  screen has to read `selectedLevel` *before* it can judge the year in the URL,
  and that year may be nonsense - refusing it would have 400'd the read that was
  about to correct it.

Three screens got faster rather than slower: `/play` was five reads and is one
call, `/progress` was five and is one, the scores wall was three. `readViewer`
(`src/app/viewer.ts`) is `cache`d, so a screen that asks who is signed in twice
pays once.

## What stayed behind, and why

**Auth.js.** `PrismaAdapter` needs a live `PrismaClient` in-process and cannot
speak REST without a custom adapter written from scratch. `src/auth-db.ts` keeps
one for it alone - nothing else may import it, and if a second caller appears the
fix is an endpoint. It sits beside `src/auth.ts` rather than in `src/lib`, which
is the pure engine.

**`prisma/auth.prisma` is a subset, not a copy.** The four tables the adapter
touches, `generate` only, no `migrations` path in `prisma.config.ts` and no
`db:migrate` script left in the package. Prisma reads only the columns a model
declares, so a `User` of five fields is a smaller session lookup - which is the
same argument that moved `ChildPhoto` to its own table. The file may only ever
shrink towards what the adapter touches.

**`claimParentRole` is written a third time** there, beside the API's and the one
inside `acceptShareInvite`'s transaction. It runs during the OAuth callback,
before the session cookie the API authenticates by exists, so it is the one
caller that cannot go over the wire. Safe to duplicate only because all three are
the same compare-and-set on `role IS NULL`.

## The contract is fully typed

The gap the iOS client was waiting on is closed: sixteen `z.unknown()` responses
are real schemas (`apps/api/src/schemas/dto.ts`), so the Swift models can be
generated rather than transcribed by hand.

Two findings from doing it, both worth keeping:

1. **A response schema is a serializer.** Fastify runs the value through it and a
   zod object strips what it does not declare, so a field left out of a schema
   does not fail loudly - it vanishes from the response and the client parses a
   smaller object perfectly happily.
2. **`satisfies z.ZodType<T>` does not catch that**, which is the trap. An object
   missing an *optional* field is still assignable to one that has it, so
   deleting `figure` from `answeredQuestionSchema` compiled clean - and would
   have emptied every diagram out of a parent's report. Optional fields are
   exactly the ones whose loss is invisible. The check had to be on the **key
   sets**, both ways: `Mirrored`, at the foot of that file.

Both were found by breaking the guard and watching it *not* fire, which is the
only way either would have shown up. The same method proved the rest: deleting
`figure`, `templateId` and `playerAvatar` each now names the field, and
over-tightening `strength` to `.int()` reddens
`test/routes/serialization.test.ts`.

That test file exists because the compiler cannot see a schema that is too
*tight*: `integer` where a ratio is 0.67 throws rather than strips. It needs real
data awkward enough to reach the case - and the first version of it passed
against a wrong schema, because answering all-right or all-wrong makes every
ratio 0 or 1, which *is* an integer.

## Rulings that still bind

1. **`fastify-type-provider-zod` must be v6+.** Only v6 accepts zod 4.
2. **`packages/core/src` is a committed symlink.** Node rejects an `exports`
   target outside the package directory, so every target starts with `./`.
3. **The engine may not use the `@` alias.** The guard test in
   `packages/core/test/exports.test.ts` walks `src/lib` and `src/content`. Its
   exemption list is **gone** - those five files were it. Nothing impure belongs
   in either directory again; `src/api.ts` and `src/auth-db.ts` are outside both.
4. **DTOs are declared once**, in `src/lib/dto.ts` (`@learnr/core/dto`), and the
   data modules re-export them. `AttemptResult` moved there during the cutover
   for that reason.
5. **The test container starts in a vitest `globalSetup`.** The data modules read
   the singleton in `apps/api/src/db.ts`, built from `DATABASE_URL` at import
   time; a per-file `beforeAll` is too late and every function returns null.
   `fileParallelism` is off because the files share one database.
6. **A concurrency test on a cold pool proves nothing.** Prisma opens connections
   lazily, so the first callers queue instead of racing and a guard test passes
   against code whose lock has been deleted. `warmPool()` exists for this.
7. **Values off the wire go through the existing parsers** - `parseFigure`,
   `parseAvatar`, `parseTarget`, `parsePhoto`, `parseMode`. An unknown avatar is
   a 400; a malformed figure is dropped rather than costing the answer.
8. **`@fastify/swagger` only sees routes inside registered plugins.** `/health`
   and `/openapi.json` are declared on the root instance and are absent from the
   contract - correct for both, but a new endpoint must live in a plugin.
9. **The build is an esbuild bundle, not `tsc` output.** `@learnr/core` ships
   TypeScript with extensionless relative imports, which tsx and vitest resolve
   and plain `node` does not. `tsc --noEmit` still typechecks.
10. **`null` is a failed read and `[]` is nothing there**, on both sides. A 503,
    a 4xx and a dead connection all come back from `src/api.ts` as null.
11. **A response schema strips what it does not declare.** Add a field to a DTO
    and it must be added to its schema in `apps/api/src/schemas/dto.ts` or it
    will not reach any client. `Mirrored` makes that a compile error rather than
    something to remember.

## How it was verified

By hand, against a real pair: a throwaway Postgres with the API's migrations, the
API on 3101, and `next start` on 3100 pointed at it. Sessions were seeded
directly so no Google round trip was needed.

Checked: a child's home screen and play screen; the managed-child redirect,
including for a year the URL made up; a parent redirected to `/progress`; the
report with real numbers, examples and a calendar; `/progress/lab`; `/children`;
`/speed` for a parent and the redirect for a child; all three states of the
leaderboard; a login code issued, redeemed once and refused the second time; a
share link read **signed out**, accepted, and accepted again idempotently; and
every screen with the API killed, where the play path still draws questions.

**One thing that surfaced and was then fixed.** With the API unreachable, a
signed-in parent fell through to the child's home screen, because
`account === null` was both "signed out" and "could not read". Pre-existing -
`readAccount` returning null did the same - but harmless only while a failed read
meant the whole app was down, which stopped being true here.

`viewerKind` (`src/lib/viewer.ts`) splits the null four ways and the three
screens that gate on a role branch on it: `/` says "Can't load your account",
`readParent` returns `viewable: null` instead of redirecting so the URL survives
a reload, and `/speed` stops sending a reader it cannot identify to the child's
section. Checked the same way, with the API killed and then brought back: it
heals on the next request with no sign-out. `/play` still draws questions, which
is the one path that must degrade rather than stop.

## Production notes

`apps/api/.env` holds the **production** Neon URL and is gitignored. Tests are
unaffected - `globalSetup` overrides `DATABASE_URL` before any test module loads.
But `db:deploy` and `prisma migrate dev` do read it and will reach production.

`LEARNR_API_URL` must be set in Vercel to `https://learnr-api-syd.fly.dev`.
Without it the web app falls back to `http://localhost:3001` and every read comes
back null - which renders as "couldn't load" rather than an error page, so it
will not announce itself loudly.

Neon warns that `sslmode=require` is deprecated in favour of `verify-full`.
Harmless today; worth fixing when the connection string is next touched.
