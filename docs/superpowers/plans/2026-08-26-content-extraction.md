# Content Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 505 shipped question templates into fourteen versioned JSON packs, generated from the TypeScript literals, consumed by the web app, and served by the API on two public endpoints.

**Architecture:** A generator serializes the TS literals into `src/content/packs/*.json`; `src/content/packs/index.ts` imports them and is the one module that touches the JSON; `catalog.ts` builds `allTemplates` from that module, so its eleven call sites and every content test are untouched and keep running against what actually ships. The API imports the same module and serves it behind `ETag`, typed by zod schemas that the compiler and a total round-trip test hold to the DTOs.

**Tech Stack:** TypeScript, Node 24, Next 16 (Turbopack), Fastify 5 with `fastify-type-provider-zod`, zod 4.4, vitest 4, esbuild, tsx.

**Spec:** `docs/superpowers/specs/2026-08-26-content-extraction-design.md`

## Global Constraints

- **A JSON import may not carry an import attribute.** `import x from './y.json' with { type: 'json' }` fails the API's typecheck with `TS2856` - under `nodenext` the file's real path is `src/content/...`, so the nearest `package.json` is the repo root, which declares no `"type"`. Write `import x from './y.json'` with no attribute.
- **The generator may not import `catalog.ts`.** `catalog.ts` is sourced from the generator's output; importing it would close a cycle and break a first run against an empty `src/content/packs/`.
- **Packs are pretty-printed at two-space indent with a trailing newline.** The pack diff is the reviewable artifact for a content change.
- **A version is derived, never written.** A pack's `version` is `sha256` of `JSON.stringify({ subject, level, templates }, null, 2)` - its own bytes with `version` excluded - truncated to 12 hex characters. The manifest's `version` is the same hash over the fourteen `${subject}.${level}:${etag}` lines joined by `\n`.
- **A pack's `version` and the manifest's `etag` for it are the same value.**
- **`GET /content/*` is public**: the route simply never calls `requireUser` or `requireParent`.
- **Pack order is `maths` K-6 then `english` K-6**, which is what `allTemplates` has always been. The manifest lists subjects sorted alphabetically (english first), matching `listSubjects`.
- **Run both halves before pushing:** `npm test`, `npm run typecheck`, `npm test --workspace apps/api` (Docker must be running), `npm run typecheck --workspace apps/api`.
- **`npm install` is always run from the repository root.**

---

### Task 1: The generator, the packs, and the drift test

**Files:**
- Create: `scripts/content-packs.ts`
- Create: `scripts/build-content.ts`
- Create: `src/content/packs.test.ts`
- Modify: `src/lib/dto.ts` (append the content DTOs)
- Modify: `package.json` (add `tsx` devDependency and the `content:build` script)
- Generated (committed): `src/content/packs/manifest.json`, `src/content/packs/{maths,english}.{K,1,2,3,4,5,6}.json`

**Interfaces:**
- Consumes: `mathsTemplates` and `englishTemplates` from `src/content/{maths,english}/index.ts`; `compareYearLevels` and `YearLevel` from `src/lib/curriculum`; `validateTemplates(inputs: unknown[]): { valid: boolean; errors: string[] }` from `src/lib/templates/validate`.
- Produces: `buildPacks(templates: readonly QuestionTemplate[]): Map<string, string>` mapping a file name to its exact bytes; `CORPUS: readonly QuestionTemplate[]`; and the DTOs `ContentPack`, `ContentManifest`, `ContentManifestSubject`, `ContentManifestLevel` in `src/lib/dto.ts`.

- [ ] **Step 1: Append the content DTOs to `src/lib/dto.ts`**

DTOs are declared once here and re-exported by consumers. Check the file's existing imports first - if `YearLevel` and `QuestionTemplate` are not already imported, add them at the top:

```ts
import type { YearLevel } from './curriculum';
import type { QuestionTemplate } from './templates/types';
```

Then append:

```ts
/**
 * One subject and school year of shipped content.
 *
 * `version` is derived - 12 hex characters of sha256 over the pack's own bytes
 * with this field excluded - so it can never disagree with the templates below
 * it, and nobody has to remember to bump anything. It is the same value the
 * manifest carries as that pack's `etag`, written twice so neither file has to
 * be read to make sense of the other.
 */
export interface ContentPack {
  version: string;
  subject: string;
  level: YearLevel;
  templates: QuestionTemplate[];
}

export interface ContentManifestLevel {
  level: YearLevel;
  topics: string[];
  templateCount: number;
  /** The `version` of the pack this names. */
  etag: string;
}

export interface ContentManifestSubject {
  subject: string;
  levels: ContentManifestLevel[];
}

/**
 * What content exists, without any of it. A client renders a level picker from
 * this alone and downloads only the pack a child is about to play.
 */
export interface ContentManifest {
  version: string;
  subjects: ContentManifestSubject[];
}
```

- [ ] **Step 2: Write the failing test for `buildPacks`**

Create `src/content/packs.test.ts`. This first half tests the pure generator and needs no committed files:

```ts
import { describe, expect, it } from 'vitest';
import { buildPacks, CORPUS } from '../../scripts/content-packs';
import type { ContentManifest, ContentPack } from '../lib/dto';

const generated = buildPacks(CORPUS);
const read = <T>(name: string): T => JSON.parse(generated.get(name)!) as T;

describe('buildPacks', () => {
  it('writes a pack per subject and year, and a manifest', () => {
    expect([...generated.keys()].sort()).toEqual(
      [
        'english.1.json', 'english.2.json', 'english.3.json', 'english.4.json',
        'english.5.json', 'english.6.json', 'english.K.json', 'manifest.json',
        'maths.1.json', 'maths.2.json', 'maths.3.json', 'maths.4.json',
        'maths.5.json', 'maths.6.json', 'maths.K.json',
      ].sort(),
    );
  });

  it('names each pack inside itself', () => {
    const pack = read<ContentPack>('maths.3.json');
    expect(pack.subject).toBe('maths');
    expect(pack.level).toBe('3');
    expect(pack.templates.every((t) => t.subject === 'maths' && t.level === '3')).toBe(true);
  });

  it('holds every template exactly once, in the catalog order', () => {
    const packed = [
      'maths.K.json', 'maths.1.json', 'maths.2.json', 'maths.3.json',
      'maths.4.json', 'maths.5.json', 'maths.6.json',
      'english.K.json', 'english.1.json', 'english.2.json', 'english.3.json',
      'english.4.json', 'english.5.json', 'english.6.json',
    ].flatMap((name) => read<ContentPack>(name).templates);

    expect(packed.map((t) => t.id)).toEqual(CORPUS.map((t) => t.id));
  });

  it('derives a version from the pack, so identical content hashes the same', () => {
    const pack = read<ContentPack>('maths.3.json');
    const again = buildPacks(CORPUS);
    expect(JSON.parse(again.get('maths.3.json')!).version).toBe(pack.version);
    expect(pack.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('moves the version of the pack that changed, and of no other', () => {
    const edited = [...CORPUS];
    const index = edited.findIndex((t) => t.subject === 'maths' && t.level === '3');
    edited[index] = { ...edited[index], prompt: `${edited[index].prompt} ` };

    const after = buildPacks(edited);
    const versionOf = (files: Map<string, string>, name: string): string =>
      JSON.parse(files.get(name)!).version;

    expect(versionOf(after, 'maths.3.json')).not.toBe(versionOf(generated, 'maths.3.json'));
    expect(versionOf(after, 'maths.4.json')).toBe(versionOf(generated, 'maths.4.json'));
    // The manifest hashes the pack hashes, so it moves whenever any pack does.
    expect(versionOf(after, 'manifest.json')).not.toBe(versionOf(generated, 'manifest.json'));
  });

  it('carries the topics and counts a client needs before downloading a pack', () => {
    const manifest = read<ContentManifest>('manifest.json');
    expect(manifest.subjects.map((s) => s.subject)).toEqual(['english', 'maths']);

    const maths = manifest.subjects.find((s) => s.subject === 'maths')!;
    expect(maths.levels.map((l) => l.level)).toEqual(['K', '1', '2', '3', '4', '5', '6']);

    const year3 = maths.levels.find((l) => l.level === '3')!;
    expect(year3.templateCount).toBe(read<ContentPack>('maths.3.json').templates.length);
    expect(year3.etag).toBe(read<ContentPack>('maths.3.json').version);
    expect(year3.topics).toEqual([...year3.topics].sort());
  });

  it('ends every file with a newline and indents at two spaces', () => {
    for (const body of generated.values()) {
      expect(body.endsWith('\n')).toBe(true);
      expect(body).toContain('\n  "version"');
    }
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run src/content/packs.test.ts`
Expected: FAIL - `Failed to resolve import "../../scripts/content-packs"`.

- [ ] **Step 4: Write `scripts/content-packs.ts`**

The pure half: no filesystem, so the drift test can call it.

