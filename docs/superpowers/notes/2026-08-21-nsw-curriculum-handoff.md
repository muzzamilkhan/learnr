# NSW curriculum + figure kinds — session handoff

**Point a new session at this file.** It supersedes the earlier version of this document, which
described state from twelve tasks ago. The work is about **three-quarters done**.

You are already in the right place: worktree `/home/muzza/code/learnr/.claude/worktrees/nsw-curriculum`,
branch `worktree-nsw-curriculum`. Stay on it. Do not `cd` to the main checkout — this session is
worktree-isolated and git commands aimed at the shared checkout are refused by the harness.

## What this work is

Cross-reference LearnR's maths content to the **NSW Mathematics K–10 Syllabus (2022)** alongside
its existing ACARA citations, and fill the Measurement-and-space and Statistics-and-probability
gaps that doing so exposes — with nine new figure kinds and 129 new question templates.

- **Spec:** `docs/superpowers/specs/2026-08-20-nsw-curriculum-design.md`
- **Plan:** `docs/superpowers/plans/2026-08-20-nsw-curriculum-plan.md` (26 tasks)
- **Figure-kind contract:** `docs/superpowers/notes/figure-kind-author-notes.md` ← for anyone writing a *kind*
- **Content-authoring contract:** `docs/superpowers/notes/figure-content-notes.md` ← **for anyone writing *questions*. This is the single most important file in the remaining work.**
- **NSW outcome codes:** `docs/superpowers/notes/nsw-outcome-codes.md` (all four stages, already assembled — do not fetch from the web)

## State

| | |
| --- | --- |
| Commits ahead of `master` | 67 |
| Pushed | **Yes** — tracks `origin/worktree-nsw-curriculum`, everything pushed |
| Tests | **887 passing / 47 files** (baseline was 551; 669 when the last handoff was written) |
| Templates | **291** — K 41 · Y1 48 · Y2 52 · Y3 52 · **Y4 34 · Y5 33 · Y6 31** |
| Figure kinds | **11 of 11 — Phase 2 is complete** |
| Tasks complete | **20 of 26** |

Nothing has merged to `master`. `master` moves during these sessions — rebase at a clean boundary
before merging.

### Done

Tasks 1–8, 25, 26 (before the last handoff), then **9–14** (the six remaining figure kinds) and
**15–18** (content for K, Year 1, Year 2, Year 3).

The eleven kinds: `polygon`, `angle` (pre-existing) + `bar`, `pictograph`, `spinner`, `solid`,
`number-line`, `clock`, `array`, `fraction-shape`, `grid`.

**Year 3's Space gap is closed** — it now cites both of ACARA v9's Year 3 Space content
descriptions, where before it had none. That gap is a large part of why this work exists.

### Not done

- **Task 19 — Year 4**, 21 new templates. Carries an inherited problem: `maths.4.data.many-to-one`
  (`4.ts:557`) has `AC9M4ST01` alone and needs an `MA2-` code — and by Year 3's ruling the honest
  answer is **ACARA-only**. The rule is written in `figure-content-notes.md`; do not re-derive it.
- **Task 20 — Year 5**, 20 new templates. **This is the second Space hole** — Year 5 is the other
  year that carried no Space content at all. Adds the `shapes` topic.
- **Task 21 — Year 6**, 18 new, **plus the integers exception** (the plan has the exact test to
  add), **plus the symmetric ACARA-only assertion**, which only becomes writable once every year
  has NSW codes. Two ids are already known to belong in it: `maths.2.position.grid-square` and its
  sibling `grid-square-claim`.
- **Task 22** — enforce the citation rules over all shipped content.
- **Task 23** — rewrite `/curriculum` for two sources. It must render divergence in **both**
  directions (see Rulings 8–12) and must not claim a NESA licence this work does not have.
- **Task 24** — update `CLAUDE.md`. Confirmed stale: §"Question diagrams" still says "the two kinds
  are `polygon` and `angle`" and lists grids among the deferred kinds.
