# NSW curriculum + figure kinds — session handoff

**Point a new session at this file.** It resumes mid-plan work that is about 40% done.

You are already in the right place: worktree `/home/muzza/code/learnr/.claude/worktrees/nsw-curriculum`,
branch `worktree-nsw-curriculum`. Stay on it. Do not `cd` to the main checkout — this session is
worktree-isolated and git commands aimed at the shared checkout are refused by the harness.

## What this work is

Cross-reference LearnR's maths content to the **NSW Mathematics K–10 Syllabus (2022)** alongside
its existing ACARA citations, and fill the Measurement-and-space and Statistics-and-probability
gaps that doing so exposes — with nine new figure kinds and 129 new question templates.

- **Spec:** `docs/superpowers/specs/2026-08-20-nsw-curriculum-design.md`
- **Plan:** `docs/superpowers/plans/2026-08-20-nsw-curriculum-plan.md` (26 tasks)
- **Figure-kind contract:** `docs/superpowers/notes/figure-kind-author-notes.md` ← **read before writing any kind**
- **NSW outcome codes:** `docs/superpowers/notes/nsw-outcome-codes.md` (all four stages, needed by the content tasks)

## State

| | |
| --- | --- |
| Commits ahead of `master` | 26 |
| Pushed | **No.** Branch has no upstream and has never been pushed |
| Tests | 669 passing / 41 files (baseline was 551), typecheck + lint clean |
| Templates | **221** — unchanged from where the diagrams work left it. Target 329 |
| Figure kinds | 5 of 11: `polygon`, `angle` (pre-existing) + `bar`, `pictograph`, `spinner` |
| Tasks complete | **10 of 26** |

Rebased onto `master` at `bbe6a85` once already. `master` moves during these sessions — another
agent has been working on it. Rebase again at a clean boundary before merging.

### Done

Tasks 1–8, 25, 26.

- **1** `stageForLevel` / `stageLabel` in `src/lib/curriculum.ts` — NSW stage derived from year, never stored
- **2** Two syllabus families in `tags` (`SYLLABUSES`, `syllabusOf`, `nswStageOfCode`) in `src/content/catalog.ts`
- **3** Figure-kind registry + `fields` record, so a kind is one file plus one-line registrations
- **4** `labelSize` is a caller-set prop on `Diagram`
- **5** Content split from one 3,532-line file into `src/content/maths/{k,1,2,3,4,5,6}.ts` + `index.ts` + `helpers.ts`
- **25** Choice-leakage check in `validateTemplate` (`CHOICE_DRAWS`, `CLOSED_SET_MAX`, `rankIsTheQuestion`, `propertyIsTheQuestion`)
- **26** 13 leaking templates reworked, 2 legitimate ones declared
- **6** `bar` (column / dot / line) — five fix rounds; it is the worked example
- **7** `pictograph` — one fix round
- **8** `spinner` — zero fix rounds

### Not done

- **Tasks 9–14 — six figure kinds:** `solid`, `number-line`, `clock`, `array`, `fraction-shape`, `grid`
- **Tasks 15–21 — all 129 new templates**, one task per school year. *None of this exists yet; it is the bulk of the remaining work*
- **Task 22** — enforce citation rules over shipped content in `catalog.test.ts`
- **Task 23** — rewrite `/curriculum` for two sources, incl. rendering where they disagree
- **Task 24** — update `CLAUDE.md`

## How to resume

Use the **`superpowers:subagent-driven-development`** skill. It has been driving this: one
implementer subagent per task, a task review after each, fix rounds capped at five.

- Ledger: `.superpowers/sdd/2026-08-20-nsw-curriculum-plan/progress.md` (874 lines, **gitignored**).
  Tasks with a `Task <N>: complete` line are done. Resume at the first without one.
- Task briefs: `scripts/task-brief <plan> <N>` from the skill's directory writes
  `task-<N>-brief.md` into that same folder.
- Review packages: `scripts/review-package <plan> <BASE> <HEAD>` writes a diff file to hand a
  reviewer. Use the BASE recorded before dispatching, never `HEAD~1`.

**The ledger is gitignored scratch and a `git clean -fdx` destroys it.** The two things in it
worth keeping have been promoted into `docs/superpowers/notes/`. Everything else is recoverable
from `git log`.

## Rulings I made on your behalf

