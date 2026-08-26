# Golden Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a golden corpus from the TypeScript engine, commit a digest of it, and guard both against drift - so the Swift port has an oracle to be verified against.

**Architecture:** A pure canonicaliser turns engine output into a separator-delimited string; a digest is twelve hex characters of sha256 over a group of those strings. Digests are committed (~100 KB) and the 110 MB corpus is generated on demand. A drift test regenerates the digests in memory and compares byte for byte against what is committed - the shape `scripts/content-packs.test.ts` already uses.

**Tech Stack:** TypeScript, vitest, `node:crypto`, tsx. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-fixture-generation-design.md`

## Global Constraints

- **The canonical form is not JSON.** Name and value join with `U+001F`; the fields of one case join with `U+001E`; cases join with `\n`. The canonicaliser throws on a value containing any of the three. **Write these as `\u001f` / `\u001e` escapes in source, never as literal control characters.**
- **Every value is its JavaScript `String(v)` form.** Never `toFixed`, never a locale-aware formatter, never a JSON encoder.
- **`vars` are emitted sorted by name.** A Swift dictionary has no insertion order to rely on.
- **The corpus seed is `` `${templateId}:${draw}` ``**, draws `0` to `99`. This string is contract - `createRng` hashes it directly.
- **The hash is `sha256(...).digest('hex').slice(0, 12)`** - the same function and truncation `scripts/content-packs.ts` uses.
- **Every digest file has one shape:** `{ version, set, draws?, groups: Record<string, string> }`, and `version` is a hash of the file's own body. Content-addressed - nothing to bump.
- **Every generated file ends with a newline and indents at two spaces**, like the content packs, because the diff is how a change gets reviewed.
- **The full corpus is never committed.** `fixtures/corpus/` is gitignored.
- **Files live under `scripts/`, never `src/lib` or `src/content`.** An engine file under those two may not import from outside `src/` - the `packages/core` symlink makes `tsc` walk each one twice and an escaping relative import resolves from the real path but not the mirrored one.
- **Engine imports use relative paths, never the `@` alias.** `packages/core/test/exports.test.ts` fails on any `@/` import inside the engine, and these scripts follow the same rule for the same reason.
- Run `npm test` and `npm run typecheck` before every commit.

---

### Task 1: The canonical form, and the compile-time guard that it is complete

The whole contract rests on this file. A field left out of the canonical form is invisible **forever** - no test can miss what it never hashes - so the completeness check is the compiler's, mirroring `Mirrored` in `apps/api/src/schemas/dto.ts`.

**Files:**
- Create: `scripts/fixtures/canonical.ts`
- Test: `scripts/fixtures/canonical.test.ts`

**Interfaces:**
- Consumes: `GeneratedQuestion` from `src/lib/templates/types`; `Figure`, `Mark`, `Point` from `src/lib/figures/types`.
- Produces:
  - `NAME_SEP`, `FIELD_SEP`, `CASE_SEP: string`
  - `type Field = readonly [name: string, value: string]`
  - `canonicalMark(mark: Mark): string`
  - `canonicalFigure(figure: Figure): Field[]`
  - `canonicalQuestion(q: GeneratedQuestion): Field[]`
  - `canonicaliseCase(fields: readonly Field[]): string`
  - `digest(cases: readonly string[]): string`
  - `QUESTION_FIELDS`, `MARK_FIELDS`, `type CanonicalCovers`

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/canonical.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Figure } from '../../src/lib/figures/types';
import type { GeneratedQuestion } from '../../src/lib/templates/types';
import {
  canonicaliseCase,
  canonicalFigure,
  canonicalMark,
  canonicalQuestion,
  digest,
  FIELD_SEP,
  NAME_SEP,
} from './canonical';

const question = (over: Partial<GeneratedQuestion> = {}): GeneratedQuestion => ({
  prompt: 'What is 7 - 3?',
  answer: 4,
  answerType: 'number',
  vars: { x: 7, y: 3 },
  ...over,
});

describe('canonicalQuestion', () => {
  it('names every field and stringifies with JavaScript semantics', () => {
    expect(canonicalQuestion(question())).toEqual([
      ['prompt', 'What is 7 - 3?'],
      ['answer', '4'],
      ['answerType', 'number'],
      ['vars.x', '7'],
      ['vars.y', '3'],
    ]);
  });

  it('writes a whole number without a decimal point, which is the port trap', () => {
    const [, answer] = canonicalQuestion(question({ answer: 4 / 2 }))[1];
    expect(answer).toBe('2');
  });

  it('sorts vars by name, because a Swift dictionary has no order to borrow', () => {
    const fields = canonicalQuestion(question({ vars: { z: 1, a: 2, m: 3 } }));
    expect(fields.filter(([n]) => n.startsWith('vars.')).map(([n]) => n)).toEqual([
      'vars.a',
      'vars.m',
      'vars.z',
    ]);
  });

  it('omits an absent optional field rather than emitting it empty', () => {
    const names = canonicalQuestion(question()).map(([n]) => n);
    expect(names).not.toContain('choices');
    expect(names).not.toContain('hint');
    expect(names.some((n) => n.startsWith('figure.'))).toBe(false);
  });

  it('carries choices and hint when they are there', () => {
    const fields = canonicalQuestion(
      question({ answerType: 'choice', choices: [4, 5, 6], hint: 'Count back from 7.' }),
    );
    expect(fields).toContainEqual(['choices', '4|5|6']);
    expect(fields).toContainEqual(['hint', 'Count back from 7.']);
  });
});

describe('canonicalMark', () => {
  it('writes each of the four kinds', () => {
    expect(
      canonicalMark({
        kind: 'path',
        points: [
          [12.5, 80],
          [45, 80],
        ],
        closed: true,
        fill: false,
        dashed: false,
      }),
    ).toBe('path|12.5,80 45,80|true|false|false');

    expect(canonicalMark({ kind: 'arc', at: [50, 50], radius: 12, from: 0, to: 90 })).toBe(
      'arc|50,50|12|0|90',
    );
    expect(canonicalMark({ kind: 'dot', at: [1, 2] })).toBe('dot|1,2');
    expect(canonicalMark({ kind: 'label', at: [1, 2], text: '3 cm' })).toBe(
      'label|1,2|3 cm',
    );
  });
});

describe('canonicalFigure', () => {
  it('flattens to width, height and one field per mark in emitted order', () => {
    const figure: Figure = {
      width: 100,
      height: 100,
      marks: [
        { kind: 'dot', at: [1, 2] },
        { kind: 'label', at: [3, 4], text: 'A' },
      ],
    };
    expect(canonicalFigure(figure)).toEqual([
      ['figure.width', '100'],
      ['figure.height', '100'],
      ['figure.mark.0', 'dot|1,2'],
      ['figure.mark.1', 'label|3,4|A'],
    ]);
  });
});

describe('canonicaliseCase', () => {
  it('joins name to value and field to field', () => {
    expect(
      canonicaliseCase([
        ['prompt', 'Hi'],
        ['answer', '4'],
      ]),
    ).toBe(`prompt${NAME_SEP}Hi${FIELD_SEP}answer${NAME_SEP}4`);
  });

  it('refuses a value carrying a separator, so the assumption is checked', () => {
    expect(() => canonicaliseCase([['prompt', `a${FIELD_SEP}b`]])).toThrow(/separator/);
    expect(() => canonicaliseCase([['prompt', `a${NAME_SEP}b`]])).toThrow(/separator/);
    expect(() => canonicaliseCase([['prompt', 'a\nb']])).toThrow(/separator/);
  });
});

describe('digest', () => {
  it('is twelve hex characters, stable, and moves with the content', () => {
    expect(digest(['a', 'b'])).toMatch(/^[0-9a-f]{12}$/);
    expect(digest(['a', 'b'])).toBe(digest(['a', 'b']));
    expect(digest(['a', 'b'])).not.toBe(digest(['a', 'c']));
  });

  it('does not confuse one case with two, because cases join on a newline', () => {
    expect(digest(['ab'])).not.toBe(digest(['a', 'b']));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/canonical.test.ts`
Expected: FAIL - `Failed to resolve import "./canonical"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/fixtures/canonical.ts`:

