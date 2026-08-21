# NSW curriculum + figure kinds — session handoff

**Point a new session at this file.** It supersedes the earlier version. **All seven content tasks
are done.** What remains is the page, the enforcement, the docs and the final review.

You are already in the right place: worktree `/home/muzza/code/learnr/.claude/worktrees/nsw-curriculum`,
branch `worktree-nsw-curriculum`. Stay on it. Do not `cd` to the main checkout.

## What this work is

Cross-reference LearnR's maths content to the **NSW Mathematics K–10 Syllabus (2022)** alongside its
existing ACARA citations, and fill the Measurement-and-space and Statistics-and-probability gaps
that doing so exposes.

- **Spec:** `docs/superpowers/specs/2026-08-20-nsw-curriculum-design.md`
- **Plan:** `docs/superpowers/plans/2026-08-20-nsw-curriculum-plan.md` (26 tasks)
- **Figure-kind contract:** `docs/superpowers/notes/figure-kind-author-notes.md`
- **Content-authoring contract:** `docs/superpowers/notes/figure-content-notes.md` — **corrected 21 times, still never reviewed as a whole.** Put it in every review package.
- **NSW outcome codes:** `docs/superpowers/notes/nsw-outcome-codes.md` (all four stages, assembled — do not fetch from the web)

## State

| | |
| --- | --- |
| Templates | **350 — the target exactly** (K 41 · Y1 48 · Y2 52 · Y3 52 · Y4 55 · Y5 53 · Y6 49) |
| Tests | **891 / 47 files** (baseline 551) |
| Figure kinds | 11 of 11 |
| Tasks complete | **23 of 26** (1–21, 25, 26) |
| Pushed | **No — the last few tasks are unpushed.** Check `git status -sb`. |

**Nothing has merged to `master`, and `master` moves during these sessions — rebase at a clean
boundary before merging.**

### Do this first: Task 21's re-review

Task 21's review was **APPROVED, spec compliant, no Critical and no Important findings**. A fix
round was ordered anyway for two items and **it landed at `8d2e823`** (891 tests green, typecheck
and lint clean). It has **not been re-reviewed**, so the very first action of the next session is:

```
scripts/review-package docs/superpowers/plans/2026-08-20-nsw-curriculum-plan.md dbce8f5 8d2e823
```

then dispatch `re-review-prompt.md` on sonnet. **Task 21 cannot be marked complete until that comes
back.** The two findings to verdict were: three comments reproducing the codes file's gloss column
(`6.ts:864`, `catalog.test.ts:203` and `:211` — two of the three were the controller's own wording
from the brief), and a gap in the notes' held-out prescription (see **The 17.2%** below).

Two things the fix round surfaced that belong to the **final review**, not to Task 21:

- **A fourth gloss survivor in another year's file**, correctly left alone as out of scope:
  `5.ts:772` carries "two-dimensional outcomes are classifying triangles and quadrilaterals". Same
  one-line fix as the three that were made.
- **One borderline phrase kept deliberately**: `6.ts`'s "MA3-DATA-01 is the many-to-one outcome".
  It is `figure-content-notes.md`'s own wording and Year 5's, the many-to-one carve-out argument is
  unstateable without it, and changing it in Year 6 alone would put three files out of step. That
  is a three-file decision, not a one-task fix.

### Not done

- **Task 22** — enforce the citation rules over all shipped content. The plan has the three tests
  verbatim. **A Task 21 finding belongs here**: neither new citation test checks that a cited NSW
  code is a code that *exists* — `syllabusOf`'s pattern would accept a typo'd `MA3-RFQ-01`. A
  membership check against `nsw-outcome-codes.md` is the stronger version and this is its home.
- **Task 23** — rewrite `/curriculum` for two sources. Must render divergence in **both**
  directions and must not claim a NESA licence this work does not have.
- **Task 24** — update `CLAUDE.md`. Confirmed stale: §"Question diagrams" still says "the two kinds
  are `polygon` and `angle`" and lists grids among the deferred kinds. **Use 350, not the plan's
  329** — see the plan defect below.
- **Final whole-branch review** (most capable model, `requesting-code-review/code-reviewer.md`),
  then `superpowers:finishing-a-development-branch`.

## How to resume

`superpowers:subagent-driven-development`. One implementer per task, a task review after each, a
scoped re-review after each fix round, capped at five.

- **Ledger:** `.superpowers/sdd/2026-08-20-nsw-curriculum-plan/progress.md` — gitignored, and now
  the record of ~60 rulings. Tasks with a `Task <N>: complete` line are done.
- **Task briefs:** `scripts/task-brief <plan> <N>` **works for Tasks 22–26.** (It fails on 15–21,
  which were written by hand; those are all done.)
- **Review packages:** `scripts/review-package <plan> <BASE> <HEAD>`. Use the BASE recorded before
  dispatching, never `HEAD~1`.
- **Models:** opus for implementers and task reviewers, sonnet for scoped re-reviews. Content tasks
  closed in one or two fix rounds at that split.

## A plan defect, already ruled on

**The plan's verification checklist says "expect 329" templates. The number is 350** — 221 shipped
plus the 129 Phase 3 adds — and the catalogue now measures exactly 350. Do not carry 329 into
Task 24, where it would enter `CLAUDE.md` and outlive the branch.

## What the last four tasks established, and what it cost to learn

