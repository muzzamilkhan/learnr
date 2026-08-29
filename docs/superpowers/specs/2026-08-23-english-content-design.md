# English content, Kindergarten to Year 6

**Date:** 2026-08-23
**Status:** shipped. 155 English templates under `src/content/english/`, with
`leaks.test.ts` beside them - the measured check this design argued for, which
found leaks the structural checks could not. The NSW Stage 3 transcription gap
this design named as a stop-and-ask is **closed** (`learnr#11`, 2026-08-29):
`ENGLISH_NSW_OUTCOMES.S3` holds nine codes, and half the gap turned out not to
be one - see *One open item* below.

## What this is

A second subject. LearnR ships 350 maths templates across K-6 and the word
"subject" has been a string on a template since the beginning, waiting for one.
This adds English: roughly 155 templates, about 22 a year, written against the
same two syllabuses maths is written against and validated by the same checks.

**The claim this design is making is that English is content and not an engine
change.** That claim is the reason to write it down: if it holds, the
`QuestionSpec`/`QuestionTemplate` split, the answer-type rules and the anchoring
checks were all in the right place, and the evidence is that a subject with
nothing numeric in it needed none of them relaxed. Where it does not hold, the
four places it fails are named in "The seams" below and every one of them is a
table gaining a row rather than a decision being reopened.

It is the same test the figures work passed and worth stating the same way: the
first pass predicted that every deferred item would be a new figure kind and no
engine change, and it was right. This one predicts that a whole new subject is
content plus four widened seams.

## What it is not

**There is no reading comprehension, and that is a decision rather than an
omission.** `MAX_PROMPT_CHARS` is 140, and it is not a tidiness rule - the play
screen sets one size for every question and that size is the worst case's, so
the cap is the only lever there is on how big every question in the app is
drawn. A comprehension passage is several hundred characters. Admitting one
would either blow the cap or shrink every maths question on the screen to pay
for a question in another subject, which is the worst way to spend it: the
child answering a Year 2 subtraction question would get smaller type so that a
Year 5 English question could exist.

So English here is **word and sentence level**: phonics, rhyme, syllables,
morphology, word classes, punctuation and spelling. That is most of what the
Language strand of both syllabuses is, and it is the half that a generated
single-answer question can honestly assess. Comprehension, composition and
handwriting are outcomes this app cannot evidence with one tapped or typed
answer, and citing them would put a claim into the one field that exists to be
checkable - the same objection the `QuestionSpec` split makes to giving a speed
run a nominal school year, and the same one "There are no Part A / Part B tags"
makes about a teacher's programming decision.

If comprehension is ever wanted, it is a screen with its own layout and its own
prompt budget, not a template that fits in this one.

## The seams

Four places assume one subject. Each is a table gaining a row.

### 1. `syllabusOf` and `SYLLABUSES`

`SYLLABUSES` names two documents and matches two code shapes. There are four
documents:

| id | subject | document | code shape |
| --- | --- | --- | --- |
| `acara` | maths | ACARA v9.0 Mathematics F-10 | `AC9M(F\|1-10)[A-Z]+\d{2}` |
| `acara` | english | ACARA v9.0 English F-10 | `AC9E(F\|1-10)(LA\|LE\|LY)\d{2}` |
| `nsw` | maths | NSW Mathematics K-10 (2022) | `MA(E\|O\|1-3)-[A-Z0-9]+-\d{2}` |
| `nsw` | english | NSW English K-10 (2022) | `EN(E\|1-3)-[A-Z]+-\d{2}` |

A `Syllabus` gains a `subject`. `SyllabusId` stays `'acara' | 'nsw'` and is
**not** widened to four values, because the id names the *family* - who
published it, whether its prose is quotable, which column of `/curriculum` it
falls in - and every one of those is a property of ACARA or NESA rather than of
the document. The divergence machinery keys off the family and would have to be
taught to collapse four ids back into two the moment it was widened.

`syllabusOf(code)` keeps its signature and still returns the family, so every
existing caller is unchanged. A second lookup, `syllabusSubjectOf(code)`,
returns the subject the document covers - it is what `/curriculum` needs to
name the right document and link the right URL, and what the new test needs to
refuse a maths code on an English template. Two narrow lookups over one table
rather than one returning a pair, because the two questions have different
callers and the family question already has several.

