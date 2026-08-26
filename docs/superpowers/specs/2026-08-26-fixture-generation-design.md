# Fixture generation: the golden corpus

**Date:** 2026-08-26
**Status:** Approved design, not yet implemented
**Scope:** This repository. Build-order step 3 of
`docs/superpowers/specs/2026-08-26-ios-port-design.md`.

## The change in one paragraph

The TypeScript engine is the oracle for a Swift port that has to agree with it
question for question, and today nothing writes that agreement down. This design
adds a generated corpus - every shipped template drawn a hundred times, plus
three smaller sets for expression evaluation, grading and profile folding - and
commits a **digest** of it rather than the corpus itself. Both engines compute
the same digest from the same canonical form; a mismatch on either side is a
failing test rather than something caught in review. The full corpus is
regenerated on demand as the debugging tool, and never committed.

## Why this is the gate

Build-order steps 4 and 5 are the Swift engine and the iOS app. `rng` and `expr`
are ported and have their own vectors; `generate`, the eleven figure builders and
the session machines have nothing to port against. The whole argument for a
native engine - that play works offline because questions are generated on the
device - rests on being able to prove the two engines agree. Until the corpus
exists, that proof does not.

The iOS client's own notes name the content pack as its blocker. That is stale:
the packs landed with step 2 and are served at `GET /content/manifest` and
`GET /content/:subject/:level`. The corpus is the real gate.

## What it costs, measured

The iOS port spec estimated "a few megabytes". It is 33 MB.

| | |
| --- | --- |
| Templates | 505 |
| Draws each | 100 |
| Cases | 50,500 |
| JSON | 32.9 MB |
| Of which figures | 22.0 MB |
| Generation time | 2.3s |

Figures are two thirds of it, and they are not evenly distributed:

| Figure kind | Avg bytes per drawing |
| --- | --- |
| `clock` | 6,378 |
| `spinner` | 2,253 |
| `grid` | 1,520 |
| `pictograph` | 1,460 |
| `fraction-shape` | 1,447 |
| `number-line` | 1,365 |
| `bar` | 1,341 |
| `solid` | 1,035 |
| `array` | 464 |
| `angle` | 251 |
| `polygon` | 169 |

A clock's minute track and numerals are about forty times a polygon. 127 of the
505 templates carry a figure.

One further measurement decided the draw count stays at 100: a template produces
on average **20.3 distinct outputs over 25 draws and 67.8 over 100**. Draws 26 to
100 are mostly repeats, but they are free - generation is 2.3 seconds and the
committed artifact is a digest whose size does not depend on the draw count at
all. The redundancy costs nothing, so there is no reason to buy less coverage.

## The shape: digests committed, corpus generated

33 MB cannot be reviewed as a diff, which is the whole point of the spec's rule
that **regeneration is its own reviewable diff**. So what is committed is a
digest - one hash per template - and the corpus itself is gitignored and rebuilt
on demand.

```
scripts/fixtures.ts         pure - cases in, canonical bytes out
scripts/build-fixtures.ts   writes fixtures/digests/  (committed, ~40 KB)
scripts/emit-fixtures.ts    writes fixtures/corpus/   (gitignored, 33 MB)
scripts/fixtures.test.ts    the drift guard, beside its script
scripts/fixtures/expr-traps.ts  the hand-authored trap list
fixtures/digests/           14 pack-shaped files + 3 small sets + a manifest
```

Two npm scripts: `fixtures:build` writes the digests, `fixtures:emit` writes the
corpus and takes an optional template id so a single failure can be read without
rebuilding all of it.

**This follows `scripts/content-packs.ts` exactly**, because that file already
solved this shape: a pure function returning bytes, a thin writer beside it, and
a drift test that regenerates in memory and compares against what is committed.
Returning bytes rather than objects is what lets the guard compare against the
files on disk without re-deciding how to format them.

