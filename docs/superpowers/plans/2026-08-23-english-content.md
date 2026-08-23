# English Content K-6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship English as LearnR's second subject - about 155 question templates across Kindergarten to Year 6, cited to both syllabuses and validated by the checks that already exist.

**Architecture:** English is content, not an engine change. `src/content/english/` mirrors `src/content/maths/` exactly (a file a year, a `helpers.ts`, an `index.ts` concatenating in school order), and `catalog.ts` gains one import. Four seams widen to admit a second subject: `SYLLABUSES` gains English's two documents, `nswStageOfCode` gains four prefixes, `/curriculum` renders per subject, and three tests in `catalog.test.ts` that assert maths facts over every template become subject-scoped. `src/lib/figures`, `answerMode`, `gradeAnswer`, the three pads, the reinforcement selector, the rewards modules and the speed run are untouched.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Prisma 7. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-english-content-design.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **Rendered prompts are at most 140 characters** (`MAX_PROMPT_CHARS`). Enforced over 50 draws of every template.
- **No slash may appear anywhere** in a prompt, hint, answer or choice unless it is a fraction. English content should contain no slashes at all.
- **At most 4 options** on a multiple choice question (`MAX_CHOICES`), at least 2.
- **Template ids are `subject.level.topic.variant`**, with the topic's spaces replaced by hyphens - e.g. `english.2.compound-words.join-two`. **Kindergarten's level segment is a capital `K`** (`english.K.rhyme.which-rhymes`): `catalog.test.ts` builds the id regex from `template.level` itself, so a lowercase `k` fails.
- **Every template cites at least one syllabus**, and **every tag must be a recognised curriculum code**. There is no room for a `needs-review` tag.
- **An NSW code may only come from the stage its template's year falls in.** ES1 = K, S1 = Years 1-2, S2 = Years 3-4, S3 = Years 5-6.
- **NESA outcome statements are Crown copyright and are never reproduced** - not in a `tags` array, not in a code comment, not in a notes file, not on a page. Say where the syllabus *places* something; never say what it *says*. ACARA descriptions are CC BY 4.0 and may be quoted or paraphrased.
- **Typed answers are one word, A-Z only, at most 16 characters.** The letter pad has no space key and no apostrophe key. Any answer containing an apostrophe or a space must be `choice`.
- **English Kindergarten uses no `text` answers at all.** Every K template is `choice`, `boolean` or `number`.
- **At most 40% of any English year's templates may generate a `text` answer.**
- **At least 15% of a Year 1-6 English year's templates must generate a typed answer, spanning at least two topics.** A floor as well as the 40% ceiling, and the spread matters more than the count: the reinforcement selector weights *topics*, so a year whose typed exposure sits in one topic lets a child who is secure in that topic go a whole year without typing anything - which makes "this is where typing starts" false in practice for exactly the children doing best. Kindergarten is exempt and stays at zero.
- **Read every sentence frame's draws out loud before shipping them.** No automated check can see that a frame is nonsense or worse: Year 1 first shipped `'I ate ? {noun}.'` over a bank containing `elephant`, `umbrella`, `house`, `dog` and `cat`. The a/an grammar was correct in all ten draws, the leak measurement was clean, and two of them were sentences no six-year-old should be shown.
- **Every year needs at least 20 templates.**
- **Word banks are shared:** every word a `choices` template can offer must be capable of being both the answer and a distractor across draws. See Task 4.
- Run `npm test` and `npm run typecheck` before every commit.
- **Never run `npm run build`, any `npm run db:*` command, or a dev server.** This worktree's `.env` carries a real production `DATABASE_URL`, and `npm run build` runs `db:deploy` first - which would apply migrations to it. Verification is `npm test` and `npm run typecheck`.
- **Everything runs under vitest.** `tsx` is not a dependency, and the `@/` import alias is configured only in `vitest.config.mts`, so a standalone `.ts` script cannot resolve this repo's imports. Anything that needs to execute against the content is a test file under `src/**/*.test.ts`.

---

## Verified curriculum citations

Sourced during design. **ACARA** codes and descriptions come from ACARA's own `english-curriculum-content-f-6-v9.docx`; **NSW** codes come from NESA's outcomes pages. Use these and do not invent neighbours.

| Year | Topic | ACARA | What ACARA's description covers | NSW |
| --- | --- | --- | --- | --- |
| K | letters and sounds | `AC9EFLY10` | isolate, blend, manipulate phonemes in single-syllable words | `ENE-PHOKW-01` |
| K | letters and sounds | `AC9EFLY13` | use knowledge of letters and sounds to spell words | `ENE-PHOKW-01` |
| K | rhyme | `AC9EFLY09` | generate rhyming words, alliteration, syllables, phonemes | `ENE-PHOAW-01` |
| K | syllables | `AC9EFLY09` | as above - syllables in spoken words | `ENE-PHOAW-01` |
| K | opposites | `AC9EFLA08` | vocabulary in familiar contexts | `ENE-VOCAB-01` |
| K | sentences | `AC9EFLA09` | capital letters for names and sentence starts, end punctuation | `ENE-CWT-01` |
| 1 | letters and sounds | `AC9E1LY11` | short and long vowels, blends, digraphs to write and read words | `EN1-PHOKW-01` |
| 1 | letters and sounds | `AC9E1LY12` | a letter can represent more than one sound; a syllable has a vowel | `EN1-PHOKW-01` |
| 1 | rhyme | `AC9E1LE04` | imitate and invent sound patterns including alliteration and rhyme | `EN1-PHOKW-01` |
| 1 | plurals | `AC9E1LY15` | grammatical morphemes to create word families | `EN1-SPELL-01` |
| 1 | opposites | `AC9E1LA09` | vocabulary of learning area topics | `EN1-VOCAB-01` |
| 1 | word classes | `AC9E1LA07` | nouns, pronouns, verbs, adjectives | `EN1-CWT-01` |
| 1 | sentences | `AC9E1LA10` | full stops, question marks, exclamation marks, capitals | `EN1-CWT-01` |
| 2 | plurals | `AC9E2LY12` | morphemic word families using prefixes and suffixes | `EN1-SPELL-01` |
| 2 | past tense | `AC9E2LY12` | as above - suffix morphemes | `EN1-SPELL-01` |
| 2 | compound words | `AC9E2LY11` | spelling patterns and morphemes for less predictable words | `EN1-SPELL-01` |
| 2 | word classes | `AC9E2LA07` | noun groups with articles and adjectives, verb groups | `EN1-CWT-01` |
| 2 | punctuation | `AC9E2LY06` | create and edit short texts (sentence-level conventions) | `EN1-CWT-01` |
| 2 | synonyms | `AC9E2LA09` | conscious choices of vocabulary to suit the topic | `EN1-VOCAB-01` |
| 3 | prefixes and suffixes | `AC9E3LY10` | base words, prefixes, suffixes, generalisations for adding a suffix | `EN2-SPELL-01` |
| 3 | homophones | `AC9E3LY12` | high-frequency words including some homophones | `EN2-SPELL-01` |
| 3 | word classes | `AC9E3LA07` | verbs represent doing, feeling, thinking, saying, relating | `EN2-CWT-01` |
| 3 | word classes | `AC9E3LA08` | verbs are anchored in time through tense | `EN2-CWT-01` |
| 3 | punctuation | `AC9E3LA11` | apostrophes for contractions and for possession | `EN2-CWT-01` |
| 3 | spelling patterns | `AC9E3LY11` | less common letter patterns to spell words | `EN2-SPELL-01` |
| 4 | prefixes and suffixes | `AC9E4LY10` | letter patterns, double letters, morphological word families, prefixes | `EN2-SPELL-01` |
| 4 | homophones | `AC9E4LY11` | high-frequency words including homophones, context for spelling | `EN2-SPELL-01` |
| 4 | word classes | `AC9E4LA08` | adverb groups and prepositional phrases | `EN2-CWT-01` |
| 4 | word classes | `AC9E4LA09` | past, present and future tenses | `EN2-CWT-01` |
| 4 | plurals | `AC9E4LY10` | as above - morphological word families | `EN2-SPELL-01` |
| 4 | synonyms | `AC9E4LA11` | synonyms and antonyms to expand vocabulary | `EN2-VOCAB-01` |
| 5 | word roots | `AC9E5LY09` | build and spell new words from base words, prefixes, suffixes, word origins | `EN3-SPELL-01` |
| 5 | prefixes and suffixes | `AC9E5LY10` | less common plurals; how a suffix changes meaning or grammatical form | `EN3-SPELL-01` |
| 5 | homophones | `AC9E5LY08` | words sharing letter patterns with different pronunciations | `EN3-SPELL-01` |
| 5 | figurative language | `AC9E5LE04` | effects of simile, metaphor and personification | `EN3-UARL-01` |
| 5 | spelling patterns | `AC9E5LY08` | as above | `EN3-SPELL-01` |
| 6 | word roots | `AC9E6LY09` | word origins including Latin and Greek roots, base words, prefixes, suffixes | `EN3-SPELL-01` |
| 6 | word classes | `AC9E6LA06` | verbs, elaborated tenses, adverb groups | `EN3-CWT-01` |
| 6 | figurative language | `AC9E6LA08` | metaphors, similes, personification, idioms, imagery, hyperbole | `EN3-UARL-01` |
| 6 | punctuation | `AC9E6LA09` | commas for lists and to separate clauses | `EN3-CWT-01` |
| 6 | spelling patterns | `AC9E6LY08` | common and less common grapheme-phoneme relationships | `EN3-SPELL-01` |