**An English ACARA strand is one of three and not any letters at all.** The
maths pattern accepts `[A-Z]+` because ACARA's maths strands are six single
words to abbreviate. English has exactly three - `LA` Language, `LE`
Literature, `LY` Literacy - so the pattern names them, which makes a mistyped
strand a shape error caught here rather than a plausible-looking code that
reaches the membership list to be caught there. Tightening the maths pattern to
match is out of scope; this is a new pattern and there is no reason to write it
loose.

### 2. `nswStageOfCode`

`STAGE_BY_PREFIX` maps the first three characters. English adds `ENE` -> `ES1`,
`EN1` -> `S1`, `EN2` -> `S2`, `EN3` -> `S3`. The stage boundaries are identical
- NSW pairs its years the same way in both syllabuses - so `stageForLevel`,
`levelsForStage` and `STAGE_BY_LEVEL` are untouched, which is the point of
having derived the stage rather than stored it.

**There is no English equivalent of `MAO-WM-01`.** Working mathematically hangs
off every maths outcome at every stage and is the reason `nswStageOfCode`
returns null for a code that names no stage. Every English outcome carries a
stage, so English exercises none of that path and adds no second exception to
it.

### 3. `/curriculum`

The page reads `curriculumCodes('maths')` and `syllabusDivergences('maths')`
twice at the top and writes "The maths questions in LearnR" in its opening
sentence. It becomes a section per subject, over `listSubjects()`, so a third
subject needs no edit here.

The **copyright asymmetry is per family and not per subject**, so nothing about
it changes: ACARA's material is CC BY 4.0 and a content description is quoted in
full, NESA's is Crown copyright and an outcome is cited and never reproduced.
That rule now governs twice as many codes, which is the reason the sweep it took
twice for maths is a named task here rather than an intention.

### 4. Three tests in `catalog.test.ts`

Most of the file already generalises: every check that runs over `allTemplates`
and asserts a property of a template - validity, prompt length, the slash rule,
typed answers the pad can enter, at most four options, the id shape, citing a
syllabus, every tag a recognised code - covers English the day English lands,
which is the file working as intended.

Three do not, and they are the three that compute over `allTemplates` while
asserting a *maths* fact:

- **`names every template that cites ACARA alone`** and **`cites no ACARA
  description for the content ACARA places a year later than NSW`**. Both close
  their exception lists with a set equality over every template in the app.
  Those are the assertions doing the real work - closed from both ends, so a
  citation quietly dropped from any other template fails - and an English
  template citing one syllabus alone would break them while being entirely
  correct. They become subject-scoped, with English divergence lists of their
  own, closed the same way.
- **`never asks a child in K to Year 3 to spell an answer`**. The next section
  is about this one.

## The typed-answer rule

The current rule is that no template below Year 4 may have a `text` answer, and
its reason is that spelling "triangle" is a literacy test rather than a maths
one: a Kindergartener knows a triangle long before they can spell it, so
requiring the spelling hides what they actually know about the maths.

**In English the reason inverts, because spelling is the skill.** A Year 2 child
being asked for the plural of "box" is being asked exactly the thing the
syllabus asks of them, and turning it into four buttons would test recognition
where the outcome is production. So the rule becomes subject-aware:

- **Maths keeps the ban unchanged**, Kindergarten through Year 3.
- **English Kindergarten stays entirely tapped.** This is the one place the ban
  survives into English and it is worth being explicit about why: an ES1 child
  is still learning letter *shapes*, and a QWERTY pad is not alphabetical. Asked
  to type "cat" they hunt three letters across three rows, and what the question
  then measures is pad navigation. Every K template is `choice`, `boolean` or
  `number`.
- **English Years 1 to 6 may use `text`**, subject to the cap below.

### The cap

**At most 40% of a year's English templates may have a typed answer**, enforced
in `catalog.test.ts` per year.

