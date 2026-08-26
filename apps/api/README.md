# learnr-api

The REST API behind LearnR. It owns the database, the schema and the migrations;
the web app and (later) the iOS app both read and write through it.

Part of the `learnr` workspace: it depends on `@learnr/core`, the pure engine
shared with the web app, so it is built and run from the repository root.

## Running it

```bash
npm install                        # from the repository root
npm run dev --workspace apps/api   # http://localhost:3001
```

Without a `DATABASE_URL` the server still boots and answers `/health`; it simply
cannot persist. That is deliberate - see `src/env.ts`.

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Postgres. The `.env.example` placeholder counts as *no database*. |
| `PORT` | Defaults to 3001. |

## Tests

**Docker must be running.** The tests use a real Postgres via Testcontainers,
not a mock: three concurrency guards - `SELECT ... FOR UPDATE` on `TopicSkill`
and on `roundsBanked`, and the compare-and-set on `targetDay` - have no meaning
against a fake client, and they are the parts most worth proving.

```bash
npm test --workspace apps/api
npm run typecheck --workspace apps/api
```

The container starts once per run in `test/helpers/global-setup.ts`, before any
test module is imported. It has to be that early: the data modules read the
singleton in `src/db.ts`, which is built from `DATABASE_URL` at import time.

`DATABASE_URL` in a local `.env` is *not* used by the tests - global setup
overrides it. It is used by `npm run dev`, and by `prisma migrate`, which will
reach whatever that file names.

## Migrations

```bash
npm run db:deploy --workspace apps/api    # apply
npm run db:migrate --workspace apps/api   # author a new one (needs a live database)
```

A deploy runs `db:deploy` as its release command, so a release carries its own
schema changes.

## The contract

`contract/openapi.yaml` is generated from the zod schemas the routes validate
against, so a route and its documented shape cannot disagree. Regenerate after
changing any route:

```bash
npm run contract --workspace apps/api
```

A test compares the committed file against the live document and fails if they
have drifted. Note that `@fastify/swagger` only sees routes inside registered
plugins - `/health` and `/openapi.json` are declared on the root instance and so
are absent, which is correct for both.

## Building and deploying

`npm run build` bundles with esbuild rather than emitting with `tsc`. It has to:
`@learnr/core` ships TypeScript with extensionless relative imports, which tsx
and vitest resolve and plain `node` does not, so a `tsc` build alone produces a
server that will not start. `tsc --noEmit` still does the typechecking.

Deployment is Fly.io in `syd`, beside the Neon database - see `fly.toml` at the
repository root. The Docker build context is the root, not `apps/api`, because
`packages/core/src` is a symlink into this repo's `src/`.

```bash
fly deploy            # from the repository root
```