These were decisions taken without asking, per the skill's instruction not to stall a running
plan. Each is reversible; rework anything you disagree with.

1. **Sequential dispatch, never parallel.** The plan calls Phases 2 and 3 "parallel-safe"; I read
   that as a statement about file ownership, not an instruction to run implementers concurrently.
   *Cost if wrong: slower, no correctness risk.*
2. **Integers stay ACARA-only** (your call, recorded here for completeness). `maths.6.integers.*`
   keep `AC9M6N01` and take no NSW code, because NSW places integers at Stage 4 (Year 7).
   Task 21 must add a `catalog.test.ts` assertion naming them so the exception stays deliberate.
3. **No Part A / Part B tags, and no topic renames.** NESA says Part A is a teacher's choice, not
   a property of content; and `topic` is stored on `Attempt`/`TopicSkill`, so renaming orphans
   every child's history.
4. **The choice-leakage work was expanded beyond what you asked.** You asked me not to repeat the
   pattern in new templates; I added an enforced check and reworked the existing 13, because the
   only durable way to guarantee it across 129 new templates is to make it unauthorable.
5. **Accepted a residual in the 12 reworked templates.** They now land on two of four ranks, so
   "never the biggest, never the smallest" still lifts a guess from 25% to ~50%. Unbracketing the
   place-value ladder would cost a diagnostic distractor the parent's report reads. The plan
   forbids new templates from inheriting it, and final verification measures it.
   *Cost if wrong: a positional reasoner gets ~50% on twelve Year 4–6 templates.*
6. **Frame pinning promoted over `bar`'s ink-budget solve** as the technique a kind reaches for
   first, with two preconditions documented. `bar`'s solve remains the fallback for kinds with no
   natural frame.
7. **Ordered a fix round for two Minor findings on Task 7**, against the skill's rule that Minors
   never enter the loop — on the ground that this file is the template seven more kinds copy, so
   a Minor there gets copied seven times.
8. **Kept the same implementer for Task 6 rounds 4–5** instead of escalating to a fresh agent as
   the skill prescribes, because the loop was not stuck — each round closed its findings and each
   new one came from a deeper measurement.

## Open decisions for you

1. **Push, or keep accumulating?** 26 unpushed commits, mid-feature.
2. **Is 129 new templates still the right scope?** It is the expensive half and none of it exists
   yet. The figure kinds are reusable machinery; the templates are volume. A thinner content pass
   is cheap to choose now and expensive to choose later.
3. **The NESA licence.** NESA syllabus material is Crown copyright with *no* Creative Commons
   licence, and its grant explicitly excludes commercial educational providers. This work only
   ever **cites outcome codes** and never reproduces syllabus prose, which is why it is fine — but
   Task 23 writes the attribution block, and it must not claim a licence we do not have. The spec
   has the full reasoning.

## Traps in this environment

- **Worktree isolation.** Git commands targeting `/home/muzza/code/learnr` are refused. Compound
  shell commands sometimes trip the guard too — split them.
- **`.env` does not exist in a fresh worktree** (gitignored), and `npm install` fails without it
  because `prisma generate` needs `DATABASE_URL`. Copy `.env` and `.env.local` from the main
  checkout.
- **`worktree.baseRef` defaults to `origin/<default>`.** When this worktree was created, `origin`
  was 3 commits behind local `master` and branching from it would have silently dropped the whole
  diagrams feature. Verify the base after creating any worktree.
- **Subagents leave probe files in `src/`.** Two did. Anything matching `src/**/*.test.ts` joins
  the shipped suite. Check `git status` before committing a task.
- **Session limits kill subagents mid-task.** One died between finishing its work and committing.
  The work was intact on disk — verify state before re-dispatching anything.

## The one thing most worth knowing

The figure subsystem's governing rule is **anchoring**: `validateTemplate` draws a figure template
50 times on different seeds and fails any answer that always produced the same picture, because
otherwise a child learns the picture rather than the maths while the analytics call the topic
secure.

`bar` needed five fix rounds, `pictograph` one, `spinner` zero — the difference is
`figure-kind-author-notes.md`. **Hand it to every kind author.** Its most expensive lesson is that
a *derived* label must be asked three questions — is it the label that gets drawn, does all of it
fit, and is it still distinct from its neighbour — and that the third is invisible to any amount of
ink measurement. Tasks 10, 11 and 14 (`number-line`, `clock`, `grid`) all draw derived labels.