Measured on the **generated** question's `answerType`, not the declared one, for
the reason `answerType` is inferred in the first place: a template that declares
nothing and whose answer evaluates to a string is a typed question whatever its
author thought, and a cap that counted declarations would miss exactly the
templates nobody noticed were typed. Kindergarten sits at zero by the stricter
rule above, so the cap binds on Years 1 to 6.

The cap exists because nothing else would stop the drift. Typed answers are the
easiest English questions to author - most of the syllabus's spelling content is
naturally a typed word - and they are much the slowest to answer: a tapped
question is one touch and a typed one is up to sixteen, on a pad with no word
completion. A year that drifted to mostly-typing would be a year where a child
gets through a third as many questions in a sitting, which starves the
reinforcement selector of the observations `MIN_OBSERVATIONS` and
`SECURE_OBSERVATIONS` are counted in. The cost of a typed answer is paid in
attempts per sitting, and the cap is what keeps it a minority of them.

40% rather than a half because the mix should still read as mostly-tapped, and
because a round of ten questions with four of them typed is already a long
round.

### What the pad can express

Two limits, and they shape the content more than any curriculum decision does:

- **There is no space key.** Every typed answer is one word.
- **There is no apostrophe key.** `can't`, `dog's` and `we'll` cannot be typed
  at all.

So contractions and possessives - which are real Stage 1 through Stage 3
content and cannot be skipped - are **multiple choice**, always. That is not a
workaround: it is the same rule that makes the Year 6 integer questions choice
because the number pad has no minus key. The screen cannot express the answer,
so the answer is tapped. `answerMode` needs no change to accommodate this, and
neither does `LetterPad`; adding an apostrophe key was considered and rejected,
because a key that appears in about four templates' answers is a key every other
question's thumb has to miss.

Typed answers are therefore: a single word, A-Z only, at most 16 characters,
graded case-insensitively and trimmed by `gradeAnswer` exactly as today.

## The real risk: English is made of closed word lists

This is the section to read before authoring anything.

`validateTemplate` runs three checks over a `choices` template, and all three
were written against maths, where the engine can always draw a fresh number.
English draws from word banks, and the obvious shape of an English question
fails the second check:

> "Which word rhymes with **cat**?" with options `hat`, `dog`, `sun`

Across forty draws the answer only ever comes from `{hat, mat, bat, sat...}` and
the distractors only ever from `{dog, sun, pin...}`, and the two sets never
overlap. That is the closed-set check firing, and **it is right to fire**: the
answer is the odd one out, narration reads the options aloud, and a child who
does not know what a rhyme is can pick the button that does not belong. It is
precisely the failure the check exists to catch, arriving in a new subject by a
new route.

### The rule

**One word bank per template, and every word in it is sometimes the answer and
sometimes a distractor.**

For rhyme: draw the *family* first (`at`, `og`, `un`, `ig`, `ed`), then the
target word from that family, then the answer from the same family, then the
distractors from the other families. Across draws, `hat` is the answer when the
target is `cat` and a distractor when the target is `dog`. The answer values and
the distractor values overlap, the disjointness check finds no structure to
object to, and it passes on the merits rather than by declaration.

That is also the pedagogically correct shape, which is the sign it is the right
fix rather than a way around a test. A child cannot learn that `hat` is a right
answer, because half the time it is a wrong one. The check and the teaching want
the same thing, which is the argument the anchoring rule makes about figures
made a second time in another subject.

**Neither `rankIsTheQuestion` nor `propertyIsTheQuestion` is expected to be
declared anywhere in English content.** The rank check stands down on its own
wherever options are words, which is nearly everywhere here. If a template seems
to need `propertyIsTheQuestion`, that is the signal its word bank is built wrong
- reach for the shared bank first, and treat a declaration as something to
justify in review rather than a way to get a template to validate.

### Measure it, do not trust the suite

CLAUDE.md already says this about figures and it is at least as true here: eight
option-set leaks were found during the figures work by *measuring*, at rates up
to 100%, and not one could have been found by the checks that existed then. The
prediction check only speaks where an option set repeats, and a leak that
narrows the answer to two buttons of four passes it cleanly.

