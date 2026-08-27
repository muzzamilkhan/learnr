# learnr-api

The REST API behind LearnR. It owns the database, the schema and the migrations.
The web app reads and writes everything through it; the iOS app will.

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

## Who calls it, and how it knows who they are

**The caller's Auth.js session cookie is the whole of the authorisation.** There
is no API key and no service account. Auth.js runs in the web app and writes
`Session` rows; this server reads the same table (`src/auth/session.ts`), so one
sign-in serves both halves and who a request is for is decided in one place. The
web app forwards the cookie as-is (`src/api.ts` there); the iOS client sends the
same token as a bearer, which is what `POST /auth/redeem` hands it.

That is why the gates are here rather than in a caller. `requireUser` and
`requireParent` sit in front of every route but three, and every child mutation
scopes its `where` by the parent resolved from the session - so a child id typed
into a URL is refused by the query, not by a check somebody remembered to write.

**Three routes are deliberately open**, and each for its own reason:

| | Why |
| --- | --- |
| `GET /speed/modes` | Static content. A child has to see what to play before signing in. |
| `POST /auth/redeem` | The code *is* the credential, spent in the statement that reads it. Throttled - see below. |
| `GET /shares/:token` | A share link's point is reaching somebody with no account here; signing in is the acceptance. It is read-only and spends nothing. |

**`POST /auth/redeem` is throttled, because it is open and the code is the
credential.** 31^4 is 923,521 codes, `redeemLoginCode` matches any live code
rather than one child's, and a hit buys a session that does not expire - so an
unbounded number of guesses is the one thing that turns a deliberately short
code into a hole. `REDEEM_BACKSTOP_LIMIT` (120) failures per caller per 15
minutes, keyed on `fly-client-ip` (set by Fly's proxy, so it cannot be spoofed)
and answering **429** with a `Retry-After`.

**This is the backstop and not the primary control.** A web-app request arrives
from Vercel, so every browser shares one key here - which is why the number is
generous, and why the tight per-browser limit (`REDEEM_FAILURE_LIMIT`, 10) lives
in the web app's own server action where the child's real address is visible.
Only failures count and a success clears the caller.

**`null` is a read that failed and `[]` is nothing there**, and the callers draw
them differently - `[]` from `readObservations` renders as "your child has never
practised". So a read that broke answers 503 and an empty one answers 200 with
`[]`. `family: null` on `GET /speed/records` is a third thing again: nobody to
rank, which is neither.

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

**Every response has a real schema**, so a client can generate its models from
the contract rather than transcribing them. They live in `src/schemas/dto.ts`,
and two things about them are worth knowing before you edit one:

- **A response schema is a serializer.** Fastify runs the value through it and a
  zod object strips what it does not declare, so a field left out does not fail -
  it silently vanishes. `Mirrored`, at the foot of that file, is the compiler
  holding every schema against the DTO it describes. It compares key sets both
  ways rather than assignability, because an object missing an *optional* field
  is still assignable to one that has it - and those are the fields whose loss is
  invisible.
- **The compiler cannot see a schema that is too tight.** `integer` where a ratio
  is 0.67 throws rather than strips, and the endpoint 500s. That is what
  `test/routes/serialization.test.ts` is for: it sends the awkward shapes on
  purpose, and every guard in it was checked by breaking the schema it covers.

A `Date` stays a `Date` (`z.date()`), serialized to an ISO 8601 string and
documented as `format: date-time`.

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