**Every leak in this phase was found by measurement, never by validation** — eight of them now,
across all seven years, at 84%, 74%, 62.5%, 100%, 100%, 23.3%, 34.1% and 36.6%. Both enforced leak
checks stand down exactly where these questions live: the rank check requires every option numeric,
and the closed-set check stands down above eight distinct answers. **Require measured numbers, not
assurances**, and expect the measure itself to be wrong before the content is.

**The measure in force is the held-out split**, and it replaced the in-sample statistic because of a
measurement rather than an opinion: one template's in-sample score fell **69.0% → 54.4% purely by
drawing 10,000 times instead of 4,000.** A statistic that moves with the sample size is measuring
the sample. Key on (prompt × sorted option set), learn each key's modal answer on half the draws,
score on the other half, ≥10,000 a half, and report the blind baseline and answers-per-key beside it.

**The 17.2%.** A held-out score can read *below* its blind baseline without any leak, and Year 6's
clock is the sharpest case on the branch: 5,931 keys over 10,000 draws means only ~69% of scored
draws have a key the learn half saw, and an unseen key scores zero, so `0.68 × 25% ≈ 17.2%` is what
a **leak-free** template with that sparsity must read. Both rows measured in one run, pre-fix
template rebuilt inside the same probe: derived-from-the-roll **34.1% held-out / 67.7% coverage /
50.4% seen-keys**, drawn-either-side **17.2% / 68.0% / 25.3%** against a 25% floor. **The deflation
had been understating a real leak** — the pre-fix template was not 34% beatable, it was 50%
beatable. **The held-out split loses power as keys approach draws**: report the coverage and the
seen-keys figure, and never read a deflated score against the blind baseline as a safety margin.

**Two facts about the anchoring check that change how you size an answer set.** Its 50 draws are
shared across *all* answers, not per answer, so it gets **stricter as answers multiply**. And it is
**deterministic per template id**, so a measured refusal rate across ids (4 answers 0/300, 6 answers
0.7–2.3%, 9 answers ~10%) is a risk paid once by the author at authoring time and never by a child.
Six answers is affordable; nine is not. This dissolved a caution that had cost real content.

## Rulings from this session

Each is reversible; the ledger has the rest with full reasoning and cost-if-wrong.

1. **The plan's 329 is a slip for 350.** Confirmed by counting the shipped files.
2. **The spec overstates Year 5's Space hole.** It and the handoff said Years 3 and 5 cite "no Space
   content at all"; Year 5 already carried `AC9M5SP03` on two templates. What it genuinely lacked
   was the rest of Space and *all* of Statistics and probability. Both holes are now closed.
3. **`maths.4.data.many-to-one` stays ACARA-only**, and `maths.4.data.picture-key` joined it.
4. **Year 4's commit subject stands as the plan wrote it** though both its grids mark a cell rather
   than a plane intersection; the commit body corrects the reading.
5. **The `number-line-kind.ts` epsilon fix into `src/lib` was authorised** — but only after the
   reviewer confirmed it independently and to the number (54 of 100 tenth-wide windows). Every
   cross-file fix allowed on this branch was measured first; two were refused for not being.
6. **`position.coordinates` widened to six answers**, because the refusal that had narrowed it was a
   budget artefact and the risk is paid at authoring time.
7. **The symmetric assertion is set equality**, not a second named-ids test, so an *accidental*
   ACARA-only template is caught as well as a deliberate one. It mutation-tested clean.
8. **`maths.1.number-patterns.repeating-unit` is a justified tenth member** of the ACARA-only set —
   closing a concern Task 16 left open. The set is 3 Year 6 integers + 2 Year 2 grid + 2 Year 4 data
   + 2 Year 5 symmetry + this one.
9. **Two Minors were pulled into a fix round rather than deferred**, against the skill's default,
   because they were self-contradicting *numbers* in the notes file the next implementer reads.
10. **Task 21 got a fix round despite an APPROVED verdict**, for the gloss comments — the one rule
    whose breach is a licensing problem rather than a bug.

## Mistakes of mine worth knowing about

- **My notes file was wrong seven more times this session** (fourteen → twenty-one), and one was in
  the paragraph that argues for measuring. The most instructive was *pessimistic* rather than
  optimistic: the `bar` category-name table refused four weekday names that draw perfectly well.
  **A guidance file that is too cautious costs content silently**, which is the harder error to see.
- **I twice gave a "smallest fix" that would have shipped a different defect.** Dropping only the
  square pyramid from `square-face` would have left the question 1/3 true where its own comment
  claims 50/50; the implementer widened the pick and was right.
- **Two of the three gloss comments Task 21 was pulled up for were my own wording**, handed over in
  the brief. My errors propagate through implementers who are trusting the brief.

## Traps in this environment

- **Worktree isolation.** Git commands targeting `/home/muzza/code/learnr` are refused, and compound
  shell commands and heredocs with braces or quotes trip the guard too. Write to a scratchpad file
  and `cat` it in, or use the Write tool.
- **Session limits kill subagents mid-task.** **Check the working tree before re-dispatching.**
- **`.env` does not exist in a fresh worktree** and `npm install` fails without it. Copy `.env` and
  `.env.local` from the main checkout.
- **Subagents leave probe files in `src/`.** Anything matching `src/**/*.test.ts` joins the shipped
  suite. Check `git status` before committing.
- **The ledger is gitignored scratch** and `git clean -fdx` destroys it.