**They live in `scripts/` and not under `src/`** for the reason
`scripts/content-packs.test.ts` does: an engine file under `src/lib` or
`src/content` may not import from outside `src/`, because the `packages/core`
symlink makes `tsc` walk every such file twice and an escaping relative import
resolves from the real path but not the mirrored one. These files must reach both
the catalog and each other. `scripts/**/*.test.ts` is already in
`vitest.config.mts`'s include, so the guard runs in `npm test` with no config
change.

**Digests mirror the pack layout** - `fixtures/digests/maths.4.json` beside
`src/content/packs/maths.4.json`, one hash per template inside it. A content
change to Year 4 moves exactly one digest file, so the diff names the year.

## How the two engines verify

Three checks, at two different grains, because a digest is a gate and not a
diagnosis.

| Where | What | Grain |
| --- | --- | --- |
| This repo, CI | Regenerated digests vs committed bytes | Byte equality of the whole file |
| `learnr-ios`, CI | Swift-computed digest vs committed digest | One hash per template |
| `learnr-ios`, dev | Field-wise assertions vs a vendored emitted corpus | Every field of every case |

A vendored corpus carries the digest of the run that produced it, so a stale copy
names itself rather than passing quietly against an engine that has moved on.

**A digest failure names the template and nothing finer.** That is acceptable
only because `fixtures:emit` takes a template id: the path from "`maths.4.angles.
larger-angle` differs" to the hundred cases to read is one command.

## The canonical form

This is the crux, and it is deliberately **not** JSON.

Hashing `JSON.stringify` output would require two JSON encoders in two languages
to agree about escaping, and prompts carry `−`, `×`, `÷`, `°` and `$` - exactly
where encoders differ on when to escape non-ASCII. So a case canonicalizes to a
hand-written form that both sides implement in about thirty lines:

```
prompt␟What is 7 − 3?␞answer␟4␞answerType␟number␞figure.mark.0␟path|12.5,80|45,80␞…
```

- Fields are joined by `␟` (U+001F), records by `␞` (U+001E). Neither can occur
  in a rendered prompt.
- Absent optional fields are omitted rather than emitted as empty, and every
  field carries its name, so omission and emptiness are distinguishable.
- **Every value is its JavaScript `String(v)` form.**

That last rule is the one that earns its keep. Swift already has to implement
JavaScript number-to-string for `renderTemplateString`, because
`generateQuestion` keys both the expected answer and the distractor dedup off
`String(value)` (`src/lib/templates/generate.ts:147`). A port yielding `"2.0"`
where the oracle says `"2"` marks a correct answer wrong *and* can offer a
distractor identical to the answer - trap two of the four the port had to
reproduce. Hashing this form makes the digest **test** the thing Swift already
had to get right, rather than adding a second formatting rule to keep in step.

The hash is `sha256(...)` truncated to twelve hex characters, the same function
`content-packs.ts` uses: short enough to read, long enough never to collide.

### Precision

The iOS port spec states two comparison tolerances. Both resolve upstream rather
than needing fixture machinery:

- **Figure coordinates at `FIGURE_PRECISION` (2).** `buildFigure` already rounds
  at build time, precisely so two figures compare as strings. Nothing to do.
- **Numeric answers at `EPSILON` (1e-9).** This does **not** apply to the corpus.
  A digest is exact by construction, and exactness is correct here: both engines
  walk the same expression tree over IEEE 754 doubles and produce bit-identical
  values, so `String()` of each is identical once Swift implements JavaScript
  number-to-string. Exact equality is the strictest useful test. `EPSILON`
  belongs to the grading set, where it is the thing under test rather than a
  tolerance applied to the comparison.

## The four sets

### 1. The main corpus

`allTemplates` - read from the packs, so this runs against the artifact that
ships, the same way `catalog.test.ts` and `leaks.test.ts` do - drawn 100 times
each on `` `${templateId}:${draw}` ``.

**That seed string is part of the contract**, since `createRng` hashes the string
itself. It differs deliberately from how a live session seeds a draw
(`` `${sessionSeed}:${drawNumber}` ``): fixtures need a seed stable across
regeneration and independent of any session.

Each case pins `prompt`, `answer`, `answerType`, `choices`, `hint`, `figure` -
**and `vars`**. `vars` is already on `GeneratedQuestion`, costs almost nothing,
and is what bisects a failure: matching `vars` with a mismatched `prompt` is a
rendering bug, while mismatched `vars` is the RNG or the binding order. Without
it every failure looks the same.

### 2. Expression evaluation

Two halves, and only one of them is generated.

**Harvested, from real usage.** The content holds 725 distinct expression strings
across `answer`, constraints, variable bounds, `{...}` holes, figure parameters
and distractors. An expression needs a scope, and this needs **no engine
instrumentation**: `q.vars` is the bound scope and is already exposed on
`GeneratedQuestion`. So for each template, draws 0-4 supply five real scopes, and
each of that template's expression strings is evaluated against them. About 3,600
cases of genuine usage.

**Hand-authored, for the traps.** Harvesting alone is not enough, and the gap is
measurable: the content uses **`^` not once**, and never uses `ceil`, `trunc`,
`sign`, `sqrt` or `isInt`. `-2 ^ 2` is one of the four documented port traps and
harvesting gives it zero coverage.

So `scripts/fixtures/expr-traps.ts` carries roughly sixty
`{ expr, scope, expect }` entries written by hand. **This file has a dual role
and that is the point.** It flows into the digest like everything else, and it is
*also* asserted directly by a plain vitest test against the engine. When the two
disagree the failure reads "a human said `round(-2.5)` is `-2` and the engine
says otherwise", and somebody decides which is wrong. That is the exact opposite
of the regenerate-to-fix reflex, and it is what closes the gap the API extraction
handoff names: **no test in this repo currently covers a negative half.**
`expr.test.ts` asserts `round(2.5)` is `3` and nothing below zero, `^` is tested
only for right-associativity, and `&&` is never given a truthy non-boolean.

Minimum coverage for the trap list:

| Case | Expected | What a naive port does |
| --- | --- | --- |
| `round(-2.5)` | `-2` | `-3` - half-away-from-zero rather than half-up |
| `-2 ^ 2` | `-4` | `4`, if unary minus binds tighter than the power operator |
| `1 && 2` | `true` | `2`, if `&&` returns the operand rather than a boolean |
| `{x / 2}` with `x = 4` | `"2"` | `"2.0"` |

plus `%` on negatives, `.5` rounding on both sides of zero, and the five
functions content never exercises.

### 3. Grading

`gradeAnswer(question, response)` over corpus questions crossed with a
constructed response list: the exact answer, surrounding whitespace, wrong case,
all eight boolean synonyms (`true`/`yes`/`t`/`y`, `false`/`no`/`f`/`n`), the
empty string, non-numeric junk, and near-misses straddling the tolerance at
`answer ± 1e-10` and `answer ± 1e-8`. The epsilon-boundary cases are the content;
the rest is the surrounding shape.

### 4. Profile folding

Seeded observation sequences through `nextSkill` and `buildProfile`, with `now`
pinned since it is injected. Targets the two named traps: float accumulation in
the recency-weighted `strength` over long runs, and `correctDays` across
`offsetMinutes` boundaries - including the rule that a day is only counted when
it is later than the last counted one, which undercounts on out-of-order arrival.
That asymmetry (mastery delayed, never faked) is exactly the kind of thing a port
implements backwards.

**Only the trap file is hand-written.** Every other input is a function of the
catalog plus the script, so the committed surface is the digests plus about sixty
reviewed lines.

## Enforcement

### The drift guard

`scripts/fixtures.test.ts` regenerates the digests in memory and compares byte
for byte against what is committed - `content-packs.test.ts`'s shape. About 2.3
seconds inside `npm test`.

**The same mechanism carries the opposite intent, and that has to be written
down.** For content packs, regenerating is the correct reflex: the diff is
mechanical and reviewable, and the guard exists so that editing a year file
without running `content:build` is a red suite rather than a stale pack. For
fixtures, the iOS port spec warns that regenerating must **not** become the
reflex fix for a red build, or the suite stops meaning anything. Identical
machinery, inverted meaning.

So the guard's failure message is load-bearing rather than decorative. It names
the change as an engine change and says to regenerate in a separate commit that
says why.

**Fixtures are regenerated only by a commit that says why, and never in the same
commit as an engine change.** This is a documented rule and not a mechanical
check: a test asserting "if `src/lib` moved then `fixtures/` did not" is defeated
by a rebase or a squash and would block legitimate work. It belongs in
`CLAUDE.md`.

### The compile-time guard, beyond the spec

A digest is only as good as the canonical form's field coverage, and a field left
out of the canonicalizer is invisible **forever** - no test can miss what it
never hashes.

That is exactly the problem `Mirrored` solves in `apps/api/src/schemas/dto.ts`,
one level up, and it takes the same answer: a key-set comparison between
`GeneratedQuestion` and the canonicalizer's field list, **both ways**. Add a
field to `GeneratedQuestion` and forget the canonicalizer, and it is a type error
rather than a silently weaker contract. As with the response schemas, optional
fields are the invisible ones - and `figure`, `choices` and `hint` are all
optional.

### What the guard already covers

The iOS port spec asks that CI fail on a template present in content but absent
from fixtures. That needs no separate check: full byte equality of the digest
file is strictly stronger, since a new template changes the regenerated bytes and
the guard reddens.

### Versioning

Content-addressed, like the packs. Each digest file's `version` is a hash of its
own contents, and `fixtures/digests/manifest.json`'s version is a hash over the
per-file versions. The spec's "a deliberate engine change regenerates them and
bumps it" happens by construction - nothing to bump, so nothing to forget.

### Deployment

`changed-apps.ts` gets one rule: `/^fixtures\//` joins `IGNORED`. The digests are
not in the Next bundle and not in the API's Docker build context, which copies
only `src/lib`, `src/content`, `packages/core` and `apps/api` - so they cannot
move either deployment, the same honest reason `docs/` is on that list. Without
it a regeneration commit falls through to "matches no rule, deploy both" and
rolls production for a test artifact. It is tested, like every other rule in that
file.

