# Question viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the play screen one prompt size whatever the question says, put the figure beside the question rather than above it, let a child tap the figure to see it full-screen, and draw fractions with a horizontal bar.

**Architecture:** Two new pure `lib` modules (`templates/limits.ts`, `fractions.ts`) carry everything testable — the prompt-length cap, the sentinel string used to fit one constant size, and the rule for what a slash is. Two new components (`maths-text.tsx`, `figure-zoom.tsx`) and one new glyph (`magnify-icon.tsx`) consume them. `play-session.tsx` is edited in place: its `Prompt` fitter searches against the sentinel instead of the prompt, its figure/prompt wrapper swaps a height query for a width query, and it gains one piece of zoom state.

**Tech Stack:** Next.js App Router (React 19), TypeScript, Tailwind v4 (CSS-variable theme, arbitrary variants), vitest (node environment only — no DOM, no component tests).

**Spec:** `docs/superpowers/specs/2026-08-22-question-viewport-design.md`

## Global Constraints

Copied verbatim from the spec and from `CLAUDE.md`; every task's requirements implicitly include these.

- **`MAX_PROMPT_CHARS = 140`.** The observed worst case over 300 draws of all 350 templates is 135 (`maths.5.chance.most-likely-from-trials`); 140 gives five characters of deliberate slack.
- **All logic lives in `src/lib` as pure functions.** Nothing in `src/lib` touches React, the network, the clock or the database.
- **Tailwind reads class names as source-text literals.** A class built by interpolating a JS value — `` `${SOME_CONST}:flex-row` ``, `` `max-h-[${n}px]` `` — compiles to nothing. Every arbitrary variant and arbitrary value must appear as literal text in the source. This is why `500px` and `64px` are written out in `play-session.tsx` rather than held in constants, and the same rule binds every class this plan adds.
- **Colours are CSS variables**, used as `text-(--color-ink)`, `bg-(--color-paper)`, `border-(--color-line)`.
- **Parent-report density is untouched by this work.** `src/components/progress-*.tsx` and `src/components/diagram.tsx`'s report call sites must not change.
- **Nothing stored, graded or spoken changes.** The answer value stays the string `1/2` on `Attempt` and in `gradeAnswer`; narration keeps reading the raw prompt text.
- **TDD, lean tests. Test behaviour through the public function, not internals.** Run `npm test` and `npm run typecheck` before pushing.
- Work on `master`. Commit after each task.

---

### Task 1: The prompt-length cap and its sentinel

**Files:**
- Create: `src/lib/templates/limits.ts`
- Create: `src/lib/templates/limits.test.ts`
- Modify: `src/content/catalog.test.ts` (add one `it` inside the existing `describe('shipped content', ...)` block, which begins at line 153)

**Interfaces:**
- Consumes: nothing.
- Produces: `MAX_PROMPT_CHARS: 140` and `PROMPT_SENTINEL: string` from `@/lib/templates/limits`. Task 4 imports both into `play-session.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/templates/limits.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MAX_PROMPT_CHARS, PROMPT_SENTINEL } from './limits';

describe('the prompt-length cap', () => {
  it('caps a prompt just above the longest one the content actually draws', () => {
    // The measured worst case is 135 characters
    // (`maths.5.chance.most-likely-from-trials`). The cap sits above it so a
    // number growing a digit inside an existing template is not a red suite.
    expect(MAX_PROMPT_CHARS).toBe(140);
  });
});

describe('the sentinel the prompt is sized against', () => {
  // The fitter searches for the largest size at which this string fits, and
  // applies that size to whatever the real prompt is. If it were shorter than
  // the cap, a real worst-case prompt would clip.
  it('is exactly as long as the cap', () => {
    expect(PROMPT_SENTINEL).toHaveLength(MAX_PROMPT_CHARS);
  });

  // A sentinel of `M`s measures a width no real prompt has and would shrink
  // every question to pay for it; a sentinel of `l`s or of one long word
  // measures too little and would clip. Ordinary words are what the content is
  // made of, so that is what the stand-in is made of.
  it('is ordinary prose rather than one repeated character', () => {
    const words = PROMPT_SENTINEL.split(' ');
    expect(words.length).toBeGreaterThan(15);
    for (const word of words) expect(word.length).toBeLessThanOrEqual(12);
    expect(new Set(PROMPT_SENTINEL).size).toBeGreaterThan(15);
  });

  it('contains digits, because every real prompt does', () => {
    expect(PROMPT_SENTINEL).toMatch(/\d\d/);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/templates/limits.test.ts`
Expected: FAIL — `Failed to resolve import "./limits"`.

- [ ] **Step 3: Write the module**

Create `src/lib/templates/limits.ts`:

```ts
/**
 * How long a question is allowed to get, and the stand-in it is sized against.
 *
 * The play screen sets every question at one size, whatever it says
 * (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`). A single
 * size can only ever be the worst case's size, so the only lever on how big it
 * is is how long the longest prompt is allowed to be - which is what this cap
 * is, and why it is enforced over the shipped content rather than intended.
 */

/**
 * The longest a rendered prompt may be.
 *
 * Measured rather than chosen: over 300 draws of each of the 350 shipped
 * templates, the longest prompt is 135 characters
 * (`maths.5.chance.most-likely-from-trials`), the median is 45 and the
 * shortest is 14.
 *
 * **140 and not 135.** A cap with no headroom goes red the first time a number
 * *inside* an existing template grows a digit, which is a template being
 * edited rather than a template getting too long. Five characters of slack
 * costs under 2% of the rendered size - not visible - where a suite that goes
 * red for a reason nobody meant is.
 */
export const MAX_PROMPT_CHARS = 140;

/**
 * The string the prompt's size is searched against, exactly `MAX_PROMPT_CHARS`
 * long.
 *
 * `Prompt` binary-searches for the largest whole pixel size at which *this*
 * fits its box, then sets the real prompt at that size - which is what makes
 * every question in the same box the same size. So this is a stand-in for the
 * worst case, and its job is to be **at least as wide** as any real prompt of
 * the same length.
 *
 * That is why it is prose and not a repeated character. A sentinel of `M`s
 * measures a width no real prompt has and would shrink every question on the
 * screen to pay for it; a sentinel of `l`s, or one unbroken word, measures too
 * little and a real prompt would clip. Ordinary words with a couple of runs of
 * digits is what the content is made of, so it is what the stand-in is made of.
 *
 * It never appears on screen - it is measured in a hidden element and thrown
 * away - so it does not have to mean anything, only to be shaped like a
 * question.
 */
