# LearnR: iOS port, API server, and web decoupling

**Date:** 2026-08-26
**Status:** Approved design, not yet implemented
**Scope:** Three repositories and one shared contract artifact

## The change in one paragraph

LearnR today is a single Next.js application: a pure TypeScript question engine
in `src/lib`, five impure files that talk to Postgres, and a UI that reaches the
database through server actions and server components. This design splits it into
a REST API server that owns the data, a web app that keeps the engine and becomes
a client of that API, and a native iOS app for children that carries its own Swift
port of the same engine so it can play offline. A shared contract artifact - the
OpenAPI spec, the question content as data, and a corpus of golden fixtures - is
what keeps the two engines from drifting apart.

## Why these three pieces

**The engine is worth porting rather than serving.** `src/lib` is deliberately
pure: nothing in it touches React, the network, the clock or the database, and
callers pass in `now` and a seeded RNG. That is what makes a faithful second
implementation possible at all, and it is why the existing architecture already
runs the session client-side with the server doing best-effort recording. Serving
questions over HTTP would be a departure from the design, not an extension of it.

**Offline play is a requirement.** A child practising should not stop because the
network did. This is the decision that forces a native engine and pays for the
conformance suite below.

**The parent half does not port.** Parents use the web app only. Roughly a
thousand lines of the most intricate analytics - `report.ts` and `errors.ts` -
therefore never reach iOS, and neither does the authoring-time validator. That
single product decision removes about a fifth of what would otherwise be ported.

## Repository layout

| Repo | Owns |
| --- | --- |
| `learnr-api` | The database, identity, records, awards, sharing, and the parent analytics computation. |
| `learnr` | The Next.js web app: parent UI and child play. Keeps the TypeScript engine; drops Prisma and server actions. |
| `learnr-ios` | SwiftUI app. Children only. Native engine, offline play, sync queue. |
| `learnr-contract` | OpenAPI spec, content JSON, golden conformance fixtures. Consumed by all three. |

`learnr-contract` starts as a published directory inside `learnr-api` rather than
a fourth Git repository. A repo whose only job is to hold three generated files
earns its independence once more than one person works across them, and not
before.

The contract holds three things neither client owns:

- **`openapi.yaml`** - generates the TypeScript client and the Swift `Codable`
  types, so a contract change is a compile error on both sides rather than a
  runtime surprise.
- **`content/*.json`** - the 505 templates, extracted from TypeScript literals to
  data, versioned. Both engines read the same bytes.
- **`fixtures/*.json`** - the golden corpus. For each `(templateId, seed)`, the
  exact prompt, answer, choices and figure marks the TypeScript oracle produced.

## Prerequisite, already landed

`muzzamilkhan/learnr#3`: Google sign-in only ever creates a parent account. The
only way to become a child is a parent creating a child profile and handing over a
four-character login code.

This design depends on it. Dropping Google from the iOS app is only sound if
Google cannot produce a child; otherwise the native app would have a role it
cannot sign in. Post-#3 the two identity paths cannot cross, and the whole of the
iOS auth surface is redeeming a code.

## Accounts and authentication

| | Parent (web only) | Child (web and iOS) |
| --- | --- | --- |
| Obtains identity | Google OAuth via Auth.js | `POST /auth/redeem` with a 4-character code |
| Session | Auth.js session cookie | Bearer token, long-lived |
| Reaches | Own children, own shares | Own play records only |

**Auth.js stays.** The API server accepts either a session cookie (web, same-site)
or an `Authorization: Bearer` token (iOS). The web parent flow is untouched, and
the child path - the only one iOS needs - does not route through Auth.js anyway.

The child login seam is already clean: `redeemLoginCode` spends the code and mints
a `Session` row in one statement, with a hundred-year lifetime. The short-lived
thing is the code, not the login. The endpoint returns that token instead of
setting a cookie.

Because no third-party sign-in is offered in the native app, App Store Guideline
4.8 does not apply and Sign in with Apple is not required.

## API contract

REST over JSON, resource-oriented, OpenAPI 3.1 as the source of truth.

### Three conventions inherited from the existing code

These are load-bearing and easy to lose in translation, so the contract states
them rather than leaving them to each handler:

1. **`null` means the read failed; `[]` means nothing was recorded.** A failed
   read is `503`, never `200 []`. The web app must render "could not read"
   distinctly from "never practised".