**Two facts about the NSW lists worth knowing before Task 3.** Stage 1 has **no** phonological-awareness or print-concepts outcome - both fold into `EN1-PHOKW-01`, which is why Year 1 rhyme cites PHOKW where Kindergarten rhyme cites PHOAW. And Stage 3 has **no** reading-fluency outcome, unlike the three stages below it.

---

## File structure

**Created:**

- `src/content/english/helpers.ts` - word-bank helpers, the ternary chains the expression language forces. Responsibility: turn an integer index into a word, for banks shared between an answer and its distractors.
- `src/content/english/k.ts` ... `src/content/english/6.ts` - one school year each, exporting `yearK`, `year1` ... `year6`.
- `src/content/english/index.ts` - concatenates the seven in school order into `englishTemplates`.
- `src/content/english/helpers.test.ts` - unit tests for the helpers.
- `docs/superpowers/notes/nsw-english-outcome-codes.md` - the transcribed NSW English outcome codes by stage.
- `src/content/english/leaks.test.ts` - the option-set leak audit (Task 13), a fourth check beyond the three in `validateTemplate`.

**Modified:**

- `src/content/catalog.ts` - `SYLLABUSES` gains two entries and a `subject` field; new `syllabusSubjectOf`; `STAGE_BY_PREFIX` gains four prefixes; `allTemplates` spreads `englishTemplates`; `DIVERGENCE_NOTES` gains English entries.
- `src/content/catalog.test.ts` - three tests subject-scoped; new English assertions; `ENGLISH_NSW_OUTCOMES` transcription.
- `src/app/curriculum/page.tsx` - renders a section per subject.
- `src/components/subject-cards.tsx` - English accent and glyph (Task 15).

---

### Task 1: Teach the syllabus table about English

**Files:**
- Modify: `src/content/catalog.ts` (the `Syllabus` interface, `SYLLABUSES`, `STAGE_BY_PREFIX`, new `syllabusSubjectOf`)
- Test: `src/content/catalog.test.ts` (the `syllabus sources` describe block)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `syllabusSubjectOf(code: string): string | null` returning `'maths'`, `'english'` or `null`. `Syllabus` gains `subject: string`. `syllabusOf(code: string): SyllabusId | null` keeps its exact signature and meaning.

**Why `SyllabusId` is not widened to four values:** the id names the *family* - who published it, whether its prose is quotable, which column of `/curriculum` it falls in - and every one of those is a property of ACARA or NESA rather than of the document. The divergence machinery keys off the family and would have to collapse four ids back into two the moment it was widened.

- [ ] **Step 1: Write the failing tests**

Add to the `syllabus sources` describe block in `src/content/catalog.test.ts`:

```ts
it('recognises an ACARA English content description', () => {
  expect(syllabusOf('AC9EFLY09')).toBe('acara');
  expect(syllabusOf('AC9E3LY10')).toBe('acara');
  expect(syllabusOf('AC9E6LA09')).toBe('acara');
});

it('recognises an NSW English outcome at every stage', () => {
  expect(syllabusOf('ENE-PHOAW-01')).toBe('nsw');
  expect(syllabusOf('EN1-PHOKW-01')).toBe('nsw');
  expect(syllabusOf('EN2-SPELL-01')).toBe('nsw');
  expect(syllabusOf('EN3-UARL-01')).toBe('nsw');
});

// English has exactly three strands - LA Language, LE Literature, LY Literacy -
// so the pattern names them. A mistyped strand is then a shape error caught
// here rather than a plausible code that has to reach the membership list.
it('rejects an English code with a strand that does not exist', () => {
  expect(syllabusOf('AC9E3XX10')).toBe(null);
  expect(syllabusOf('AC9E3L10')).toBe(null);
});

it('reads the stage an NSW English outcome belongs to', () => {
  expect(nswStageOfCode('ENE-PHOAW-01')).toBe('ES1');
  expect(nswStageOfCode('EN1-SPELL-01')).toBe('S1');
  expect(nswStageOfCode('EN2-CWT-01')).toBe('S2');
  expect(nswStageOfCode('EN3-VOCAB-01')).toBe('S3');
});

it('names the subject whose syllabus a code comes from', () => {
  expect(syllabusSubjectOf('AC9M4N02')).toBe('maths');
  expect(syllabusSubjectOf('MA2-AR-01')).toBe('maths');
  expect(syllabusSubjectOf('AC9E3LY10')).toBe('english');
  expect(syllabusSubjectOf('EN2-SPELL-01')).toBe('english');
  expect(syllabusSubjectOf('needs-review')).toBe(null);
});

it('names all four documents', () => {
  expect(SYLLABUSES.map((s) => [s.id, s.subject])).toEqual([
    ['acara', 'maths'],
    ['acara', 'english'],
    ['nsw', 'maths'],
    ['nsw', 'english'],
  ]);
});
```

Also **change** the existing assertion that English codes are unrecognised - it was written when English was hypothetical and is now wrong:

```ts
it('is not fooled by a tag that is only a note to ourselves', () => {
  expect(syllabusOf('needs-review')).toBe(null);
  expect(syllabusOf('MA9-XX-01')).toBe(null);
  expect(syllabusOf('AC9X4N02')).toBe(null);   // was AC9E4N02, which is English now
});
```

Add `syllabusSubjectOf` to the import list at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content/catalog.test.ts -t 'syllabus sources'`
Expected: FAIL - `syllabusSubjectOf is not a function`, and the English codes return `null`.

- [ ] **Step 3: Implement**

In `src/content/catalog.ts`, add `subject` to the interface:

```ts
export interface Syllabus {
  id: SyllabusId;
  /** The subject whose content this document covers. */
  subject: string;
  name: string;
  shortName: string;
  url: string;
  pattern: RegExp;
}
```

Replace `SYLLABUSES` with four entries, keeping the two maths ones byte-identical apart from the new field:

```ts
export const SYLLABUSES: readonly Syllabus[] = [
  {
    id: 'acara',
    subject: 'maths',
    name: 'Australian Curriculum Version 9.0 — Mathematics (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    pattern: /^AC9M(F|\d{1,2})[A-Z]+\d{2}$/,
  },
  {
    id: 'acara',
    subject: 'english',
    name: 'Australian Curriculum Version 9.0 — English (Foundation to Year 10)',
    shortName: 'ACARA v9.0',
    url: 'https://www.australiancurriculum.edu.au',
    // English has exactly three strands, so they are named rather than matched
    // as `[A-Z]+`: a mistyped strand fails here instead of reaching the
    // membership list looking like a real code.
    pattern: /^AC9E(F|\d{1,2})(LA|LE|LY)\d{2}$/,
  },
  {
    id: 'nsw',
    subject: 'maths',
    name: 'NSW Mathematics K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022',
    pattern: /^MA(E|O|[1-3])-[A-Z0-9]+-\d{2}$/,
  },
  {
    id: 'nsw',
    subject: 'english',
    name: 'NSW English K–10 Syllabus (2022)',
    shortName: 'NSW K–10 (2022)',
    url: 'https://curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022',
    pattern: /^EN(E|[1-3])-[A-Z]+-\d{2}$/,
  },
];
```

Add the subject lookup beside `syllabusOf`:

```ts
/**
 * The subject whose syllabus a code comes from, or `null` for a tag that is not
 * a curriculum code.
 *
 * A second narrow lookup rather than widening `syllabusOf`'s return, because the
 * two questions have different callers: `/curriculum` needs the subject to name
 * the right document and link the right URL, and `catalog.test.ts` needs it to
 * refuse a maths code on an English template - while everything that already
 * asks which *family* published a code is unchanged.
 */
export function syllabusSubjectOf(code: string): string | null {
  return SYLLABUSES.find((s) => s.pattern.test(code))?.subject ?? null;
}
```

Extend the stage prefixes. **English adds no exception to the null path** - `MAO-WM-01` is null because Working mathematically belongs to every stage at once, and every English outcome carries a stage:

```ts
const STAGE_BY_PREFIX: Record<string, Stage> = {
  MAE: 'ES1',
  MA1: 'S1',
  MA2: 'S2',
  MA3: 'S3',
  ENE: 'ES1',
  EN1: 'S1',
  EN2: 'S2',
  EN3: 'S3',
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/content/catalog.test.ts`
Expected: PASS, whole file.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
npm test
git add src/content/catalog.ts src/content/catalog.test.ts
git commit -m "Let the syllabus table hold four documents, not two"
```

---

### Task 2: Scope the three maths-shaped tests by subject

**Files:**
- Modify: `src/content/catalog.test.ts` (three tests)

**Interfaces:**
- Consumes: `syllabusSubjectOf` from Task 1.
- Produces: nothing new. This is a refactor that must stay green with maths content alone.

**Why:** Most of `catalog.test.ts` runs over `allTemplates` and asserts a property of a template, so English is covered on the day it lands - that is the file working as intended. Three tests are different: they run over `allTemplates` while asserting a *maths* fact, and English content would break them while being entirely correct.

Two of them close their exception lists with a set equality over every template in the app, and **that closure is the half doing the real work** - with "cites at least one syllabus" satisfied by either, a citation quietly dropped from any other template would otherwise pass green. So they must stay closed; they just have to be closed per subject.

- [ ] **Step 1: Scope the ACARA-alone set equality**

In `names every template that cites ACARA alone`, change the final computation from every template to maths templates only. Leave the id list and all its comments exactly as they are:

```ts
    const missingNsw = allTemplates
      .filter((t) => t.subject === 'maths')
      .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'nsw'))
      .map((t) => t.id);

    expect(missingNsw.sort()).toEqual([...acaraOnly].sort());
```

- [ ] **Step 2: Scope the NSW-alone set equality**

In `cites no ACARA description for the content ACARA places a year later than NSW`, same change to the trailing exhaustiveness check:

```ts
    const missingAcara = allTemplates
      .filter((t) => t.subject === 'maths')
      .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'acara'))
      .map((t) => t.id);

    expect(missingAcara.sort()).toEqual([...nswOnly].sort());
```

- [ ] **Step 3: Scope the spelling ban, and say why it is now subject-aware**

Replace `never asks a child in K to Year 3 to spell an answer` with:

```ts
  // Spelling a word on the letter pad is a literacy test, not a maths one. In
  // the early years the maths answer is tapped instead: a word a child of that
  // age cannot reliably spell would hide what they actually know about the
  // maths.
  //
  // **In English the reason inverts, which is why this is scoped by subject
  // rather than by year alone.** A Year 2 child asked for the plural of "box"
  // is being asked exactly what the syllabus asks of them, and four buttons
  // would test recognition where the outcome is production. English has its own
  // floor - Kindergarten - and its own cap, both below.
  it('never asks a child in K to Year 3 to spell a maths answer', () => {
    const early = allTemplates.filter(
      (t) => t.subject === 'maths' && ['K', '1', '2', '3'].includes(t.level),
    );

    for (const template of early) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-spelling-${i}`));
        expect(q.answerType, template.id).not.toBe('text');
      }
    }
  });