- **Final whole-branch review**, then `superpowers:finishing-a-development-branch`.

## How to resume

Use the **`superpowers:subagent-driven-development`** skill. One implementer subagent per task, a
task review after each, a scoped re-review after each fix round, fix rounds capped at five.

- **Ledger:** `.superpowers/sdd/2026-08-20-nsw-curriculum-plan/progress.md` — 2,265 lines,
  **41 recorded rulings**, gitignored. Tasks with a `Task <N>: complete` line are done.
- **Task briefs:** `scripts/task-brief <plan> <N>` works for Tasks 1–14 and 22–26. **It fails on
  Tasks 15–21**, because Phase 3 tasks are checklist bullets rather than headings — write those
  briefs by hand, combining the Phase 3 preamble with the year's row of the table. `task-15-brief.md`
  through `task-18-brief.md` are the pattern.
- **Review packages:** `scripts/review-package <plan> <BASE> <HEAD>`. Use the BASE recorded before
  dispatching, never `HEAD~1`.

**Models used:** opus for content implementers and task reviewers, sonnet for scoped re-reviews.
Content tasks are closing in one or two fix rounds at that split.

## The single most valuable thing to know

**`docs/superpowers/notes/figure-content-notes.md` is the lever on everything that remains**, and
it is **controller-written and has never been reviewed**. It has been **corrected twelve times** —
every correction found by an implementer writing against it, and four of them were confidently
wrong statements of mine. Two more were caught by a reviewer *after* they had been committed.

Put it in every review package. Hand it to every content implementer. Tell them plainly that it is
accurate as far as anyone has tested it, not as far as it is true — and that reporting an error in
it is worth more than working around one. That instruction is what produced most of its content.

The second most valuable thing: **every leak in this phase was found by measurement, never by
validation.** Both enforced leak checks stand down where these questions live — the rank check
stands down when any option is wordy, the closed-set check above eight distinct answers. Every
year so far shipped at least one question answerable without looking at the picture, at 84%, 74%,
62.5% and 100%. **Require measured numbers, not assurances.**

## Rulings I made on your behalf

Each is reversible. The ledger has all 41 with their full reasoning and cost-if-wrong; these are
the ones that shaped the work.

1. **Report-scale legibility governs every figure kind.** A figure is built once and serves both
   the play screen and a 64px report row, so the smaller surface decides. This cost real content:
   no to-the-minute clock reading, a 4×4 coordinate plane, arrays capped at 7×7. *If wrong: several
   limits loosen and some report thumbnails become unreadable.*
2. **A clock's minute must be a multiple of 5**, so `clock` cannot draw "read the time to the
   minute". Covers all of K–Stage 1 and most of Stage 2. *The lever is one constant.*
3. **`array` got a bespoke no-lever refusal rule** (a fully pinned array is refused, on the
   precedent that a regular polygon may not pin its rotation). **`grid` later proved this
   unnecessary** — with no cell-aspect wobble, the generic anchoring check refuses a pinned grid
   for free. **Carried to the final review as a simplification candidate.**
4. **`answerIssues` became an optional fifth member of `FigureKindModule`**, for kinds whose jitter
   changes the *answer* rather than the picture. Declared by `array` and `grid`.
5. **Cross-file fixes: refused twice, allowed twice.** Refused for `bar`'s `formatStep` overflow
   (deferred to the final review) and for another kind's logic. Allowed for a shared-constant
   extraction into `labels.ts`, and for a one-expression fix to a Year 1 leak measured at 62.5% —
   on the ground that knowingly shipping it while four more years got written was worse.
6. **New templates are filed with their topic siblings**, not appended as a pictures block.
7. **The "dot plot" wording sweep stops at author-facing text** — `bar-kind.ts` and `labels.ts`
   fixed; three test titles and two closed years' comments left, all recorded.
8. **Year K clocks cite NSW alone.** NSW places hour time at Early Stage 1; ACARA places dial
   reading at Year 2. The mirror of the Year 6 integers case.