2. **Ownership is the `where` clause, never a separate check.** Every handler
   touching a child scopes its query by the caller's id. No fetch-then-compare:
   the query itself must be incapable of returning someone else's child.
3. **Play-path writes are best-effort; account writes report success.** Recording
   an answer may fail silently, because the child keeps playing either way.
   Removing a child may not, because the parent was told it worked.

### Auth

```
POST /auth/redeem        { code }   -> { token, childId, expiresAt }
GET  /me                            -> Account
```

### Play and sync

```
POST /sessions                { id, subject, level, seed }  -> 201 | 200 (idempotent on id)
POST /sessions/{id}/attempts  { attempts: [...] }           -> { streak, streakAdvanced }
POST /sessions/{id}/award-round                             -> { stars }
POST /sessions/{id}/award-target { offsetMinutes }          -> { awarded }
POST /sessions/{id}/end
```

- **`id` is client-supplied** (a UUID) and `POST /sessions` is idempotent on it.
  This is what lets iOS mint a session offline and reconcile later, and it is the
  mechanism behind the round-banking guarantee below.
- **`attempts` is a batch.** Web sends one at a time, unchanged; iOS flushes a
  queue. A replayed batch must be safe.
- **`award-round`** is called once at the end of a synced sitting, and per closed
  round by live web play.
- **`award-target`** pays for the current local day only if it is unpaid, and
  never retroactively pays older days.

### Content

```
GET /content/manifest           -> { version, subjects, levels, etag }
GET /content/{subject}/{level}  -> { version, templates: [...] }
```

Versioned, cacheable, `ETag`-driven. iOS ships a bundled copy and updates in the
background, so new templates do not require an App Store release. Given that
content is 505 AI-authored templates likely to churn, this matters.

### Parent reads - web only, never called by iOS

```
GET    /children                              -> ChildProfile[]
POST   /children
PATCH  /children/{id}
DELETE /children/{id}
POST   /children/{id}/login-code              -> { code, expiresAt }
GET    /children/{id}/report?subject=         -> computed report
GET    /children/{id}/answers?subject=&limit=
GET    /children/{id}/speed
GET    /shares
POST   /shares
DELETE /shares/{id}
POST   /shares/{token}/accept
```

`report.ts` and `errors.ts` run server-side and return computed JSON. The web app
renders; it no longer computes.

### Speed

```
GET  /speed/modes                          -> static mode list
POST /speed/runs   { id, mode, correct }   -> SpeedOutcome
GET  /speed/records
```

Client-supplied `id` for the same offline reason. The score is client-asserted and
unverifiable, as it already is today; offline does not make that worse. A
`SpeedRecord` is a maximum, and a maximum is idempotent.

### Data transfer objects

The existing types are already the DTOs. `Attempt`, `Observation`,
`AnsweredQuestion`, `Figure`, `LearnerProfile`, `QuestionTemplate` and
`ChildProfile` are plain serialisable shapes exchanged today between the pure core
and the impure shell. The contract codifies them rather than inventing new ones.

## Offline play and the round-banking hazard

### The hazard

`awardRoundStars` reads every attempt in a session ordered by `answeredAt`, chunks
that list into rounds of ten, and pays for chunks past `roundsBanked`. Chunking is
therefore **positional**: round 1 is "the first ten answers in `answeredAt`
order", not a fixed set of rows.

The existing code documents a limitation it accepts:

> An attempt landing with an `answeredAt` earlier than answers that have already
> been banked would therefore shuffle itself into a round somebody has been paid
> for [...] It is accepted because answers are written as they are given and a
> child plays one question at a time, so a late-dated attempt is not something
> ordinary play produces.

**Offline play produces exactly that.** A child answers twelve questions on a
plane at 3pm; at 5pm they play ten more at home, which bank three stars; at 5:11pm
the queue flushes and twelve earlier-dated attempts land. Re-chunking now yields a
different round 1, already marked paid, and the child silently loses the stars
they earned offline. The precondition under which the limitation was accepted no
longer holds.

Recounting the total instead of incrementing it is **rejected**: the code rejects
it for a good reason, since a changed daily target could retroactively reduce a
child's star total.

### The structural fix: one session per sitting

Each sitting gets its own `LearningSession` row. Because `awardRoundStars` filters
on `learningSessionId`, one sitting's answers can never enter another's chunking -
the interleaving becomes impossible rather than handled.

