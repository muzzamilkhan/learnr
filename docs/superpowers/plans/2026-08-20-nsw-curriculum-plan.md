# NSW curriculum + nine figure kinds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cross-reference LearnR's maths content to the NSW Mathematics K–10 Syllabus (2022), and fill the Measurement-and-space and Statistics-and-probability gaps that doing so exposes, with nine new figure kinds and 129 new templates.

**Architecture:** NSW outcome codes join ACARA codes as a second family in a template's `tags`; stage is derived from level, never stored. The nine deferred figure kinds become self-contained modules behind a registry, so each is one new file plus one registry entry. `src/content/maths.ts` splits by year so content work parallelises.

**Tech Stack:** TypeScript, Next.js App Router, vitest (node environment — no component tests), Prisma. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-nsw-curriculum-design.md`

## Global Constraints

- **Never reproduce NESA syllabus text.** Outcome codes (`MA2-MR-01`) and focus area names (`Multiplicative relations`) only. NESA material is Crown copyright with no Creative Commons licence. An outcome *statement* must not appear in this repo or on any page. ACARA text stays quotable — it is CC BY 4.0.
- **No Part A / Part B tags.** NESA: "Part A does not equate to Year 3 only."
- **No topic renames.** `topic` is stored on `Attempt` and `TopicSkill`; renaming orphans history.
- **All logic in `src/lib` stays pure** — no React, network, clock, database. `now` and `Rng` are always injected.
- **Answer-type rules are unchanged**: no `text` answer below Year 4; no typed answer the number pad cannot enter (digits and one decimal point, no minus key); at most 4 choices.
- **The anchoring rule holds for every new kind**: a figure is built from the bound scope and the injected `Rng`, varies by default, and `validateTemplate` fails any answer that always produced the same picture.
- **No multiple-choice question may be answerable without engaging with it.** Two ways it happens, both found in shipped content (see Tasks 25 and 26):
  - **Rank leak** — sort the options numerically and the answer's rank is the same every draw, so "never the biggest, never the smallest" beats the question. Caused by distractors built as scalings of the answer (`n/10`, `n/1000`, `n`), which always sort into a fixed order.
  - **Option-set leak** — the answer is always drawn from a distinguishable subset of the option space, so the option set announces it. Worse under narration, which reads word options aloud: a pre-literate child hears three colours and applies the rule without reading the question.

  Where a fixed rank is legitimate *because finding the extreme is the question* ("Which is largest?"), declare it with `rankIsTheQuestion: true`. Where the answer's option set is disjoint from the distractors' *because telling that property apart is the question* ("which of these is even?" — no odd number could ever be the answer), declare it with `propertyIsTheQuestion: true`. The two are separate and each suppresses only its own check. Declaring is the exception, exactly as pinning a figure's `rotation` is — because forgetting is the failure mode and a leaking question looks perfectly correct.

- **Reach every rank you can.** The check refuses only a *constant* rank, which is a weaker property than "the rank carries no information". The twelve templates reworked in Task 26 land on exactly two of four ranks, so "never the biggest, never the smallest" still lifts a guess from 25% to ~50% — accepted there, because a place-value ladder brackets the answer by construction and unbracketing it costs a diagnostic distractor (see the ledger's Task 26 ruling). **New templates are under no such constraint and must not inherit it.** Author option sets where the answer can land at any rank. An inherently bracketing ladder is fine; confinement you manufactured is not.
- **Template ids are `subject.level.topic.variant`**, lowercase kebab variant.
- Every template cites at least one syllabus code. NSW codes must match their level's stage.
- Run `npm test` and `npm run typecheck` before every commit.

## Stage mapping (used throughout)

| Stage | Code prefix | Levels |
| --- | --- | --- |
| Early Stage 1 | `MAE-` | `K` |
| Stage 1 | `MA1-` | `1`, `2` |
| Stage 2 | `MA2-` | `3`, `4` |
| Stage 3 | `MA3-` | `5`, `6` |

## Phases and parallelism

- **Phase 1 (Tasks 1–5)** — foundation. Strictly sequential. Everything depends on it.
- **Phase 2 (Tasks 6–14)** — the nine figure kinds. Parallel-safe once Task 3 lands: each task creates one module and appends one registry entry.
- **Phase 3 (Tasks 15–21)** — content, one task per school year. Parallel-safe once Tasks 5 and 14 land: each task owns one file.
- **Phase 4 (Tasks 22–23)** — curriculum page and final verification. Sequential, last.

---

## Phase 1 — Foundation

### Task 1: Derive stage from level

**Files:**
- Modify: `src/lib/curriculum.ts`
- Test: `src/lib/curriculum.test.ts`

**Interfaces:**
- Consumes: `YearLevel`, `parseYearLevel` (already in `src/lib/curriculum.ts`)
- Produces:
  ```ts
  export const STAGES: readonly ['ES1', 'S1', 'S2', 'S3'];
  export type Stage = (typeof STAGES)[number];
  export function stageForLevel(level: YearLevel): Stage;
  export function stageLabel(stage: Stage): string;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/curriculum.test.ts`:

```ts
import { STAGES, stageForLevel, stageLabel } from './curriculum';

describe('stageForLevel', () => {
  // NSW stages span two school years. The mapping is total, which is why a
  // stage is derived here rather than stored on a template where it could
  // drift from the level beside it.
  it('maps every school year onto its NSW stage', () => {
    expect(stageForLevel('K')).toBe('ES1');
    expect(stageForLevel('1')).toBe('S1');
    expect(stageForLevel('2')).toBe('S1');
    expect(stageForLevel('3')).toBe('S2');
    expect(stageForLevel('4')).toBe('S2');
    expect(stageForLevel('5')).toBe('S3');
    expect(stageForLevel('6')).toBe('S3');
  });

  it('covers every level with a stage', () => {
    for (const level of ['K', '1', '2', '3', '4', '5', '6'] as const) {
      expect(STAGES).toContain(stageForLevel(level));
    }
  });
});