So every `choice` template in this content is measured before it ships: key each
draw by its prompt and sorted option set, learn the modal answer on one sample,
score it on a held-out sample against the blind baseline. A word-bank subject is
exactly where a set is most likely to repeat, so this is not a formality.

### Word banks are ternary chains

**The expression language has no arrays and nothing to index one with**, which
is why `maths/helpers.ts` holds `dayName`, `shapeName`, `solidWord` and
`columnLetter` - each a chain of ternaries turning an integer into a word.
English needs many more of these, so `src/content/english/helpers.ts` is where
they live, built the same way and carrying the same warning `equalSectors` does:
a chain ends in an unguarded `else`, so an index the helper was not told about
does not fail, it silently returns the last entry. Name a bank once as a
constant and hand that same constant to the `pick` and to the helper.

## Content shape

`src/content/english/` mirrors `src/content/maths/` exactly - `k.ts` through
`6.ts`, a `helpers.ts`, and an `index.ts` concatenating them in school order
into `englishTemplates`. `catalog.ts` gains one import and one spread into
`allTemplates`; it already never learned that maths is more than one file, and
it does not need to learn that there is more than one subject either.

About 22 templates a year, ~155 total. That clears the same `>= 20` floor maths
is held to, which is the point at which a year's pool stops repeating itself
within a sitting.

| Year | Stage | Topics |
| --- | --- | --- |
| K | ES1 | letters and sounds, rhyme, syllables, opposites, sentences |
| 1 | S1 | letters and sounds, rhyme, plurals, opposites, word classes, sentences |
| 2 | S1 | plurals, past tense, compound words, word classes, punctuation, synonyms |
| 3 | S2 | prefixes and suffixes, homophones, word classes, punctuation, spelling patterns |
| 4 | S2 | prefixes and suffixes, homophones, word classes, plurals, synonyms |
| 5 | S3 | word roots, prefixes and suffixes, homophones, figurative language, spelling patterns |
| 6 | S3 | word roots, word classes, figurative language, punctuation, spelling patterns |

Topics recur across years and get harder, which is the many-to-many shape maths
already has and the reason no level->topics table exists in either subject. The
curriculum is derived from the content: adding a Year 4 homophone template is
all it takes to put homophones into Year 4.

**Syllable counting is a `number` answer**, which is how Kindergarten gets a
question that is typed without being spelled - the child counts claps and taps a
digit. It is worth naming because it is the only place in K where the answer is
not a button.

Topic names are stored on `Attempt` and `TopicSkill`, and both are
`@@unique([userId, subject, topic, level])` - subject is in the key, so an
English topic cannot collide with a maths one. No topic is renamed on either
side, for the reason no maths topic was renamed into NSW's vocabulary: a rename
orphans every child's history.

## Curriculum citation

Both syllabuses, the same discipline as maths, because the reason is the same:
NSW schools teach the NSW syllabus and a parent reading `/curriculum` should
find their child's **stage**, which is the word their school uses. Halving the
work by citing ACARA alone would leave the English half of that page as a column
of em dashes while the "cites at least one syllabus" rule passed green - the
guarantee kept in the letter and lost in the substance.

So:

- `docs/superpowers/notes/nsw-english-outcome-codes.md`, transcribed from NESA
  the way `nsw-outcome-codes.md` was, grouped by stage.
- A transcribed membership list in `catalog.test.ts` beside `NSW_OUTCOMES`,
  checked by the same two-way manual diff and with the per-stage counts
  reconciled. That list is the only check in the file that tests a citation for
  *truth* rather than shape, and it fails safe only against omissions - a wrong
  entry stays green forever - so the diff is the whole guard and the task report
  records how it was done rather than that it was done.
- Divergences recorded in `DIVERGENCE_NOTES` and asserted as set equalities
  closed from both ends, per subject.

Some divergence is expected: NSW's 2022 English syllabus is notably
phonics-forward and places systematic phonics and phonological awareness earlier
than ACARA writes them down, which is the same shape as the maths clock-face and
fraction divergences - NSW teaching something a year before ACARA. The list is
derived from the citations rather than predicted here, and each entry gets its
sentence.