| Event | Call | Effect |
| --- | --- | --- |
| 3:00pm offline, child plays | none | client mints session id A locally, queues attempts |
| 5:00pm online, child plays | `POST /sessions` (B) | `LearningSession` B, `roundsBanked = 0` |
| 5:00-5:10pm, ten answers | `POST /sessions/B/attempts` | attempts on B only |
| round closes | `POST /sessions/B/award-round` | chunks B's answers, pays, `B.roundsBanked = 1` |
| 5:11pm, queue flushes | `POST /sessions` (A), then attempts | attempts on A only |

This is nearly free: the client already opens a session per sitting. The only new
requirement is that iOS can mint a session id offline, hence the client-supplied
idempotent id.

### The ordering rule: a synced sitting banks once

A synced sitting sends all its attempts, then calls `award-round` once. Live web
play continues to bank per closed round, since its attempts are never late.

This does not fix a live bug - attempts flushing into a session only ever append,
so chunking stays stable - but it removes a reason to reason about interleaving on
every future change, and it is what keeps a **partially delivered flush** safe when
the queue retries. Given the queue will retry, the rule is worth its one line.

**A sitting that is still open when the device reconnects** flushes what it has
and stays open; it banks on the same rule as any other synced sitting, once, when
the child finishes. The child is mid-play, so there is nothing to gain from paying
early and a partially flushed sitting is precisely the case the rule protects. A
sitting left unfinished - the app killed, the child bored - is closed by the next
launch, which flushes its attempts, banks once, and calls `end`.

### Idempotency

`Attempt.id` becomes client-supplied, with the insert deduping on it. Without this
a retried flush double-counts answers into `TopicSkill` and quietly corrupts the
reinforcement model. This is a schema change: today the column is a `cuid()`
default.

The existing guards continue to do their job and are more valuable than before:
`SELECT ... FOR UPDATE` on `roundsBanked` makes a repeated award idempotent, and
the compare-and-set on `targetDay` makes the daily target pay at most once a day.

### What is authoritative where

Play-only offline. Questions generate on the device; **awards do not**. Stars,
streaks and the daily target are computed server-side on sync, where the row locks
and compare-and-set guards already exist. Reimplementing `roundsBanked` semantics
on a device that can be reinstalled is a bad trade. A child may see stars arrive a
moment late; they will never see them paid twice.

## The Swift port

### What ports

| Module | TS lines | Ports | Note |
| --- | --- | --- | --- |
| `expr/` | ~600 | yes | Pratt parser, 16 functions, no arrays. Drift-prone. |
| `rng.ts` | 45 | yes | mulberry32 over FNV-1a. `UInt32` with `&*` and `&+`. |
| `templates/generate` | 253 | yes | Binding, constraints, `{expr}` holes. |
| `templates/validate` | 737 | no | Authoring-time. Content ships pre-validated. |
| `figures/` builders | ~7000 | yes | Eleven kinds. The bulk of the work. |
| `figures/` rendering | 274 | rewrite | Four primitives to SwiftUI `Path`. Small. |
| `session/` | ~400 | yes | State machine, grading, answer rules. |
| `speedrun/run` + modes | ~700 | yes | Second state machine. |
| `reinforcement/select` | ~200 | yes | Weighted draw. |
| `analytics/profile` | 255 | yes | The selector needs it in-process. |
| `analytics/report`, `errors` | ~980 | no | Parent-only, server-side. |
| `rewards/` | ~300 | partial | Display only; awards are server-authoritative. |
| `speech/narration` | small | rewrite | `AVSpeechSynthesizer`. |

About **9,500 lines** of TypeScript become Swift. Roughly 2,000 lines stay behind
because of decisions in this document.

The figure builders are about seventy per cent of the work and the least
interesting part of it. That is where the schedule goes.

**Rendering is not the hard part.** `Figure` resolves to `{ width, height, marks }`
with only four primitives - path, arc, dot, label - and `<Diagram>` is explicitly
"the dumb half". iOS renders four primitives, not eleven kinds. The seven thousand
lines are builders, and they port only because generation happens on-device.

**The RNG ports mechanically.** mulberry32 over an FNV-1a string hash, written in
explicit unsigned-32 arithmetic with `Math.imul`. Seeds are UUIDs and
`` `${seed}:${draw}` ``, so ASCII only, and `charCodeAt` returning UTF-16 code
units never bites. This is the highest-risk item in the port and it is thirty
lines with published test vectors.

## The conformance suite