```ts
import { createHash } from 'node:crypto';
import { compareYearLevels } from '../src/lib/curriculum';
import type { QuestionTemplate } from '../src/lib/templates/types';
import type { ContentManifestSubject } from '../src/lib/dto';
import { mathsTemplates } from '../src/content/maths';
import { englishTemplates } from '../src/content/english';

/**
 * The shipped corpus, in the order `allTemplates` has always had: maths K-6,
 * then english K-6.
 *
 * **This module may not import `../src/content/catalog`.** The catalog is
 * sourced from what this generates, so importing it would close a cycle and
 * make a first run against an empty `src/content/packs/` impossible.
 */
export const CORPUS: readonly QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];

/** Two spaces, because the pack diff is how a content change gets reviewed. */
const INDENT = 2;

/** Twelve hex characters of sha256 - short enough to read, long enough never to collide. */
function hash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/**
 * Every pack and the manifest, as the exact bytes that get committed and
 * served. Returning bytes rather than objects is what lets the drift test
 * compare against the files on disk without re-deciding how to format them.
 */
export function buildPacks(templates: readonly QuestionTemplate[]): Map<string, string> {
  const files = new Map<string, string>();

  const subjects: ContentManifestSubject[] = unique(templates.map((t) => t.subject))
    .sort()
    .map((subject) => {
      const forSubject = templates.filter((t) => t.subject === subject);
      const levels = unique(forSubject.map((t) => t.level))
        .sort(compareYearLevels)
        .map((level) => {
          const forLevel = forSubject.filter((t) => t.level === level);
          // The hash is over the pack without its own version, which would
          // otherwise have to contain itself.
          const body = { subject, level, templates: forLevel };
          const etag = hash(JSON.stringify(body, null, INDENT));

          files.set(
            `${subject}.${level}.json`,
            `${JSON.stringify({ version: etag, ...body }, null, INDENT)}\n`,
          );

          return {
            level,
            topics: unique(forLevel.map((t) => t.topic)).sort(),
            templateCount: forLevel.length,
            etag,
          };
        });

      return { subject, levels };
    });

  const version = hash(
    subjects.flatMap((s) => s.levels.map((l) => `${s.subject}.${l.level}:${l.etag}`)).join('\n'),
  );

  files.set('manifest.json', `${JSON.stringify({ version, subjects }, null, INDENT)}\n`);

  return files;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/content/packs.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the runner `scripts/build-content.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateTemplates } from '../src/lib/templates/validate';
import { buildPacks, CORPUS } from './content-packs';

const PACK_DIR = 'src/content/packs';

/**
 * Generates the content packs from the TypeScript literals.
 *
 * **It validates before it writes.** One invalid template and nothing is
 * written, so emitting a broken pack is impossible rather than merely tested
 * against afterwards.
 */
async function main(): Promise<void> {
  const check = validateTemplates([...CORPUS]);
  if (!check.valid) {
    console.error(`Refusing to write: ${check.errors.length} problem(s) in the templates.`);
    for (const error of check.errors.slice(0, 20)) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }

  const files = buildPacks(CORPUS);
  await mkdir(PACK_DIR, { recursive: true });
  for (const [name, body] of files) {
    await writeFile(join(PACK_DIR, name), body, 'utf8');
  }

  console.log(`Wrote ${files.size} files to ${PACK_DIR}`);
}

main();
```

- [ ] **Step 7: Add `tsx` and the `content:build` script**

The root package has no `tsx` today; `apps/api` does, and relying on hoisting is fragile.

Run: `npm install --save-dev tsx` (from the repository root)

Then add to the root `package.json` `"scripts"`, after `"test:watch"`:

```json
"content:build": "tsx scripts/build-content.ts",
```

- [ ] **Step 8: Generate the packs**

Run: `npm run content:build`
Expected: `Wrote 15 files to src/content/packs`

Then confirm: `ls src/content/packs | wc -l` gives `15`.

- [ ] **Step 9: Add the drift half of the test**

Add these two imports to the top of `src/content/packs.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
```

then append this to the end of the file:

```ts
const packDir = join(import.meta.dirname, 'packs');

describe('the committed packs', () => {
  it('are exactly the files the generator writes', () => {
    const onDisk = readdirSync(packDir).filter((name) => name.endsWith('.json'));
    expect(onDisk.sort()).toEqual([...generated.keys()].sort());
  });

  it.each([...generated.keys()])('%s is byte-identical to what the templates generate', (name) => {
    expect(readFileSync(join(packDir, name), 'utf8')).toBe(generated.get(name));
  });
});
```

This is what makes forgetting the build step a red suite: edit a year file without running `npm run content:build` and every pack it touches goes red, and so does hand-editing a pack.

- [ ] **Step 10: Run the whole suite and the typechecks**

Run: `npx vitest run src/content/packs.test.ts`
Expected: PASS, 8 or more tests.

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 11: Prove the drift test actually fires**

Edit any template's `prompt` in `src/content/maths/3.ts` (add a trailing space), then run `npx vitest run src/content/packs.test.ts`.
Expected: FAIL on `maths.3.json` and on `manifest.json`.

Undo the edit with `git checkout src/content/maths/3.ts` and re-run.
Expected: PASS. A guard nobody has watched fail is a guard nobody has tested.

- [ ] **Step 12: Commit**

```bash
git add scripts/content-packs.ts scripts/build-content.ts src/content/packs.test.ts \
        src/content/packs src/lib/dto.ts package.json package-lock.json