### One open item, since closed

**Closed 2026-08-29 (`learnr#11`).** NESA still does not render Stage 3 - the
prediction below that a PDF or the per-stage content pages would yield it was
wrong on both counts. It was sourced instead from two independent published
copies that agree, and that reproduce Stages 1 and 2 exactly as this repo
already had them; `docs/superpowers/notes/nsw-english-outcome-codes.md` names
both and says why the cross-check is what makes them believable. The stop-and-ask
this section demanded is what happened, and the answer was *don't wait for NESA*.

Two of the four candidate codes were real - `EN3-HANDW-01` and `EN3-HANDW-02` -
and **the other two do not exist**: Stage 3 has a single Creating-written-texts
outcome where Stage 2 has three. So half of what this section called a
transcription gap was the syllabus's own shape, and the discipline it argues for
below is exactly what stopped four inferred codes going in, two of which would
have been fabrications.

**NESA's outcomes page paginates, and Stage 3 did not come back with the other
three stages.** Early Stage 1, Stage 1 and Stage 2 were retrieved cleanly; Stage
3 needs sourcing from the syllabus PDF or the per-stage content pages. It is a
discrete task and not a blocker for anything before it, and no Stage 3 code will
be written into a template or a notes file from memory or inference. If the PDF
does not yield an authoritative list, that is a stop-and-ask rather than a
guess: a fabricated code satisfies every shape test in the repo and reaches a
parent as a dead lookup, which is exactly the failure the membership list exists
to prevent.

## Testing

New assertions in `catalog.test.ts`:

- English cites an English syllabus - no maths code on an English template and
  no English code on a maths one.
- Every English NSW code is in the transcribed English membership list.
- Every English NSW code comes from the stage its template's year falls in
  (the existing check generalises; it keys off `nswStageOfCode`).
- No `text` answer in English Kindergarten.
- At most 40% of any English year's templates carry a typed answer.
- At least 20 templates in every English year.
- The two divergence set-equalities, per subject.

Everything else is already enforced over `allTemplates` and needs nothing: 155
new templates walk into the prompt-length cap, the slash rule, the four-option
limit, the id shape, the tag-recognition rule and `validateTemplates` on the day
they land.

Plus, outside the suite: the measured leak check over every `choice` template,
reported per template with its blind baseline.

## What is explicitly untouched

`src/lib/figures` and every one of its eleven kinds, `Mark`, `parseFigure`,
`MAX_MARKS`, `Diagram`, `answerMode`, `gradeAnswer`, `NumberPad`, `LetterPad`,
`ChoicePad`, the reinforcement selector, `buildProfile`, the rewards modules,
the daily target, the speed run, and the whole of `src/app` apart from
`/curriculum`.

**English carries no figure.** Word and sentence level work needs no diagram,
and the one kind that might have been invented for it - a drawn object to name
or sound out - fights the anchoring rule hardest of anything in the app: a
drawn cat is one picture, so "cat" would be anchored to it by construction, and
the check would be right to refuse it.

`SubjectCards` needs no code change. `SUBJECT_ACCENT` maps maths to accent 0 and
`accentFor` already cycles for anything unlisted, so English gets a colour
without being named; `SubjectGlyph` already falls back to a subject's first
letter, which is "at least stable and never a wrong picture". Giving English an
entry in `SUBJECT_ACCENT` and a glyph of its own is a small, optional polish
task at the end, not a prerequisite.

## Risks

- **The word-bank rule is the whole authoring risk.** A template written the
  natural way fails validation, and the fix is structural rather than a tweak.
  Getting it wrong quietly - passing validation while still leaking - is what
  the measurement pass is for.
- **The NSW English transcription fails safe only against omissions.** Same
  exposure `nsw-outcome-codes.md` has, same mitigation, and now twice the
  surface.
- ~~**Stage 3 codes are not yet sourced.**~~ Closed 2026-08-29; the list is
  complete at nine. The exposure above it is the one that remains.
- **The Crown copyright rule now governs twice as many codes.** It had to be
  swept for twice in maths, each drifting comment reading as harmless on its
  own. Say where a syllabus puts something; never what it says.