**The TypeScript engine is the oracle. The fixtures are the contract. CI is the
enforcement.** Drift stops being something caught in review and becomes a failing
test on whichever side moved.

### Generation

```
for each of 505 templates:
  for draw in 0..99:
    seed = `${templateId}:${draw}`
    q = generateQuestion(template, createRng(seed))
    emit { templateId, seed, prompt, answer, answerType, choices?, figure? }
```

The seed string is part of the contract, not an implementation detail: both
engines must build it identically, since `createRng` hashes the string itself.
Note this deliberately differs from how a live session seeds a draw
(`` `${sessionSeed}:${drawNumber}` ``) - fixtures need a seed that is stable
across regeneration and independent of any session.

About 50,000 cases, a few megabytes of JSON. Both engines' suites load it and must
reproduce every field.

This works because the engine is deterministic and seeded by construction,
generation has no I/O, and `Figure` resolves to four comparable primitives. Those
properties were already true; the suite exploits them rather than requiring new
work.

### Comparison precision

Stated in the contract so neither implementation chooses for itself:

- Figure coordinates compare at `FIGURE_PRECISION = 2`.
- Numeric answers compare with `EPSILON = 1e-9`, as `gradeAnswer` already does.

### Three smaller fixture sets

All cheap, all covering drift-prone logic:

- **Expression evaluation** - expressions and scopes to values. Catches
  precedence, `^` right-associativity, `%` on negatives, rounding at `.5`.
- **Grading** - `(question, response)` to correctness. Catches boolean synonyms
  and numeric tolerance.
- **Profile folding** - observation sequences to `LearnerProfile`. Catches float
  accumulation in `strength`, and the `localDay` / `offsetMinutes` arithmetic,
  which is a classic cross-platform trap.

### Versioning

Fixtures carry a version. A deliberate engine change regenerates them and bumps
it; an undeliberate change fails CI.

**Fixtures are regenerated only by a commit that says why, and never in the same
commit as an engine change.** Regeneration is its own reviewable diff. Without
this, regenerating becomes the reflex fix for a red build and the suite stops
meaning anything.

CI fails on a template id present in content but absent from fixtures.

### What the suite does not protect

- **UI and interaction are not covered.** Answer pads, timing, animation: native
  work, judged by eye.
- **It proves agreement, not correctness.** A bug in the TypeScript engine is
  faithfully reproduced in Swift. That is acceptable - the oracle is the shipped
  web behaviour, and matching it is the goal.

## Build order

1. **API server.** Extract the five impure files (`records.ts`, `accounts.ts`,
   `speed-records.ts`, `sharing.ts`, `db.ts`) plus the parent analytics; stand up
   the endpoints; point the web app at them. Web keeps working throughout. This is
   the riskiest step and the one with a live rollback.
2. **Content extraction.** TypeScript literals to versioned JSON, consumed by web
   first. Proves the format before iOS depends on it.
3. **Fixture generation.** The oracle corpus, with the TypeScript engine passing
   its own suite. Must precede Swift, or there is nothing to port against.
4. **Swift engine.** Bottom-up: `rng`, `expr`, `generate`, figures, session. Each
   layer green against fixtures before the next begins.
5. **iOS app.** UI, sync queue, offline store.

Steps 1 to 3 ship value independently of iOS: the web app gets a real API, content
becomes updatable without a deploy, and the engine gains a regression suite it does
not have today.

## Decisions deliberately rejected

**Server-side generation with aggressive device caching.** The app would pre-fetch
a few hundred resolved questions, play them from cache, and refill on reconnect.
Offline play works and the engine exists exactly once - the consistency problem
disappears rather than being managed. Rejected because the cache is finite, a long
offline stretch exhausts it, and reinforcement adapts only as far as the batch
allows. Recorded here so it is rejected deliberately rather than by omission.

**Running the TypeScript engine in JavaScriptCore inside the native shell.** Avoids
the second implementation, but trades it for bridge friction, and figure rendering
would still be native. If one engine is the goal, server-side generation is the
better route to it.

**Recounting stars instead of incrementing.** See the round-banking section.

## Open questions

None blocking. Two to settle during implementation:

- **Existing self-declared children** (`role = 'child' AND parentId IS NULL`),
  if production has any. Grandfather or migrate; needs a query first. Tracked on
  `learnr#3`.
- **Content update cadence on iOS** - whether the bundled copy refreshes on
  launch, daily, or only on manifest change. An `ETag` makes any of these cheap.