## How this gets verified

By breaking each guard and watching it fire, which is this repo's established
method and the only way the response-schema work found its real bugs. Each of
these must redden the right thing and name it:

- Break the canonicalizer to emit `2.0` where the engine says `2`.
- Drop a field from the canonical form - `figure` in particular, the optional one
  whose loss was invisible last time.
- Add a template to a year file.
- Change a trap's expected value in `expr-traps.ts` away from what the engine
  does.
- Point `changed-apps.ts` at a path under `fixtures/` and confirm it moves
  neither half.

## Deliberately out of scope

Recorded as rejections rather than omissions.

**No API endpoint for fixtures.** Content packs are served because a Swift client
needs them at runtime. Fixtures are a build and test artifact; a production
endpoint for them would be a category error.

**How `learnr-ios` obtains the digests is the iOS side's call.** `learnr` is
public, so `raw.githubusercontent.com` reaches the digest files without auth.
Nothing on this side changes either way, and the vendored-corpus staleness check
lives in that repo.

**The corpus is never committed.** `fixtures:emit` rebuilds it in about three
seconds.

**The Swift side is step 4.** This design delivers the oracle and this repo's own
suite against it, and nothing in Swift.

**Authoring-time validation does not port and is not covered.**
`validateTemplate`, the figure anchoring check and the option-set leak checks run
before content ships and have no on-device equivalent, so they need no fixtures.

## What this suite does not protect

Unchanged from the iOS port spec, and worth restating because the trap list is a
partial exception:

- **UI and interaction are not covered.** Answer pads, timing, animation.
- **It proves agreement, not correctness.** A bug in the TypeScript engine is
  faithfully reproduced in Swift. The one place that is not true is
  `expr-traps.ts`, where a human asserted the expected value and the engine is
  the thing under test.