describe('stageLabel', () => {
  it('names each stage the way NSW does', () => {
    expect(stageLabel('ES1')).toBe('Early Stage 1');
    expect(stageLabel('S1')).toBe('Stage 1');
    expect(stageLabel('S2')).toBe('Stage 2');
    expect(stageLabel('S3')).toBe('Stage 3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/curriculum.test.ts`
Expected: FAIL — `stageForLevel is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/curriculum.ts`:

```ts
/**
 * The NSW Mathematics K-10 Syllabus (2022) organises content by stage, where a
 * stage spans two school years. LearnR's level is a single year, so the mapping
 * is total in this direction and lossy in the other - which is why a stage is
 * *derived* here and never stored on a template. A stored stage is a second
 * truth that can disagree with the level sitting beside it, the same objection
 * `TopicSkill` answers by being a cache rather than a second history.
 */
export const STAGES = ['ES1', 'S1', 'S2', 'S3'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_BY_LEVEL: Record<YearLevel, Stage> = {
  K: 'ES1',
  '1': 'S1',
  '2': 'S1',
  '3': 'S2',
  '4': 'S2',
  '5': 'S3',
  '6': 'S3',
};

export function stageForLevel(level: YearLevel): Stage {
  return STAGE_BY_LEVEL[level];
}

const STAGE_LABELS: Record<Stage, string> = {
  ES1: 'Early Stage 1',
  S1: 'Stage 1',
  S2: 'Stage 2',
  S3: 'Stage 3',
};

export function stageLabel(stage: Stage): string {
  return STAGE_LABELS[stage];
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. `STAGE_BY_LEVEL` being a `Record<YearLevel, Stage>` means adding a year to `YearLevel` without giving it a stage is a compile error, which is the point.

- [ ] **Step 5: Commit**

```bash
git add src/lib/curriculum.ts src/lib/curriculum.test.ts
git commit -m "Derive the NSW stage a school year falls in, rather than storing it"
```

---

### Task 2: Teach the catalog a second syllabus source

**Files:**
- Modify: `src/content/catalog.ts`
- Test: `src/content/catalog.test.ts`

**Interfaces:**
- Consumes: `stageForLevel`, `Stage` (Task 1)
- Produces:
  ```ts
  export type SyllabusId = 'acara' | 'nsw';
  export interface Syllabus {
    id: SyllabusId;
    name: string;
    shortName: string;
    url: string;
    pattern: RegExp;
  }
  export const SYLLABUSES: readonly Syllabus[];
  export function syllabusOf(code: string): SyllabusId | null;
  export function nswStageOfCode(code: string): Stage | null;
  // CodeUse gains a `syllabus` field; LevelCodes is unchanged in shape.
  export interface CodeUse {
    code: string;
    syllabus: SyllabusId;
    topics: string[];
    templateCount: number;
  }
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/content/catalog.test.ts`:

```ts
import { SYLLABUSES, syllabusOf, nswStageOfCode } from './catalog';

describe('syllabus sources', () => {
  it('recognises an ACARA content description', () => {
    expect(syllabusOf('AC9M4N02')).toBe('acara');
    expect(syllabusOf('AC9MFN01')).toBe('acara');
  });

  it('recognises an NSW outcome code at every stage', () => {
    expect(syllabusOf('MAE-RWN-01')).toBe('nsw');
    expect(syllabusOf('MA1-CSQ-01')).toBe('nsw');
    expect(syllabusOf('MA2-MR-02')).toBe('nsw');
    expect(syllabusOf('MA3-RQF-01')).toBe('nsw');
    expect(syllabusOf('MAO-WM-01')).toBe('nsw');
  });

  it('is not fooled by a tag that is only a note to ourselves', () => {
    expect(syllabusOf('needs-review')).toBe(null);
    expect(syllabusOf('MA9-XX-01')).toBe(null);
    expect(syllabusOf('AC9E4N02')).toBe(null);
  });

  it('reads the stage an NSW code belongs to', () => {
    expect(nswStageOfCode('MAE-RWN-01')).toBe('ES1');
    expect(nswStageOfCode('MA1-FG-01')).toBe('S1');
    expect(nswStageOfCode('MA2-AR-01')).toBe('S2');
    expect(nswStageOfCode('MA3-GM-03')).toBe('S3');
  });

  // MAO-WM-01 is Working mathematically, which hangs off every outcome at
  // every stage rather than belonging to one. It has no stage to read.
  it('gives the working-mathematically code no stage', () => {
    expect(nswStageOfCode('MAO-WM-01')).toBe(null);
    expect(nswStageOfCode('AC9M4N02')).toBe(null);
  });

  it('names both sources', () => {
    expect(SYLLABUSES.map((s) => s.id)).toEqual(['acara', 'nsw']);
  });
});
```

And replace the existing `curriculumCodes` "counts the templates citing a code" test with one that carries both families:

```ts
it('counts the templates citing a code, from either syllabus', () => {
  const grouped = curriculumCodes('maths', [
    { ...allTemplates[0], level: '3', topic: 'addition', tags: ['AC9M3N01', 'MA2-AR-01'] },
    { ...allTemplates[0], level: '3', topic: 'subtraction', tags: ['AC9M3N01'] },
  ]);

  expect(grouped).toEqual([
    {
      level: '3',
      codes: [
        { code: 'AC9M3N01', syllabus: 'acara', topics: ['addition', 'subtraction'], templateCount: 2 },
        { code: 'MA2-AR-01', syllabus: 'nsw', topics: ['addition'], templateCount: 1 },
      ],
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/catalog.test.ts`
Expected: FAIL — `syllabusOf is not a function`

- [ ] **Step 3: Write minimal implementation**

In `src/content/catalog.ts`, replace the lone `CURRICULUM_CODE` constant with:

```ts
import { compareYearLevels, type Stage, type YearLevel } from '@/lib/curriculum';

export type SyllabusId = 'acara' | 'nsw';

export interface Syllabus {
  id: SyllabusId;
  name: string;
  shortName: string;
  url: string;
  pattern: RegExp;
}

/**
 * The syllabuses a template may cite. Two rather than one because NSW schools
 * teach the NSW syllabus and not ACARA directly, and a NSW parent should be
 * able to find their child's stage on the curriculum page.
 *
 * A code is a *reference*, which matters legally as well as structurally: ACARA
 * material is CC BY 4.0 and quotable, NESA material is Crown copyright and is
 * not. Nothing in this repo stores an outcome statement.
 *
 * `MAO` is Working mathematically, which belongs to every stage at once - it
 * matches as an NSW code and has no stage of its own.
 */
export const SYLLABUSES: readonly Syllabus[] = [
  {
    id: 'acara',
    name: 'Australian Curriculum Version 9.0 — Mathematics (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    pattern: /^AC9M(F|\d{1,2})[A-Z]+\d{2}$/,
  },
  {
    id: 'nsw',
    name: 'NSW Mathematics K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022',
    pattern: /^MA(E|O|[1-3])-[A-Z0-9]+-\d{2}$/,
  },
];

export function syllabusOf(code: string): SyllabusId | null {
  return SYLLABUSES.find((s) => s.pattern.test(code))?.id ?? null;
}

const STAGE_BY_PREFIX: Record<string, Stage> = {
  MAE: 'ES1',
  MA1: 'S1',
  MA2: 'S2',
  MA3: 'S3',
};

/** The stage an NSW outcome code belongs to, or `null` if it names no one stage. */
export function nswStageOfCode(code: string): Stage | null {
  if (syllabusOf(code) !== 'nsw') return null;
  return STAGE_BY_PREFIX[code.slice(0, 3)] ?? null;
}
```

Then update `curriculumCodes` to keep any tag `syllabusOf` recognises, and to stamp each `CodeUse` with its `syllabus`. Sorting stays `.sort()` on the code string, which puts every `AC9M…` before every `MA…` — ACARA first is also the order the page wants.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/catalog.ts src/content/catalog.test.ts
git commit -m "Let a template cite two syllabuses, and say which one a code came from"
```

---

### Task 3: A registry for figure kinds

**Files:**
- Create: `src/lib/figures/registry.ts`
- Modify: `src/lib/figures/build.ts`, `src/lib/figures/types.ts`
- Test: `src/lib/figures/registry.test.ts`

This task adds **no new kind**. It moves `polygon` and `angle` behind a registry so the nine that follow are one file and one entry each, and can be written in parallel without nine agents editing the same switch.

**Interfaces:**
- Produces:
  ```ts
  export interface FigureKindModule<K extends FigureKind> {
    kind: K;
    /** The marks this kind draws, before `fit` normalises the box. */
    build(spec: Extract<FigureSpec, { kind: K }>, scope: Scope, rng: Rng): Mark[];
    /** Authoring mistakes in this kind's own fields. Never throws. */
    issues(spec: Extract<FigureSpec, { kind: K }>, scope: Scope, read: FieldReader): string[];
  }
  export function registerFigureKind(module: FigureKindModule<FigureKind>): void;
  export function figureKindModule(kind: string): FigureKindModule<FigureKind> | undefined;
  ```
  `FieldReader` is the existing field-evaluating helper inside `figureIssues`, extracted and exported so a kind module can report its own field errors in the established wording.

- [ ] **Step 1: Write the failing test**

Create `src/lib/figures/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FIGURE_KINDS } from './types';
import { figureKindModule } from './registry';

describe('the figure kind registry', () => {
  // Every kind the vocabulary names must be buildable. A kind added to
  // FIGURE_KINDS without a module would fall back to a triangle at runtime,
  // which is the silent failure this registry exists to make loud.
  it('has a module for every kind in the vocabulary', () => {
    for (const kind of FIGURE_KINDS) {
      expect(figureKindModule(kind), kind).toBeDefined();
      expect(figureKindModule(kind)!.kind).toBe(kind);
    }
  });

  it('has no module for a kind nobody declared', () => {
    expect(figureKindModule('trapezoidal-prism-net')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/figures/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`

- [ ] **Step 3: Implement the registry and move the two kinds onto it**

- Create `registry.ts` with a module-level `Map<string, FigureKindModule>`, `registerFigureKind` and `figureKindModule`.
- Move `polygonFigure` into `src/lib/figures/polygon-kind.ts` and `angleFigure` into `src/lib/figures/angle-kind.ts`, each registering itself and each taking with it the `figureIssues` branch that validates its own fields.
- `buildFigure` becomes:
  ```ts
  const module = figureKindModule((spec ?? {}).kind);
  return fit(module ? module.build(safe, scope, rng) : polygonModule.build(safe, scope, rng));
  ```
  keeping the documented "unrecognised kind draws an equilateral triangle" fallback exactly as it is.
- `figureIssues` keeps its own guards for "not an object" and "not a figure kind", then delegates to `module.issues`.
- Export `FieldReader` and the field-evaluating helper from `build.ts` so kind modules share the existing error wording.

**Do not change any observable behaviour.** The existing `build.test.ts`, `polygon.test.ts`, `angle.test.ts` and `validate.test.ts` must pass untouched — that is this task's real test.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS, all 551+ existing tests green with no edits to them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/figures/
git commit -m "Put the two figure kinds behind a registry, so the next nine are a file each"
```

---

### Task 4: Make labels scale with the diagram

**Files:**
- Modify: `src/components/diagram.tsx`

`diagram.tsx` already renders `kind: 'label'` and carries a note that nothing emits one yet, and that "whoever adds the first label-emitting figure kind should give `LABEL_SIZE` the same treatment" as the stroke widths. `bar`, `number-line` and `grid` all emit labels, so this is that treatment.

- [ ] **Step 1: Read the existing treatment**

Read `src/components/diagram.tsx` around `LABEL_SIZE` and the stroke-width handling, and follow whatever the strokes already do to stay constant across the play screen's large box and the parent report's small one.

- [ ] **Step 2: Apply the same scaling to `LABEL_SIZE`**

A label must be legible at the report's size and not overpowering at the play screen's. Replace the flat constant with the same scale-aware computation the strokes use, and replace the note with a comment saying what it now does.

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test && npm run typecheck`
There are no component tests (vitest is node-only), so also run `npm run build` to catch a JSX or type error.

- [ ] **Step 4: Commit**

```bash
git add src/components/diagram.tsx
git commit -m "Size a figure's labels the way its strokes are sized, now something draws them"
```

---

### Task 5: Split the content by year

**Files:**
- Create: `src/content/maths/k.ts`, `1.ts`, `2.ts`, `3.ts`, `4.ts`, `5.ts`, `6.ts`, `index.ts`
- Delete: `src/content/maths.ts`
- Modify: `src/content/catalog.ts` (import path only)

`maths.ts` is 3532 lines and this plan adds 129 templates to it. Splitting by year is the decomposition that lets Phase 3 run seven ways in parallel, and it is worth doing on its own terms at that size.

- [ ] **Step 1: Move each year's templates into its own file**

Each file exports one array, e.g.:

```ts
// src/content/maths/4.ts
import type { QuestionTemplate } from '@/lib/templates/types';

/** Year 4 — NSW Stage 2 (Part A or B is the teacher's call, not the content's). */
export const year4: QuestionTemplate[] = [ /* … */ ];
```

`index.ts` concatenates in school order:

```ts
import { yearK } from './k';
import { year1 } from './1';
// …
export const mathsTemplates: QuestionTemplate[] = [
  ...yearK, ...year1, ...year2, ...year3, ...year4, ...year5, ...year6,
];
```

- [ ] **Step 2: Point the catalog at the new module**

`src/content/catalog.ts`: `import { mathsTemplates } from './maths';` resolves to `./maths/index.ts` unchanged. Confirm no other file imports `@/content/maths` directly; if one does, it keeps working through the index.

- [ ] **Step 3: Verify the split changed nothing**

Run: `npm test && npm run typecheck`
Expected: PASS with no test edits. `catalog.test.ts` asserts 200 templates' worth of invariants and is the proof the move was faithful.

Also confirm the count is unchanged:
```bash
grep -c "id: 'maths" src/content/maths/*.ts | awk -F: '{s+=$2} END {print s}'   # expect 200
```

- [ ] **Step 4: Commit**

```bash
git add -A src/content/
git commit -m "Give each school year its own content file, before adding half again as many questions"
```

---

## Phase 2 — The nine figure kinds

**Parallel-safe.** Each task: one new module file, one new `FigureSpec` union member, one entry appended to `FIGURE_KINDS`, one line appended to the registry's list in `registry.ts`, one test file. Collisions are confined to one-line additions.

**A kind module has four members** (Task 3 defines them; read `task-3-report.md`
for the verbatim signatures): `kind`, `build`, `issues`, and `fields`. `fields`
declares the kind's authored parameters and which are required, and it is what
`src/lib/templates/validate.ts` reads to check each parameter is a well-formed
expression over the bound scope. Declaring a parameter in the `FigureSpec` union
but omitting it from `fields` means it is never validated — so add every
parameter to both.

Every task in this phase follows the same shape, and every task must satisfy these, which are **not** repeated per task:

- The kind's module lives at `src/lib/figures/<kind>-kind.ts` and registers itself via `registerFigureKind`.
- Its tests live at `src/lib/figures/<kind>-kind.test.ts` and cover: the geometry it pins, that each jittered parameter actually varies across seeds, and that `issues` reports each of its own fields being absent, unevaluable or the wrong type.
- Every parameter is an `Expr` evaluated against the bound scope. **Omitting an optional parameter asks for jitter; supplying one pins it.**
- The builder returns `Mark[]` in the maths frame (y up); `fit` turns it over.
- **The anchoring rule**: for every answer the kind can accompany, two different seeds must be able to produce two different pictures. `validateTemplate` enforces this over shipped content, but the kind's own test should assert it directly.
- Coordinates are rounded by `fit`; do not round in the module.

### Task 6: `bar` — column, dot and line graphs

**Spec member:**
```ts
| {
    kind: 'bar';
    /** The values, as a pick or a comma-joined expression, e.g. "'3,7,5,2'". */
    values: Expr;
    /** Category labels, comma-joined. Omitted, categories go unlabelled. */
    labels?: Expr;
    /** 'column' | 'dot' | 'line'. Omitted, jitters between column and dot. */
    style?: Expr;
    /** Units per axis step. Omitted, jitters over 1, 2, 5 and 10 as the values allow. */
    scale?: Expr;
  }
```

`column` and `dot` are both categorical and read alike, which is why omitting `style` may choose between them. `line` is pinned deliberately — a line graph is a continuous reading, not a drawing choice — and is what Stage 3 Data B needs.

Emits: a `path` per bar (or a `dot` per point, or one open `path` for a line), one `label` per category when `labels` is given, one `label` per axis step, and two `path` marks for the axes.

- [ ] Write `bar-kind.test.ts` covering: bar heights proportional to values; `style: 'line'` emits exactly one open path through all points; omitted `style` produces both a column and a dot rendering across seeds; the axis is labelled at every step; `values` absent is an issue.
- [ ] Run it, watch it fail.
- [ ] Implement `bar-kind.ts`, register it, add `'bar'` to `FIGURE_KINDS` and the union member to `FigureSpec`.
- [ ] Run `npm test && npm run typecheck`.
- [ ] Commit: `Draw a bar, dot and line graph, so a question can be read off a graph`

### Task 7: `pictograph`

**Spec member:**
```ts
| {
    kind: 'pictograph';
    /** Counts of the icon per row, comma-joined. */
    counts: Expr;
    labels?: Expr;
    /** How many things one icon stands for. Omitted, jitters over 1, 2, 5, 10. */
    key?: Expr;
    /** Allow a half icon for a remainder. Omitted, false. */
    halves?: Expr;
  }
```

Emits one small closed `path` per icon, a `label` per row, and a `label` stating the key.

- [ ] Test: icon count equals `ceil(count / key)`; `halves: 'true'` draws a half-width icon for a remainder and `halves` absent never does; the key label matches `key`; the key varies across seeds when omitted.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a picture graph, and let one icon stand for more than one thing`

### Task 8: `spinner`

**Spec member:**
```ts
| {
    kind: 'spinner';
    /** Sector sizes as parts of the whole, comma-joined, e.g. "'1,1,2'". */
    sectors: Expr;
    /** Fill pattern per sector, comma-joined names. Omitted, sectors alternate. */
    fills?: Expr;
    rotation?: Expr;
  }
```

Emits a circle as a closed `path` of sampled points, one `path` per sector boundary, and a `dot` at the centre.

- [ ] Test: sector angles are proportional to `sectors` and sum to 360; rotation jitters across seeds; equal sectors produce equal angles (the "is it fair?" question depends on it); `sectors` absent is an issue.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a spinner, so a chance question can be looked at rather than described`

### Task 9: `solid` — 3D objects and their nets

**Spec member:**
```ts
| {
    kind: 'solid';
    /** 'cube' | 'cuboid' | 'sphere' | 'cone' | 'cylinder' | 'square-pyramid' | 'triangular-prism'. */
    solid: Expr;
    /** 'object' | 'net'. Omitted, jitters between the two. */
    view?: Expr;
    rotation?: Expr;
  }
```

**This kind carries the hardest anchoring case.** A cube has eleven nets; "which solid does this net fold into?" answered `cube` must not always show the cross. The jitter chooses among the nets a solid has, and rotates. The `object` view is a simple oblique projection.

- [ ] Test: every solid renders in both views; a cube's `net` view produces at least three distinct pictures across seeds (the anchoring case, asserted directly); `view: 'net'` never draws an object; an unknown solid name falls back to a cube rather than throwing.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a solid and its nets, never the same net twice for the same solid`

### Task 10: `number-line`

**Spec member:**
```ts
| {
    kind: 'number-line';
    /** The value the arrow points at. */
    at: Expr;
    /** Omitted, the builder picks a range containing `at`. */
    from?: Expr;
    to?: Expr;
    /** Distance between labelled ticks. Omitted, jitters over what divides the range. */
    step?: Expr;
    /** Draw minor ticks between the labelled ones. Omitted, jitters. */
    minorTicks?: Expr;
  }
```

Emits the line as a `path`, a tick `path` per step, a `label` per labelled tick, and an arrow (`path`) plus `dot` at `at`.

- [ ] Test: the arrow sits proportionally between `from` and `to`; the range always contains `at`; the range varies across seeds when omitted (7 can appear on 0–10 and on 0–20 — the anchoring case); `step` divides the range evenly; `at` absent is an issue.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a number line, and never place the same number on the same range twice`

### Task 11: `clock` — analogue faces

**Spec member:**
```ts
| {
    kind: 'clock';
    /** Hours, 1-12. */ hour: Expr;
    /** Minutes, 0-59. */ minute: Expr;
    /** Omitted, jitters. */ numerals?: Expr;
    /** Omitted, jitters. */ minuteTicks?: Expr;
  }
```

**The anchoring case stated in the spec.** Three o'clock is three o'clock: the hands *are* the answer and must not vary. So the face does — numerals drawn or not, tick style, hand lengths, radius. Any kind whose answer fully determines its geometry has to find its variation elsewhere, and this is the pattern.

- [ ] Test: the hour hand accounts for minutes past (at 3:30 it sits half way between 3 and 4, not on 3 — the classic bug); the minute hand is at `minute × 6°`; the hour hand is always shorter than the minute hand; **the same time produces at least two distinct figures across seeds**; hands do not vary for a fixed time (assert the hand angles are seed-independent).
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a clock face, varying the face because the hands are the answer`

### Task 12: `array`

**Spec member:**
```ts
| { kind: 'array'; rows: Expr; columns: Expr; orientation?: Expr }
```

Emits one `dot` per item in a grid. `orientation` omitted jitters between drawing `rows × columns` and its transpose — which is the commutativity the question is often about, so a template asking "how many rows?" must pin it.

- [ ] Test: dot count is `rows × columns` in both orientations; spacing is even; omitted `orientation` produces both layouts across seeds; `orientation: 'rows'` always puts `rows` rows.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw an array, the picture equal groups are actually taught from`

### Task 13: `fraction-shape`

**Spec member:**
```ts
| {
    kind: 'fraction-shape';
    numerator: Expr;
    denominator: Expr;
    /** 'circle' | 'rectangle' | 'strip'. Omitted, jitters over those that divide evenly. */
    shape?: Expr;
    rotation?: Expr;
  }
```

Emits the outline as a closed `path`, one `path` per partition line, and a filled closed `path` per shaded part.

- [ ] Test: shaded parts equal `numerator` and total parts equal `denominator`; 2/4 and 1/2 render as different pictures (they are different questions); the shape varies across seeds when omitted; a denominator a shape cannot divide evenly is not chosen for that shape.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Shade a fraction of a shape, the area model NSW teaches fractions from`

### Task 14: `grid` — maps and coordinates

**Spec member:**
```ts
| {
    kind: 'grid';
    /** The marked point, "x,y". */ at: Expr;
    columns?: Expr;
    rows?: Expr;
    /** 'numbers' | 'letters' | 'none'. Omitted, jitters between numbers and letters. */
    axisLabels?: Expr;
    /** Mark the point on the lines rather than in a cell. Omitted, false. */
    onLines?: Expr;
  }
```

`onLines: 'false'` is a grid map (the point is *in* B3, the Stage 2 reading); `'true'` is the coordinate plane (the point is *at* (2,3), the Stage 3 reading). First quadrant only — NSW Stage 3 `MA3-GM-01` does not go negative, and the number pad has no minus key anyway.

- [ ] Test: the grid has `columns × rows` cells; the mark sits in the right cell and, with `onLines`, on the right intersection; axis labels run `1..n` or `A..Z`; the grid extent varies across seeds when omitted; **no coordinate is ever negative**.
- [ ] Run, fail, implement, register, `npm test && npm run typecheck`.
- [ ] Commit: `Draw a grid map and a first-quadrant coordinate plane`

---

## Phase 3 — Content, one task per year

**Parallel-safe** once Tasks 5 and 14 land. Each task owns exactly one file: `src/content/maths/<year>.ts`.

Every task in this phase does three things, and these are **not** repeated per task:

1. **Add the year's new templates** from the table below.
2. **Add an NSW outcome code to every existing template in that year**, alongside its ACARA code — except the three integer templates, which stay ACARA-only (Task 21).
3. **Verify** with `npm test && npm run typecheck`, then commit.

Sourcing an NSW code: `https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022/content/<stage>`. Cite the focus area's outcome code for the focus area the template's topic practises. **Copy no outcome text into the repo.** If no NSW outcome genuinely covers a template, leave it ACARA-only and say so in the commit message rather than citing a code that does not fit — a wrong citation is worse than a missing one, because the page presents it as checkable.

The per-year new-template counts:

| Year | Data | Chance | Solids | Clock | Grid | Mass | Volume | Number line | Fraction shape | Array | **New** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K   | 4 | – | 3 | 2 | – | 2 | – | 1 | – | – | **12** |
| 1   | 4 | 3 | 3 | 2 | 2 | 1 | – | 1 | 2 | 1 | **19** |
| 2   | 4 | 3 | 3 | 2 | 2 | 2 | – | 1 | 1 | 1 | **19** |
| 3   | 4 | 3 | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 1 | **20** |
| 4   | 4 | 4 | 3 | 2 | 2 | 1 | 2 | 1 | 1 | 1 | **21** |
| 5   | 4 | 4 | 3 | 2 | 2 | 1 | 2 | 1 | 1 | – | **20** |
| 6   | 4 | 3 | 3 | 2 | 2 | 1 | 2 | 1 | – | – | **18** |
| **Total** | **28** | **20** | **21** | **14** | **12** | **9** | **8** | **7** | **6** | **4** | **129** |

Answer-type reminders that bite hardest in this phase: solid names and angle names are `choice` below Year 4, never `text`; a fraction answered as a fraction must be `choice` (the pad types digits and one decimal point, so `3/4` is untypeable); a time answered as `3:30` is untypeable and must be `choice` or split into a number of minutes.

- [ ] **Task 15: Year K** — `src/content/maths/k.ts`, 12 new templates, MAE- codes on all existing. Commit: `Give Kindergarten graphs, solids, a clock face and a number line`
- [ ] **Task 16: Year 1** — `src/content/maths/1.ts`, 19 new, MA1- codes. Adds the `fractions` topic to Year 1. Commit: `Give Year 1 chance, coordinates and halves of a shape`
- [ ] **Task 17: Year 2** — `src/content/maths/2.ts`, 19 new, MA1- codes. Commit: `Give Year 2 the data and chance it never had`
- [ ] **Task 18: Year 3** — `src/content/maths/3.ts`, 20 new, MA2- codes. Adds the `shapes` topic to Year 3, which had no Space content cited at all. Commit: `Give Year 3 shapes back, and the graphs and solids beside them`
- [ ] **Task 19: Year 4** — `src/content/maths/4.ts`, 21 new, MA2- codes. Commit: `Give Year 4 nets, spinners and a coordinate grid`
- [ ] **Task 20: Year 5** — `src/content/maths/5.ts`, 20 new, MA3- codes. Adds the `shapes` topic to Year 5. Commit: `Give Year 5 shapes back, and probability as a fraction`
- [ ] **Task 21: Year 6** — `src/content/maths/6.ts`, 18 new, MA3- codes, **and the integer exception**.

  Year 6 carries the one deliberate asymmetry. `maths.6.integers.temperature`, `.subtract` and `.compare` keep `AC9M6N01` and get **no** NSW code, because NSW places integers at Stage 4 (`MA4-INT-C-01`, Year 7).

  Add to `src/content/catalog.test.ts`:

  ```ts
  // NSW places integers at Stage 4 - Year 7 - where ACARA places them at Year 6.
  // These three keep the ACARA citation and take no NSW one, and the curriculum
  // page renders the disagreement. Naming them here means dropping the asterisk
  // later has to be a decision somebody makes, rather than a test going quietly
  // green when a well-meaning edit adds an MA3- code that does not belong.
  it('cites no NSW outcome for the content NSW places beyond Year 6', () => {
    const acaraOnly = ['temperature', 'subtract', 'compare'].map((v) => `maths.6.integers.${v}`);

    for (const id of acaraOnly) {
      const template = allTemplates.find((t) => t.id === id);
      expect(template, id).toBeDefined();
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'acara')).toBe(true);
      expect(template!.tags?.some((tag) => syllabusOf(tag) === 'nsw')).toBe(false);
    }
  });
  ```

  Commit: `Give Year 6 line graphs and nets, and leave integers cited against ACARA alone`

---

## Phase 4 — The page, and proving the whole thing

### Task 22: Enforce the citation rules over all shipped content

**Files:**
- Modify: `src/content/catalog.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { syllabusOf, nswStageOfCode } from './catalog';
import { stageForLevel } from '@/lib/curriculum';

it('cites at least one syllabus for every template', () => {
  for (const template of allTemplates) {
    expect(template.tags?.some((tag) => syllabusOf(tag) !== null), template.id).toBe(true);
  }
});

// The characteristic bug of a second citation family, and invisible by
// inspection across 329 templates: an NSW code from the wrong stage. A Stage 2
// code on a Year 5 template reads as perfectly plausible and is simply wrong.
it('only cites an NSW outcome from the stage the template’s year falls in', () => {
  for (const template of allTemplates) {
    for (const tag of template.tags ?? []) {
      const stage = nswStageOfCode(tag);
      if (!stage) continue;
      expect(stage, `${template.id} cites ${tag}`).toBe(stageForLevel(template.level));
    }
  }
});

it('reproduces no NSW syllabus prose, only codes', () => {
  // A tag is an identifier. Anything with a space in it is prose, and NESA's
  // is Crown copyright - see the spec. This is a cheap guard on the one rule
  // whose breach would be a licensing problem rather than a bug.
  for (const template of allTemplates) {
    for (const tag of template.tags ?? []) {
      if (syllabusOf(tag) === 'nsw') expect(tag).not.toMatch(/\s/);
    }
  }
});
```

- [ ] **Step 2: Run and fix whatever it catches**

Run: `npm test`
Any failure here is a real miscitation from Phase 3. Fix the template, not the test.

- [ ] **Step 3: Commit**

```bash
git add src/content/catalog.test.ts
git commit -m "Refuse an NSW citation from the wrong stage, which nothing else would catch"
```

---

### Task 23: The curriculum page shows both sources, and where they disagree

**Files:**
- Modify: `src/app/curriculum/page.tsx`

- [ ] **Step 1: Two sources in the opening section**

Add the NSW syllabus beside ACARA, with the stage mapping spelled out (Early Stage 1 = Kindergarten, Stage 1 = Years 1–2, Stage 2 = Years 3–4, Stage 3 = Years 5–6) and a line saying stages span two years while LearnR's levels are single years — which is why one Stage 2 code sits on both Year 3 and Year 4 templates.

Explain both code shapes. ACARA's existing explanation stays, including its verbatim quotation of `AC9M4N02`, which CC BY permits. The NSW explanation gives the shape (`MA` + stage + focus area + number) and **no outcome statement**.

- [ ] **Step 2: Render both codes per year, and the disagreement**

The per-year sections already map `curriculumCodes('maths')`. Each `CodeUse` now carries `syllabus`; group each year's list into an ACARA column and an NSW column, or label each row with its source.

Then the part that is the point of the page: where a template cites one source and not the other, say so. Derive the absence — a year whose ACARA codes cover templates that no NSW code covers — and render an em dash plus one hand-written sentence naming Stage 4 as where NSW places integers. Only the sentence is hand-written; the em dash is the absence of a tag.

- [ ] **Step 3: Two attribution blocks that differ in kind**

Keep ACARA's CC BY 4.0 block unchanged. Add a NESA block that states:
- © NSW Education Standards Authority, Crown copyright
- a link to the syllabus at `curriculum.nsw.edu.au`
- that LearnR cites outcome codes and writes its own questions, and reproduces no NSW syllabus material

And a sentence saying **why the two blocks differ**: ACARA's material is CC BY 4.0 and quotable; NESA's is Crown copyright and is cited rather than reproduced.

- [ ] **Step 4: Bound the claim**

Add a short paragraph: LearnR's questions are written against the syllabus's focus areas. `MAO-WM-01` — Working mathematically — attaches to every NSW outcome, and a generated single-answer question evidences understanding and fluency, not communicating, reasoning or problem solving. Say so rather than implying coverage the app does not have.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run build`
Then read the page at `/curriculum` in `npm run dev` and check both orientations of an iPad — this page is long and the code lists are the widest thing on it.

- [ ] **Step 6: Commit**

```bash
git add src/app/curriculum/page.tsx
git commit -m "Show both syllabuses, and say plainly where the two disagree"
```

---

### Task 24: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

The architecture document is the map of this codebase and this work changes the map.

- [ ] Update **Question templates**: content now ships 329 templates citing two syllabuses; `tags` carries both families; stage is derived by `stageForLevel` and enforced in `catalog.test.ts`.
- [ ] Add a short **Two syllabuses** section: why NSW is cited, why stage is derived and not stored, why there are no Part A/B tags, why topics were not renamed, and the copyright asymmetry that makes the NSW half cite rather than quote.
- [ ] Update the figures paragraph: eleven kinds behind a registry, and the two anchoring patterns worth knowing (a kind whose answer fixes its geometry varies its presentation instead — `clock`; a kind with many correct pictures varies which one — `solid`).
- [ ] Note the content file split under `src/content/maths/`.
- [ ] Commit: `Write down the second syllabus, and the nine kinds that fill its gaps`

---

## Verification checklist

Run at the end, all from the worktree:

```bash
npm test                 # every test, including catalog invariants over 329 templates
npm run typecheck
npm run build            # catches JSX and page-level type errors the node-only tests cannot

# The content actually landed
grep -c "id: 'maths" src/content/maths/*.ts | awk -F: '{s+=$2} END {print s}'   # expect 329

# Positional advantage is a known number, not a surprise.
# Probe every `choice` template over a few hundred seeded draws, compute the answer's rank
# among the numerically sorted options, and report the worst-case share any single rank takes
# and how many of the available ranks are reachable. The twelve templates Task 26 reworked sit
# at ~50% over two of four ranks and are accepted at that. Any NEW template worse than those,
# or reaching fewer ranks than its option set allows, is a defect to fix before merge.
# Keep the probe outside `src/` so it never joins the shipped suite.

# The strand split moved
# expect roughly: Number and algebra 50%, Measurement and space 33%, Statistics and probability 17%
```

And confirm by eye, because no test can: `/curriculum` names both sources, renders the integer disagreement, and quotes no NSW outcome text anywhere.

---

## Phase 1b — Choice leakage (inserted mid-flight; run these straight after Task 5)

A review of the shipped content found multiple-choice questions answerable
without engaging with them. Measured over 200 seeded draws per template: **14
templates have a fixed answer rank**, of which 12 are genuine leaks and 2 are
legitimate ("Which is the largest?" — the answer is the max because that is the
question). **1 template has an option-set leak.** 13 to rework.

This is the same failure the figure anchoring rule exists to prevent — a child
learns the shortcut, the analytics call the topic secure, and the wrong thing
was learned. It is enforced rather than intended for the same reason: a leaking
question looks perfectly correct.

These two tasks come before Phase 2 and Phase 3 because Phase 3 writes 129 new
templates, many of them `choice`. The check has to exist before the content, or
it is 129 more chances to author the same bug.

### Task 25: Refuse a multiple-choice question that answers itself

**Files:**
- Modify: `src/lib/templates/validate.ts`, `src/lib/templates/types.ts`
- Test: `src/lib/templates/validate.test.ts`

**Interfaces:**
- Consumes: `generate`, `createRng` (already used by the figure anchoring check)
- Produces: `export const CHOICE_DRAWS = 40;` and a new optional field on the
  authored choices spec:

```ts
choices?: {
  count: number;
  distractors?: Expr[];
  jitter?: { min: Expr; max: Expr };
  /**
   * The answer's rank among the sorted options is fixed *because finding the
   * extreme is the question* — "Which is largest?". Declared so the leakage
   * check does not flag it, and declared deliberately: an undeclared fixed
   * rank is a question a child can beat without doing the maths.
   */
  rankIsTheQuestion?: boolean;
}
```

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/templates/validate.test.ts`. These four cases are the whole
contract — a leak of each kind, and a legitimate case of each kind:

```ts
describe('choice leakage', () => {
  // The shipped shape that fails: place-value distractors always sort into the
  // same order, so the answer sits at a fixed rank every single draw.
  it('rejects a choice question whose answer is always the same sorted rank', () => {
    const result = validateTemplate({
      id: 'maths.6.measurement.leaky',
      subject: 'maths', topic: 'measurement', level: '6',
      prompt: 'How many kilograms is {g} grams?',
      vars: [
        { name: 'n', kind: 'int', min: '3', max: '199' },
        { name: 'g', kind: 'expr', expr: 'n * 50' },
      ],
      answer: 'n * 50 / 1000',
      answerType: 'choice',
      choices: { count: 4, distractors: ['n * 50 / 100', 'n * 50 / 10000', 'n * 50'] },
      tags: ['AC9M6M01'],
    });

    expect(result.errors.join(' ')).toMatch(/rank/i);
  });

  // Finding the largest IS the question, so a fixed rank is honest here - but
  // only because the template says so.
  it('accepts a fixed rank when the template declares that is the question', () => {
    const spec = {
      id: 'maths.5.decimals.largest',
      subject: 'maths', topic: 'decimals', level: '5',
      prompt: 'Which of these is the largest: {a}, {b} or {c}?',
      vars: [
        { name: 'a', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
        { name: 'b', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
        { name: 'c', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
      ],
      constraints: ['a != b', 'b != c', 'a != c'],
      answer: 'max(a, max(b, c))',
      answerType: 'choice',
      tags: ['AC9M5N01'],
    } as const;

    const leaky = validateTemplate({ ...spec, choices: { count: 3, distractors: ['a', 'b', 'c'] } });
    expect(leaky.errors.join(' ')).toMatch(/rank/i);

    const declared = validateTemplate({
      ...spec,
      choices: { count: 3, distractors: ['a', 'b', 'c'], rankIsTheQuestion: true },
    });
    expect(declared.errors).toEqual([]);
  });

  // The Kindergarten pattern shape: three colours from three disjoint pick
  // lists, and the answer is always the one from the middle list. Narration
  // reads the options aloud, so this is beatable without reading at all.
  it('rejects a choice question whose answer never appears as a wrong option', () => {
    const result = validateTemplate({
      id: 'maths.K.patterns.leaky',
      subject: 'maths', topic: 'patterns', level: 'K',
      prompt: 'What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, ?',
      vars: [
        { name: 'a', kind: 'pick', from: ['red', 'blue'] },
        { name: 'b', kind: 'pick', from: ['yellow', 'orange'] },
        { name: 'c', kind: 'pick', from: ['green', 'purple'] },
      ],
      answer: 'b',
      answerType: 'choice',
      choices: { count: 3, distractors: ['a', 'c'] },
      tags: ['AC9MFA01'],
    });

    expect(result.errors.join(' ')).toMatch(/option set|never a distractor|announces/i);
  });

  it('accepts a choice question whose options genuinely mix', () => {
    const result = validateTemplate({
      id: 'maths.2.addition.sound',
      subject: 'maths', topic: 'addition', level: '2',
      prompt: 'What is {x} + {y}?',
      vars: [
        { name: 'x', kind: 'int', min: '10', max: '40' },
        { name: 'y', kind: 'int', min: '10', max: '40' },
      ],
      answer: 'x + y',
      answerType: 'choice',
      choices: { count: 4, jitter: { min: '1', max: '9' } },
      tags: ['AC9M2N01'],
    });

    expect(result.errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests, watch them fail**

Run: `npx vitest run src/lib/templates/validate.test.ts`
Expected: FAIL — no leakage check exists yet.

- [ ] **Step 3: Implement the check**

In `validate.ts`, beside the figure anchoring check and modelled on it. For a
spec with `choices`, draw `CHOICE_DRAWS` times (skip draws that throw, as the
figure check does), and gather per draw: the answer, the options, and the
answer's rank among the options sorted ascending when **every** option is a
number.

Report two errors:

- **Rank**: when every draw was fully numeric and one rank accounts for **every**
  draw (not merely most — a near-constant rank is a content smell, a constant
  one is a defect, and only the defect should block a build), and
  `rankIsTheQuestion` is not set. Word the error so it names the rank and the
  option count, and says to vary the distractors or declare
  `rankIsTheQuestion`.
- **Option set**: when the set of values the answer took across all draws is
  **disjoint** from the set of values that ever appeared as a wrong option,
  **and** the answer took at most `CLOSED_SET_MAX` (8) distinct values. The
  size guard is what stops it firing on a template with 178 distinct numeric
  answers, where disjointness is arithmetic coincidence rather than structure.
  Set `CLOSED_SET_MAX = 8` as a named constant with that reasoning in a comment.

Both checks need at least ~10 usable draws before they conclude anything.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` and `npm run typecheck`

`src/content/catalog.test.ts` validates all shipped content, so **this step will
now fail on the 13 leaking templates**. That is correct and expected — Task 26
fixes them. Commit this task with the check implemented; if the suite is red at
the end of this task, say so in your report and do NOT weaken the check to make
it pass.

- [ ] **Step 5: Commit**

Stage `src/lib/templates/` and commit with the message:
`Refuse a multiple-choice question a child can beat without reading it`

---

### Task 26: Rework the thirteen questions that answer themselves

**Files:**
- Modify: `src/content/maths/4.ts`, `5.ts`, `6.ts`, `k.ts` (after Task 5's split)

**The twelve rank leaks.** All share one cause: distractors built by scaling the
answer by powers of ten, which always sort into a fixed order.

```
maths.4.decimals.add-tenths                  maths.6.decimals.add
maths.4.decimals.hundredths                  maths.6.decimals.divide-by-powers-of-ten
maths.4.decimals.tenths                      maths.6.decimals.multiply-by-powers-of-ten
maths.5.decimals.add                         maths.6.integers.subtract
maths.5.decimals.subtract                    maths.6.integers.temperature
maths.6.measurement.centimetres-to-metres    maths.6.measurement.grams-to-kilograms
```

**Keep the place-value distractors** — `n/10` for `n/100` is the mistake a child
actually makes, and replacing them with random noise would make the questions
easier and less diagnostic. Fix the *ordering* instead, by either:

- offering a **near-miss that straddles the answer** — e.g. add `(n + 1) / 100`
  or `(n - 1) / 100` alongside the place-value errors, so the answer is
  sometimes above and sometimes below its neighbour; or
- **varying which distractors appear**, so the set is not the same three
  scalings every time.

Whichever you choose, the acceptance test is Task 25's check passing, not your
judgement of the shape.

**Two templates are NOT leaks** and must be left working, with
`rankIsTheQuestion: true` added and a one-line comment saying why:

```
maths.4.decimals.larger      "Which is larger, {a} or {b}?"
maths.5.decimals.largest     "Which of these is the largest: {a}, {b} or {c}?"
```

**The one option-set leak: `maths.K.patterns.repeating-three`.** Answer `b`,
distractors `a` and `c`, where the three `pick` lists are disjoint colour sets —
so the answer is always the `{yellow, orange}` one. Narration reads word options
aloud, so a pre-literate child can hear three colours and apply the rule without
engaging with the pattern at all. Fix so the answer is not always drawn from the
same list: draw all three colours from **one shared list** with constraints
keeping them distinct, so any colour can be the answer and any can be a
distractor. Keep it a `choice` question (K may not spell).

- [ ] **Step 1: Confirm the check catches all thirteen**

Run the suite and record how many templates the leakage check names, before
changing anything. That count is your baseline.

- [ ] **Step 2: Fix the twelve rank leaks**
- [ ] **Step 3: Declare the two legitimate ones**
- [ ] **Step 4: Fix the Kindergarten pattern**
- [ ] **Step 5: Verify**

Run: `npm test` and `npm run typecheck`
Expected: fully green. Every shipped template passes the leakage check.

- [ ] **Step 6: Commit**

Stage `src/content/` and commit with the message:
`Rework the questions a child could beat by position rather than by maths`