git commit -m "Generate the content packs from the templates that author them"
```

---

### Task 2: Source the catalog from the packs

**Files:**
- Create: `src/content/packs/index.ts`
- Modify: `src/content/catalog.ts:1-15` (the imports and `allTemplates`)
- Modify: `packages/core/package.json` (add the `./content/packs` export)

**Interfaces:**
- Consumes: `ContentPack`, `ContentManifest` from `src/lib/dto`; the fifteen generated JSON files from Task 1.
- Produces: `PACKS: readonly ContentPack[]`, `CONTENT_MANIFEST: ContentManifest`, and `contentPack(subject: string, level: YearLevel): ContentPack | undefined`, all from `src/content/packs/index.ts` and reachable as `@learnr/core/content/packs`.

- [ ] **Step 1: Write `src/content/packs/index.ts`**

This is the only module in the repository that imports the JSON. Note there is **no import attribute** - see Global Constraints.

```ts
import type { YearLevel } from '../../lib/curriculum';
import type { ContentManifest, ContentPack } from '../../lib/dto';
import manifest from './manifest.json';
import mathsK from './maths.K.json';
import maths1 from './maths.1.json';
import maths2 from './maths.2.json';
import maths3 from './maths.3.json';
import maths4 from './maths.4.json';
import maths5 from './maths.5.json';
import maths6 from './maths.6.json';
import englishK from './english.K.json';
import english1 from './english.1.json';
import english2 from './english.2.json';
import english3 from './english.3.json';
import english4 from './english.4.json';
import english5 from './english.5.json';
import english6 from './english.6.json';

/**
 * The generated content packs, and the one place the JSON is imported.
 *
 * The packs are written by `scripts/build-content.ts` from the TypeScript
 * literals under `maths/` and `english/`, which stay the thing an author
 * edits - `packs.test.ts` fails if the two disagree by a byte. Everything
 * downstream reads them from here: `catalog.ts` for the web app, and the
 * API's `/content` routes for a client that cannot import TypeScript.
 *
 * **The order is maths K-6 then english K-6**, which is the order
 * `allTemplates` has always had.
 *
 * The cast is the boundary. JSON widens `level` to `string` and a figure's
 * `kind` with it, and what stands behind the cast is not optimism: the
 * generator refuses to write a pack that fails `validateTemplates`, the drift
 * test holds these bytes to the literals, and `catalog.test.ts` runs the whole
 * shipped-content suite over what this exports.
 */
const packs = [
  mathsK, maths1, maths2, maths3, maths4, maths5, maths6,
  englishK, english1, english2, english3, english4, english5, english6,
] as ContentPack[];

export const PACKS: readonly ContentPack[] = packs;

export const CONTENT_MANIFEST = manifest as ContentManifest;

/** The pack for one course, or undefined where no such course ships. */
export function contentPack(subject: string, level: YearLevel): ContentPack | undefined {
  return packs.find((pack) => pack.subject === subject && pack.level === level);
}
```

- [ ] **Step 2: Point `catalog.ts` at it**

In `src/content/catalog.ts`, replace these two lines:

```ts
import { mathsTemplates } from './maths';
import { englishTemplates } from './english';
```

with:

```ts
import { PACKS } from './packs';
```

and replace:

```ts
export const allTemplates: QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];
```

with:

```ts
export const allTemplates: QuestionTemplate[] = PACKS.flatMap((pack) => pack.templates);
```

Then extend the file's existing doc comment above `allTemplates` with a sentence saying where the templates now come from:

```
 * The templates are read from the generated packs in `./packs`, not from the
 * TypeScript literals that author them - so every test in this directory runs
 * against the artifact that actually ships.
```

- [ ] **Step 3: Run the full web suite**

Run: `npm test`
Expected: PASS, all files. `catalog.test.ts` (ids, tags, the four syllabus rules, figure anchoring, prompt length, typed-answer bands) and `english/leaks.test.ts` now run against the packs with no edit to either.

- [ ] **Step 4: Typecheck both halves and build the web app**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run typecheck --workspace apps/api`
Expected: exit 0. This is the check that would catch an import attribute sneaking back in.

Run: `npm run build`
Expected: a successful Turbopack build with the same route list as before.

- [ ] **Step 5: Export the module from `@learnr/core`**

In `packages/core/package.json`, add to `"exports"`, beside the existing `"./content/catalog"` entry:

```json
"./content/packs": "./src/content/packs/index.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/content/packs/index.ts src/content/catalog.ts packages/core/package.json
git commit -m "Read the catalog from the packs, so the tests run on what ships"
```

---

### Task 3: The template schemas and the guards that hold them

**Files:**
- Modify: `packages/core/package.json` (add three exports)
- Modify: `apps/api/src/schemas/dto.ts` (schemas, plus `Mirrored` and `MirroredUnions` entries)
- Create: `apps/api/test/schemas/content.test.ts`

**Interfaces:**
- Consumes: `PACKS`, `CONTENT_MANIFEST` from `@learnr/core/content/packs`; `QuestionTemplate`, `VarSpec`, `ChoiceSpec` from `@learnr/core/templates/types`; `FigureSpec`, `FIGURE_KINDS` from `@learnr/core/figures/types`; `figureKindModule` from `@learnr/core/figures/registry`; `ContentPack`, `ContentManifest`, `ContentManifestSubject`, `ContentManifestLevel` from `@learnr/core/dto`.
- Produces: `questionTemplateSchema`, `varSpecSchema`, `choiceSpecSchema`, `figureSpecSchema`, `contentPackSchema`, `contentManifestSchema`, `contentManifestSubjectSchema`, `contentManifestLevelSchema`, all exported from `apps/api/src/schemas/dto.ts`.