```

- [ ] **Step 4: Run the whole suite to verify it is still green**

Run: `npm test`
Expected: PASS, 951 tests. This task changes no behaviour - it narrows three assertions so English can land beside them.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/content/catalog.test.ts
git commit -m "Narrow the three tests that say maths but check everything"
```

---

### Task 3: Transcribe the NSW English outcome codes

**Files:**
- Create: `docs/superpowers/notes/nsw-english-outcome-codes.md`
- Modify: `src/content/catalog.test.ts` (add `ENGLISH_NSW_OUTCOMES` and a well-formedness test)

**Interfaces:**
- Consumes: `syllabusOf`, `nswStageOfCode` from Task 1.
- Produces: `ENGLISH_NSW_OUTCOMES: Record<Stage, readonly string[]>` in `catalog.test.ts`, used by Task 4's membership assertion.

**This is the only check in the repo that tests a citation for truth rather than shape, and it fails safe only against omissions.** A code sitting in this list *wrongly* - mistyped on the way in - stays green forever, because this list is where correctness is defined. The manual two-way diff is the entire guard.

**Transcribed rather than parsed out of the notes file**, for the reason `NSW_OUTCOMES` gives: a regex over prose that stops matching yields an *empty* list, and an empty membership list waves every code through. A green test is the one failure mode this net must not have.

- [ ] **Step 1: Source the codes, stage by stage**

These four stages were retrieved during design and are confirmed:

- **Early Stage 1 (11):** `ENE-OLC-01`, `ENE-VOCAB-01`, `ENE-PHOAW-01`, `ENE-PRINT-01`, `ENE-PHOKW-01`, `ENE-REFLU-01`, `ENE-RECOM-01`, `ENE-CWT-01`, `ENE-SPELL-01`, `ENE-HANDW-01`, `ENE-UARL-01`
- **Stage 1 (9):** `EN1-OLC-01`, `EN1-VOCAB-01`, `EN1-PHOKW-01`, `EN1-REFLU-01`, `EN1-RECOM-01`, `EN1-CWT-01`, `EN1-SPELL-01`, `EN1-HANDW-01`, `EN1-UARL-01`
- **Stage 2 (11):** `EN2-OLC-01`, `EN2-VOCAB-01`, `EN2-REFLU-01`, `EN2-RECOM-01`, `EN2-CWT-01`, `EN2-CWT-02`, `EN2-CWT-03`, `EN2-SPELL-01`, `EN2-HANDW-01`, `EN2-HANDW-02`, `EN2-UARL-01`
- **Stage 3 (partially confirmed):** `EN3-OLC-01`, `EN3-VOCAB-01`, `EN3-RECOM-01`, `EN3-CWT-01`, `EN3-SPELL-01`, `EN3-UARL-01`, `EN3-UARL-02` are confirmed. The focus areas NESA lists at Stage 3 are Oral language and communication, Vocabulary, Reading comprehension, Creating written texts, Spelling, Handwriting and digital transcription, and Understanding and responding to literature - note there is **no** reading-fluency outcome at Stage 3, unlike the three stages below it.

**Complete Stage 3 before writing the list.** The remaining candidates are the Creating-written-texts and Handwriting outcomes (`EN3-CWT-02`, `EN3-CWT-03`, `EN3-HANDW-01`, `EN3-HANDW-02`). Source them from NESA directly:

```
https://curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/outcomes
https://curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/content/stage-3
```

**If an authoritative Stage 3 list cannot be obtained, STOP and ask.** Do not infer a code from the pattern of the stage below it. A fabricated code satisfies every shape test in this repo, reports the right stage, and reaches a parent on `/curriculum` as an invitation to look up an outcome that does not exist. Only the four Stage 3 codes the content actually cites - `EN3-VOCAB-01`, `EN3-SPELL-01`, `EN3-UARL-01`, `EN3-CWT-01` - are needed for Tasks 10 and 11 to proceed, so an incomplete Stage 3 blocks this task and nothing else.

- [ ] **Step 2: Write the notes file**

Create `docs/superpowers/notes/nsw-english-outcome-codes.md` with a table per stage, each row a code and the **focus area name** it belongs to.

**Record the focus area, never the outcome statement.** "Phonological awareness" is a heading and a place in the syllabus; the sentence after it is Crown copyright. This file is a finding aid, not a copy.

State the per-stage counts explicitly at the top of the file, so the reconciliation in Step 4 has something to reconcile against. Note the two structural facts: Stage 1 has no phonological-awareness or print-concepts outcome (both fold into `EN1-PHOKW-01`), and Stage 3 has no reading-fluency outcome.

- [ ] **Step 3: Transcribe into the test file**

Add to `src/content/catalog.test.ts`, directly below `NSW_OUTCOMES`:

```ts
/**
 * Every NSW *English* outcome code a template may cite, by stage - the four
 * stage tables of `docs/superpowers/notes/nsw-english-outcome-codes.md`, and
 * nothing else. Beside `NSW_OUTCOMES` and for its reasons: it is the only check
 * in this file that tests a citation for truth rather than for shape, it is
 * transcribed rather than parsed because a regex that stops matching yields an
 * empty list and an empty membership list waves every code through, and it
 * fails safe against omissions and nothing else - a wrong entry here stays
 * green forever, so the manual two-way diff against the notes file is the whole
 * of the guard.
 *
 * Two structural facts that look like transcription errors and are not. Stage 1
 * has no phonological-awareness and no print-concepts outcome: both fold into
 * EN1-PHOKW-01, which is why Year 1 rhyme cites PHOKW where Kindergarten rhyme
 * cites PHOAW. And Stage 3 has no reading-fluency outcome, unlike the three
 * stages below it.
 */
const ENGLISH_NSW_OUTCOMES: Record<Stage, readonly string[]> = {
  ES1: [
    'ENE-OLC-01',
    'ENE-VOCAB-01',
    'ENE-PHOAW-01',
    'ENE-PRINT-01',
    'ENE-PHOKW-01',
    'ENE-REFLU-01',
    'ENE-RECOM-01',
    'ENE-CWT-01',
    'ENE-SPELL-01',
    'ENE-HANDW-01',
    'ENE-UARL-01',
  ],
  S1: [
    'EN1-OLC-01',
    'EN1-VOCAB-01',
    'EN1-PHOKW-01',
    'EN1-REFLU-01',
    'EN1-RECOM-01',
    'EN1-CWT-01',
    'EN1-SPELL-01',
    'EN1-HANDW-01',
    'EN1-UARL-01',
  ],
  S2: [
    'EN2-OLC-01',
    'EN2-VOCAB-01',
    'EN2-REFLU-01',
    'EN2-RECOM-01',
    'EN2-CWT-01',
    'EN2-CWT-02',
    'EN2-CWT-03',
    'EN2-SPELL-01',
    'EN2-HANDW-01',
    'EN2-HANDW-02',
    'EN2-UARL-01',
  ],
  S3: [
    // Completed in Step 1 from NESA. Do not infer these from Stage 2.
  ],
};
```

- [ ] **Step 4: Reconcile the transcription both ways**

Diff the code column of all four stage tables in the notes file against the four blocks above, **in both directions**, and reconcile the per-stage counts against the totals the notes file states for itself. Record in the task report how it was done, not merely that it was - this is the discipline `NSW_OUTCOMES` documents and the only guard this list has.

- [ ] **Step 5: Write a well-formedness test**

```ts
it('transcribes English outcome codes that are shaped like English outcomes', () => {
  for (const [stage, codes] of Object.entries(ENGLISH_NSW_OUTCOMES)) {
    expect(codes.length, `${stage} is empty`).toBeGreaterThan(0);
    for (const code of codes) {
      expect(syllabusOf(code), code).toBe('nsw');
      expect(syllabusSubjectOf(code), code).toBe('english');
      expect(nswStageOfCode(code), code).toBe(stage);
    }
  }
});
```

This catches a code transcribed into the wrong stage's block, which the two-way diff can miss because both lists would agree.

- [ ] **Step 6: Run and commit**

```bash
npx vitest run src/content/catalog.test.ts
npm run typecheck
git add docs/superpowers/notes/nsw-english-outcome-codes.md src/content/catalog.test.ts
git commit -m "Write down which English outcomes exist, so a typo cannot become a citation"
```

---

### Task 4: Scaffold the English subject and its rules