export const PROMPT_SENTINEL =
  'A spinner was spun many times and it stopped on red 26 times, blue 37 times and green 22 times. Which colour is this most likely to stop on?';
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/templates/limits.test.ts`
Expected: PASS, 4 tests.

That string is exactly 140 characters — 29 words, longest word 7, 30 distinct characters, and it carries two-digit numbers. If the length assertion fails you have mistyped it; paste the literal into `python3 -c "print(len('...'))"` to find the difference. Do not pad with spaces or repeated letters to make up a shortfall — adjust a real word, or the sentinel stops measuring what a real prompt measures.

- [ ] **Step 5: Write the failing catalogue test**

In `src/content/catalog.test.ts`, add `MAX_PROMPT_CHARS` to the imports:

```ts
import { MAX_PROMPT_CHARS } from '@/lib/templates/limits';
```

and add this `it` inside `describe('shipped content', ...)`, immediately after the existing `it('every template generates sane questions across many seeds', ...)` which ends at line 168:

```ts
  // The play screen sets every question at one size, and that size is the
  // worst case's. So the cap is not a tidiness rule - it is the only lever
  // there is on how big every question on the screen gets, and a template
  // sneaking past it makes every *other* question smaller.
  //
  // 50 draws rather than the 25 above: this is a maximum over a distribution
  // rather than a property of every draw, so it wants the extra sampling.
  it('never draws a prompt longer than the play screen is sized for', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 50; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-length-${i}`));
        expect(q.prompt.length, `${template.id}: ${q.prompt}`).toBeLessThanOrEqual(
          MAX_PROMPT_CHARS,
        );
      }
    }
  });
```

- [ ] **Step 6: Run the catalogue test**

Run: `npx vitest run src/content/catalog.test.ts`
Expected: PASS. Every shipped template already fits — the longest draws 135 against a cap of 140.

If it fails, the failure message names the template and prints the prompt. That is a genuine finding: the measurement in the spec missed a draw. Report it rather than raising the cap.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
npm test
git add src/lib/templates/limits.ts src/lib/templates/limits.test.ts src/content/catalog.test.ts
git commit -m "Cap how long a question may get, since one size means the worst case's size"
```

---

### Task 2: One rule for what a slash is

**Files:**
- Create: `src/lib/fractions.ts`
- Create: `src/lib/fractions.test.ts`
- Modify: `src/lib/speech/narration.ts:49` (delete the private `FRACTION` regex) and `:92` (use the shared rule)
- Modify: `src/content/catalog.test.ts` (one more `it` in `describe('shipped content', ...)`)

**Interfaces:**
- Consumes: nothing.
- Produces: from `@/lib/fractions` — `type MathsSegment = { kind: 'text'; text: string } | { kind: 'fraction'; numerator: string; denominator: string }`, `splitFractions(text: string): MathsSegment[]`, and `fractionPattern(): RegExp` (a *factory*, because a `/g` regex carries `lastIndex` between uses and two modules sharing one would interfere). Task 3 calls `splitFractions`; `narration.ts` and `catalog.test.ts` are the other consumers, both in this task.

- [ ] **Step 1: Write the failing test**

Create `src/lib/fractions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { splitFractions } from './fractions';

describe('splitFractions', () => {
  it('leaves a text with no slash in one piece', () => {
    expect(splitFractions('What is 7 + 3?')).toEqual([{ kind: 'text', text: 'What is 7 + 3?' }]);
  });

  it('pulls a fraction out from the words around it', () => {
    expect(splitFractions('What is 2/3 of 12?')).toEqual([
      { kind: 'text', text: 'What is ' },
      { kind: 'fraction', numerator: '2', denominator: '3' },
      { kind: 'text', text: ' of 12?' },
    ]);
  });

  it('keeps every digit of a multi-digit numerator and denominator', () => {
    expect(splitFractions('11/16')).toEqual([
      { kind: 'fraction', numerator: '11', denominator: '16' },
    ]);
  });

  it('finds every fraction in a sentence, not only the first', () => {
    expect(splitFractions('1/8 + 7/16 = ?/16')).toEqual([
      { kind: 'fraction', numerator: '1', denominator: '8' },
      { kind: 'text', text: ' + ' },
      { kind: 'fraction', numerator: '7', denominator: '16' },
      { kind: 'text', text: ' = ' },
      { kind: 'fraction', numerator: '?', denominator: '16' },
    ]);
  });

  // The gap marker is a numerator like any other: "?/12" is a fraction with its
  // top missing, which is a better picture of what is being asked than a slash.
  it('takes the gap marker as a numerator', () => {
    expect(splitFractions('?/12')).toEqual([
      { kind: 'fraction', numerator: '?', denominator: '12' },
    ]);
  });

  it('drops the spaces a written fraction may carry around its slash', () => {
    expect(splitFractions('3 / 4')).toEqual([
      { kind: 'fraction', numerator: '3', denominator: '4' },
    ]);
  });

  // Not every slash is a fraction in general - it is only a fraction in *this*
  // content, and only because division is written with a division sign. A slash
  // with a word on either side of it is left as it was.
  it('leaves a slash that is not between numbers alone', () => {
    expect(splitFractions('red/blue')).toEqual([{ kind: 'text', text: 'red/blue' }]);
    expect(splitFractions('and/9')).toEqual([{ kind: 'text', text: 'and/9' }]);
  });

  it('returns one empty piece for an empty text', () => {
    expect(splitFractions('')).toEqual([{ kind: 'text', text: '' }]);
  });
});
```

No empty segments anywhere: a text run is pushed only when there is text in it, so `'11/16'` comes back as one segment and `'1/8 + 7/16 = ?/16'` as five. The one exception is `''`, which has to come back as *something* for a renderer to map over.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/fractions.test.ts`
Expected: FAIL — `Failed to resolve import "./fractions"`.

- [ ] **Step 3: Write the module**

Create `src/lib/fractions.ts`:

```ts
/**
 * Which slashes in a question are fractions, and what is on either side of
 * them.
 *
 * Pure, like the rest of `lib`: this decides what a piece of text *is*, and
 * `src/components/maths-text.tsx` decides how to draw it - the same split
 * `src/lib/figures/` and `src/components/diagram.tsx` already make.
 *
 * **Every `/` in the shipped content is a fraction, because division is
 * written `÷`.** That claim used to live in a comment in
 * `src/lib/speech/narration.ts`; it is a test in `src/content/catalog.test.ts`
 * now, over every rendered prompt, hint, answer and choice.
 *
 * `narration.ts` reads the rule from here rather than keeping its own copy.
 * The spoken form and the drawn form must not be able to disagree about which
 * slashes are fractions, and two regexes in two files is exactly how they
 * would - one tuned, the other not, and nothing on screen to say so.
 */

/** A run of plain text, or a fraction to be drawn with a bar. */
export type MathsSegment =
  | { kind: 'text'; text: string }
  | { kind: 'fraction'; numerator: string; denominator: string };

/**
 * A digit run or the gap marker, a slash, a digit run.
 *
 * The gap counts as a numerator so "?/9" is a fraction with its top missing -
 * which is what `maths.4.fractions.equivalent` and the four add/subtract
 * templates are actually asking. Spaces around the slash are allowed, because
 * a template is free to write one.
 */
const FRACTION_SOURCE = String.raw`(\d+|\?)\s*\/\s*(\d+)`;

/**
 * A fresh matcher each time.
 *
 * A `/g` regex carries `lastIndex` between uses, so a single shared instance
 * would have two modules stepping on each other's position - and the failure
 * is a fraction silently skipped rather than an error.
 */
export const fractionPattern = (): RegExp => new RegExp(FRACTION_SOURCE, 'g');

/**
 * Break a rendered prompt, hint, answer or choice into the pieces a renderer
 * draws. Text with no fraction in it comes back as a single `text` segment, so
 * a caller never needs a special case for the ordinary question.
 *
 * No empty segments: a text run is pushed only when there is text in it. The
 * one exception is an empty input, which has to come back as *something* for a
 * caller to map over.
 */
export function splitFractions(text: string): MathsSegment[] {
  const segments: MathsSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(fractionPattern())) {
    const at = match.index;
    if (at > cursor) segments.push({ kind: 'text', text: text.slice(cursor, at) });
    segments.push({ kind: 'fraction', numerator: match[1], denominator: match[2] });
    cursor = at + match[0].length;
  }

  const tail = text.slice(cursor);
  if (tail !== '' || segments.length === 0) segments.push({ kind: 'text', text: tail });

  return segments;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/fractions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Point narration at the shared rule**

In `src/lib/speech/narration.ts`, delete the private regex at line 49 and its comment block above it (the one beginning "A slash between numbers is a fraction"), and add to the imports at the top:

```ts
import { fractionPattern } from '../fractions';
```

Replace line 92:

```ts
  out = out.replace(FRACTION, '$1 out of ');
```

with:

```ts
  // The fraction rule is `src/lib/fractions.ts`', not a second copy here: the
  // spoken form and the form the play screen *draws* must not be able to
  // disagree about which slashes are fractions.
  out = out.replace(fractionPattern(), (_, numerator: string, denominator: string) => (
    ` ${numerator} out of ${denominator} `
  ));
```

The old regex used a lookahead and kept only the digit immediately before the slash, so `12/25` came out `12 out of 25` by leaving `1` untouched. The shared rule captures both runs in full and produces the same string. The surrounding spaces are collapsed by the `\s+` cleanup at the end of `spokenText`.

- [ ] **Step 6: Run the narration tests and watch them still pass**

Run: `npx vitest run src/lib/speech/narration.test.ts`
Expected: PASS, unchanged. The three fraction assertions at lines 34, 35 and 80 are the ones that matter:

```
spokenText('Write 1/4 as a decimal.')   === 'Write 1 out of 4 as a decimal.'
spokenText('What is 2/3 of 12?')        === 'What is 2 out of 3 of 12?'
spokenText('Complete: 2/3 = ?/9')       === 'Complete: 2 out of 3 equals what out of 9'
```

If any fails, the shared rule is not equivalent to the one it replaced. Fix the rule, not the test.

- [ ] **Step 7: Write the failing catalogue test**

In `src/content/catalog.test.ts`, add to the imports:

```ts
import { splitFractions } from '@/lib/fractions';
```

and add this `it` inside `describe('shipped content', ...)`:

```ts
  // Both the narration and the play screen's renderer rest on one claim: every
  // `/` in this content is a fraction, because division is written `÷`. It has
  // been true since the content was written and it lived in a comment; it is
  // load-bearing in two places now, so it is checked.
  //
  // A slash that is *not* a fraction would be spoken as one and drawn as
  // ordinary text, which is two screens disagreeing about the same character.
  it('writes no slash that is not a fraction', () => {
    for (const template of allTemplates) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-slash-${i}`));
        const texts = [q.prompt, q.hint ?? '', String(q.answer), ...(q.choices ?? []).map(String)];

        for (const text of texts) {
          // Every slash the text contains has to be inside a fraction segment.
          const slashes = (text.match(/\//g) ?? []).length;
          const inFractions = splitFractions(text).filter((s) => s.kind === 'fraction').length;
          expect(inFractions, `${template.id}: ${text}`).toBe(slashes);
        }
      }
    }
  });
```

- [ ] **Step 8: Run the catalogue test**

Run: `npx vitest run src/content/catalog.test.ts`
Expected: PASS. All 350 templates already satisfy it.

- [ ] **Step 9: Typecheck and commit**

```bash
npm run typecheck
npm test
git add src/lib/fractions.ts src/lib/fractions.test.ts src/lib/speech/narration.ts src/content/catalog.test.ts
git commit -m "Say once what a slash is, for the voice and for the screen"
```

---

### Task 3: Drawing a fraction with a bar

**Files:**
- Create: `src/components/maths-text.tsx`

**Interfaces:**
- Consumes: `splitFractions` from `@/lib/fractions` (Task 2). It does not import `MathsSegment` — the segments are narrowed by their `kind` inline.
- Produces: `MathsText({ text }: { text: string })`, a component rendering a string with its fractions stacked. Tasks 5 and 6 use it.

- [ ] **Step 1: Write the component**

There is no test step here, and that is deliberate: vitest in this repo runs in node with no DOM, so a component renders nothing to assert against — the same reason `src/lib/photo/crop.ts` has tests and `src/components/photo-crop.tsx` does not. Everything decidable was decided in Task 2 and is tested there.

Create `src/components/maths-text.tsx`:

```tsx
import { splitFractions } from '@/lib/fractions';

/**
 * A rendered prompt, hint, answer or choice, with its fractions drawn the way
 * a child is taught them: one number over another with a bar between, rather
 * than the `1/2` the expression language happens to produce.
 *
 * The dumb half, like `diagram.tsx`: `src/lib/fractions.ts` decides what a
 * slash is and this decides nothing at all, which is what lets the same rule
 * serve the narration, where there is nothing to draw.
 *
 * **Everything is sized in `em`.** The play screen searches for a prompt size
 * at runtime and sets it as an inline `font-size` on the element this sits
 * inside, so a fraction has to grow with whatever it is given rather than
 * being told - and the same component then works unchanged in a choice button
 * at `text-4xl` and in a hint at `clamp(1rem,2.4vh,1.5rem)`.
 *
 * `inline-flex` with `align-middle` puts the stack's centre on the
 * surrounding line's middle, which is where a vinculum belongs - a baseline
 * alignment would hang the whole fraction below the text it sits in.
 */
export function MathsText({ text }: { text: string }) {
  const segments = splitFractions(text);

  // The common case by a long way: 338 of the 350 shipped templates never draw
  // a fraction at all, and this keeps them one text node rather than a span.
  if (segments.length === 1 && segments[0].kind === 'text') return <>{segments[0].text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span
            key={index}
            // 0.72em: a fraction is two lines of type where the text around it
            // is one, so it is set smaller to keep the line it sits in from
            // opening up more than it has to. `leading-none` is the other half
            // of that - the default line-height on the two halves would add a
            // third of a line each.
            className="mx-[0.12em] inline-flex flex-col items-center align-middle text-[0.72em] leading-none"
          >
            <span className="px-[0.18em]">{segment.numerator}</span>
            {/* The vinculum. `border-current` so it takes the colour of
                whatever it is drawn in - the green of a revealed right answer,
                the soft ink of a hint - without any caller passing a colour. */}
            <span className="my-[0.08em] w-full border-t-[0.09em] border-current" />
            <span className="px-[0.18em]">{segment.denominator}</span>
          </span>
        ),
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. Nothing imports the component yet; this only proves it compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/maths-text.tsx
git commit -m "Draw a fraction the way a child is taught it"
```

---

### Task 4: One size for every question

**Files:**
- Modify: `src/components/play-session.tsx` — the `Prompt` component (around lines 849-932), `promptSize` (around lines 946-950), and the two `<Prompt ... />` call sites (around lines 709 and 718)

**Interfaces:**
- Consumes: `MAX_PROMPT_CHARS`, `PROMPT_SENTINEL` from `@/lib/templates/limits` (Task 1).
- Produces: nothing new. `Prompt`'s props are unchanged; its `key` prop goes away at both call sites.

- [ ] **Step 1: Add the import**

At the top of `src/components/play-session.tsx`, beside the other `@/lib` imports:

```ts
import { PROMPT_SENTINEL } from '@/lib/templates/limits';
```

- [ ] **Step 2: Replace the module comment above `Prompt`**

Replace the block comment that currently begins "The question, set as large as the room it has allows." and ends "...it is a ceiling and not a size." with:

```ts
/**
 * The question, set at one size whatever it says.
 *
 * The screen is a fixed height that may not scroll, so the size cannot simply
 * be declared: the room left between the header and the pad is what the prompt
 * has to fit in, and that differs by device, by orientation, by whether a
 * target bar is showing and by whether this question has a figure. So the box
 * is measured and the size is searched for - the largest whole pixel size that
 * still fits, never larger than the ceiling `--prompt-max` sets.
 *
 * **What is searched against is `PROMPT_SENTINEL`, not the prompt in hand.**
 * That one substitution is the whole of this feature
 * (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`): the
 * sentinel is `MAX_PROMPT_CHARS` long, so the size found is the worst case's
 * size, and every question in the same box gets it. Before this, the fit
 * measured the actual question, so the type jumped between roughly 96px and
 * roughly 33px across a session - carrying no information, since it was a fact
 * about how many words the template's author used rather than about the maths.
 *
 * The obvious alternative was to delete the fit and declare a `clamp()`, and
 * the four things in the first paragraph are why not: a declared size has to
 * survive the worst combination of all of them on every device, so every
 * device pays for the worst one. This is fitted against the box that actually
 * exists.
 *
 * **The fit test is "the sentinel fits *and* the prompt fits".** The sentinel
 * is the longer string, so it binds and the size is constant. The second half
 * is a net rather than a branch anyone plans to reach: a sentinel is an
 * estimate of *width*, and a real prompt of unusually wide glyphs could exceed
 * it. It costs one `&&` and it is what makes clipping impossible rather than
 * unlikely.
 *
 * The ceiling is where the two scales live: a phone keeps the `vh` ceiling it
 * always had, and from `sm` up it is twice that, because a tablet or a laptop
 * was leaving the question small in the middle of a large screen.
 */
```

- [ ] **Step 3: Replace `promptSize` with one constant**

Delete the whole of `function promptSize(prompt: string) { ... }` and its comment, and put in its place:

```ts
/**
 * The size before the fit runs: what the server renders and what a browser
 * without JavaScript keeps.
 *
 * One class rather than the three length-keyed steps this used to be. A size
 * chosen by how long the prompt is was the same unsteadiness the fit below now
 * removes, arriving a frame earlier - and it is a *pre*-hydration guess, so it
 * only has to be near the middle of the range the fit lands in.
 *
 * The sentinel and the real prompt both carry it, so the two are measured
 * under identical type before either is resized.
 */
const PROMPT_CLASS = 'text-[clamp(1.125rem,3.5vh,2.25rem)]';
```

This comes before the component below because the component references it.

- [ ] **Step 4: Rewrite the component body**

Replace the whole of `function Prompt({ ... })` — from `function Prompt({` down to its closing `}` before `readPromptMax` — with:

```tsx
function Prompt({
  prompt,
  onRepeat,
  repeatable,
}: {
  prompt: string;
  onRepeat: () => void;
  repeatable: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const sentinelRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    const sentinel = sentinelRef.current;
    if (!box || !text || !sentinel) return;

    // A long word can overrun the line at a size whose lines still fit, so
    // width is checked as well as height.
    const fits = (el: HTMLElement, height: number) =>
      el.offsetHeight <= height && el.scrollWidth <= el.clientWidth;

    const fit = () => {
      const height = box.clientHeight;
      const width = box.clientWidth;
      // A viewport too short to leave the question any room at all - a phone
      // held sideways - collapses the box to nothing. There is no size that
      // fits, so the declared one is left alone and allowed to overrun, which
      // is what it did before there was a fit at all. Hiding the overrun would
      // hide the question.
      if (height <= 0 || width <= 0) return;

      const max = readPromptMax(box);
      let low = MIN_PROMPT_PX;
      let high = Math.max(MIN_PROMPT_PX, Math.round(max));
      let best = MIN_PROMPT_PX;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        sentinel.style.fontSize = `${mid}px`;
        text.style.fontSize = `${mid}px`;
        // The sentinel is what decides the size - it is the worst case, and it
        // is the same on every question. The real prompt is checked too, as a
        // net rather than a branch anyone plans to reach: the sentinel is an
        // estimate of *width*, so a prompt of unusually wide glyphs could
        // exceed it, and clipping the question is the one outcome not worth
        // risking for consistency.
        if (fits(sentinel, height) && fits(text, height)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      sentinel.style.fontSize = '';
      text.style.fontSize = `${best}px`;
    };

    fit();

    // The box changes height when the target bar appears or goes, and width
    // when the iPad is turned, and neither is a re-render of this component.
    // It no longer changes when the *question* does - that is the point - so
    // there is nothing in the dependency list.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      // Tapping the question repeats it, but only while it is being read
      // aloud: a child who missed it reaches for the words themselves, which
      // needs no icon and no explaining, and a child who can read never finds
      // a button where the question is. It is the box and not the text that
      // takes the tap, since the text is only as big as it needs to be and a
      // child aiming at a short question would otherwise be aiming at very
      // little.
      onClick={repeatable ? onRepeat : undefined}
      role={repeatable ? 'button' : undefined}
      aria-label={repeatable ? 'Read the question again' : undefined}
      className="relative flex min-h-0 w-full flex-1 items-center justify-center [--prompt-max:clamp(1.375rem,4.5vh,3rem)] sm:[--prompt-max:6rem]"
    >
      {/* The worst case, measured and never seen.
          `invisible` and not `hidden`: a `display:none` element has no
          `offsetHeight` to read, which is the one thing this exists for.
          `absolute` so it cannot push the thing it is measuring for around -
          but pinned by `top`/`left` only and **never `inset-0`**, because an
          element stretched to its container's height reports that height
          whatever its content does, and the measurement would come back true
          at every size. `w-full max-w-3xl sm:max-w-5xl` are the real prompt's
          own width rules, so the two break lines identically. */}
      <p
        ref={sentinelRef}
        aria-hidden
        role="presentation"
        className={`pointer-events-none invisible absolute top-0 left-1/2 w-full max-w-3xl -translate-x-1/2 text-center leading-snug font-semibold text-balance sm:max-w-5xl ${PROMPT_CLASS}`}
      >
        {PROMPT_SENTINEL}
      </p>

      {/* Sized by the class until the fit runs, so a prompt rendered on the
          server is already about the right size rather than snapping into
          place. Wider than a page of prose on a big screen: a short question
          is one line, and a line it can grow along is what lets it grow at
          all. */}
      <h1
        ref={textRef}
        className={`w-full max-w-3xl text-center leading-snug font-semibold text-balance sm:max-w-5xl ${PROMPT_CLASS}`}
      >
        <MathsText text={prompt} />
      </h1>
    </div>
  );
}
```

Add the `MathsText` import at the top of the file, beside the other component imports:

```ts
import { MathsText } from './maths-text';
```


- [ ] **Step 5: Drop the `key` at both call sites**

There are two `<Prompt ... />` call sites, one inside the figure branch and one in the `else`. Both currently read:

```tsx
<Prompt
  key={session.askedCount}
  prompt={question.prompt}
  onRepeat={repeatQuestion}
  repeatable={narrating}
/>
```

Delete the `key` line from both. It remounted the component on every question, which would now re-run a fit whose answer cannot have changed, and `Prompt` holds no state a question boundary needs to reset.

- [ ] **Step 6: Typecheck and run the suite**

```bash
npm run typecheck
npm test
```

Expected: clean, and every existing test still passing — nothing in `src/lib` changed in this task.

- [ ] **Step 7: Check it by eye**

Run `npm run dev` and open `/play`. Vitest here is node-only, so this is the only verification there is for layout, and `CLAUDE.md` asks for it after any change to this screen.

Check, in the browser's device toolbar:
- **iPad landscape (1024×768)** — answer through several questions of very different lengths. The prompt must be the **same size** for all of them. A question with no figure should land somewhere near 54px.
- **iPad portrait (768×1024)** — same, one size throughout.
- **iPhone portrait (390×844)** and **landscape (844×390)** — one size throughout; on landscape the question may still be small, which is the pre-existing collapse the comment describes.
- A **fraction question** — reach one with `?child=` off and level 4 or 5 selected (e.g. `maths.4.fractions.equivalent`), or temporarily narrow the template pool. Its fraction must be stacked with a bar, must sit centred on the line rather than hanging below it, and must not push the prompt out of its box.

- [ ] **Step 8: Commit**

```bash
git add src/components/play-session.tsx
git commit -m "Set every question at the same size, by fitting the worst one"
```

---

### Task 5: The figure beside the question

**Files:**
- Modify: `src/components/play-session.tsx` — the figure/prompt wrapper (around lines 637-726) and the constant comment block at lines 71-90

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Rewrite the wrapper's comment**

Replace the long comment block above the figure branch (the one beginning "A question with a figure is a picture with a caption underneath it") with:

```tsx
          // A question with a figure is a question *beside* a picture, from
          // `sm` up - and a picture with a caption under it below that
          // (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`).
          //
          // One rule, at the width line, and it replaces the
          // `[@media(max-height:500px)]` pair that used to live here. Those
          // existed to give a landscape phone a row; a landscape phone is
          // *wide*, so the width query gives it one already. `500px` survives
          // only in the pad's own compound query further down, which makes
          // this one fewer place that number is written rather than a second
          // short-viewport line beside it.
          //
          // **A portrait phone keeps the column because a row would make the
          // figure smaller, not larger.** A row divides width and a 390px
          // phone has none to divide: side by side the drawing comes out
          // around 195px against roughly 280px stacked. The gain from a row is
          // real on a landscape iPad (~150px to ~270px) and a portrait iPad
          // (~330px to ~384px), and negative here - so the rule follows the
          // measurement rather than a preference for one shape.
          //
          // The split is 40/60 in the figure's favour. The prompt is a fixed
          // size now (see `Prompt`) and needs only the room its worst case
          // takes, so the wider half goes to the picture. `Diagram` is capped
          // at 40/46vh - ample headroom on every device this targets, so it is
          // a defence against an unreasonably tall window rather than the
          // thing that decides the figure's size - and floored at 64px (see
          // the note at the top of this file) so it is never a sliver.
          //
          // `items-stretch` on the row: in the column, height is the main axis
          // and flex-grow sizes both children along it, but a row's main axis
          // is width, and stretch is what gives them a height at all.
```

- [ ] **Step 2: Rewrite the wrapper element**

Replace this line:

```tsx
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 sm:gap-4 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-stretch">
```

with:

```tsx
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:items-stretch sm:gap-4">
```

- [ ] **Step 3: Reorder the two children and reset their shares**

Inside that wrapper the `<Diagram ... />` currently comes first and the prompt's slot second. Swap them, so the prompt is first in DOM order — in the row that puts it on the left, and in the column below `sm` it would put it on top, which is wrong. Use `order` to keep the column's stacking:

Put the prompt's slot first, with:

```tsx
            <div className="order-2 flex min-h-0 w-full min-w-0 flex-[0.4] flex-col items-center justify-center sm:order-1">
              <Prompt
                prompt={question.prompt}
                onRepeat={repeatQuestion}
                repeatable={narrating}
              />
            </div>
```

and the figure second, with its `className` changed only in its flex share and its order:

```tsx
            className="order-1 min-h-[min(64px,100%)] min-w-[min(64px,100%)] max-h-[40vh] max-w-[40vh] w-full flex-[0.6] sm:order-2 sm:max-h-[46vh] sm:max-w-[46vh]"
```

`flex-[0.4]` / `flex-[0.6]` rather than `flex-[0.35]` / `flex-1`: with the prompt at a fixed size, an explicit pair of shares says what the split is, where `flex-1` against a fraction only worked because one side happened to win. Both must be literal class text — see the Global Constraints.

Leave `strokeWidth={3.5}` and `labelSize={PLAY_LABEL_SIZE}` as they are.

- [ ] **Step 4: Update the file-head constant comment**

At lines 71-90 the comment explains that `500px` means "landscape phone" and is used by "the figure-and-prompt wrapper below" and the pad. The wrapper no longer uses it. Rewrite the second half of that block so it names only the pad:

```
 * `500px` is written out at its one remaining use below rather than held in a
 * constant: Tailwind's scanner reads class names as source-text literals
 * (CLAUDE.md says this outright for `OPERATION_ACCENT`, and it is exactly as
 * true of an arbitrary variant), so a class built from
 * `` `${SOME_CONST}:flex-row` `` compiles to nothing - the composed string
 * exists at runtime, but never in the source text the build ever scans. A
 * shared constant here would be a standing invitation to do that again the
 * next time this screen changes.
 *
 * It used to have two uses. The figure-and-prompt wrapper wanted a row on a
 * landscape phone, and now takes its row from `sm:` instead - a landscape
 * phone is wide, so the width query covers it, and the height query was the
 * more specific way of saying the same thing. What is left is the pad's own
 * `min-height:501px` half, where the question is genuinely about height: a
 * fixed `16rem` floor built for a device with height to spare must not be
 * handed to a wide device without any.
```

- [ ] **Step 5: Typecheck and run the suite**

```bash
npm run typecheck
npm test
```

Expected: clean and green.

- [ ] **Step 6: Check it by eye**

`npm run dev`, `/play`, on a level with plenty of figure questions — Year 1 or Year 2 have several `data` and `shapes` templates. In the device toolbar:

- **iPad landscape (1024×768)** — question on the left, figure on the right, figure noticeably larger than before (aim ~270px).
- **iPad portrait (768×1024)** — same row, figure ~380px.
- **iPhone landscape (844×390)** — still a row, both usable, and **the narration speaker button in the header must not be painted over** — that was the bug the `min(64px,100%)` floor was written for, and this task moves the figure.
- **iPhone portrait (390×844)** — a column: figure on top at full width, question beneath it. Confirm the figure is *bigger* here than it is in the row, which is the whole reason for the exception.
- A question with **no figure** on every one of those — the prompt takes the full width and nothing about it changed.

- [ ] **Step 7: Commit**

```bash
git add src/components/play-session.tsx
git commit -m "Put the picture beside the question, where there is width to do it"
```

---

### Task 6: Tapping the figure to see it large

**Files:**
- Create: `src/components/magnify-icon.tsx`
- Create: `src/components/figure-zoom.tsx`
- Modify: `src/lib/figures/labels.ts` (add `ZOOM_LABEL_SIZE` beside `PLAY_LABEL_SIZE`)
- Modify: `src/components/play-session.tsx` (zoom state, the figure's wrapper, the overlay's render)

**Interfaces:**
- Consumes: `Figure` from `@/lib/figures/types`; `MathsText` from `./maths-text` (Task 3); `Diagram` from `./diagram`; `ZOOM_LABEL_SIZE` from `@/lib/figures/labels`.
- Produces: `FigureZoom({ figure, prompt, onClose, onRepeat, repeatable })` and `MagnifyIcon()`.

- [ ] **Step 1: Add the zoom's label size**

Find `PLAY_LABEL_SIZE` in `src/lib/figures/labels.ts` and add beside it:

```ts
/**
 * The label size for a figure opened full-screen (`figure-zoom.tsx`).
 *
 * Smaller than the play screen's, because these are viewBox units and the box
 * is bigger: a label at 7 units in a 270px box renders around 19 real pixels,
 * and the same 7 in a ~600px overlay would render around 42 - a caption
 * shouting over the drawing it labels. 4 puts it back near 24, which is a
 * comfortable read at arm's length.
 *
 * **Safe without any change to the kinds that place labels.** The paragraph
 * above says a kind has to leave room for the *larger* of the sizes it will be
 * drawn at, which is still the report's 16. A third size that is smaller than
 * both asks for less room than the budget already allows.
 */
export const ZOOM_LABEL_SIZE = 4;
```

If `PLAY_LABEL_SIZE` is not exported from that file, add it there in the same style and update `play-session.tsx`'s import — but check first: `play-session.tsx:32` already imports it from `@/lib/figures/labels`, so it is exported.

- [ ] **Step 2: Write the glyph**

Create `src/components/magnify-icon.tsx`, matching the shape of the other glyph components (open one — `hint-icon.tsx` — and follow its props, sizing and `currentColor` convention exactly):

```tsx
/**
 * A magnifier, on the corner of a figure that can be opened larger.
 *
 * A picture rather than a word, for the reason the door, the tick and the
 * lightbulb are: this screen is built to need no reading, and a child who
 * cannot read has no other way to discover that the drawing is tappable.
 */
export function MagnifyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}
```

Before committing this, open `src/components/hint-icon.tsx` and `src/components/exit-icon.tsx` and make the props, the `className` default and the stroke conventions match whichever pattern those two share. Do not invent a third convention.

- [ ] **Step 3: Write the overlay**

Create `src/components/figure-zoom.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import type { Figure } from '@/lib/figures/types';
import { ZOOM_LABEL_SIZE } from '@/lib/figures/labels';
import { Diagram } from './diagram';
import { MathsText } from './maths-text';

/**
 * The figure, over the whole screen.
 *
 * **It has to cover the screen, because the question area is bound by height
 * and not by width** (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`).
 * Expanding a figure into the prompt's half of the row buys almost nothing: on
 * a landscape iPad that area is around 270px tall whether the figure has 60%
 * of the width or all of it. The only room left to take is the pad's, and
 * taking the pad's room means covering the pad. So a child cannot answer while
 * this is open, and closing it is one tap **anywhere** rather than a target to
 * find.
 *
 * **The prompt rides along.** The questions this exists for are the ones where
 * the picture carries the data - a bar graph, a coordinate grid - and reading a
 * graph against a question you are trying to remember is the thing that made
 * the small figure hard in the first place.
 *
 * This is the one place the figure is a control, and it is a reversal: the
 * diagrams design said the figure "is not a second control: it takes no tap".
 * What is unchanged is why - a figure must not be a second thing to decode -
 * and a tap that only ever makes the same picture bigger decodes nothing.
 */
export function FigureZoom({
  figure,
  prompt,
  onClose,
  onRepeat,
  repeatable,
}: {
  figure: Figure;
  prompt: string;
  onClose: () => void;
  /** Repeat the question aloud. Only wired up while narration is on. */
  onRepeat: () => void;
  repeatable: boolean;
}) {
  // Escape closes it for whoever is on a keyboard. A tap anywhere is the
  // child's way out and needs nothing here.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="The picture, larger"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center gap-3 bg-(--color-paper) p-4 sm:gap-4 sm:p-6"
    >
      {/* Small and out of the way: the picture is what this screen is for, and
          the words are here so a child does not have to hold the question in
          their head while reading a graph. Tapping them repeats them aloud,
          exactly as tapping the question on the play screen does - and the tap
          must not also close the overlay, hence the stopPropagation. */}
      <p
        onClick={
          repeatable
            ? (event) => {
                event.stopPropagation();
                onRepeat();
              }
            : undefined
        }
        role={repeatable ? 'button' : undefined}
        aria-label={repeatable ? 'Read the question again' : undefined}
        className="w-full max-w-3xl shrink-0 text-center text-[clamp(1rem,2.6vh,1.5rem)] leading-snug font-semibold text-balance text-(--color-ink)"
      >
        <MathsText text={prompt} />
      </p>

      {/* `strokeWidth` 5 rather than the play screen's 3.5: it is real pixels
          (`vectorEffect="non-scaling-stroke"`), and a line that reads at 270px
          is a hairline at 600. */}
      <Diagram
        figure={figure}
        strokeWidth={5}
        labelSize={ZOOM_LABEL_SIZE}
        className="min-h-0 w-full flex-1"
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the play screen — state**

In `src/components/play-session.tsx`, add the imports:

```ts
import { FigureZoom } from './figure-zoom';
import { MagnifyIcon } from './magnify-icon';
```

Add the state beside `const [hintShown, setHintShown] = useState(false);` (line 195):

```ts
const [zoomed, setZoomed] = useState(false);
```

and clear it in `advance` (line 345), beside `setHintShown(false)`:

```ts
setZoomed(false);
```

- [ ] **Step 5: Wire it in — the figure becomes tappable**

The `<Diagram ... />` inside the figure branch has to gain a wrapper that carries the tap and the glyph, because `Diagram` renders an `<svg>` and takes no handlers. Replace the `<Diagram ... />` element (keeping every prop it has, and moving its layout classes to the wrapper) with:

```tsx
            <div
              onClick={() => setZoomed(true)}
              role="button"
              aria-label="See the picture larger"
              className="order-1 relative flex min-h-[min(64px,100%)] min-w-[min(64px,100%)] max-h-[40vh] max-w-[40vh] w-full flex-[0.6] items-center justify-center sm:order-2 sm:max-h-[46vh] sm:max-w-[46vh]"
            >
              <Diagram
                figure={question.figure}
                strokeWidth={3.5}
                labelSize={PLAY_LABEL_SIZE}
                className="h-full w-full"
              />
              {/* What says the drawing can be tapped. A picture, for the reason
                  the door and the tick are pictures - and in the corner rather
                  than over the drawing, because the drawing is the question. */}
              <span className="pointer-events-none absolute right-0 bottom-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-1.5 text-(--color-ink-soft)">
                <MagnifyIcon />
              </span>
            </div>
```

The `min-h-[min(64px,100%)]` and `min-w-[min(64px,100%)]` floors move to the wrapper unchanged — read the note at the top of the file before touching them, and keep them written out as literal class text.

- [ ] **Step 6: Wire it in — render the overlay**

At the bottom of the returned `<main>`, beside `{streak !== null && <StreakFlash ... />}` and before `{reward !== null && ...}`, add:

```tsx
      {/* Below the celebrations in DOM order deliberately: a round can close on
          the same answer that had the picture open, and the stars are the thing
          that must be on top. The zoom cannot survive that answer anyway -
          `advance` clears it - so this only decides one frame. */}
      {zoomed && question.figure && (
        <FigureZoom
          figure={question.figure}
          prompt={question.prompt}
          onClose={() => setZoomed(false)}
          onRepeat={repeatQuestion}
          repeatable={narrating}
        />
      )}
```

- [ ] **Step 7: Typecheck and run the suite**

```bash
npm run typecheck
npm test
```

Expected: clean and green.

- [ ] **Step 8: Check it by eye**

`npm run dev`, `/play`, on a level with figure questions:

- The **magnifier badge** appears on the figure's corner, on every viewport, and on **no** question that has no figure.
- Tapping the figure opens the overlay; the prompt is small at the top, the drawing fills the rest and is clearly bigger than it was.
- Tapping **anywhere** closes it. **Escape** closes it.
- Turn narration on with the speaker button, open the zoom, tap the prompt inside it — it reads aloud and the overlay **stays open**.
- Answer a question, then answer another: the zoom must not be open on the new question.
- Open the zoom on the tenth answer's question and confirm the round's star screen is not hidden behind it.
- On **iPhone landscape (844×390)** the overlay must still be usable — prompt at top, drawing below.

- [ ] **Step 9: Commit**

```bash
git add src/components/figure-zoom.tsx src/components/magnify-icon.tsx src/lib/figures/labels.ts src/components/play-session.tsx
git commit -m "Let a child open the picture, since the small one was the problem"
```

---

### Task 7: Fractions on the pad and in the feedback line

**Files:**
- Modify: `src/components/choice-pad.tsx` (the button's children, around line 60)
- Modify: `src/components/play-session.tsx` — `Hint` (around line 972) and `FeedbackLine` (around line 1084)

**Interfaces:**
- Consumes: `MathsText` from `./maths-text` (Task 3).
- Produces: nothing new.

- [ ] **Step 1: The choice buttons**

In `src/components/choice-pad.tsx`, add the import:

```ts
import { MathsText } from './maths-text';
```

and replace the button's child — currently `{option.label}` — with:

```tsx
            <MathsText text={option.label} />
```

Add to the module comment at the top of the file:

```
 * A label may be a fraction (`maths.5.fractions.equivalent-shaded` and
 * `maths.5.chance.spinner-fraction` are both `choice` templates whose answers
 * are fractions), so it is drawn through `MathsText` rather than as text. The
 * `value` is untouched: `1/2` is still what is graded and recorded.
```

- [ ] **Step 2: The hint**

In `play-session.tsx`'s `Hint`, replace `{hint}` inside the `<p>` with:

```tsx
          <MathsText text={hint} />
```

Two shipped hints carry a fraction — `maths.5.fractions.add-related-denominator` ("1/7 is the same as 2/14.") and `maths.6.fractions.add-with-equivalence` ("Rewrite 1/8 with 16 on the bottom first.").

- [ ] **Step 3: The feedback line**

In `play-session.tsx`'s `FeedbackLine`, replace:

```tsx
      {feedback?.state === 'wrong' ? `The answer is ${feedback.expected}` : ''}
```

with:

```tsx
      {feedback?.state === 'wrong' ? (
        <>
          The answer is <MathsText text={feedback.expected} />
        </>
      ) : (
        ''
      )}
```

This is the line a tapped question shows after a wrong tap, and a tapped fraction question's right answer is a fraction — so without it the prompt and the buttons would draw a bar and the sentence naming the answer would draw a slash.

`AnswerDisplay`'s `<output>` is left alone: it shows what the child **typed**, and a typed answer is digits from the number pad or letters from the letter pad. Neither can produce a slash.

- [ ] **Step 4: Typecheck and run the suite**

```bash
npm run typecheck
npm test
```

Expected: clean and green. Nothing in `src/lib` changed.

- [ ] **Step 5: Check it by eye**

`npm run dev`, and reach a fraction question. The reliable ones:

- `maths.5.fractions.equivalent-shaded` — Year 5, topic `fractions`. Four choice buttons, each a fraction.
- `maths.5.chance.spinner-fraction` — Year 5, topic `chance`. Same shape, and it has a figure, so it exercises the row layout too.
- `maths.6.fractions.add-with-equivalence` — Year 6. A prompt with three fractions in it and a hint with one.

Check that:
- The stacked fraction on a **choice button** is centred and does not clip the button's rounded top or bottom.
- Getting one **wrong** turns the right button green with its bar still drawn, and the sentence under it draws a bar too.
- The **hint** behind the lightbulb draws a bar and stays inside its `min-h-12` row without pushing the question.
- **Narration still speaks it**: turn the speaker on and confirm `maths.6.fractions.add-with-equivalence` is read as "1 out of 8 plus 7 out of 16 equals what out of 16" — the drawing changed, the speech did not.

- [ ] **Step 6: Commit**

```bash
git add src/components/choice-pad.tsx src/components/play-session.tsx
git commit -m "Draw the bar on the buttons too, not only in the question"
```

---

### Task 8: Write down what changed

**Files:**
- Modify: `CLAUDE.md` — the **UI** section, the **Question diagrams** section, the **Question templates** section
- Modify: `docs/superpowers/specs/2026-08-20-question-diagrams-design.md` — the **Layout** section and the **Narration** section

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

This task is not optional and not cosmetic. Three of the four changes contradict sentences currently written in `CLAUDE.md`, and a document that argues for the opposite of the code is worse than no document.

- [ ] **Step 1: The three contradictions in `CLAUDE.md`**

Find and rewrite each. Match the file's voice — it states a decision and then says why, and it says what was rejected.

1. In **UI**, the bullet beginning "**The question is measured and fitted, not declared** (`Prompt`)". It currently argues that a declared size "can only be the one that survives the worst case, which is what left a short question small in the middle of a large screen". That is now what the app deliberately does. Rewrite it to say the box is still measured but what is measured is `PROMPT_SENTINEL` at `MAX_PROMPT_CHARS`, so the size is the worst case's and every question shares it; that the jump between 96px and 33px across a session carried no information; and that the cap is therefore the only lever on how big the one size is, which is why `catalog.test.ts` enforces it.

2. In **Question diagrams**, the sentence "the figure is not a second control: it takes no tap, and tapping the question still repeats the words". Rewrite: the figure now takes a tap and it opens full-screen, with a magnifier glyph saying so; the reason the old rule existed — a figure must not be a second thing to decode — is unchanged, and a tap that only ever makes the same picture bigger decodes nothing. Say why it has to cover the screen (the question area is height-bound, so the only room left is the pad's) and that the prompt rides along.

3. In **Question diagrams**, the paragraph beginning "**The figure outranks the prompt on the play screen.**" It describes the figure claiming the room first with the prompt fitting into what is left, and names the `max-height:500px` exception. Rewrite it for the row-from-`sm` rule, the 40/60 split, and the portrait-phone exception with the measured reason (a row divides width and a 390px phone has none to divide: ~195px side by side against ~280px stacked).

- [ ] **Step 2: The `500px` note in `CLAUDE.md`**

In **UI**, the bullet "**One short-viewport line, and a second should not be invented.**" says `max-height:500px` "turns a figure and its prompt into a row". It does not any more. Rewrite so it names only the pad's `min-height:501px` half, and say that the figure's use of it went when the width query turned out to cover the same devices — that is the note getting *shorter*, which is the direction it should go.

- [ ] **Step 3: The new facts in `CLAUDE.md`**

Add, in the sections they belong to:

- In **Question templates**: `MAX_PROMPT_CHARS` (140), what it is measured against (135 observed over 300 draws of all 350 templates), why the five characters of slack, and that `catalog.test.ts` enforces it. Say plainly that it is not a tidiness rule — it is the only lever on how big every question on the screen is.
- In **UI**: that a fraction is drawn with a horizontal bar (`src/lib/fractions.ts` decides what a slash is, `src/components/maths-text.tsx` draws it), that it applies to the prompt, the hint, the choice buttons and the feedback line, and that the parent's report is deliberately left as text because its rows are single-line and elided.
- In **Narration**: that the fraction rule now lives in `src/lib/fractions.ts` and narration imports it, so the spoken and drawn forms cannot disagree about which slashes are fractions — and that `catalog.test.ts` now checks the "every `/` is a fraction" claim that used to be a comment.

- [ ] **Step 4: The diagrams spec**

`docs/superpowers/specs/2026-08-20-question-diagrams-design.md`'s **Layout** section (lines 120-131) describes the old stacking and the `max-height` exception, and its **Narration** section says the figure takes no tap. Do not rewrite that spec — it is a record of a decision made on a date. Add a short note at the top of each of those two sections pointing at
`docs/superpowers/specs/2026-08-22-question-viewport-design.md` and saying in one sentence what superseded it.

- [ ] **Step 5: Check nothing else still says the old thing**

```bash
grep -n "max-height:500px" CLAUDE.md src/components/*.tsx
grep -rn "takes no tap\|not a second control" CLAUDE.md docs/
grep -rn "measured and fitted" CLAUDE.md
```

Every hit must either be a rewritten sentence or a dated spec carrying a superseded-by note.

- [ ] **Step 6: Full verification, then commit**

```bash
npm test
npm run typecheck
npm run build
```

All three must pass before committing. `npm run build` is included because it is the only thing that exercises the Tailwind scanner, and every class this plan added is an arbitrary variant or arbitrary value that compiles to nothing if it was built by interpolation rather than written out.

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-20-question-diagrams-design.md
git commit -m "Say that the question is one size now, and that the picture takes a tap"
git push
```

---

## Notes for whoever executes this

**The order matters in one place only.** Tasks 1-3 are independent of each other and produce what Tasks 4-7 consume. Tasks 4, 5, 6 and 7 all edit `play-session.tsx` and must be done in order or they will conflict.

**There are no component tests, and that is the house rule rather than an omission.** Vitest here runs in node with no DOM — the same reason `src/lib/photo/crop.ts` has tests and `src/components/photo-crop.tsx` does not. Everything decidable has been pushed into `src/lib` and is tested there. The by-eye checks in Tasks 4, 5, 6 and 7 are the whole of the verification for the rest, so do not skip them.

**If a by-eye check disagrees with a number in this plan** — the figure comes out at 200px where the plan says 270, the prompt at 40px where it says 54 — the numbers are the spec's arithmetic, not measurements from a running browser. Report the difference rather than tuning the classes to hit the number: the arithmetic may have been wrong, and that is worth knowing.