- [ ] **Step 1: Add the three `@learnr/core` exports**

In `packages/core/package.json` `"exports"`:

```json
"./templates/types": "./src/lib/templates/types.ts",
"./figures/registry": "./src/lib/figures/registry.ts",
"./figures/build": "./src/lib/figures/build.ts",
```

`./figures/build` is imported for its side effect only: it is what registers the eleven kind modules, and without it `figureKindModule` returns undefined.

- [ ] **Step 2: Write the failing test**

Create `apps/api/test/schemas/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PACKS } from '@learnr/core/content/packs';
import { FIGURE_KINDS } from '@learnr/core/figures/types';
import '@learnr/core/figures/build';
import { figureKindModule } from '@learnr/core/figures/registry';
import {
  choiceSpecSchema,
  figureSpecSchema,
  questionTemplateSchema,
} from '../../src/schemas/dto.js';

const templates = PACKS.flatMap((pack) => pack.templates);

describe('questionTemplateSchema', () => {
  /**
   * A response schema is a serializer: a zod object strips what it does not
   * declare, so a field left out of the schema does not fail - it vanishes
   * from the response and a client parses a smaller object happily. Leaving
   * `rightAngles` off the polygon arm would take the right-angle ticks off
   * every polygon question on the way to iOS, with nothing to see.
   *
   * This is the whole corpus rather than a sample, which is what makes it a
   * guard rather than a spot check.
   */
  it('round-trips all 505 shipped templates without losing a field', () => {
    expect(templates).toHaveLength(505);
    for (const template of templates) {
      expect(questionTemplateSchema.parse(template)).toEqual(template);
    }
  });

  it('is exercised by every figure kind', () => {
    const used = new Set(templates.map((t) => t.figure?.kind).filter(Boolean));
    expect([...used].sort()).toEqual([...FIGURE_KINDS].sort());
  });

  it('is exercised by every variable kind', () => {
    const used = new Set(templates.flatMap((t) => t.vars.map((v) => v.kind)));
    expect([...used].sort()).toEqual(['expr', 'int', 'number', 'pick']);
  });

  /**
   * The round-trip above is total over shipped *content*, which is not the
   * same as total over the *schema*: most of what a figure can pin is
   * deliberately left to jitter, so no shipped template sets `polygon.rotation`
   * or `angle.arc` at all. The registry's own `fields` table is what each kind
   * really has, so holding the schema to it covers the fields content does not
   * reach, and keeps covering them when a kind gains one.
   */
  it('declares exactly the fields the registry says each kind has', () => {
    for (const kind of FIGURE_KINDS) {
      const declared = Object.keys(figureKindModule(kind)!.fields).sort();
      const arm = figureSpecSchema.options.find((option) => option.shape.kind.value === kind);

      expect(arm, `no schema arm for ${kind}`).toBeDefined();
      expect(Object.keys(arm!.shape).filter((key) => key !== 'kind').sort()).toEqual(declared);
    }
  });

  /**
   * Two `ChoiceSpec` fields no shipped template uses - `jitter`, the fallback
   * distractor generator, and `propertyIsTheQuestion`, which no template needs
   * yet. `Mirrored` holds them by key set, and this holds them through an
   * actual serialization, which is the half key comparison cannot do.
   */
  it('keeps the choice fields shipped content never uses', () => {
    const spec = {
      count: 4,
      distractors: ['x + 1'],
      jitter: { min: '1', max: '5' },
      rankIsTheQuestion: true,
      propertyIsTheQuestion: true,
    };

    expect(choiceSpecSchema.parse(spec)).toEqual(spec);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test --workspace apps/api -- test/schemas/content.test.ts`
Expected: FAIL - `questionTemplateSchema` is not exported from `../../src/schemas/dto.js`.

- [ ] **Step 4: Add the schemas to `apps/api/src/schemas/dto.ts`**

Add the type imports at the top, beside the existing ones:

```ts
import type { ChoiceSpec, QuestionTemplate, VarSpec } from '@learnr/core/templates/types';
import type { FigureSpec } from '@learnr/core/figures/types';
import type {
  ContentManifest,
  ContentManifestLevel,
  ContentManifestSubject,
  ContentPack,
} from '@learnr/core/dto';
```

Then add the schemas. The field lists were taken from each kind module's `fields` table, not read off the type by eye - `clock` has two required fields, `hour` and `minute`:

```ts
/**
 * Everything a content pack carries.
 *
 * A template is authored data and every numeric field in it is an *expression
 * string*, not a number - `max: 'x - 1'` is the point of the format - so
 * `exprSchema` is `z.string()` throughout and tightening any of it to a number
 * would 500 the endpoint on perfectly good content.
 */
const exprSchema = z.string();

export const varSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    name: z.string(), kind: z.literal('int'),
    min: exprSchema, max: exprSchema, step: z.number().optional(),
  }),
  z.object({
    name: z.string(), kind: z.literal('number'),
    min: exprSchema, max: exprSchema, decimals: z.number().optional(),
  }),
  z.object({
    name: z.string(), kind: z.literal('pick'),
    from: z.array(z.union([z.string(), z.number()])).readonly(),
    weights: z.array(z.number()).readonly().optional(),
  }),
  z.object({ name: z.string(), kind: z.literal('expr'), expr: exprSchema }),
]);

export const choiceSpecSchema = z.object({
  count: z.number(),
  distractors: z.array(exprSchema).readonly().optional(),
  jitter: z.object({ min: exprSchema, max: exprSchema }).optional(),
  rankIsTheQuestion: z.boolean().optional(),
  propertyIsTheQuestion: z.boolean().optional(),
});

export const figureSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('polygon'), shape: exprSchema,
    rotation: exprSchema.optional(), mirror: exprSchema.optional(),
    rightAngles: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('angle'), degrees: exprSchema,
    rotation: exprSchema.optional(), armLength: exprSchema.optional(),
    arc: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('bar'), values: exprSchema,
    labels: exprSchema.optional(), style: exprSchema.optional(),
    scale: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('pictograph'), counts: exprSchema,
    labels: exprSchema.optional(), key: exprSchema.optional(),
    halves: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('spinner'), sectors: exprSchema,
    fills: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('solid'), solid: exprSchema,
    view: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('number-line'), at: exprSchema,
    from: exprSchema.optional(), to: exprSchema.optional(),
    step: exprSchema.optional(), minorTicks: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('clock'), hour: exprSchema, minute: exprSchema,
    numerals: exprSchema.optional(), minuteTicks: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('array'), rows: exprSchema, columns: exprSchema,
    orientation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('fraction-shape'), numerator: exprSchema, denominator: exprSchema,
    shape: exprSchema.optional(), rotation: exprSchema.optional(),
  }),
  z.object({
    kind: z.literal('grid'), at: exprSchema,
    columns: exprSchema.optional(), rows: exprSchema.optional(),
    axisLabels: exprSchema.optional(), onLines: exprSchema.optional(),
  }),
]);

export const questionTemplateSchema = z.object({
  id: z.string(),
  subject: z.string(),
  topic: z.string(),
  level: yearLevelSchema,
  tags: z.array(z.string()).readonly().optional(),
  prompt: z.string(),
  vars: z.array(varSpecSchema).readonly(),
  constraints: z.array(exprSchema).readonly().optional(),
  answer: exprSchema,
  answerType: z.enum(['number', 'text', 'choice', 'boolean']).optional(),
  choices: choiceSpecSchema.optional(),
  hint: z.string().optional(),
  figure: figureSpecSchema.optional(),
});

export const contentPackSchema = z.object({
  version: z.string(),
  subject: z.string(),
  level: yearLevelSchema,
  templates: z.array(questionTemplateSchema),
});

export const contentManifestLevelSchema = z.object({
  level: yearLevelSchema,
  topics: z.array(z.string()),
  templateCount: z.number().int(),
  etag: z.string(),
});

export const contentManifestSubjectSchema = z.object({
  subject: z.string(),
  levels: z.array(contentManifestLevelSchema),
});

export const contentManifestSchema = z.object({
  version: z.string(),
  subjects: z.array(contentManifestSubjectSchema),
});
```

- [ ] **Step 5: Hold the schemas to the DTOs by the compiler**

Add to the `Mirrored` type at the foot of `apps/api/src/schemas/dto.ts`, beside its existing entries:

```ts
  questionTemplate: Assert<Mirrors<typeof questionTemplateSchema, QuestionTemplate>>;
  choiceSpec: Assert<Mirrors<typeof choiceSpecSchema, ChoiceSpec>>;
  contentPack: Assert<Mirrors<typeof contentPackSchema, ContentPack>>;
  contentManifest: Assert<Mirrors<typeof contentManifestSchema, ContentManifest>>;
  contentManifestSubject: Assert<Mirrors<typeof contentManifestSubjectSchema, ContentManifestSubject>>;
  contentManifestLevel: Assert<Mirrors<typeof contentManifestLevelSchema, ContentManifestLevel>>;
```

And to `MirroredUnions`, because `keyof` a union sees only the keys common to every arm, which would wave a missing arm straight through:

```ts
  varSpec: Assert<Both<z.infer<typeof varSpecSchema>, VarSpec>>;
  figureSpec: Assert<Both<z.infer<typeof figureSpecSchema>, FigureSpec>>;
```

- [ ] **Step 6: Run the test and the typecheck**

Run: `npm test --workspace apps/api -- test/schemas/content.test.ts`
Expected: PASS, 5 tests.

Run: `npm run typecheck --workspace apps/api`
Expected: exit 0.

- [ ] **Step 7: Prove all three guards fire**

Each of these is a deliberate break, checked and then undone. A guard nobody has watched fail is a guard nobody has tested.