**Files:**
- Create: `src/content/english/helpers.ts`, `src/content/english/helpers.test.ts`, `src/content/english/index.ts`
- Modify: `src/content/catalog.ts` (import and spread), `src/content/catalog.test.ts` (English rules)

**Interfaces:**
- Consumes: `ENGLISH_NSW_OUTCOMES` (Task 3), `syllabusSubjectOf` (Task 1).
- Produces: `englishTemplates: QuestionTemplate[]` (empty for now); `wordFrom(bank: readonly string[], i: Expr): Expr` and `WordBank` in `helpers.ts`, used by every content task.

**The rules are written now, before any content, and they iterate over whatever English years exist.** That makes them vacuous today and correct as each year lands, so Task 5 opens with a genuine failing test rather than one bolted on afterwards.

- [ ] **Step 1: Write the helper's failing test**

Create `src/content/english/helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluate } from '@/lib/expr';
import { wordFrom } from './helpers';

const RHYMES_AT = ['cat', 'hat', 'mat', 'bat'] as const;

describe('wordFrom', () => {
  it('gives back the word at each index of the bank', () => {
    for (let i = 0; i < RHYMES_AT.length; i++) {
      expect(evaluate(wordFrom(RHYMES_AT, String(i)), {})).toBe(RHYMES_AT[i]);
    }
  });

  it('reads an index that is itself an expression', () => {
    expect(evaluate(wordFrom(RHYMES_AT, '1 + 2'), {})).toBe('bat');
  });

  it('falls through to the last word for an index it was not told about', () => {
    // The chain ends in an unguarded else, exactly as `solidWord` and
    // `columnLetter` do. Documented rather than fixed: a guard would need a
    // failure value the expression language has no way to represent, and the
    // caller's `pick` list is what keeps the index in range.
    expect(evaluate(wordFrom(RHYMES_AT, '99'), {})).toBe('bat');
  });

  it('escapes nothing, because a bank is plain lowercase words', () => {
    expect(() => wordFrom(['a b'], '0')).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/content/english/helpers.test.ts`
Expected: FAIL - cannot resolve `./helpers`.

- [ ] **Step 3: Write the helper**

Create `src/content/english/helpers.ts`:

```ts
import type { Expr } from '@/lib/templates/types';

/**
 * A closed list of words a template draws both its answer and its distractors
 * from. Named as a type because the same constant has to reach three places -
 * the `pick` that chooses the target, the `answer`, and the `distractors` - and
 * three literals written out three times is the shape `equalSectors` warns
 * about in the maths helpers.
 */
export type WordBank = readonly string[];

/**
 * The word at index `i` of `bank`, as an expression-language string.
 *
 * **The expression language has no arrays and nothing to index one with**,
 * which is why `maths/helpers.ts` holds `dayName`, `shapeName`, `solidWord` and
 * `columnLetter` - each a chain of ternaries turning an integer into a word.
 * English needs many more of them and they all have the same shape, so this
 * builds the chain instead of each bank writing its own.
 *
 * **The chain ends in an unguarded else**, so an index the bank does not have
 * comes back as the *last* word rather than failing - the same caveat
 * `solidWord` and `columnLetter` carry. That is safe only because the caller's
 * own `pick` list is what produces the index: name the bank once as a constant
 * and hand that same constant to the `pick` and to this.
 */
export function wordFrom(bank: WordBank, i: Expr): Expr {
  if (bank.length === 0) throw new Error('wordFrom: empty bank');
  for (const word of bank) {
    // A bank holds plain lowercase words. Anything else - a space, a quote, an
    // apostrophe - would either break the string literal this builds or produce
    // an answer the letter pad cannot type, so it is refused at authoring time
    // rather than discovered as a question a child cannot answer.
    if (!/^[a-z]+$/.test(word)) {
      throw new Error(`wordFrom: ${JSON.stringify(word)} is not a plain lowercase word`);
    }
  }

  return bank
    .slice(0, -1)
    .reduceRight(
      (rest, word, index) => `${i} == ${index} ? '${word}' : ${rest}`,
      `'${bank[bank.length - 1]}'`,
    );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/english/helpers.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Create the empty subject and wire it in**

Create `src/content/english/index.ts`:

```ts
import type { QuestionTemplate } from '@/lib/templates/types';

/**
 * English course, Kindergarten to Year 6.
 *
 * Written against two syllabuses like the maths course beside it: ACARA's
 * Australian Curriculum v9.0 English, and the NSW English K-10 Syllabus (2022).
 * An ACARA English code reads AC9 E <year> <strand> <number>, where the strands
 * are LA Language, LE Literature and LY Literacy - three, where maths has six.
 * An NSW English code reads EN <stage> - <focus area> - <number>. NSW outcome
 * statements are Crown copyright and are never reproduced here.
 *
 * Three rules every template here obeys, and the last is the one that is easy
 * to get wrong:
 *
 * - **No question is a picture.** Word and sentence level work needs no
 *   diagram, and the kind that might have been invented for it - a drawn object
 *   to name - fights the anchoring rule hardest of anything in the app: a drawn
 *   cat is one picture, so "cat" would be anchored to it by construction.
 * - **A child is never asked to type something the screen cannot express.** The
 *   letter pad has no space key and no apostrophe key, so every typed answer is
 *   one word of A-Z, and contractions and possessives are multiple choice -
 *   the same rule that makes the Year 6 integer questions choice because the
 *   number pad has no minus key. Kindergarten types nothing at all.
 * - **A template has one word bank, and every word in it is sometimes the
 *   answer and sometimes a distractor.** English is made of closed word lists,
 *   which is the exact shape `validateTemplate`'s closed-set check refuses -
 *   and refuses rightly, because a child can pick the odd one out without
 *   knowing what a rhyme is. Draw the *family* first, then the target from it,
 *   then the answer from the same family and the distractors from other
 *   families, so `hat` is the answer when the target is `cat` and a distractor
 *   when the target is `dog`.
 */
export const englishTemplates: QuestionTemplate[] = [];
```

In `src/content/catalog.ts`, add the import beside the maths one and spread it:

```ts
import { mathsTemplates } from './maths';
import { englishTemplates } from './english';

export const allTemplates: QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];
```

- [ ] **Step 6: Write the English rules**

Add a new describe block to `src/content/catalog.test.ts`:

```ts
describe('English content', () => {
  const englishTemplates = allTemplates.filter((t) => t.subject === 'english');
  const englishLevels = () =>
    listSubjects().find((s) => s.subject === 'english')?.levels ?? [];

  // A session draws at random from a year's pool, so a thin year means a child
  // sees the same question shapes over and over. The same floor maths is held
  // to, for the same reason.
  it('gives every English year enough templates for a varied session', () => {
    for (const level of englishLevels()) {
      expect(level.templateCount, `Year ${level.level}`).toBeGreaterThanOrEqual(20);
    }
  });

  // An English template cites English syllabuses. Every other citation test
  // checks shape, stage or existence; this one checks that the document is
  // about the subject, which is the mistake a copy-paste from the maths content
  // would make and nothing else would catch.
  it('cites only English syllabuses, and maths cites only maths ones', () => {
    for (const template of allTemplates) {
      for (const tag of template.tags ?? []) {
        expect(syllabusSubjectOf(tag), `${template.id} cites ${tag}`).toBe(template.subject);
      }
    }
  });

  it('cites no NSW English outcome the syllabus does not have', () => {
    const known = new Set(Object.values(ENGLISH_NSW_OUTCOMES).flat());

    for (const template of englishTemplates) {
      for (const tag of template.tags ?? []) {
        if (syllabusOf(tag) !== 'nsw') continue;
        expect(known.has(tag), `${template.id} cites ${tag}, which is not an NSW outcome`).toBe(
          true,
        );
      }
    }
  });

  // An Early Stage 1 child is still learning letter *shapes*, and a QWERTY pad
  // is not alphabetical. Asked to type "cat" they hunt three letters across
  // three rows, and what the question measures is pad navigation rather than
  // phonics. So the maths ban survives into English at exactly one year.
  it('never asks a Kindergartener to type a word', () => {
    for (const template of englishTemplates.filter((t) => t.level === 'K')) {
      for (let i = 0; i < 25; i++) {
        const q = generateQuestion(template, createRng(`${template.id}-k-typed-${i}`));
        expect(q.answerType, template.id).not.toBe('text');
      }
    }
  });

  // Typed answers are the easiest English questions to author and much the
  // slowest to answer - one touch against up to sixteen, on a pad with no word
  // completion. A year that drifted to mostly-typing would be a year where a
  // child gets through a third as many questions in a sitting, which starves
  // the selector of the observations `MIN_OBSERVATIONS` and
  // `SECURE_OBSERVATIONS` are counted in.
  //
  // Measured on the *generated* answerType and not the declared one, for the
  // reason `answerType` is inferred in the first place: a template that
  // declares nothing and whose answer evaluates to a string is a typed question
  // whatever its author thought, and a cap counting declarations would miss
  // exactly the templates nobody noticed were typed.
  it('keeps typed answers to a minority of every English year', () => {
    for (const level of englishLevels()) {
      const forLevel = englishTemplates.filter((t) => t.level === level.level);
      const typed = forLevel.filter(
        (t) => generateQuestion(t, createRng(`${t.id}-cap`)).answerType === 'text',
      );

      expect(
        typed.length / forLevel.length,
        `Year ${level.level}: ${typed.length} of ${forLevel.length} typed`,
      ).toBeLessThanOrEqual(0.4);
    }
  });
});
```

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: PASS. Every English rule is vacuous - there are no English templates yet - and `allTemplates` is unchanged in content.

- [ ] **Step 8: Commit**

```bash
npm run typecheck
git add src/content/english src/content/catalog.ts src/content/catalog.test.ts
git commit -m "Make room for English, and write its rules before its questions"
```

---

## The seven content tasks

Tasks 5 to 11 are one school year each and have an identical shape, so it is written down once here rather than seven times.

**Each task:**

1. Adds `src/content/english/<year>.ts` exporting `yearK` / `year1` / ... / `year6`.
2. Adds the import and the spread to `src/content/english/index.ts`.
3. Is driven by a failing test: `gives every English year enough templates for a varied session` fails for that year until 20 templates exist.
4. Ends with `npm test`, `npm run typecheck`, and a commit.

**The three question shapes, written out in full.** Every template in every year is one of these. They use the Year 1 rhyme topic as the worked example; substitute the year's own topic, bank and citations from the table at the top of this plan.

**Shape A - tapped, from a shared word bank.** This is the shape that gets the anchoring rule right, and most English templates are it.

It needs a two-dimensional bank - families of words - so write this local helper at the top of the file first, composing `wordFrom` over the families:

```ts
import type { Expr } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/** The word at `index` of family `family`, as an expression. */
const FAMILY_WORD = (family: Expr, index: Expr): Expr =>
  RHYME_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(RHYME_FAMILIES[RHYME_FAMILIES.length - 1], index)})`,
  );
```

