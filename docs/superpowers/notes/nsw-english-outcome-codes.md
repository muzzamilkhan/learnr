# NSW English K–10 (2022) — outcome codes by stage

Reference for the English content tasks. Cite a code from the stage matching the
template's year. `catalog.test.ts` (`ENGLISH_NSW_OUTCOMES`) enforces the stage
match and that a cited code actually exists.

**This file is a finding aid, not a copy.** Each row names a code and the focus
area it belongs to — a heading and a place in the syllabus. The sentence after
that heading, describing what a child does to meet the outcome, is Crown
copyright and is never transcribed here, in a code comment, or on the
curriculum page.

Early Stage 1 through Stage 2 are sourced from the official outcomes page,
`curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/outcomes`, and
the Stage 3 content page,
`curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/content/stage-3`.
**Stage 3 is not**, because neither page will render it — see below.

## Counts

| Stage | Codes |
| --- | --- |
| Early Stage 1 | 11 |
| Stage 1 | 9 |
| Stage 2 | 11 |
| Stage 3 | 9 |
| **Total** | **40** |

## Three structural facts

**Stage 1 has no phonological-awareness (PHOAW) and no print-concepts (PRINT)
outcome.** Both fold into `EN1-PHOKW-01` — a Year 1 rhyme template cites PHOKW
where a Kindergarten one cites PHOAW. This is not a transcription gap; NESA's
own outcome list does not carry PHOAW or PRINT codes past Early Stage 1.

**Stage 3 has no reading-fluency (REFLU) outcome**, unlike the three stages
below it. NESA's Stage 3 focus areas run Oral language and communication,
Vocabulary, Reading comprehension, Creating written texts, Spelling,
Handwriting and digital transcription, and Understanding and responding to
literature — reading fluency is not among them at this stage.

**Stage 3 has one Creating-written-texts (CWT) outcome, where Stage 2 has
three.** `EN3-CWT-01` is the whole of that focus area at Stage 3. This is the
fact most likely to be mistaken for a transcription error, because Stage 2's
`EN2-CWT-01`, `-02` and `-03` sit right above it and the obvious inference from
that shape is wrong. **There is no `EN3-CWT-02` and no `EN3-CWT-03`. Do not add
them.** Handwriting is the other way round and stays split — `EN3-HANDW-01` and
`EN3-HANDW-02`, as at Stage 2.

## Where Stage 3 came from, since NESA would not render it

**NESA's own pages still do not carry Stage 3**, re-checked 2026-08-29. The
outcomes page truncates after `EN2-UARL-01`; the Stage 3 content page renders
`EN3-OLC-01` and then links to its remaining six focus areas without expanding
their detail sections. That is the same failure recorded when this file was
first written, so waiting it out is not a plan.

So Stage 3's nine codes are sourced the way Stage 3 of the *maths* list was,
after that page would not render either: from two independent published copies
that agree with each other, and that are checked against what we already know.

- A NSW Department of Education record-of-learning document, at
  `nsw.gov.au/sites/default/files/noindex/2024-02/english-s3-record-of-learning-and-achievement-using-syllabus-outcomes.docx`.
- A copy of NESA's own *English — NSW Syllabus Content, Years 1–10*, a
  five-page outcomes listing.

**What makes them believable is the cross-check, not their provenance.** The
second carries Stage 1 and Stage 2 as well as Stage 3, and reproduces both
*exactly* as this file already had them — 9 codes and 11 codes, including the
`EN2-CWT-01/02/03` and `EN2-HANDW-01/02` splits and the absence of a Stage 1
PHOAW or PRINT code. A source that gets two known stages right code-for-code is
a source worth believing on the third. The two agree on all nine Stage 3 codes
with no disagreement to resolve.

**The two codes this recovered are `EN3-HANDW-01` and `EN3-HANDW-02`**, and the
finding that mattered as much is a negative one: the CWT codes this file
previously listed as "possible" do not exist, which is now written above as a
structural fact rather than left as an open gap for somebody to close by
guessing.

**The standing rule is unchanged.** A code goes in this file when it has been
*seen*, never when it has been inferred from a neighbouring stage's shape. A
fabricated code satisfies every shape check in this repo, reports the right
stage, and would reach a parent on `/curriculum` as an invitation to look up an
outcome that does not exist. The membership list this file feeds fails safe
against omissions and not against wrong entries — a real code missing from it
fails loudly against the template that cites it, which is the right direction to
fail in; a wrong one stays green forever.

Only `EN3-VOCAB-01`, `EN3-SPELL-01`, `EN3-UARL-01` and `EN3-CWT-01` are needed
by the templates currently planned against Stage 3, so this gap blocks nothing
downstream of this task.

## Early Stage 1 — Kindergarten (`K`)

| Code | Focus area |
| --- | --- |
| ENE-OLC-01 | Oral language and communication |
| ENE-VOCAB-01 | Vocabulary |
| ENE-PHOAW-01 | Phonological awareness |
| ENE-PRINT-01 | Print conventions |
| ENE-PHOKW-01 | Phonic and word knowledge |
| ENE-REFLU-01 | Reading fluency |
| ENE-RECOM-01 | Reading comprehension |
| ENE-CWT-01 | Creating written texts |
| ENE-SPELL-01 | Spelling |
| ENE-HANDW-01 | Handwriting and digital transcription |
| ENE-UARL-01 | Understanding and responding to literature |

## Stage 1 — Years 1–2

| Code | Focus area |
| --- | --- |
| EN1-OLC-01 | Oral language and communication |
| EN1-VOCAB-01 | Vocabulary |
| EN1-PHOKW-01 | Phonic and word knowledge |
| EN1-REFLU-01 | Reading fluency |
| EN1-RECOM-01 | Reading comprehension |
| EN1-CWT-01 | Creating written texts |
| EN1-SPELL-01 | Spelling |
| EN1-HANDW-01 | Handwriting and digital transcription |
| EN1-UARL-01 | Understanding and responding to literature |

## Stage 2 — Years 3–4

| Code | Focus area |
| --- | --- |
| EN2-OLC-01 | Oral language and communication |
| EN2-VOCAB-01 | Vocabulary |
| EN2-REFLU-01 | Reading fluency |
| EN2-RECOM-01 | Reading comprehension |
| EN2-CWT-01 | Creating written texts |
| EN2-CWT-02 | Creating written texts |
| EN2-CWT-03 | Creating written texts |
| EN2-SPELL-01 | Spelling |
| EN2-HANDW-01 | Handwriting and digital transcription |
| EN2-HANDW-02 | Handwriting and digital transcription |
| EN2-UARL-01 | Understanding and responding to literature |

## Stage 3 — Years 5–6

| Code | Focus area |
| --- | --- |
| EN3-OLC-01 | Oral language and communication |
| EN3-VOCAB-01 | Vocabulary |
| EN3-RECOM-01 | Reading comprehension |
| EN3-CWT-01 | Creating written texts |
| EN3-SPELL-01 | Spelling |
| EN3-HANDW-01 | Handwriting and digital transcription |
| EN3-HANDW-02 | Handwriting and digital transcription |
| EN3-UARL-01 | Understanding and responding to literature |
| EN3-UARL-02 | Understanding and responding to literature |

Complete: all seven of Stage 3's focus areas are represented, and reading
fluency is absent because Stage 3 has no such focus area rather than because a
code is missing. See the two sections above for where these came from and for
why Creating written texts stops at `-01`.