1. Delete `rightAngles` from the `polygon` arm of `figureSpecSchema`. Run `npm run typecheck --workspace apps/api` - expect a `figureSpec` error naming the union; run the test - expect the registry-fields test to fail on `polygon`. Restore it.
2. Delete `constraints` from `questionTemplateSchema`. Run the typecheck - expect `{ schemaIsMissing: "constraints" }`. Restore it.
3. Change `templateCount: z.number().int()` to `z.string()`. Run the test - expect the round-trip to fail. Restore it.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json apps/api/src/schemas/dto.ts apps/api/test/schemas/content.test.ts
git commit -m "Describe a template on the wire, and hold the schema to it three ways"
```

---

### Task 4: The two endpoints, the contract, and the docs

**Files:**
- Create: `apps/api/src/routes/content.ts`
- Create: `apps/api/test/routes/content.test.ts`
- Modify: `apps/api/src/server.ts` (import and register `contentRoutes`)
- Modify: `apps/api/contract/openapi.yaml` (regenerated, not hand-edited)
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/notes/2026-08-26-api-extraction-handoff.md`

**Interfaces:**
- Consumes: `CONTENT_MANIFEST`, `contentPack` from `@learnr/core/content/packs`; `parseYearLevel` from `@learnr/core/curriculum`; `contentManifestSchema`, `contentPackSchema` from `../schemas/dto.js`; `errorSchema` from `../schemas/common.js`.
- Produces: `contentRoutes: FastifyPluginAsync`, registered in `buildServer`.

- [ ] **Step 1: Write the failing route tests**

Create `apps/api/test/routes/content.test.ts`. These need no database rows, but `startDatabase()` still runs because `buildServer` wires the auth plugin, which resolves a session on every request:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase } from '../helpers/db.js';
import { buildServer } from '../../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

const packDir = join(import.meta.dirname, '../../../../src/content/packs');
const committed = (name: string) => JSON.parse(readFileSync(join(packDir, name), 'utf8'));