Then the template:

```ts

// Four families, so a word from any of them can be a distractor for any other.
// Named once and handed to the `pick`, the answer and the distractors: three
// literals written out three times is how a bank and its index drift apart.
const RHYME_FAMILIES: readonly WordBank[] = [
  ['cat', 'hat', 'mat', 'bat'],
  ['dog', 'log', 'frog', 'jog'],
  ['sun', 'run', 'bun', 'fun'],
  ['pig', 'wig', 'dig', 'big'],
];

{
  id: 'english.1.rhyme.which-rhymes',
  subject: 'english',
  topic: 'rhyme',
  level: '1',
  prompt: 'Which word rhymes with {target}?',
  vars: [
    // The family comes first, so the target and the answer share one and the
    // distractors come from the others. This ordering is the whole trick.
    { name: 'f', kind: 'int', min: '0', max: '3' },
    { name: 't', kind: 'int', min: '0', max: '3' },
    { name: 'a', kind: 'int', min: '0', max: '3' },
    { name: 'd1', kind: 'int', min: '1', max: '3' },
    { name: 'd2', kind: 'int', min: '1', max: '3' },
    { name: 'target', kind: 'expr', expr: FAMILY_WORD('f', 't') },
    { name: 'answer', kind: 'expr', expr: FAMILY_WORD('f', 'a') },
  ],
  // The answer must not be the target itself, and the two distractors must come
  // from two different other families - otherwise two buttons could coincide.
  constraints: ['t != a', 'd1 != d2'],
  answer: 'answer',
  answerType: 'choice',
  choices: {
    count: 3,
    distractors: [
      FAMILY_WORD('(f + d1) % 4', 't'),
      FAMILY_WORD('(f + d2) % 4', 'a'),
    ],
  },
  hint: 'Say the words out loud. Rhyming words end with the same sound.',
  tags: ['AC9E1LE04', 'EN1-PHOKW-01'],
}
```

**Verified before any year was written.** This exact template was built and run
through `validateTemplate`: it passes all three anchoring checks with no errors,
and over 60 draws the answer values and the distractor values genuinely overlap
- `hat` turns up as both. The pattern works; what remains per year is choosing
the words.

**Why this passes the closed-set check:** across draws `hat` is the answer when `f` picks the `at` family and a distractor when `f` picks `og`. The answer values and the distractor values overlap, so there is no disjointness for the check to object to - and no child can learn that a particular button is the right one, which is the same fact stated as teaching rather than as validation.

**No "odd one out" question, ever. It is answerable from the buttons alone by
construction, and no bank can fix it.**