9. **Year 1 clocks cite NSW alone too — and my scope note claiming otherwise was wrong.** I
   asserted Year 1 had an honest ACARA code without checking. The repo's own evidence settled it:
   every existing `AC9M1M03` citation is duration or unit conversion, never dial reading.
10. **Year 1's two fraction templates cite NSW alone** — ACARA's first fraction code is a year later.
11. **Year 2's two grid-reference templates cite ACARA alone** — NSW files grid maps at Stage 2,
    which is Years 3–4. **This was my error too**: I told the implementer Year 2 was where grid
    references "become honest", conflating Stage 2 with Year 2.
12. **A many-to-one pictograph below Stage 3 is ACARA-only or `key: '1'`** — with Year 2's
    `picture-key-two` as the one earned exception, which makes its argument out loud.
13. **A figure question's options go on the buttons, not in the prompt.** Dropping the offer moves
    them to narration from the buttons, so a pre-literate child hears the same words and the prompt
    above the picture halves. Applied at Year 3; **Years 1 and 2 deliberately not retro-fitted.**
14. **A year may restate a neighbour's question** when the citation is what makes it different,
    provided it says so at the copy. `maths.3.position.grid-reference` is the declared instance.

## Mistakes of mine worth knowing about

Not for contrition — because the same shapes will recur.

- **I conflated NSW "Stage 2" with "Year 2" twice in one dispatch.** Stage 1 is Years 1–2, Stage 2
  is Years 3–4, Stage 3 is Years 5–6. An implementer caught both by reading the brief rather than
  obeying it. **Tell them the mapping wins over anything you write.**
- **I passed an implementer's *argument* through to my human partner as settled** without a
  reviewer seeing it, and it was unsound. Numbers I was careful about; reasoning I was not. An
  argument is a claim like any other — put it in the review package.
- **I wrote two eyeballed numbers into the paragraph of the notes file that argues for measuring
  rather than eyeballing.** Both off by one. Measure before writing a number down, including in
  prose.
- **I contradicted myself inside a single ruling** — telling an implementer to add an exception
  list and then saying no action was needed. Retracted within the minute; it had independently
  reached the same conclusion. Re-read a ruling before sending it.

## Traps in this environment

- **Worktree isolation.** Git commands targeting `/home/muzza/code/learnr` are refused. Compound
  shell commands sometimes trip the guard too — and so do heredocs containing braces and quotes.
  Write those to a scratchpad file and `cat` them in.
- **Session limits kill subagents mid-task, and this happened.** **Check the working tree before
  re-dispatching anything.** One implementer died between finishing its edits and committing; all
  the work was intact on disk and green, and resuming it to finish cost minutes where a fresh
  dispatch would have redone a whole task.
- **`.env` does not exist in a fresh worktree** (gitignored) and `npm install` fails without it,
  because `prisma generate` needs `DATABASE_URL`. Copy `.env` and `.env.local` from the main
  checkout.
- **Subagents leave probe files in `src/`.** Anything matching `src/**/*.test.ts` joins the shipped
  suite. Check `git status` before committing a task.
- **The ledger is gitignored scratch** and a `git clean -fdx` destroys it. What is worth keeping has
  been promoted into `docs/superpowers/notes/`; the rest is recoverable from `git log`.

## The one thing most worth knowing about the subsystem

The figure subsystem's governing rule is **anchoring**: `validateTemplate` draws a figure template
50 times on different seeds and fails any answer that always produced the same picture, because
otherwise a child learns the picture rather than the maths while the analytics call the topic
secure.

**It compares figures as serialised strings**, which is the whole reason the hard bugs are hard: a
lever the JSON can see and a child cannot passes the check while anchoring. That defect shipped
three times under three different disguises — `solid`'s mirror on a symmetric shape,
`fraction-shape` iterating a `Set` in insertion order, and an array's ±10% cell wobble. **Measure a
visible spread; never count distinct JSON strings.**