```ts
import { createHash } from 'node:crypto';
import type { Figure, Mark, Point } from '../../src/lib/figures/types';
import type { GeneratedQuestion } from '../../src/lib/templates/types';

/**
 * The canonical form both engines hash, and the reason it is not JSON.
 *
 * Two JSON encoders in two languages have to agree about escaping before their
 * output can be compared, and a rendered prompt carries the minus sign, times,
 * divide, degree and dollar - exactly where they differ on when to escape
 * non-ASCII. So the form is written out by hand instead, in about thirty lines
 * a Swift port can mirror.
 *
 * **Every value is its JavaScript `String(v)` form**, which is the rule that
 * earns its keep: `generateQuestion` already keys the expected answer and the
 * distractor dedup off `String(value)`, so a port yielding `"2.0"` where this
 * says `"2"` marks a correct answer wrong *and* can offer a distractor identical
 * to the answer. Hashing this form makes the digest test the thing the port had
 * to get right anyway, rather than adding a second formatting rule to keep in
 * step.
 */

/** Between a field's name and its value. */
export const NAME_SEP = '\u001f';
/** Between the fields of one case. */
export const FIELD_SEP = '\u001e';
/** Between cases. A rendered prompt is one line by construction. */
export const CASE_SEP = '\n';

/** Anything that would let two fields be read as one. */
const SEPARATORS = /[\u001e\u001f\n]/;

export type Field = readonly [name: string, value: string];

/** `Point` is a tuple, `readonly [number, number]` - not an object with x and y. */
const point = (p: Point): string => `${String(p[0])},${String(p[1])}`;

/**
 * A mark's kind, then its fields in declared order, joined by `|`.
 *
 * The four kinds are a closed set - it is what lets `diagram.tsx` stay a dumb
 * renderer - so this switch is exhaustive by construction. A fifth kind is a
 * decision that has escaped `lib`, and it breaks this loudly rather than
 * quietly.
 */
export function canonicalMark(mark: Mark): string {
  switch (mark.kind) {
    case 'path':
      return [
        'path',
        mark.points.map(point).join(' '),
        String(mark.closed),
        String(mark.fill),
        String(mark.dashed),
      ].join('|');
    case 'arc':
      return ['arc', point(mark.at), String(mark.radius), String(mark.from), String(mark.to)].join('|');
    case 'dot':
      return ['dot', point(mark.at)].join('|');
    case 'label':
      return ['label', point(mark.at), mark.text].join('|');
  }
}

export function canonicalFigure(figure: Figure): Field[] {
  const fields: Field[] = [
    ['figure.width', String(figure.width)],
    ['figure.height', String(figure.height)],
  ];
  figure.marks.forEach((mark, i) => fields.push([`figure.mark.${i}`, canonicalMark(mark)]));
  return fields;
}

export function canonicalQuestion(q: GeneratedQuestion): Field[] {
  const fields: Field[] = [
    ['prompt', q.prompt],
    ['answer', String(q.answer)],
    ['answerType', q.answerType],
  ];
  if (q.choices) fields.push(['choices', q.choices.map(String).join('|')]);
  if (q.hint !== undefined) fields.push(['hint', q.hint]);
  for (const [name, value] of Object.entries(q.vars).sort(([a], [b]) => (a < b ? -1 : 1))) {
    fields.push([`vars.${name}`, String(value)]);
  }
  if (q.figure) fields.push(...canonicalFigure(q.figure));
  return fields;
}

export function canonicaliseCase(fields: readonly Field[]): string {
  return fields
    .map(([name, value]) => {
      if (SEPARATORS.test(value)) {
        throw new Error(
          `Canonical value for ${name} contains a separator: ${JSON.stringify(value)}`,
        );
      }
      return `${name}${NAME_SEP}${value}`;
    })
    .join(FIELD_SEP);
}

/** Twelve hex characters of sha256 - `content-packs.ts`'s function and truncation. */
export function digest(cases: readonly string[]): string {
  return createHash('sha256').update(cases.join(CASE_SEP), 'utf8').digest('hex').slice(0, 12);
}

/* The completeness guard ------------------------------------------------ */

/**
 * Which keys of `GeneratedQuestion` this file accounts for. Not the emitted
 * labels - `vars` becomes `vars.<name>` and `figure` becomes several fields -
 * but the account of what has been considered.
 *
 * **A field left out of the canonical form is invisible forever**, because no
 * test can miss what it never hashes. That is `Mirrored`'s problem from
 * `apps/api/src/schemas/dto.ts` one level up, and it takes the same answer: the
 * key sets are compared by the compiler, both ways. Optional fields are again
 * the invisible ones, and `choices`, `hint` and `figure` are all optional.
 */
export const QUESTION_FIELDS = [
  'prompt',
  'answer',
  'answerType',
  'choices',
  'hint',
  'vars',
  'figure',
] as const;

/** The same account, per arm of `Mark`. A new field on an existing kind is as invisible. */
export const MARK_FIELDS = {
  path: ['kind', 'points', 'closed', 'fill', 'dashed'],
  arc: ['kind', 'at', 'radius', 'from', 'to'],
  dot: ['kind', 'at'],
  label: ['kind', 'at', 'text'],
} as const;

/** The arm of `Mark` whose `kind` is `V`. */
type ArmWith<V> = Extract<Mark, { kind: V }>;

type CheckKeys<Declared extends PropertyKey, Actual> = [Exclude<keyof Actual, Declared>] extends [
  never,
]
  ? [Exclude<Declared, keyof Actual>] extends [never]
    ? true
    : { canonicalFormNamesAFieldTheTypeDoesNot: Exclude<Declared, keyof Actual> }
  : { canonicalFormIsMissing: Exclude<keyof Actual, Declared> };

type Assert<T extends true> = T;

/**
 * Exported so it is never an unused declaration, and because the list is worth
 * reading: it is everything the digest promises to notice.
 */
export type CanonicalCovers = {
  question: Assert<CheckKeys<(typeof QUESTION_FIELDS)[number], GeneratedQuestion>>;
  path: Assert<CheckKeys<(typeof MARK_FIELDS)['path'][number], ArmWith<'path'>>>;
  arc: Assert<CheckKeys<(typeof MARK_FIELDS)['arc'][number], ArmWith<'arc'>>>;
  dot: Assert<CheckKeys<(typeof MARK_FIELDS)['dot'][number], ArmWith<'dot'>>>;
  label: Assert<CheckKeys<(typeof MARK_FIELDS)['label'][number], ArmWith<'label'>>>;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/fixtures/canonical.test.ts && npm run typecheck`
Expected: PASS, and typecheck clean.

- [ ] **Step 5: Verify the compile guard by breaking it**

This is the repo's established method - the response-schema work found its real bugs only by breaking a guard and watching it *not* fire, so a guard nobody has seen fire is not yet a guard.

Run each of these, confirm the compiler names the field, then **restore the file**:

1. Delete `'figure'` from `QUESTION_FIELDS`. Run `npm run typecheck`.
   Expected: an error naming `canonicalFormIsMissing: "figure"`.
2. Delete `'dashed'` from `MARK_FIELDS.path`. Run `npm run typecheck`.
   Expected: an error naming `canonicalFormIsMissing: "dashed"` on the `path` entry.
3. Add `'nonsense'` to `QUESTION_FIELDS`. Run `npm run typecheck`.
   Expected: an error naming `canonicalFormNamesAFieldTheTypeDoesNot: "nonsense"`.

Confirm `git diff` is empty before committing.

- [ ] **Step 6: Commit**

```bash
git add scripts/fixtures/canonical.ts scripts/fixtures/canonical.test.ts
git commit -m "Write the canonical form, and make the compiler prove it is complete"
```

---

### Task 2: The main corpus cases

**Files:**
- Create: `scripts/fixtures/corpus.ts`
- Test: `scripts/fixtures/corpus.test.ts`

**Interfaces:**
- Consumes: `canonicaliseCase`, `canonicalQuestion` from `./canonical`; `createRng` from `src/lib/rng`; `generateQuestion` from `src/lib/templates/generate`.
- Produces:
  - `DRAWS: number` (100)
  - `seedFor(templateId: string, draw: number): string`
  - `corpusCases(template: QuestionTemplate): string[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/corpus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { corpusCases, DRAWS, seedFor } from './corpus';

const template = allTemplates.find((t) => t.id === 'maths.1.subtraction.difference')!;

describe('seedFor', () => {
  it('is the template id and the draw, which is contract', () => {
    expect(seedFor('maths.3.fractions.half', 7)).toBe('maths.3.fractions.half:7');
  });
});

describe('corpusCases', () => {
  it('draws a hundred times', () => {
    expect(corpusCases(template)).toHaveLength(DRAWS);
  });

  it('is deterministic, which is the whole premise', () => {
    expect(corpusCases(template)).toEqual(corpusCases(template));
  });

  it('names the fields of every case', () => {
    for (const line of corpusCases(template)) {
      expect(line).toContain('prompt');
      expect(line).toContain('answer');
      expect(line).toContain('answerType');
    }
  });

  it('varies, so a hundred identical draws would not pass unnoticed', () => {
    expect(new Set(corpusCases(template)).size).toBeGreaterThan(1);
  });

  it('carries a figure where the template has one', () => {
    const withFigure = allTemplates.find((t) => t.figure)!;
    expect(corpusCases(withFigure).every((line) => line.includes('figure.width'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/corpus.test.ts`
Expected: FAIL - `Failed to resolve import "./corpus"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/fixtures/corpus.ts`:

```ts
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, canonicalQuestion } from './canonical';

/**
 * A hundred draws a template. Coverage flattens well before that - a template
 * averages 20.3 distinct outputs over 25 draws and 67.8 over 100 - but the
 * committed artifact is a digest whose size does not depend on the draw count,
 * and generation is under three seconds, so the redundancy costs nothing.
 */
export const DRAWS = 100;

/**
 * **This string is contract, not an implementation detail**, because `createRng`
 * hashes the string itself. It differs deliberately from how a live session
 * seeds a draw (`${sessionSeed}:${drawNumber}`): a fixture needs a seed stable
 * across regeneration and independent of any session.
 */
export const seedFor = (templateId: string, draw: number): string => `${templateId}:${draw}`;

export function corpusCases(template: QuestionTemplate): string[] {
  const cases: string[] = [];
  for (let draw = 0; draw < DRAWS; draw++) {
    const question = generateQuestion(template, createRng(seedFor(template.id, draw)));
    cases.push(canonicaliseCase(canonicalQuestion(question)));
  }
  return cases;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/fixtures/corpus.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/corpus.ts scripts/fixtures/corpus.test.ts
git commit -m "Draw every template a hundred times, on the seed the contract names"
```

---

### Task 3: The digest files, the writer, and the drift guard

This is the task that produces working software: after it, the corpus is guarded.

**Files:**
- Create: `scripts/fixtures/digests.ts`, `scripts/build-fixtures.ts`, `scripts/fixtures/digests.test.ts`
- Create: `fixtures/digests/*.json` (generated, committed)
- Modify: `package.json` (add `fixtures:build`)

**Interfaces:**
- Consumes: `corpusCases`, `DRAWS` from `./corpus`; `digest` from `./canonical`; `allTemplates` from `src/content/catalog`; `compareYearLevels` from `src/lib/curriculum`.
- Produces:
  - `interface DigestSet { name: string; groups: Map<string, string> }`
  - `corpusSets(templates: readonly QuestionTemplate[]): DigestSet[]`
  - `allSets(templates: readonly QuestionTemplate[]): DigestSet[]` - **the one place the set list is written**; Tasks 6-8 extend this and nothing else
  - `buildDigestFiles(sets: readonly DigestSet[]): Map<string, string>` - filename to exact bytes

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/digests.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { allSets, buildDigestFiles } from './digests';

const generated = buildDigestFiles(allSets(allTemplates));
const read = (name: string) => JSON.parse(generated.get(name)!);