This was measured rather than reasoned: `english.K.rhyme.not-rhyme` ("Which word
does NOT rhyme with *cat*?") and `english.K.syllables.odd-clap-count` ("Which
word does NOT have 3 claps?") both scored **100% against a 33% blind baseline**
when a rule was learned from the option set alone. Both passed
`validateTemplate` cleanly.

The reason is structural. For "which does not rhyme with *cat*?" to have exactly
one answer, the two distractors must both rhyme with the target - which means
they rhyme with **each other**. So `{hat, mat, dog}` announces `dog` without the
prompt being read at all. Widening the bank changes nothing: any bank produces
two-that-match and one-that-does-not. Making the distractors *not* rhyme with
each other gives the question two correct answers instead.

The same holds for any "which is not", "which does not belong", or
"find the odd one" phrasing over a property the options themselves carry. Ask
the positive question instead - "which word rhymes with *cat*?" - where the
target in the prompt is what picks the answer out, and the same three buttons
can arise from several different answers.

**A negative question is only safe when the property is not visible in the
option set** - and in a word-list subject it almost always is.

**Shape B - typed, one word.** Years 1 to 6 only, and no more than 40% of a year:

```ts
{
  id: 'english.2.plurals.add-es',
  subject: 'english',
  topic: 'plurals',
  level: '2',
  prompt: 'Write the plural of {word}.',
  vars: [
    { name: 'i', kind: 'int', min: '0', max: '5' },
    { name: 'word', kind: 'expr', expr: wordFrom(HISS_WORDS, 'i') },
  ],
  // Every word in HISS_WORDS ends in a hissing sound, so every plural takes
  // -es. A bank mixing -s and -es words would need the rule as a second
  // expression, and the question is about the rule rather than about which
  // rule applies.
  answer: "word + 'es'",
  answerType: 'text',
  hint: 'Words ending in s, x, ch or sh add -es to become plural.',
  tags: ['AC9E2LY12', 'EN1-SPELL-01'],
}
```

`HISS_WORDS` is `['box', 'bus', 'fox', 'dish', 'branch', 'glass']` - all A-Z, all under 16 characters with the suffix on.

**Shape C - true or false.** Cheap, tapped, and exempt from every choice check because there are no `choices`:

```ts
{
  id: 'english.K.sentences.starts-with-capital',
  subject: 'english',
  topic: 'sentences',
  level: 'K',
  prompt: 'Does this sentence start correctly? {sentence}',
  vars: [
    { name: 'i', kind: 'int', min: '0', max: '5' },
    { name: 'ok', kind: 'pick', from: [0, 1] },
    { name: 'sentence', kind: 'expr', expr: SENTENCE('i', 'ok') },
  ],
  answer: 'ok == 1',
  hint: 'A sentence always starts with a capital letter.',
  tags: ['AC9EFLA09', 'ENE-CWT-01'],
}
```

**Two things a boolean template must get right.** `validateTemplate` rejects `choices` alongside a boolean answer - the play screen draws its own two buttons - so never give one both. And the true and false cases must be **equally likely**, which is what `ok` being a `pick` over two values buys: a template whose claim is true four times in five teaches "say true", which is the anchoring rule wearing different clothes.

**Per-year topic, citation and count tables follow in each task.** Distribute the 22 across the year's topics roughly evenly, 3 to 5 a topic.

---

## Self-check before you report — learned from Kindergarten

Kindergarten shipped 22 templates and needed a fix round for six findings. All six
were invisible to `npm test`, which was green throughout. Run this list against
your own year before reporting.

**1. Measure every `choice` template, keyed on the OPTIONS ALONE.**
Draw 600, learn the modal answer per option-set on the first 300, score it on the
last 300 against the mean of `1 / choices.length`. Flag anything more than 15
points above blind. Write it as a temporary test, run it, then delete it — the
permanent version is Task 13's deliverable.

Key on the options and **not** on the prompt. Including the prompt makes the key
unique per question, so the learned rule just memorises each answer and scores
100% on anything well-posed — which measures nothing. Measured both ways on
Kindergarten: prompt-plus-options flagged all 17 choice templates, options-alone
flagged 3.

**2. No odd-one-out questions.** See the rule above. Both of Kindergarten's
scored 100%.

**3. Does every frame admit exactly one word from its own bank?**
Kindergarten shipped `'At night we ?.'` with `sleep` as the answer and `nap` in
the same bank — reachable as a distractor in about a fifth of draws. A child
answering `nap` is right and is marked wrong. Check **every frame against every
other word in its bank by hand**; the automated checks cannot see this, and a
measurement will not catch it either because the template is not leaking, it is
simply wrong.

**4. Are two of your templates the same question in different words?**
The test is mechanical, not aesthetic: if two templates have the same `vars`, the
same `constraints`, the same `distractors` and the same `answer` expression, they
are one question rendered twice however differently the prompt reads.

**The mechanical test has a loophole Year 1 fell through: two templates can be
*logical duals* and still pass it.** `is-doing-word` (`i >= 10`) beside
`is-naming-word` (`i < 10`) over one bank have different answer expressions, so
the letter of the test clears them — but every word in that bank is exclusively
a noun or exclusively a verb, so a child who answers one correctly answers the
other by pure negation, exercising no new judgment. Ask whether the second
question can be *derived* from the first, not just whether the code differs.

**Not every reversal is a dual.** A *bijective same-fact reversal* is fine and
already shipped: `which-is-plural`/`which-is-singular` asks the same 1:1 mapping
from both ends, and knowing one direction does not hand you the other without
doing the work. What Year 1 got wrong was a *negation-derivable exclusive-category
dual* - `is-doing-word` beside `is-naming-word` over a bank where every word is
exclusively one or the other, so the second answer is the first one negated. Ask
which of the two you have.


The maths
content's apparent near-duplicates are not a precedent for this — `counting-numbers`'
four variants each compute a **different answer expression**. Prefer fewer,
genuinely distinct templates over hitting a per-topic count.

**A template that differs only in how many buttons it shows is not a distinct
template.** This has now appeared twice: Kindergarten's `rhyme.pick-of-two` had
a byte-identical prompt to `rhyme.which-rhymes` and Year 4's
`synonyms.two-choices` had one to `synonyms.which-synonym`, each differing only
in offering two options instead of three. Both clear the mechanical test,
because having one fewer distractor variable makes the `constraints` differ
trivially. A child meets the same sentence twice. Adding a worked pair or a
sentence context *is* a distinct angle; changing the option count is not.


**5. Can a boolean question be answered from a surface cue?**
Kindergarten's `is-a-sentence` drew its fragments lowercase and unpunctuated,
while two templates beside it in the same topic taught "look for a capital and a
full stop" — so it could be answered without ever judging the thing it tested.
Make the true and false cases differ **only** in the property being asked about.

**6. Sequence questions have honest end effects.** "Which letter comes after
`{x}`?" cannot offer the first letter as an answer or the last as a target. That
asymmetry is structural rather than a bank built wrong, and is acceptable — but
know which of the two you have.

---

### Task 5: Kindergarten

**Files:**
- Create: `src/content/english/k.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `yearK: QuestionTemplate[]`.

**Kindergarten is entirely tapped** - Shapes A and C only, plus `number` answers for syllable counting. No Shape B at all.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| letters and sounds | 5 | `AC9EFLY10`, `AC9EFLY13` | `ENE-PHOKW-01` | A |
| rhyme | 4 | `AC9EFLY09` | `ENE-PHOAW-01` | A |
| syllables | 4 | `AC9EFLY09` | `ENE-PHOAW-01` | number, A |
| opposites | 4 | `AC9EFLA08` | `ENE-VOCAB-01` | A |
| sentences | 5 | `AC9EFLA09` | `ENE-CWT-01` | C, A |

**Syllable counting is a `number` answer**, which is how Kindergarten gets a question that is typed without being spelled: the child counts claps and taps a digit. `answerType` is inferred from the answer evaluating to a number, so declare nothing.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: PASS vacuously - there are no English years yet. This is the one year where the test cannot fail first, so write one template, wire it up, and re-run: it then fails with `Year K: 1 is not >= 20`, which is the real red.

- [ ] **Step 2: Write the year**

Create `src/content/english/k.ts` with a file comment naming the year and its two syllabuses, the word banks as named constants, and the 22 templates per the table.

Every word bank must be usable in both roles. For **opposites**, that means the bank is *pairs* and either member can be the target: `hot/cold`, `big/small`, `up/down`, `fast/slow`, `day/night`, `wet/dry` - so `cold` is the answer when the target is `hot` and a distractor when the target is `big`.

For **letters and sounds**, the target is a word and the options are single letters, drawn from one alphabet bank so every letter is answer and distractor across draws.

- [ ] **Step 3: Wire it into the index**

```ts
import { yearK } from './k';

export const englishTemplates: QuestionTemplate[] = [...yearK];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS. Watch specifically for `every template is valid` - a closed-set failure here means a bank is not shared, and the fix is the bank rather than a `propertyIsTheQuestion` declaration.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/k.ts src/content/english/index.ts
git commit -m "Teach Kindergarten its letters, without asking it to spell"
```

---

### Task 6: Year 1

**Files:**
- Create: `src/content/english/1.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year1: QuestionTemplate[]`.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| letters and sounds | 4 | `AC9E1LY11`, `AC9E1LY12` | `EN1-PHOKW-01` | A |
| rhyme | 4 | `AC9E1LE04` | `EN1-PHOKW-01` | A |
| plurals | 4 | `AC9E1LY15` | `EN1-SPELL-01` | B, A |
| opposites | 3 | `AC9E1LA09` | `EN1-VOCAB-01` | A |
| word classes | 4 | `AC9E1LA07` | `EN1-CWT-01` | A, C |
| sentences | 3 | `AC9E1LA10` | `EN1-CWT-01` | C, A |

**Year 1 is where typing starts**, and at most 8 of the 22 may be typed. Plurals is the natural home for it - a plain `-s` plural on a one-syllable noun is 4 or 5 letters.

**Year 1 rhyme cites `EN1-PHOKW-01`, not a phonological-awareness outcome.** Stage 1 has none; it folds into phonics and word knowledge. That is not a citation getting lazy, it is what the syllabus does.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL once `1.ts` is wired in with fewer than 20 - `Year 1: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/1.ts` per the table. Word classes at this level is naming: "Is *jump* a doing word?" (Shape C) and "Which word is a naming word?" (Shape A, bank of nouns and verbs mixed so every word appears in both roles across draws).

- [ ] **Step 3: Wire it into the index**

```ts
import { year1 } from './1';

export const englishTemplates: QuestionTemplate[] = [...yearK, ...year1];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, including `keeps typed answers to a minority of every English year`.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/1.ts src/content/english/index.ts
git commit -m "Let Year 1 type a word, now that it can spell one"
```

---

### Task 7: Year 2

**Files:**
- Create: `src/content/english/2.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year2: QuestionTemplate[]`.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| plurals | 4 | `AC9E2LY12` | `EN1-SPELL-01` | B, A |
| past tense | 4 | `AC9E2LY12` | `EN1-SPELL-01` | B, A |
| compound words | 4 | `AC9E2LY11` | `EN1-SPELL-01` | B, A |
| word classes | 4 | `AC9E2LA07` | `EN1-CWT-01` | A, C |
| punctuation | 3 | `AC9E2LY06` | `EN1-CWT-01` | A, C |
| synonyms | 3 | `AC9E2LA09` | `EN1-VOCAB-01` | A |

**Compound words are the best typed question in the year**: "What word do you get from *cup* and *cake*?" answers `cupcake`, 7 letters, one word, no apostrophe.

**Punctuation here must avoid apostrophes as answers.** "Which mark ends a question?" is a choice between `.`, `?` and `!` - and those are not letters, so it can never be typed. Keep the option set shared: every mark is the answer for some prompt and a distractor for others.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL - `Year 2: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/2.ts` per the table. Past tense uses a bank of regular verbs whose `-ed` form is spelled without doubling (`jump`, `walk`, `play`, `look`, `call`, `wash`) - doubling is Year 3's content and mixing it in makes the question about which rule applies rather than about the rule.

- [ ] **Step 3: Wire it into the index**

```ts
import { year2 } from './2';

export const englishTemplates: QuestionTemplate[] = [...yearK, ...year1, ...year2];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/2.ts src/content/english/index.ts
git commit -m "Give Year 2 the endings that change a word"
```

---

### Task 8: Year 3

**Files:**
- Create: `src/content/english/3.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year3: QuestionTemplate[]`.

**Year 3 is Stage 2**, so every NSW citation is `EN2-`. A `EN1-` code here fails the stage check, and it is the characteristic mistake: Stage 2 is Years 3 and 4, not Year 2.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| prefixes and suffixes | 5 | `AC9E3LY10` | `EN2-SPELL-01` | B, A |
| homophones | 4 | `AC9E3LY12` | `EN2-SPELL-01` | A |
| word classes | 5 | `AC9E3LA07`, `AC9E3LA08` | `EN2-CWT-01` | A, C |
| punctuation | 4 | `AC9E3LA11` | `EN2-CWT-01` | A |
| spelling patterns | 4 | `AC9E3LY11` | `EN2-SPELL-01` | B, A |

**Every contraction and possessive question in this year is Shape A.** `can't` and `dog's` contain an apostrophe, and the letter pad has no apostrophe key - so they are tapped, always, for the reason the Year 6 integer questions are tapped.

**Homophones are naturally Shape A and naturally leaky.** "Which word completes: I went ___ the shop?" with options `to`, `too`, `two` is a *fixed* option set, so the prediction check fires the moment each set always carries the same answer. The fix is to vary the sentence so the same three buttons arise from three different answers - which is exactly what a homophone question should do anyway.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL - `Year 3: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/3.ts` per the table.

- [ ] **Step 3: Wire it into the index**

```ts
import { year3 } from './3';

export const englishTemplates: QuestionTemplate[] = [
  ...yearK, ...year1, ...year2, ...year3,
];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS. If a homophone template fails the prediction check, widen the sentence bank rather than declaring a flag.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/3.ts src/content/english/index.ts
git commit -m "Start Year 3 on the parts a word is built from"
```

---

### Task 9: Year 4

**Files:**
- Create: `src/content/english/4.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year4: QuestionTemplate[]`.

**Year 4 is Stage 2**, so NSW citations are `EN2-`, the same codes Year 3 carries. One Stage 2 code honestly sitting on both a Year 3 and a Year 4 template is the syllabus working as written, not a duplicate.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| prefixes and suffixes | 5 | `AC9E4LY10` | `EN2-SPELL-01` | B, A |
| homophones | 4 | `AC9E4LY11` | `EN2-SPELL-01` | A |
| word classes | 5 | `AC9E4LA08`, `AC9E4LA09` | `EN2-CWT-01` | A, C |
| plurals | 4 | `AC9E4LY10` | `EN2-SPELL-01` | B, A |
| synonyms | 4 | `AC9E4LA11` | `EN2-VOCAB-01` | A |

Year 4 plurals are the irregular ones - `mouse`/`mice`, `goose`/`geese`, `child`/`children`, `foot`/`feet`, `tooth`/`teeth`, `person`/`people`. All are single A-Z words under 16 characters, so they can be typed.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL - `Year 4: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/4.ts` per the table.

- [ ] **Step 3: Wire it into the index**

```ts
import { year4 } from './4';

export const englishTemplates: QuestionTemplate[] = [
  ...yearK, ...year1, ...year2, ...year3, ...year4,
];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/4.ts src/content/english/index.ts
git commit -m "Ask Year 4 for the plurals that break the rule"
```

---

### Task 10: Year 5

**Files:**
- Create: `src/content/english/5.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year5: QuestionTemplate[]`.

**Year 5 is Stage 3**, so NSW citations are `EN3-`.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| word roots | 5 | `AC9E5LY09` | `EN3-SPELL-01` | A, B |
| prefixes and suffixes | 4 | `AC9E5LY10` | `EN3-SPELL-01` | B, A |
| homophones | 4 | `AC9E5LY08` | `EN3-SPELL-01` | A |
| figurative language | 5 | `AC9E5LE04` | `EN3-UARL-01` | A |
| spelling patterns | 4 | `AC9E5LY08` | `EN3-SPELL-01` | B, A |

**Figurative language is the one topic whose option set is genuinely fixed** - `simile`, `metaphor`, `personification` are the three answers and the three distractors. That is fine and passes both checks on the merits: the answer values and the distractor values are the *same* set, so there is no disjointness, and as long as each set of buttons arises from several different answers the prediction check is satisfied too. It needs a wide bank of example sentences, not a flag.

Keep each example inside 140 characters with the prompt around it: `Which one is this? The wind whispered through the trees.` is 55.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL - `Year 5: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/5.ts` per the table.

- [ ] **Step 3: Wire it into the index**

```ts
import { year5 } from './5';

export const englishTemplates: QuestionTemplate[] = [
  ...yearK, ...year1, ...year2, ...year3, ...year4, ...year5,
];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/5.ts src/content/english/index.ts
git commit -m "Show Year 5 what a sentence is doing when it does not mean it"
```

---

### Task 11: Year 6

**Files:**
- Create: `src/content/english/6.ts`
- Modify: `src/content/english/index.ts`

**Interfaces:**
- Consumes: `wordFrom`, `WordBank` (Task 4).
- Produces: `year6: QuestionTemplate[]`.

**Year 6 is Stage 3**, so NSW citations are `EN3-`, the same codes Year 5 carries.

| Topic | Templates | ACARA | NSW | Shapes |
| --- | --- | --- | --- | --- |
| word roots | 5 | `AC9E6LY09` | `EN3-SPELL-01` | A, B |
| word classes | 4 | `AC9E6LA06` | `EN3-CWT-01` | A, C |
| figurative language | 5 | `AC9E6LA08` | `EN3-UARL-01` | A |
| punctuation | 4 | `AC9E6LA09` | `EN3-CWT-01` | A |
| spelling patterns | 4 | `AC9E6LY08` | `EN3-SPELL-01` | B, A |

Year 6 word roots are the Latin and Greek ones ACARA names: `port` carry, `graph` write, `aqua` water, `tele` far, `scrib` write, `dict` say. "Which word means *water*?" over a bank where every root appears as answer and distractor.

Year 6 figurative language adds idiom and hyperbole to Year 5's three, which widens the option set and makes the prediction check easier rather than harder.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run src/content/catalog.test.ts -t 'gives every English year'`
Expected: FAIL - `Year 6: n is not >= 20`.

- [ ] **Step 2: Write the year**

Create `src/content/english/6.ts` per the table.

- [ ] **Step 3: Wire it into the index**

```ts
import { year6 } from './6';

export const englishTemplates: QuestionTemplate[] = [
  ...yearK, ...year1, ...year2, ...year3, ...year4, ...year5, ...year6,
];
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS. Every English year now clears 20, and the whole subject is in `allTemplates`.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/content/english/6.ts src/content/english/index.ts
git commit -m "Finish with the roots English borrowed from somewhere else"
```

---

### Task 12: Record the divergences

**Files:**
- Modify: `src/content/catalog.ts` (`DIVERGENCE_NOTES`), `src/content/catalog.test.ts` (English set equalities)

**Interfaces:**
- Consumes: all seven content tasks.
- Produces: nothing new; closes the citation story.

**Only doable once all the content exists**, because the divergences are *derived* from the citations rather than predicted. `syllabusDivergences(subject)` is already subject-scoped and needs no change.

- [ ] **Step 1: Find out what actually diverged**

Write Step 3's set-equality test first, with **both lists empty**, and run it:

```bash
npx vitest run src/content/catalog.test.ts -t 'cites one syllabus alone'
```

The failure diff names every English template citing one syllabus alone - which is exactly the list Steps 2 and 3 need, obtained by the route that already works rather than by a side query. (`tsx` is not a dependency here and the `@/` alias lives only in the vitest config, so a standalone script cannot resolve this repo's imports.)

If the test **passes** with both lists empty, every English template cites both syllabuses, there are no divergences, and Steps 2 and 3 are a no-op - say so in the task report and go to Step 4. That is a real possibility: the citation table at the top of this plan pairs every topic with both an ACARA code and an NSW one.

- [ ] **Step 2: Write a note for each divergence**

For every entry the command printed, add a `DivergenceNote` to `DIVERGENCE_NOTES` in `src/content/catalog.ts`, keyed by `cites`, `level` and `topic`.

**Say where the syllabus places something; never say what it says.** "NSW places systematic phonics at Early Stage 1, where ACARA's first description of it is at Year 1" is a statement about placement and is fine. A sentence describing what the outcome asks a child to do is a reproduction of Crown copyright and is not.

- [ ] **Step 3: Close the English exception lists from both ends**

Add to the `English content` describe block:

```ts
// The same shape the maths exceptions take, and closed the same way. Asserting
// only that a named template lacks a code catches an addition and misses a
// subtraction: with "cites at least one syllabus" satisfied by either, a
// citation quietly dropped from any *other* English template would pass green.
// So the complete set is asserted, and every member of it names a decision.
it('names every English template that cites one syllabus alone', () => {
  const acaraOnly: string[] = [
    // Fill from Step 1. Each id gets a comment naming the divergence.
  ];
  const nswOnly: string[] = [
    // Likewise.
  ];

  const missingNsw = englishTemplates
    .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'nsw'))
    .map((t) => t.id);
  const missingAcara = englishTemplates
    .filter((t) => !t.tags?.some((tag) => syllabusOf(tag) === 'acara'))
    .map((t) => t.id);

  expect(missingNsw.sort()).toEqual([...acaraOnly].sort());
  expect(missingAcara.sort()).toEqual([...nswOnly].sort());
});
```

- [ ] **Step 3b: Enforce the typed-answer floor**

Add beside the existing 40% cap in the `English content` block:

```ts
  // A floor as well as a ceiling, and the spread is the half that matters.
  // The reinforcement selector weights *topics*, so a year whose typed
  // exposure all sits in one topic lets a child who is secure in that topic
  // go a whole year without typing anything - which makes "this is where
  // typing starts" false in practice for exactly the children doing best.
  // Kindergarten is exempt: an Early Stage 1 child hunting letters on a
  // QWERTY pad is being tested on pad navigation rather than on English.
  it('gives every English year past Kindergarten some typing, in more than one topic', () => {
    for (const level of englishLevels()) {
      if (level.level === 'K') continue;
      const forLevel = englishTemplates.filter((t) => t.level === level.level);
      const typed = forLevel.filter(
        (t) => generateQuestion(t, createRng(`${t.id}-floor`)).answerType === 'text',
      );
      const topics = new Set(typed.map((t) => t.topic));

      expect(
        typed.length / forLevel.length,
        `Year ${level.level}: ${typed.length} of ${forLevel.length} typed`,
      ).toBeGreaterThanOrEqual(0.15);
      expect(topics.size, `Year ${level.level} types in only: ${[...topics].join(', ')}`)
        .toBeGreaterThanOrEqual(2);
    }
  });
```

- [ ] **Step 4: Check every divergence has a note**

The existing `explains every divergence the shipped content produces` and `records no note that has outlived its divergence` tests run over maths only. Add the English pair beside them, or generalise both to loop over `listSubjects()`. Prefer generalising - a third subject then needs no edit.

- [ ] **Step 5: Run and commit**

```bash
npm test
npm run typecheck
git add src/content/catalog.ts src/content/catalog.test.ts
git commit -m "Say where the two syllabuses disagree about English, if they do"
```

---

### Task 13: Measure the option-set leaks

**Files:**
- Create: `src/content/english/leaks.test.ts`

**Interfaces:**
- Consumes: every English content task.
- Produces: an enforced check, and whatever template fixes it forces.

**A test rather than a script**, for two reasons. `tsx` is not a dependency of this repo and the `@/` alias is configured only in `vitest.config.mts`, so a standalone `.ts` script cannot resolve these imports at all. And the RNG is seeded, so the measurement is deterministic - which means it can be an enforced check on every run rather than something somebody has to remember to do. That is strictly stronger than a script, and it keeps the point intact: the measurement is a *new* check, because the existing three cannot see this.

**A green suite says little about a new `choice` template.** Eight option-set leaks were found during the figures work by measuring, at rates up to 100%, and not one could have been found by the checks that existed then. The prediction check only speaks where an option set repeats, and a leak that narrows the answer to two buttons of four passes it cleanly. English is a word-bank subject, which is exactly where a set is most likely to repeat.

- [ ] **Step 1: Write the test**

Create `src/content/english/leaks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allTemplates } from '../catalog';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';

/**
 * How often a `choice` question can be answered from its buttons alone.
 *
 * For each template: draw many questions, key each by its prompt and sorted
 * option set, learn the modal answer for each key on a training sample, then
 * score that rule on a held-out sample. Compare against the blind baseline -
 * the mean of 1/n over the options actually offered - and fail anything
 * meaningfully above it.
 *
 * **This is a fourth check, not a restatement of the three in
 * `validateTemplate`.** Those refuse a fixed answer rank, a closed set the
 * distractors never draw from, and an option set that predicts its answer -
 * and the third only speaks where a set repeats, so a leak that narrows the
 * answer to two buttons of four passes all three cleanly. Eight such leaks
 * were found by measuring during the figures work, at rates up to 100%, and
 * not one could have been found by the checks that existed then.
 *
 * **Held out rather than scored in-sample**, because a rule learned and tested
 * on the same draws reports the sample's own noise as signal - which, for a
 * template whose option sets rarely repeat, would be most of what it found.
 *
 * **The key is the option set and NOT the prompt, which is where this differs
 * from the figures work it is modelled on.** There the prompt is a constant
 * caption ("What shape is this?") and the *figure* carries the question, so
 * keying on prompt-plus-options asks "do the buttons give away what the
 * picture should be telling you". Here the prompt carries the question, so
 * including it makes the key unique per question and the modal rule degenerates
 * into memorising the answer to each one - which scores 100% on any
 * well-posed question and measures nothing. Measured both ways on the
 * Kindergarten content: prompt-plus-options flagged all 17 choice templates at
 * 100%, options-alone flagged 3. The rule is to key on everything the child can
 * see *except* the thing that is supposed to determine the answer.
 *
 * A template whose sets almost never repeat scores nothing here and is
 * reported as *unmeasurable* rather than as clean: no evidence is not evidence
 * of no leak, and saying so is the honest reading.
 */
const DRAWS = 600;
const TRAIN = 300;

/**
 * How far above blind guessing counts as a leak.
 *
 * Not zero: a held-out sample of a few hundred draws carries real sampling
 * noise, and a template whose answer is genuinely uniform over its options
 * still lands a few points either side of its baseline. 15 points is
 * comfortably outside that band and far below what an actual leak produces -
 * the figures work measured leaks at 60% to 100% against baselines of 25% to
 * 33%.
 */
const MARGIN = 0.15;

interface Row {
  id: string;
  scored: number;
  hit: number;
  baseline: number;
}

function measure(): { rows: Row[]; unmeasurable: string[] } {
  const rows: Row[] = [];
  const unmeasurable: string[] = [];

  for (const template of allTemplates) {
    if (template.subject !== 'english') continue;

    const draws = Array.from({ length: DRAWS }, (_, i) =>
      generateQuestion(template, createRng(`${template.id}-leak-${i}`)),
    ).filter((q) => q.choices && q.choices.length > 0);

    if (draws.length === 0) continue;

    // Keyed on the OPTIONS ALONE, deliberately - see the note above.
    const key = (q: (typeof draws)[number]) =>
      [...q.choices!].map(String).sort().join(' ');

    const counts = new Map<string, Map<string, number>>();
    for (const q of draws.slice(0, TRAIN)) {
      const byAnswer = counts.get(key(q)) ?? new Map<string, number>();
      const a = String(q.answer);
      byAnswer.set(a, (byAnswer.get(a) ?? 0) + 1);
      counts.set(key(q), byAnswer);
    }

    const modal = new Map<string, string>();
    for (const [k, byAnswer] of counts) {
      modal.set(k, [...byAnswer.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }

    let scored = 0;
    let hit = 0;
    let blind = 0;
    for (const q of draws.slice(TRAIN)) {
      const guess = modal.get(key(q));
      if (guess === undefined) continue;
      scored++;
      blind += 1 / q.choices!.length;
      if (guess === String(q.answer)) hit++;
    }

    // Too few held-out draws shared a key with the training half for any rate
    // computed from them to mean anything.
    if (scored < 30) {
      unmeasurable.push(template.id);
      continue;
    }

    rows.push({ id: template.id, scored, hit, baseline: blind / scored });
  }

  return { rows, unmeasurable };
}

describe('English multiple-choice questions', () => {
  it('cannot be answered from the buttons alone', () => {
    const { rows } = measure();

    const leaks = rows
      .filter((r) => r.hit / r.scored > r.baseline + MARGIN)
      .sort((a, b) => b.hit / b.scored - a.hit / a.scored)
      .map(
        (r) =>
          `${r.id}: ${((r.hit / r.scored) * 100).toFixed(0)}% from the options alone ` +
          `(blind ${(r.baseline * 100).toFixed(0)}%, n=${r.scored})`,
      );

    expect(leaks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/content/english/leaks.test.ts`
Expected: PASS, or a failure naming each leaking template with its measured rate and its blind baseline.

While developing, also print the `unmeasurable` list once (a temporary `console.log`, removed before committing) and **record it in the task report**. Those templates are not verified clean - their option sets almost never repeat, so the method has nothing to measure - and reporting them as unmeasurable rather than silently passing them is the whole point of the distinction.

- [ ] **Step 3: Fix every leak**

For anything flagged, **widen what varies** - a bigger word bank, more sentence frames, distractors drawn from more families. Do **not** reach for `rankIsTheQuestion` or `propertyIsTheQuestion`: neither is expected anywhere in English content, and a template that seems to need one has a bank built wrong. If you believe a declaration is genuinely right, stop and put the argument in the task report for review rather than declaring it.

A template whose sets almost never repeat will report `n` close to zero and a meaningless rate - that is the honest "no evidence" answer, not a pass. Note it as unmeasurable rather than as clean.

- [ ] **Step 4: Re-run until clean, then commit**

```bash
npm test
npm run typecheck
git add src/content/english
git commit -m "Measure whether the buttons give the answer away, because the suite cannot"
```

---

### Task 14: Render the curriculum page per subject

**Files:**
- Modify: `src/app/curriculum/page.tsx`

**Interfaces:**
- Consumes: `syllabusSubjectOf` (Task 1), `listSubjects`, `curriculumCodes`, `syllabusDivergences`.
- Produces: nothing consumed downstream.

The page opens `curriculumCodes('maths')` and `syllabusDivergences('maths')` and writes "The maths questions in LearnR" in its first sentence. It becomes a section per subject, so a third subject needs no edit here.

- [ ] **Step 1: Loop over subjects**

Replace the two hardcoded calls with a loop over `listSubjects()`, rendering a section per subject: a heading naming the subject, then that subject's two syllabus panels and its `curriculumCodes` / `syllabusDivergences` output.

Use each `SYLLABUSES` entry's own `name` and `url` rather than the constants the page currently inlines - that is what the `subject` field added in Task 1 is for, and it is what keeps the English section from linking a parent to the maths document.

- [ ] **Step 2: Reword the opening paragraph**

"The maths questions in LearnR are cross-referenced to two syllabuses" becomes a sentence about the app's questions generally. **Keep the copyright asymmetry exactly as it is** - ACARA quoted, NESA cited and never reproduced. It is per family, not per subject, so it now governs twice as many codes and none of its wording changes.

- [ ] **Step 3: Check it renders**

Run: `npm run dev`, open `http://localhost:3000/curriculum`.
Expected: a maths section and an English section, each with its own two documents, its own codes by year, and its own divergences. No em dash column where a citation should be.

- [ ] **Step 4: Run and commit**

```bash
npm test
npm run typecheck
git add src/app/curriculum/page.tsx
git commit -m "Let the curriculum page speak for both subjects"
```

---

### Task 15: Give English a colour and a glyph

**Files:**
- Modify: `src/components/subject-cards.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Optional polish, and deliberately last.** `SUBJECT_ACCENT` maps maths to accent 0 and `accentFor` already cycles for anything unlisted, so English has a colour without being named; `SubjectGlyph` already falls back to a subject's first letter, which the comment there calls "at least stable and never a wrong picture". Everything works before this task.

- [ ] **Step 1: Pin the accent**

```ts
const SUBJECT_ACCENT: Record<string, number> = { maths: 0, english: 1 };
```

Accent 1 is leaf green, so the two subjects are told apart by colour before they are read - which is what that table's comment says it is for.

- [ ] **Step 2: Give English a picture**

`SubjectGlyph` currently early-returns the first letter for anything that is not maths. Make it a switch on the subject with the letter as the fallback, and draw English as a serif **Aa** - the pair a child meets on an alphabet chart, and one that says "letters" the way `+ - x /` says "numbers":

```tsx
function SubjectGlyph({ subject }: { subject: string }) {
  if (subject === 'maths') {
    return (
      <span className="grid grid-cols-2 gap-x-1 text-2xl leading-none font-bold">
        <span>+</span>
        <span>&minus;</span>
        <span>&times;</span>
        <span>&divide;</span>
      </span>
    );
  }
  if (subject === 'english') {
    return <span className="font-serif text-3xl leading-none font-bold">Aa</span>;
  }
  return <span className="text-3xl font-bold uppercase">{subject.slice(0, 1)}</span>;
}
```

- [ ] **Step 3: Look at it**

Run: `npm run dev`, open `http://localhost:3000` and switch levels.
Expected: two cards per level, different colours, English showing **Aa**.

- [ ] **Step 4: Run and commit**

```bash
npm test
npm run typecheck
git add src/components/subject-cards.tsx
git commit -m "Tell the two subjects apart before either is read"
```

---

## Done when

- `npm test` and `npm run typecheck` pass.
- Every English year has at least 20 templates; about 155 in total.
- Every English template cites an ACARA English description and, where the syllabus has one, an NSW English outcome from its own stage.
- The leak measurement in `src/content/english/leaks.test.ts` flags nothing, and its unmeasurable list is recorded.
- `/curriculum` shows both subjects with their own documents.
- The home screen offers two subjects at every level from K to 6.