describe('GET /content/manifest', () => {
  it('answers a reader with no session at all', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/manifest' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(committed('manifest.json'));
  });

  it('carries the version as an ETag and answers 304 to it', async () => {
    const first = await app.inject({ method: 'GET', url: '/content/manifest' });
    const etag = first.headers.etag as string;
    expect(etag).toBe(`"${committed('manifest.json').version}"`);

    const second = await app.inject({
      method: 'GET', url: '/content/manifest', headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });
});

describe('GET /content/:subject/:level', () => {
  /**
   * The strongest guard in this file: a response schema strips what it does
   * not declare, so serving the pack and comparing it against the committed
   * bytes is what proves nothing was lost between the two.
   */
  it('serves a pack exactly as it was committed', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/maths/3' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(committed('maths.3.json'));
  });

  it('keeps every figure and every constraint on the way out', async () => {
    const pack = (await app.inject({ method: 'GET', url: '/content/maths/5' })).json();
    const source = committed('maths.5.json');

    expect(pack.templates.filter((t: { figure?: unknown }) => t.figure))
      .toEqual(source.templates.filter((t: { figure?: unknown }) => t.figure));
    expect(pack.templates.filter((t: { constraints?: unknown }) => t.constraints))
      .toEqual(source.templates.filter((t: { constraints?: unknown }) => t.constraints));
  });

  it('normalises the level the way every other boundary does', async () => {
    const lower = await app.inject({ method: 'GET', url: '/content/maths/k' });

    expect(lower.statusCode).toBe(200);
    expect(lower.json().level).toBe('K');
  });

  it('answers 304 to a matching ETag', async () => {
    const first = await app.inject({ method: 'GET', url: '/content/english/2' });
    const second = await app.inject({
      method: 'GET', url: '/content/english/2',
      headers: { 'if-none-match': first.headers.etag as string },
    });

    expect(second.statusCode).toBe(304);
  });

  it('is a 404 for a year that is not one', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/maths/9' });
    expect(response.statusCode).toBe(404);
  });

  it('is a 404 for a subject nobody ships', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/history/3' });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test --workspace apps/api -- test/routes/content.test.ts` (Docker must be running)
Expected: FAIL - 404 on `/content/manifest`, because no route is registered.

- [ ] **Step 3: Write `apps/api/src/routes/content.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { parseYearLevel } from '@learnr/core/curriculum';
import { CONTENT_MANIFEST, contentPack } from '@learnr/core/content/packs';
import { errorSchema } from '../schemas/common.js';
import { contentManifestSchema, contentPackSchema } from '../schemas/dto.js';

/**
 * The shipped question templates, for a client that cannot import TypeScript.
 *
 * **These two are public, and that is deliberate.** Content is not personal
 * data - the web app's landing page already renders coverage from these very
 * templates to a signed-out visitor - and public is what lets a device cache
 * hold a pack and lets iOS warm its bundled copy before a child has signed in.
 * The route is public by simply never calling `requireUser`, the way
 * `GET /shares/:token` is.
 *
 * The packs ship inside the bundle: esbuild inlines an imported JSON file, so
 * there is no path to resolve at runtime and the Docker build context - which
 * is the repository root, for the symlink's sake - never enters into it.
 */
export const contentRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/content/manifest', {
    schema: { response: { 200: contentManifestSchema } },
  }, async (request, reply) => {
    const etag = `"${CONTENT_MANIFEST.version}"`;
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();

    return reply.header('etag', etag).send(CONTENT_MANIFEST);
  });

  app.get('/content/:subject/:level', {
    schema: {
      params: z.object({ subject: z.string(), level: z.string() }),
      response: { 200: contentPackSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    // The same boundary parser every other reader of a year uses, so `k` and
    // `03` mean what they mean everywhere else and nothing else gets through.
    const level = parseYearLevel(request.params.level);
    if (!level) return reply.code(404).send({ error: 'No such level' });

    const pack = contentPack(request.params.subject, level);
    if (!pack) return reply.code(404).send({ error: 'No such content' });

    const etag = `"${pack.version}"`;
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();

    return reply.header('etag', etag).send(pack);
  });
};
```

- [ ] **Step 4: Register it in `apps/api/src/server.ts`**

Add the import beside the other route imports:

```ts
import { contentRoutes } from './routes/content.js';
```

and the registration after `app.register(playRoutes);`:

```ts
  app.register(contentRoutes);
```

It must be a registered plugin: `@fastify/swagger` only sees routes inside one, and a route absent from the contract is a route iOS cannot generate a model from.

- [ ] **Step 5: Run the route tests**

Run: `npm test --workspace apps/api -- test/routes/content.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole API suite and the typecheck**

Run: `npm test --workspace apps/api`
Expected: PASS - 119 existing tests plus the new ones.

Run: `npm run typecheck --workspace apps/api`
Expected: exit 0.

- [ ] **Step 7: Regenerate the contract**

Run: `npm run contract --workspace apps/api`
Expected: `Wrote contract/openapi.yaml`.

Then confirm the two paths arrived and nothing lost its type:

Run: `grep -c '^  /' apps/api/contract/openapi.yaml`
Expected: `32`, where it was 30.

Run: `grep -c 'schema: {}' apps/api/contract/openapi.yaml`
Expected: `0`.

- [ ] **Step 8: Update `CLAUDE.md`**

Three edits:

1. In **Where everything lives**, add to the tree beneath `src/content/`:

```
src/content/packs/    the generated JSON packs - the artifact that ships
scripts/build-content.ts  writes them from the TypeScript literals
```

2. Add a paragraph after the **Shape of the content** section:

```
**The templates ship as generated JSON, and the TypeScript is what authors
edit.** `scripts/build-content.ts` serializes them into `src/content/packs/` -
one pack a subject and year, plus a manifest - and `catalog.ts` reads the packs,
so `catalog.test.ts` and `leaks.test.ts` run against the artifact rather than
its source. `src/content/packs.test.ts` regenerates in memory and compares byte
for byte, so editing a year file without running `npm run content:build` is a
red suite rather than a stale pack. A pack's `version` is a hash of its own
bytes: nothing to bump, so nothing to forget. **The JSON import may not carry an
import attribute** - `with { type: 'json' }` fails the API's typecheck under
`nodenext`, because the symlink puts the file's real path under a repository
root that declares no `"type"`.
```

3. In the **build order** list under **The iOS app**, change item 2 from "Content extraction" as pending to done, and say the packs are what a Swift client fetches.

- [ ] **Step 9: Update the handoff note**

In `docs/superpowers/notes/2026-08-26-api-extraction-handoff.md`, add a short section after "What exists now" recording that step 2 has landed: the fourteen packs, the two public endpoints, the contract at 32 paths, and the fact that the round-trip test rather than the compiler is what holds the template schema, because most of what a figure can pin is deliberately absent from shipped content.

- [ ] **Step 10: Run everything, both halves**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test --workspace apps/api`
Expected: PASS.

Run: `npm run typecheck --workspace apps/api`
Expected: exit 0.

Run: `npm run build`
Expected: a successful build.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/routes/content.ts apps/api/test/routes/content.test.ts \
        apps/api/src/server.ts apps/api/contract/openapi.yaml \
        CLAUDE.md docs/superpowers/notes/2026-08-26-api-extraction-handoff.md
git commit -m "Serve the content packs, so a client that cannot import TypeScript has them"
```

- [ ] **Step 12: Deploy**

Run: `fly deploy --ha=false` (from the repository root)

Then check the live pair:

```bash
curl -s https://learnr-api-syd.fly.dev/content/manifest | head -c 200
curl -sI https://learnr-api-syd.fly.dev/content/maths/3 | grep -i etag
```

Expected: a manifest with a 12-character version, and an `ETag` header on the pack.

---

## What this plan does not do

- **Fixture generation** - build-order step 3, its own spec and plan.
- **Any Swift work** - step 4, in `muzzamilkhan/learnr-ios`.
- **Database- or blob-stored content**, and the upload path that implies.
- **A runtime content refresh in the web app.** The bundled packs are what the web renders.