describe('buildDigestFiles', () => {
  it('writes a file per subject and year, and a manifest', () => {
    expect([...generated.keys()]).toContain('maths.3.json');
    expect([...generated.keys()]).toContain('english.K.json');
    expect([...generated.keys()]).toContain('manifest.json');
  });

  it('holds one group per template, hashed', () => {
    const file = read('maths.3.json');
    const ids = allTemplates.filter((t) => t.subject === 'maths' && t.level === '3').map((t) => t.id);
    expect(Object.keys(file.groups).sort()).toEqual([...ids].sort());
    for (const hash of Object.values(file.groups)) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('derives a version from its own body, so identical content hashes the same', () => {
    expect(read('maths.3.json').version).toBe(
      JSON.parse(buildDigestFiles(allSets(allTemplates)).get('maths.3.json')!).version,
    );
    expect(read('maths.3.json').version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('moves the version of the set that changed, and of no other', () => {
    const edited = [...allTemplates];
    const index = edited.findIndex((t) => t.subject === 'maths' && t.level === '3');
    edited[index] = { ...edited[index], prompt: `${edited[index].prompt} ` };

    const after = buildDigestFiles(allSets(edited));
    const versionOf = (files: Map<string, string>, name: string) =>
      JSON.parse(files.get(name)!).version;

    expect(versionOf(after, 'maths.3.json')).not.toBe(versionOf(generated, 'maths.3.json'));
    expect(versionOf(after, 'maths.4.json')).toBe(versionOf(generated, 'maths.4.json'));
    // The manifest hashes the set hashes, so it moves whenever any set does.
    expect(versionOf(after, 'manifest.json')).not.toBe(versionOf(generated, 'manifest.json'));
  });

  it('ends every file with a newline and indents at two spaces', () => {
    for (const body of generated.values()) {
      expect(body.endsWith('\n')).toBe(true);
      expect(body).toContain('\n  "version"');
    }
  });
});

const digestDir = join(import.meta.dirname, '..', '..', 'fixtures', 'digests');

describe('the committed digests', () => {
  it('are exactly the files the generator writes', () => {
    expect(readdirSync(digestDir).filter((n) => n.endsWith('.json')).sort()).toEqual(
      [...generated.keys()].sort(),
    );
  });

  it.each([...generated.keys()])('%s is byte-identical to what the engine generates', (name) => {
    expect(readFileSync(join(digestDir, name), 'utf8')).toBe(generated.get(name));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/digests.test.ts`
Expected: FAIL - `Failed to resolve import "./digests"`.

- [ ] **Step 3: Write the digest builder**

Create `scripts/fixtures/digests.ts`:

```ts
import { compareYearLevels } from '../../src/lib/curriculum';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { digest } from './canonical';
import { corpusCases, DRAWS } from './corpus';

/** Two spaces, because the digest diff is how an engine change gets reviewed. */
const INDENT = 2;

/**
 * One named collection of hashes. Every digest file has this shape - corpus
 * years, the expression sets, grading and profile folding alike - so a Swift
 * client reads one format rather than four.
 */
export interface DigestSet {
  name: string;
  /** Group name to twelve hex characters. A group is a template id or a scenario. */
  groups: Map<string, string>;
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export function corpusSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  const sets: DigestSet[] = [];
  for (const subject of unique(templates.map((t) => t.subject)).sort()) {
    const forSubject = templates.filter((t) => t.subject === subject);
    for (const level of unique(forSubject.map((t) => t.level)).sort(compareYearLevels)) {
      const groups = new Map<string, string>();
      for (const template of forSubject.filter((t) => t.level === level)) {
        groups.set(template.id, digest(corpusCases(template)));
      }
      sets.push({ name: `${subject}.${level}`, groups });
    }
  }
  return sets;
}

/**
 * Every set the digests cover, in file order.
 *
 * **This is the one place the list is written.** `build-fixtures.ts`,
 * `emit-fixtures.ts` and the drift guard all call it, so a set added here
 * reaches all three at once. Written out in three places instead,
 * `emit-fixtures.ts` would stamp an emitted corpus with a manifest version
 * computed over a different set list than the committed manifest covers - and
 * the whole point of that stamp is that a stale vendored copy names itself.
 */
export function allSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  return [...corpusSets(templates)];
}

/**
 * Every digest file and the manifest, as the exact bytes that get committed.
 *
 * Returning bytes rather than objects is what lets the drift guard compare
 * against the files on disk without re-deciding how to format them - the same
 * reason `buildPacks` does it.
 */
export function buildDigestFiles(sets: readonly DigestSet[]): Map<string, string> {
  const files = new Map<string, string>();
  const versions: { set: string; version: string }[] = [];

  for (const set of sets) {
    const groups = Object.fromEntries([...set.groups].sort(([a], [b]) => (a < b ? -1 : 1)));
    // The version is over the body without itself, which it would otherwise
    // have to contain.
    const body = { set: set.name, draws: DRAWS, groups };
    const version = digest([JSON.stringify(body, null, INDENT)]);
    files.set(`${set.name}.json`, `${JSON.stringify({ version, ...body }, null, INDENT)}\n`);
    versions.push({ set: set.name, version });
  }

  const manifest = {
    sets: sets.map((s, i) => ({
      set: s.name,
      groups: s.groups.size,
      version: versions[i].version,
    })),
  };
  files.set(
    'manifest.json',
    `${JSON.stringify(
      { version: digest(versions.map((v) => `${v.set}:${v.version}`)), ...manifest },
      null,
      INDENT,
    )}\n`,
  );

  return files;
}
```

- [ ] **Step 4: Write the writer**

Create `scripts/build-fixtures.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { allTemplates } from '../src/content/catalog';
import { allSets, buildDigestFiles } from './fixtures/digests';

const DIGEST_DIR = 'fixtures/digests';

/**
 * Writes the committed digests.
 *
 * **Running this is a deliberate act.** The drift guard exists to make an
 * unintended engine change red, and regenerating is the wrong reflex for a red
 * build - it is what would turn the suite into a rubber stamp. Regenerate only
 * in a commit that says why, and never in the same commit as the engine change
 * itself.
 */
async function main(): Promise<void> {
  const files = buildDigestFiles(allSets(allTemplates));
  await mkdir(DIGEST_DIR, { recursive: true });
  for (const [name, body] of files) await writeFile(join(DIGEST_DIR, name), body, 'utf8');
  console.log(`Wrote ${files.size} files to ${DIGEST_DIR}`);
}

main();
```

Add to `package.json` scripts, immediately after `"content:build"`:

```json
"fixtures:build": "tsx scripts/build-fixtures.ts",
```

- [ ] **Step 5: Generate the digests and run the test**

Run: `npm run fixtures:build && npx vitest run scripts/fixtures/digests.test.ts && npm run typecheck`
Expected: `Wrote 15 files to fixtures/digests`; PASS; typecheck clean.

- [ ] **Step 6: Verify the drift guard by breaking it**

1. Add a trailing space to any template's `prompt` in `src/content/maths/3.ts`.
2. Run `npm run content:build` (so the pack guard is not what reddens), then
   `npx vitest run scripts/fixtures/digests.test.ts`.
   Expected: FAIL, naming `maths.3.json` as not byte-identical.
3. `git checkout src/content/maths/3.ts && npm run content:build`. Confirm `git status --short` is clean and the test passes again.

- [ ] **Step 7: Commit**

```bash
git add scripts/fixtures/digests.ts scripts/fixtures/digests.test.ts scripts/build-fixtures.ts package.json fixtures/digests
git commit -m "Commit a digest of the corpus, and guard it against drift"
```

---

### Task 4: Emitting the full corpus for debugging

A digest names the template and nothing finer. This is what turns "`maths.4.angles.larger-angle` differs" into a hundred readable cases, and it is also what a Swift developer vendors to assert field by field.

**Files:**
- Create: `scripts/emit-fixtures.ts`
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- Consumes: `DRAWS`, `seedFor` from `./fixtures/corpus`; `allSets`, `buildDigestFiles` from `./fixtures/digests`; `allTemplates` from `src/content/catalog`.
- Produces: nothing importable. A CLI: `npm run fixtures:emit -- [templateIdSubstring]`.

- [ ] **Step 1: Add the gitignore rule**

Append to `.gitignore`:

```
# the emitted golden corpus - ~110 MB, rebuilt in seconds by `npm run fixtures:emit`
/fixtures/corpus/
```

- [ ] **Step 2: Write the emitter**

Create `scripts/emit-fixtures.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRng } from '../src/lib/rng';
import { generateQuestion } from '../src/lib/templates/generate';
import { allTemplates } from '../src/content/catalog';
import { DRAWS, seedFor } from './fixtures/corpus';
import { allSets, buildDigestFiles } from './fixtures/digests';

const CORPUS_DIR = 'fixtures/corpus';

/**
 * Writes the full corpus - about 110 MB - which is never committed.
 *
 * It carries the manifest version of the run that produced it, so a copy
 * vendored into another repository names itself as stale rather than passing
 * quietly against an engine that has moved on.
 *
 * Takes an optional substring so a single failing template can be read without
 * rebuilding all of it: `npm run fixtures:emit -- angles.larger-angle`.
 */
async function main(): Promise<void> {
  const filter = process.argv[2];
  const templates = filter ? allTemplates.filter((t) => t.id.includes(filter)) : allTemplates;
  if (templates.length === 0) {
    console.error(`No template id contains ${JSON.stringify(filter)}`);
    process.exitCode = 1;
    return;
  }

  const version = JSON.parse(buildDigestFiles(allSets(allTemplates)).get('manifest.json')!).version;
  await mkdir(CORPUS_DIR, { recursive: true });

  const bySet = new Map<string, unknown[]>();
  for (const template of templates) {
    const key = `${template.subject}.${template.level}`;
    const cases = bySet.get(key) ?? [];
    for (let draw = 0; draw < DRAWS; draw++) {
      const seed = seedFor(template.id, draw);
      const q = generateQuestion(template, createRng(seed));
      cases.push({
        templateId: template.id,
        seed,
        prompt: q.prompt,
        answer: q.answer,
        answerType: q.answerType,
        ...(q.choices ? { choices: q.choices } : {}),
        ...(q.hint !== undefined ? { hint: q.hint } : {}),
        vars: q.vars,
        ...(q.figure ? { figure: q.figure } : {}),
      });
    }
    bySet.set(key, cases);
  }

  for (const [set, cases] of bySet) {
    await writeFile(
      join(CORPUS_DIR, `${set}.json`),
      `${JSON.stringify({ version, set, draws: DRAWS, cases }, null, 2)}\n`,
      'utf8',
    );
  }

  console.log(`Wrote ${bySet.size} files to ${CORPUS_DIR} (${templates.length} templates)`);
}

main();
```

Add to `package.json` scripts, immediately after `"fixtures:build"`:

```json
"fixtures:emit": "tsx scripts/emit-fixtures.ts",
```

- [ ] **Step 3: Run it both ways**

Run: `npm run fixtures:emit`
Expected: `Wrote 14 files to fixtures/corpus (505 templates)`. Confirm `du -sh fixtures/corpus` is roughly 110 MB.

Run: `npm run fixtures:emit -- subtraction.difference`
Expected: `Wrote 1 files to fixtures/corpus (1 templates)`.

Run: `git status --short`
Expected: `fixtures/corpus/` does not appear.

- [ ] **Step 4: Commit**

```bash
rm -rf fixtures/corpus
git add scripts/emit-fixtures.ts .gitignore package.json
git commit -m "Emit the full corpus on demand, since a digest names no field"
```

---

### Task 5: The hand-authored expression traps

**The one place in this suite where a human asserts what is correct.** Everything else proves agreement; this proves the oracle itself is right, and it closes the gap the API extraction handoff names - no test in this repo currently covers a negative half.

**Files:**
- Create: `scripts/fixtures/expr-traps.ts`, `scripts/fixtures/expr-traps.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `FUNCTIONS`, `type Scope`, `type Value` from `src/lib/expr`.
- Produces:
  - `interface TrapCase { expr: string; scope?: Scope; expect: Value }`
  - `EXPR_TRAPS: readonly TrapCase[]`

- [ ] **Step 1: Write the trap list**

Create `scripts/fixtures/expr-traps.ts`:

```ts
import type { Scope, Value } from '../../src/lib/expr';

/**
 * Expressions whose expected values were written by a human, not read off the
 * engine.
 *
 * Everywhere else in this suite the engine is the oracle and a fixture proves
 * *agreement* - a bug here would be faithfully reproduced in Swift and both
 * sides would stay green. This file is the exception, and it is deliberate. The
 * cases below are the places where idiomatic Swift silently diverges from the
 * JavaScript the content was authored against, and where this repo has no
 * coverage at all: `expr.test.ts` asserts `round(2.5)` is `3` and nothing on the
 * other side of zero, `^` is tested only for right-associativity, and `&&` is
 * never given a truthy non-boolean.
 *
 * Harvesting from content cannot reach them. The 505 shipped templates use `^`
 * **not once**, and never use `ceil`, `trunc`, `sign`, `sqrt` or `isInt`.
 *
 * **When this file and the engine disagree, decide which is wrong.** Do not
 * edit an expectation to match the engine without saying why in the commit -
 * that is the whole value of the file.
 */
export interface TrapCase {
  expr: string;
  scope?: Scope;
  expect: Value;
}

export const EXPR_TRAPS: readonly TrapCase[] = [
  // Rounding at .5, on both sides of zero. `Math.round` is half-up; Swift's
  // `rounded()` is half-away-from-zero, so the negatives are where they part.
  { expr: 'round(2.5)', expect: 3 },
  { expr: 'round(3.5)', expect: 4 },
  { expr: 'round(-2.5)', expect: -2 },
  { expr: 'round(-3.5)', expect: -3 },
  { expr: 'round(2.4)', expect: 2 },
  { expr: 'round(-2.4)', expect: -2 },

  // Unary minus against the power operator. `^` binds tighter, so this is the
  // negation of a square rather than the square of a negative.
  { expr: '-2 ^ 2', expect: -4 },
  { expr: '(-2) ^ 2', expect: 4 },
  { expr: '2 ^ 3 ^ 2', expect: 512 },
  { expr: '-2 ^ 3', expect: -8 },

  // `&&` and `||` yield booleans here, not the operand.
  { expr: '1 && 2', expect: true },
  { expr: '0 || 3', expect: true },
  { expr: '0 && 1', expect: false },
  { expr: '!0', expect: true },
  { expr: '!2', expect: false },

  // `%` follows the dividend's sign, as in JavaScript.
  { expr: '-7 % 3', expect: -1 },
  { expr: '7 % -3', expect: 1 },
  { expr: '-7 % -3', expect: -1 },
  { expr: '7 % 3', expect: 1 },

  // **`mod()` is not `%`**, which is the trap nothing else here would catch.
  // It is written `((a % b) + b) % b`, so it takes the *divisor's* sign where
  // the operator takes the dividend's, and the two disagree on every
  // mixed-sign pair. A port implementing `mod` as `%` is wrong on exactly
  // these. Verified against the engine, not assumed.
  { expr: 'mod(-7, 3)', expect: 2 },
  { expr: 'mod(7, -3)', expect: -2 },
  { expr: 'mod(-7, -3)', expect: -1 },
  { expr: 'mod(7, 3)', expect: 1 },

  // Division producing a whole number. The value is what a prompt hole
  // stringifies, and `"2.0"` there marks a correct answer wrong.
  { expr: 'x / 2', scope: { x: 4 }, expect: 2 },
  { expr: 'x / 4', scope: { x: 2 }, expect: 0.5 },
  { expr: '6 / 3', expect: 2 },
  { expr: '1 / 3', expect: 0.3333333333333333 },

  // The five functions no shipped template uses, so nothing else covers them.
  { expr: 'ceil(2.1)', expect: 3 },
  { expr: 'ceil(-2.1)', expect: -2 },
  { expr: 'trunc(2.9)', expect: 2 },
  { expr: 'trunc(-2.9)', expect: -2 },
  { expr: 'sign(-4)', expect: -1 },
  { expr: 'sign(0)', expect: 0 },
  { expr: 'sign(4)', expect: 1 },
  { expr: 'sqrt(9)', expect: 3 },
  { expr: 'sqrt(2)', expect: 1.4142135623730951 },
  { expr: 'isInt(4)', expect: true },
  { expr: 'isInt(4.5)', expect: false },
  { expr: 'isInt(-4)', expect: true },

  // Floor and abs across zero, where truncation and flooring part company.
  { expr: 'floor(-2.1)', expect: -3 },
  { expr: 'floor(2.9)', expect: 2 },
  { expr: 'abs(-3)', expect: 3 },
  { expr: 'abs(-3.5)', expect: 3.5 },

  // The remaining named functions, on the awkward arguments.
  { expr: 'gcd(12, 18)', expect: 6 },
  { expr: 'gcd(7, 13)', expect: 1 },
  { expr: 'lcm(4, 6)', expect: 12 },
  { expr: 'pow(2, 10)', expect: 1024 },
  { expr: 'pow(2, 0.5)', expect: 1.4142135623730951 },
  { expr: 'min(3, -3)', expect: -3 },
  { expr: 'max(3, -3)', expect: 3 },
  { expr: 'isEven(0)', expect: true },
  { expr: 'isEven(-2)', expect: true },
  { expr: 'isOdd(-3)', expect: true },

  // Precedence and associativity of the ordinary operators.
  { expr: '2 + 3 * 4', expect: 14 },
  { expr: '(2 + 3) * 4', expect: 20 },
  { expr: '10 - 3 - 2', expect: 5 },
  { expr: '100 / 10 / 2', expect: 5 },
  { expr: '1 + 2 > 2', expect: true },
  { expr: '2 * 3 == 6', expect: true },

  // The ternary, and strings.
  { expr: 'x > 3 ? "big" : "small"', scope: { x: 5 }, expect: 'big' },
  { expr: 'x > 3 ? "big" : "small"', scope: { x: 1 }, expect: 'small' },
  { expr: '"a" == "a"', expect: true },

  // **`+` concatenates when either side is a string**, and that is the
  // stringification trap again in a branch nothing else here reaches
  // (`evaluate.ts`'s `+` case). `renderTemplateString` stringifies every hole,
  // so a port yielding "2.0" for `x / 2` yields "n2.0" for the fourth of these.
  // Left-associativity decides whether the numbers are summed first or
  // concatenated one at a time - the last two differ for that reason alone.
  { expr: '1 + "a"', expect: '1a' },
  { expr: '"a" + 1', expect: 'a1' },
  { expr: '2 + "0"', expect: '20' },
  { expr: '"n" + (x / 2)', scope: { x: 4 }, expect: 'n2' },
  { expr: '1 + 2 + "a"', expect: '3a' },
  { expr: '"a" + 1 + 2', expect: 'a12' },

  // Float accumulation, which both engines must get wrong identically.
  { expr: '0.1 + 0.2', expect: 0.30000000000000004 },
  { expr: '0.1 * 3', expect: 0.30000000000000004 },
];
```

- [ ] **Step 2: Write the test that asserts them against the engine**

Create `scripts/fixtures/expr-traps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluate, FUNCTIONS } from '../../src/lib/expr';
import { EXPR_TRAPS } from './expr-traps';

describe('the expression traps', () => {
  it.each(EXPR_TRAPS)('$expr', ({ expr, scope, expect: expected }) => {
    expect(evaluate(expr, scope ?? {})).toBe(expected);
  });

  it('names every function the language has, so a new one cannot arrive untested', () => {
    const covered = new Set(
      EXPR_TRAPS.flatMap(({ expr }) => [...expr.matchAll(/([a-zA-Z]\w*)\s*\(/g)].map((m) => m[1])),
    );
    expect(Object.keys(FUNCTIONS).filter((name) => !covered.has(name))).toEqual([]);
  });

  it('has no duplicate cases', () => {
    const keys = EXPR_TRAPS.map(({ expr, scope }) => `${expr}|${JSON.stringify(scope ?? {})}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run scripts/fixtures/expr-traps.test.ts`

Expected: every case PASSES.

**If any case fails, stop and report it rather than editing the expectation.** A disagreement here is either a real engine bug or a wrong hand-written claim, and which one it is has to be decided rather than papered over. That is the entire reason this file exists.

Two things that may need adjusting, and are not failures of the expectations:

- If `FUNCTIONS` is not a plain object keyed by function name, rewrite that one assertion against its actual shape and say so in the commit message.
- If `Object.keys(FUNCTIONS)` includes a name this list does not cover, **add a case for it** rather than deleting the assertion.

- [ ] **Step 4: Verify the guard by breaking it**

Change `{ expr: 'round(-2.5)', expect: -2 }` to `expect: -3`. Run the test.
Expected: FAIL naming `round(-2.5)`. Restore it and confirm `git diff` is clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/expr-traps.ts scripts/fixtures/expr-traps.test.ts
git commit -m "Assert what the expression language does either side of zero"
```

---

### Task 6: Harvesting the expressions the content actually uses

**Files:**
- Create: `scripts/fixtures/expr.ts`, `scripts/fixtures/expr.test.ts`
- Modify: `scripts/fixtures/digests.ts` (extend `allSets`), `scripts/fixtures/digests.test.ts`, `fixtures/digests/`

**Interfaces:**
- Consumes: `EXPR_TRAPS` from `./expr-traps`; `canonicaliseCase`, `digest` from `./canonical`; `seedFor` from `./corpus`; `type DigestSet` from `./digests`; `evaluate` from `src/lib/expr`.
- Produces:
  - `expressionsOf(template: QuestionTemplate): string[]`
  - `exprSet(templates: readonly QuestionTemplate[]): DigestSet`

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/expr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { expressionsOf, exprSet } from './expr';

const template = allTemplates.find((t) => t.id === 'maths.1.subtraction.difference')!;

describe('expressionsOf', () => {
  it('takes the answer, the constraints, the bounds and the prompt holes', () => {
    const found = expressionsOf(template);
    expect(found).toContain('x - y');
    expect(found).toContain('x > y');
    expect(found).toContain('x');
    expect(found).toContain('y');
  });

  it('is deduplicated and stable', () => {
    expect(expressionsOf(template)).toEqual(expressionsOf(template));
    expect(new Set(expressionsOf(template)).size).toBe(expressionsOf(template).length);
  });

  it('finds every distinct expression the shipped content holds', () => {
    const all = new Set(allTemplates.flatMap(expressionsOf));
    expect(all.size).toBeGreaterThan(700);
  });
});

describe('exprSet', () => {
  it('groups the traps under their own name, beside a group per template', () => {
    const set = exprSet(allTemplates);
    expect(set.name).toBe('expr');
    expect(set.groups.has('traps')).toBe(true);
    expect(set.groups.has(template.id)).toBe(true);
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...exprSet(allTemplates).groups]).toEqual([...exprSet(allTemplates).groups]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/expr.test.ts`
Expected: FAIL - `Failed to resolve import "./expr"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/fixtures/expr.ts`:

```ts
import { evaluate } from '../../src/lib/expr';
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, digest } from './canonical';
import { seedFor } from './corpus';
import type { DigestSet } from './digests';
import { EXPR_TRAPS } from './expr-traps';

/** How many real scopes each of a template's expressions is evaluated against. */
const SCOPES_PER_TEMPLATE = 5;

/**
 * Every expression string a template holds, deduplicated and in a stable order.
 *
 * This reaches the language as content actually uses it, which is the half the
 * hand-written traps cannot: 1,377 distinct strings across the shipped corpus. It
 * is also exactly why the traps exist beside it - content uses `^` not once and
 * never uses `ceil`, `trunc`, `sign`, `sqrt` or `isInt`.
 */
export function expressionsOf(template: QuestionTemplate): string[] {
  const found: string[] = [];
  const add = (expr: unknown): void => {
    if (typeof expr === 'string' && expr.length > 0) found.push(expr);
  };

  add(template.answer);
  for (const constraint of template.constraints ?? []) add(constraint);

  for (const spec of template.vars) {
    if (spec.kind === 'int' || spec.kind === 'number') {
      add(spec.min);
      add(spec.max);
    } else if (spec.kind === 'expr') {
      add(spec.expr);
    }
  }

  for (const text of [template.prompt, template.hint]) {
    for (const hole of String(text ?? '').matchAll(/\{([^}]*)\}/g)) add(hole[1]);
  }

  for (const distractor of template.choices?.distractors ?? []) add(distractor);

  // A figure's parameters are expressions too, evaluated against this same
  // bound scope by `buildFigure`. Every `FigureSpec` field is a single `Expr`
  // apart from the `kind` discriminant, so walking the object is exhaustive
  // and stays exhaustive when a twelfth kind is added - which is the reason it
  // is written as a walk rather than a list of field names.
  if (template.figure) {
    for (const [field, value] of Object.entries(template.figure)) {
      if (field !== 'kind') add(value);
    }
  }

  // The `jitter` bounds, used when authored distractors run short. No shipped
  // template carries one today, so this collects nothing yet; it is here so
  // that the first one to use it is covered rather than silently uncovered.
  if (template.choices?.jitter) {
    add(template.choices.jitter.min);
    add(template.choices.jitter.max);
  }

  return [...new Set(found)];
}

/**
 * The expression set: one group per template for what content uses, plus
 * `traps` for the hand-authored cases.
 *
 * **An expression needs a scope, and this needs no engine instrumentation.**
 * `q.vars` is the bound scope and is already exposed on `GeneratedQuestion`, so
 * five draws supply five real bindings and each expression is seen against
 * several rather than one lucky one. Evaluating a variable's *bound* against the
 * final scope rather than the partial one it was drawn under is sound: the final
 * scope is a superset, and a variable may only reference ones declared before
 * it.
 *
 * An expression that throws under a given scope records the throw rather than
 * being skipped. A port that fails to throw where this one does has diverged
 * just as surely as one returning a different number.
 */
export function exprSet(templates: readonly QuestionTemplate[]): DigestSet {
  const groups = new Map<string, string>();

  groups.set(
    'traps',
    digest(
      EXPR_TRAPS.map(({ expr, scope, expect }) =>
        canonicaliseCase([
          ['expr', expr],
          ['scope', JSON.stringify(scope ?? {})],
          ['value', String(expect)],
        ]),
      ),
    ),
  );

  for (const template of templates) {
    const expressions = expressionsOf(template);
    if (expressions.length === 0) continue;

    const cases: string[] = [];
    for (let draw = 0; draw < SCOPES_PER_TEMPLATE; draw++) {
      const scope = generateQuestion(template, createRng(seedFor(template.id, draw))).vars;
      for (const expr of expressions) {
        let value: string;
        try {
          value = String(evaluate(expr, scope));
        } catch (error) {
          value = `throws: ${(error as Error).message}`;
        }
        cases.push(
          canonicaliseCase([
            ['expr', expr],
            ['scope', JSON.stringify(scope)],
            ['value', value],
          ]),
        );
      }
    }
    groups.set(template.id, digest(cases));
  }

  return { name: 'expr', groups };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/fixtures/expr.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

If `canonicaliseCase` throws because a scope value or an error message carries a separator, that is the guard doing its job - report it rather than loosening the check.

- [ ] **Step 5: Wire it into the digests**

**One edit, in `scripts/fixtures/digests.ts`.** `allSets` is the single place
the list lives, so `build-fixtures.ts`, `emit-fixtures.ts` and the drift guard
all pick the new set up without being touched. Add the import and extend the
returned array:

```ts
import { exprSet } from './expr';
```

```ts
export function allSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  return [...corpusSets(templates), exprSet(templates)];
}
```

This closes an import cycle in the module graph - `expr.ts` imports the
`DigestSet` *type* from `digests.ts` and `digests.ts` now imports the `exprSet`
*function* back. It resolves because the type import is erased at compile time
and `exprSet` is only called, never evaluated at module load. If the runtime
disagrees, move `DigestSet` into its own `scripts/fixtures/types.ts` and have
both import from there; say so in the commit message.

Then add to the `describe('buildDigestFiles')` block in `scripts/fixtures/digests.test.ts`:

```ts
  it('carries the expression set beside the corpus years', () => {
    expect([...generated.keys()]).toContain('expr.json');
    expect(Object.keys(read('expr.json').groups)).toContain('traps');
  });
```

- [ ] **Step 6: Regenerate, test, and commit**

Run: `npm run fixtures:build && npm test && npm run typecheck`
Expected: `Wrote 16 files`; all green.

```bash
git add scripts/fixtures/expr.ts scripts/fixtures/expr.test.ts scripts/fixtures/digests.ts scripts/fixtures/digests.test.ts fixtures/digests
git commit -m "Harvest the expressions content uses, against the scopes it uses them in"
```

---

### Task 7: The grading set

**Files:**
- Create: `scripts/fixtures/grading.ts`, `scripts/fixtures/grading.test.ts`
- Modify: `scripts/fixtures/digests.ts` (extend `allSets`), `scripts/fixtures/digests.test.ts`, `fixtures/digests/`

**Interfaces:**
- Consumes: `gradeAnswer` from `src/lib/session/grade`; `canonicaliseCase`, `digest` from `./canonical`; `seedFor` from `./corpus`; `type DigestSet` from `./digests`.
- Produces:
  - `responsesFor(question: Question): string[]`
  - `gradingSet(templates: readonly QuestionTemplate[]): DigestSet`

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/grading.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import { gradingSet, responsesFor } from './grading';

const questionFor = (id: string) =>
  generateQuestion(allTemplates.find((t) => t.id === id)!, createRng(`${id}:0`));

describe('responsesFor', () => {
  it('offers the answer, the answer padded, and junk', () => {
    const q = questionFor('maths.1.subtraction.difference');
    const responses = responsesFor(q);
    expect(responses).toContain(String(q.answer));
    expect(responses).toContain(` ${String(q.answer)} `);
    expect(responses).toContain('');
    expect(responses).toContain('abc');
  });

  it('straddles the tolerance for a numeric answer', () => {
    const q = questionFor('maths.1.subtraction.difference');
    const responses = responsesFor(q);
    expect(responses).toContain(String(Number(q.answer) + 1e-10));
    expect(responses).toContain(String(Number(q.answer) + 1e-8));
  });

  it('offers all eight boolean spellings for a true/false question', () => {
    const template = allTemplates.find(
      (t) => generateQuestion(t, createRng(`${t.id}:0`)).answerType === 'boolean',
    )!;
    const responses = responsesFor(generateQuestion(template, createRng(`${template.id}:0`)));
    for (const said of ['true', 'yes', 't', 'y', 'false', 'no', 'f', 'n']) {
      expect(responses).toContain(said);
    }
  });

  it('is deduplicated', () => {
    const responses = responsesFor(questionFor('maths.1.subtraction.difference'));
    expect(new Set(responses).size).toBe(responses.length);
  });
});

describe('gradingSet', () => {
  it('groups by template and hashes', () => {
    const set = gradingSet(allTemplates);
    expect(set.name).toBe('grading');
    expect(set.groups.size).toBe(allTemplates.length);
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...gradingSet(allTemplates).groups]).toEqual([...gradingSet(allTemplates).groups]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/grading.test.ts`
Expected: FAIL - `Failed to resolve import "./grading"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/fixtures/grading.ts`:

```ts
import { createRng } from '../../src/lib/rng';
import { gradeAnswer } from '../../src/lib/session/grade';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { Question, QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, digest } from './canonical';
import { seedFor } from './corpus';
import type { DigestSet } from './digests';

/** What a child may have tapped or typed for a true/false question. */
const BOOLEAN_SPELLINGS = ['true', 'yes', 't', 'y', 'false', 'no', 'f', 'n'];

/**
 * The responses each question is graded against.
 *
 * The near-misses are the content. `gradeAnswer` compares a numeric answer with
 * `EPSILON` (1e-9), so `answer + 1e-10` must be correct and `answer + 1e-8` must
 * not - a port choosing a different tolerance, or comparing exactly, parts
 * company on exactly one of those two and on nothing else.
 */
export function responsesFor(question: Question): string[] {
  const answer = String(question.answer);
  const responses = [
    answer,
    ` ${answer} `,
    answer.toUpperCase(),
    answer.toLowerCase(),
    '',
    'abc',
    '0',
  ];

  if (question.answerType === 'boolean' || typeof question.answer === 'boolean') {
    responses.push(...BOOLEAN_SPELLINGS);
  }

  if (question.answerType === 'number' || typeof question.answer === 'number') {
    const n = Number(question.answer);
    responses.push(
      String(n + 1e-10),
      String(n - 1e-10),
      String(n + 1e-8),
      String(n - 1e-8),
      String(n + 1),
      `${n}.0`,
      `0${n}`,
    );
  }

  for (const choice of question.choices ?? []) responses.push(String(choice));

  return [...new Set(responses)];
}

/**
 * Draw 0 of every template - 505 questions, covering all four answer types -
 * each graded against its own response list.
 *
 * One draw a template rather than all hundred: grading reads the answer and the
 * answer type and nothing else about how the question was drawn, so the
 * hundredth draw exercises the same path as the first. What varies usefully is
 * the *response*, which is why that list is constructed rather than sampled.
 *
 * `response` and `recorded` go through `JSON.stringify` rather than raw, because
 * a response is deliberately allowed to be empty or to carry padding, and an
 * unquoted empty value is indistinguishable from an absent one.
 */
export function gradingSet(templates: readonly QuestionTemplate[]): DigestSet {
  const groups = new Map<string, string>();

  for (const template of templates) {
    const question = generateQuestion(template, createRng(seedFor(template.id, 0)));
    const cases = responsesFor(question).map((response) => {
      const grade = gradeAnswer(question, response);
      return canonicaliseCase([
        ['answer', String(question.answer)],
        ['answerType', question.answerType],
        ['response', JSON.stringify(response)],
        ['correct', String(grade.correct)],
        ['recorded', JSON.stringify(grade.response)],
      ]);
    });
    groups.set(template.id, digest(cases));
  }

  return { name: 'grading', groups };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/fixtures/grading.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Wire it into the digests**

**One edit, in `scripts/fixtures/digests.ts`** - `allSets` is the only call
site. Add the import and extend the returned array:

```ts
import { gradingSet } from './grading';
```

```ts
export function allSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  return [...corpusSets(templates), exprSet(templates), gradingSet(templates)];
}
```

Then add to the `describe('buildDigestFiles')` block in `scripts/fixtures/digests.test.ts`:

```ts
  it('carries the grading set', () => {
    expect([...generated.keys()]).toContain('grading.json');
  });
```

- [ ] **Step 6: Regenerate, test, and commit**

Run: `npm run fixtures:build && npm test && npm run typecheck`
Expected: `Wrote 17 files`; all green.

```bash
git add scripts/fixtures/grading.ts scripts/fixtures/grading.test.ts scripts/fixtures/digests.ts scripts/fixtures/digests.test.ts fixtures/digests
git commit -m "Grade every answer type against the responses either side of the tolerance"
```

---

### Task 8: The profile folding set

**Files:**
- Create: `scripts/fixtures/profile.ts`, `scripts/fixtures/profile.test.ts`
- Modify: `scripts/fixtures/digests.ts` (extend `allSets`), `scripts/fixtures/digests.test.ts`, `fixtures/digests/`

**Interfaces:**
- Consumes: `buildProfile`, `nextSkill`, `REVIEW_INTERVALS_MS`, `MIN_OBSERVATIONS`, `type Observation`, `type TopicSkill` from `src/lib/analytics/profile`; `canonicaliseCase`, `digest` from `./canonical`; `type DigestSet` from `./digests`.
- Produces:
  - `interface Scenario { name: string; observations: Observation[] }`
  - `SCENARIOS: readonly Scenario[]`
  - `profileSet(): DigestSet`

- [ ] **Step 1: Write the failing test**

Create `scripts/fixtures/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_OBSERVATIONS } from '../../src/lib/analytics/profile';
import { profileSet, SCENARIOS } from './profile';

describe('SCENARIOS', () => {
  it('names each one once', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reaches each threshold rather than sampling at random', () => {
    const names = SCENARIOS.map((s) => s.name);
    for (const name of [
      'below-min-observations',
      'struggling',
      'developing',
      'secure',
      'long-run-strength',
      'days-across-offsets',
      'out-of-order-days',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('stops short of MIN_OBSERVATIONS where it says it does', () => {
    const short = SCENARIOS.find((s) => s.name === 'below-min-observations')!;
    expect(short.observations.length).toBeLessThan(MIN_OBSERVATIONS);
  });

  it('accumulates strength over a few hundred observations', () => {
    expect(
      SCENARIOS.find((s) => s.name === 'long-run-strength')!.observations.length,
    ).toBeGreaterThanOrEqual(300);
  });
});

describe('profileSet', () => {
  it('groups by scenario and hashes', () => {
    const set = profileSet();
    expect(set.name).toBe('profile');
    expect([...set.groups.keys()].sort()).toEqual(SCENARIOS.map((s) => s.name).sort());
    for (const hash of set.groups.values()) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    expect([...profileSet().groups]).toEqual([...profileSet().groups]);
  });

  it('distinguishes the day scenarios, which is the trap it exists for', () => {
    const groups = profileSet().groups;
    expect(groups.get('days-across-offsets')).not.toBe(groups.get('out-of-order-days'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/fixtures/profile.test.ts`
Expected: FAIL - `Failed to resolve import "./profile"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/fixtures/profile.ts`:

```ts
import {
  buildProfile,
  nextSkill,
  REVIEW_INTERVALS_MS,
  type Observation,
  type TopicSkill,
} from '../../src/lib/analytics/profile';
import { canonicaliseCase, digest } from './canonical';
import type { DigestSet } from './digests';

/**
 * A fixed moment to count days from, so nothing here reads the clock. Midnight
 * UTC on 1 January 2026 - `now` is injected everywhere in the engine, which is
 * what makes this set possible at all.
 */
const EPOCH = Date.UTC(2026, 0, 1);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Sydney in winter, which is where the day boundary actually falls for this family. */
const SYDNEY = 600;

export interface Scenario {
  name: string;
  observations: Observation[];
}

const answer = (over: Partial<Observation> = {}): Observation => ({
  topic: 'subtraction',
  level: '1',
  correct: true,
  timeTakenMs: 4000,
  answeredAt: EPOCH,
  offsetMinutes: SYDNEY,
  ...over,
});

/** `n` answers, one an hour apart from `startAt`. */
const run = (
  n: number,
  correct: (i: number) => boolean,
  startAt = EPOCH,
  offsetMinutes = SYDNEY,
): Observation[] =>
  Array.from({ length: n }, (_, i) =>
    answer({ correct: correct(i), answeredAt: startAt + i * HOUR, offsetMinutes }),
  );

/**
 * Sequences built to reach each threshold, not sampled at random.
 *
 * Two traps are the point of the set. **`strength` is a recency-weighted float**
 * folded one answer at a time, so a few hundred observations is where two
 * languages' accumulation would part company if it were going to.
 * **`correctDays` is the child's day, not the server's** - each observation
 * carries the offset it was given at, and the fold only ever counts a day later
 * than the last counted, so answers arriving out of order undercount. Mastery is
 * delayed, never faked, and that asymmetry is exactly what a port implements
 * backwards.
 */
export const SCENARIOS: readonly Scenario[] = [
  { name: 'empty', observations: [] },
  { name: 'below-min-observations', observations: run(3, () => true) },
  { name: 'struggling', observations: run(12, (i) => i % 5 === 0) },
  { name: 'developing', observations: run(12, (i) => i % 3 !== 0) },
  {
    name: 'secure',
    observations: [
      ...run(6, () => true, EPOCH),
      ...run(6, () => true, EPOCH + DAY),
      ...run(6, () => true, EPOCH + 2 * DAY),
    ],
  },
  { name: 'long-run-strength', observations: run(300, (i) => i % 4 !== 0) },
  {
    name: 'days-across-offsets',
    // One instant is a different local day either side of the dateline, and a
    // missing offset means UTC rather than the last one seen.
    observations: [
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: 0 }),
      answer({ answeredAt: EPOCH + 13 * HOUR, offsetMinutes: -480 }),
      answer({ answeredAt: EPOCH + 37 * HOUR, offsetMinutes: SYDNEY }),
      answer({ answeredAt: EPOCH + 37 * HOUR, offsetMinutes: undefined }),
    ],
  },
  {
    name: 'out-of-order-days',
    // Day 3, then day 1. The second must not count, which is the undercount.
    observations: [
      answer({ answeredAt: EPOCH + 2 * DAY }),
      answer({ answeredAt: EPOCH }),
      answer({ answeredAt: EPOCH + 3 * DAY }),
    ],
  },
  { name: 'all-wrong', observations: run(10, () => false) },
  { name: 'wrong-then-right', observations: run(20, (i) => i >= 10) },
  { name: 'right-then-wrong', observations: run(20, (i) => i < 10) },
  ...REVIEW_INTERVALS_MS.map((interval, i) => ({
    name: `review-interval-${i}`,
    observations: [
      ...Array.from({ length: i + 1 }, (_, d) => answer({ answeredAt: EPOCH + d * DAY })),
      answer({ answeredAt: EPOCH + (i + 1) * DAY + interval }),
    ],
  })),
];

/** `lastCorrectDay` stringifies as `"null"` where it is unset, and that is intended - a null day and day 0 are different things. */
const canonicalSkill = (skill: TopicSkill): string =>
  canonicaliseCase([
    ['topic', skill.topic],
    ['level', skill.level],
    ['attempts', String(skill.attempts)],
    ['correct', String(skill.correct)],
    ['strength', String(skill.strength)],
    ['streak', String(skill.streak)],
    ['correctDays', String(skill.correctDays)],
    ['lastCorrectDay', String(skill.lastCorrectDay)],
    ['totalTimeMs', String(skill.totalTimeMs)],
    ['lastAnsweredAt', String(skill.lastAnsweredAt)],
  ]);

/**
 * Each scenario folded twice: once through `nextSkill` a step at a time - so an
 * intermediate state that diverges names the observation it diverged on - and
 * once through `buildProfile`, which is the same arithmetic the stored row goes
 * through.
 */
export function profileSet(): DigestSet {
  const groups = new Map<string, string>();

  for (const { name, observations } of SCENARIOS) {
    const cases: string[] = [];
    let skill: TopicSkill | undefined;
    for (const observation of observations) {
      skill = nextSkill(skill, observation);
      cases.push(canonicalSkill(skill));
    }
    for (const built of buildProfile(observations).skills) cases.push(canonicalSkill(built));
    groups.set(name, digest(cases));
  }

  return { name: 'profile', groups };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/fixtures/profile.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Wire it into the digests**

**One edit, in `scripts/fixtures/digests.ts`** - `allSets` is the only call
site. Add the import and extend the returned array. `profileSet` takes no
argument: its inputs are the hand-built scenarios, not the content.

```ts
import { profileSet } from './profile';
```

```ts
export function allSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  return [...corpusSets(templates), exprSet(templates), gradingSet(templates), profileSet()];
}
```

Then add to the `describe('buildDigestFiles')` block in `scripts/fixtures/digests.test.ts`:

```ts
  it('carries the profile set', () => {
    expect([...generated.keys()]).toContain('profile.json');
  });
```

- [ ] **Step 6: Regenerate, test, and commit**

Run: `npm run fixtures:build && npm test && npm run typecheck`
Expected: `Wrote 18 files`; all green.

```bash
git add scripts/fixtures/profile.ts scripts/fixtures/profile.test.ts scripts/fixtures/digests.ts scripts/fixtures/digests.test.ts fixtures/digests
git commit -m "Fold observations to a skill row, across the day boundary and out of order"
```

---

### Task 9: Keep a regeneration commit out of the deploy pipeline

**Files:**
- Modify: `scripts/changed-apps.ts`, `scripts/changed-apps.test.ts`

- [ ] **Step 1: Write the failing test**

In `scripts/changed-apps.test.ts`, add to the `describe('changedApps')` block, immediately after the `'deploys neither half for prose'` test:

```ts
  it('deploys neither half for the fixture digests, which ship nowhere', () => {
    expect(changedApps(['fixtures/digests/maths.3.json', 'fixtures/digests/manifest.json'])).toEqual(
      neither,
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/changed-apps.test.ts`
Expected: FAIL - receives `{ api: true, web: true }`, because a path matching no rule deploys both.

- [ ] **Step 3: Add the rule**

In `scripts/changed-apps.ts`, replace the `IGNORED` declaration and its comment:

```ts
/**
 * Prose, and the fixture digests. Neither ships anywhere - the digests are not
 * in the Next bundle and not in the API's Docker context, which copies only
 * `src/lib`, `src/content`, `packages/core` and `apps/api` - so a regeneration
 * commit must not roll production for a test artifact.
 */
const IGNORED = [/\.md$/, /^docs\//, /^\.claude\//, /^\.superpowers\//, /^fixtures\//];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/changed-apps.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/changed-apps.ts scripts/changed-apps.test.ts
git commit -m "Ship nothing for a fixture regeneration, since the digests deploy nowhere"
```

---

### Task 10: Write down what the corpus is and how to treat it

The rule that regeneration is deliberate cannot be a test, so it has to be documentation. This task is where it lands.

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/notes/2026-08-26-api-extraction-handoff.md`

- [ ] **Step 1: Add the section to `CLAUDE.md`**

Insert a new `## The golden corpus` section immediately before `## Setup`:

```markdown
## The golden corpus

The engine here is the **oracle** for the Swift port in `learnr-ios`, and
`fixtures/` is where that is written down. `npm run fixtures:build` regenerates
it; `npm run fixtures:emit` writes the full corpus for reading.

**What is committed is a digest, not the corpus.** 505 templates drawn 100 times
is 33 MB of compact JSON, and ~110 MB as the emitter actually writes it - indented
two spaces, because it exists to be read - two thirds of it figures, where one `clock` drawing is 6.4 KB against
a `polygon`'s 169 bytes - and 110 MB cannot be reviewed as a diff, which is the
whole point of regeneration being its own reviewable commit. So
`fixtures/digests/` holds one twelve-character hash per template (~100 KB) and
`fixtures/corpus/` is gitignored and rebuilt in about three seconds.

**The seed is contract**: `` `${templateId}:${draw}` ``, draws 0-99, because
`createRng` hashes the string itself. It differs deliberately from a live
session's `` `${sessionSeed}:${drawNumber}` `` - a fixture needs a seed stable
across regeneration and independent of any session.

**The canonical form is not JSON** (`scripts/fixtures/canonical.ts`). Two JSON
encoders in two languages have to agree about escaping first, and a prompt
carries the minus sign, times, divide, degree and dollar - exactly where they
differ. So a case is written out by hand: name and value join with `U+001F`,
fields with `U+001E`, cases with a newline, and the canonicaliser throws on a
value containing any of the three. Every value is its JavaScript `String(v)`
form, which is the rule that earns its keep - `generateQuestion` already keys the
expected answer and the distractor dedup off `String(value)`, so a port yielding
`"2.0"` where this says `"2"` marks a correct answer wrong. Hashing that form
makes the digest *test* it. `vars` are sorted by name, because a Swift dictionary
has no order to borrow.

**A field left out of the canonical form is invisible forever**, so the
completeness check is the compiler's: `CanonicalCovers` compares key sets both
ways against `GeneratedQuestion` and against each arm of `Mark`. It is
`Mirrored`'s trick from `apps/api/src/schemas/dto.ts` one level up, and it exists
for the identical reason - optional fields are the ones whose loss is invisible,
and `choices`, `hint` and `figure` are all optional.

**Regenerating is not the fix for a red build.**
`scripts/fixtures/digests.test.ts` reddens when the engine's output moves, and
the whole value of that is lost if regenerating is the reflex. A deliberate
engine change regenerates the digests **in its own commit, which says why** -
never in the same commit as the change. This is the one rule here that is
documentation rather than a test, because a check for it is defeated by a rebase.

**Four sets, and one of them asserts rather than records.**
`scripts/fixtures/expr-traps.ts` carries about sixty expressions whose expected
values a human wrote down - `round(-2.5)` is `-2`, `-2 ^ 2` is `-4`, `1 && 2` is
`true` - and its test asserts them against the engine. Everywhere else the engine
is the oracle and a fixture proves *agreement*, so a bug here would be reproduced
in Swift and both sides would stay green. Harvesting cannot reach these: the 505
shipped templates use `^` **not once** and never use `ceil`, `trunc`, `sign`,
`sqrt` or `isInt`. When that file and the engine disagree, decide which is wrong.

The other three record: the main corpus; the 1,377 expressions content actually
uses, evaluated against real bound scopes (`q.vars` *is* the scope, so this needs
no engine instrumentation); and grading and profile folding over constructed
inputs built to reach each threshold.

`fixtures/` is in `changed-apps.ts`'s `IGNORED`: the digests are not in the Next
bundle and not in the API's Docker context, so a regeneration deploys nothing.
```

- [ ] **Step 2: Update the handoff note**

In `docs/superpowers/notes/2026-08-26-api-extraction-handoff.md`, replace the paragraph beginning **"No test in this repo covers a negative half."** with:

```markdown
**That gap is closed.** `scripts/fixtures/expr-traps.ts` now asserts
`round(-2.5)` is `-2`, `-2 ^ 2` is `-4` and `1 && 2` is `true`, along with `%` on
negatives and the five functions no shipped template uses, each as a value a
human wrote down rather than read off the engine. It sits inside the golden
corpus of build-order step 3 - see `## The golden corpus` in `CLAUDE.md` - which
is what the Swift port of `generate`, the figures and the session machines is
verified against.
```

Then, in the iOS client section, replace the paragraph beginning **"What gates those is step 3, not step 2."** with:

```markdown
**Step 3 has since landed, so step 4 is unblocked.** `fixtures/digests/` holds a
hash per template over 100 seeded draws, plus expression, grading and
profile-folding sets, and `npm run fixtures:emit` writes the readable corpus a
Swift test asserts field by field against. The client's own account of itself
predates content extraction and names the pack as its blocker; the packs have
been served since step 2, at `GET /content/manifest` and
`GET /content/:subject/:level`.
```

- [ ] **Step 3: Check the prose against the code**

Run: `npm test && npm run typecheck`
Expected: green - a documentation task must not have moved anything.

Re-read both edits against the files they describe. Every path, script name and identifier named in them has to exist: `npm run fixtures:build`, `npm run fixtures:emit`, `fixtures/digests/`, `fixtures/corpus/`, `scripts/fixtures/canonical.ts`, `CanonicalCovers`, `scripts/fixtures/expr-traps.ts`, `scripts/fixtures/digests.test.ts`, and `IGNORED` in `scripts/changed-apps.ts`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/notes/2026-08-26-api-extraction-handoff.md
git commit -m "Say what the corpus is, and that regenerating it is deliberate"
```

---

## Done when

- `npm test` and `npm run typecheck` are green.
- `fixtures/digests/` holds 18 files: 14 corpus years, `expr.json`, `grading.json`, `profile.json`, `manifest.json`.
- `npm run fixtures:build` twice in a row leaves `git status --short` clean.
- `npm run fixtures:emit` writes ~110 MB that `git status` does not see.
- Editing any shipped template reddens `scripts/fixtures/digests.test.ts` and names the year.
- Removing a field from `QUESTION_FIELDS` or from a `MARK_FIELDS` arm fails `npm run typecheck` and names the field.
- Changing a trap's expected value reddens `scripts/fixtures/expr-traps.test.ts` and names the expression.
- `changedApps(['fixtures/digests/maths.3.json'])` is `{ api: false, web: false }`.
