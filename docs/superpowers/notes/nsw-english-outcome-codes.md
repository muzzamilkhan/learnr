# NSW English K–10 (2022) — outcome codes by stage

Reference for the English content tasks. Cite a code from the stage matching the
template's year. `catalog.test.ts` (`ENGLISH_NSW_OUTCOMES`) enforces the stage
match and that a cited code actually exists.

**This file is a finding aid, not a copy.** Each row names a code and the focus
area it belongs to — a heading and a place in the syllabus. The sentence after
that heading, describing what a child does to meet the outcome, is Crown
copyright and is never transcribed here, in a code comment, or on the
curriculum page.

Sourced from the official outcomes page,
`curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/outcomes`, and
the Stage 3 content page,
`curriculum.nsw.edu.au/learning-areas/english/english-k-10-2022/content/stage-3`.

## Counts

| Stage | Codes |
| --- | --- |
| Early Stage 1 | 11 |
| Stage 1 | 9 |
| Stage 2 | 11 |
| Stage 3 | 7 (partial — see below) |
| **Total** | **38** |

## Two structural facts

**Stage 1 has no phonological-awareness (PHOAW) and no print-concepts (PRINT)
outcome.** Both fold into `EN1-PHOKW-01` — a Year 1 rhyme template cites PHOKW
where a Kindergarten one cites PHOAW. This is not a transcription gap; NESA's
own outcome list does not carry PHOAW or PRINT codes past Early Stage 1.

**Stage 3 has no reading-fluency (REFLU) outcome**, unlike the three stages
below it. NESA's Stage 3 focus areas run Oral language and communication,
Vocabulary, Reading comprehension, Creating written texts, Spelling,
Handwriting and digital transcription, and Understanding and responding to
literature — reading fluency is not among them at this stage.

## Stage 3 is partial

Seven Stage 3 codes are confirmed directly against NESA. Two focus areas —
Creating written texts and Handwriting and digital transcription — are known to
exist at Stage 3 (they are named in NESA's own focus-area list) but their
outcome codes beyond `EN3-CWT-01` could not be retrieved from NESA's site: the
outcomes page truncates before Stage 3 and the Stage 3 content page truncates
before reaching those two focus areas' detail sections. See the task report for
the exact URLs tried and what came back.

**Do not add `EN3-CWT-02`, `EN3-CWT-03`, `EN3-HANDW-01` or `EN3-HANDW-02` by
inferring them from Stage 2's shape.** A fabricated code satisfies every shape
check in this repo, reports the right stage, and would reach a parent on
`/curriculum` as an invitation to look up an outcome that does not exist. The
membership list this file feeds fails safe against omissions — a real code
missing from it fails loudly against the template that cites it, which is the
right direction to fail in. Leaving Stage 3 incomplete costs a future author one
loud failure and a lookup; inventing a code costs nothing until a parent acts on
it.

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

## Stage 3 — Years 5–6 (partial, 7 of an unknown total — see above)

| Code | Focus area |
| --- | --- |
| EN3-OLC-01 | Oral language and communication |
| EN3-VOCAB-01 | Vocabulary |
| EN3-RECOM-01 | Reading comprehension |
| EN3-CWT-01 | Creating written texts |
| EN3-SPELL-01 | Spelling |
| EN3-UARL-01 | Understanding and responding to literature |
| EN3-UARL-02 | Understanding and responding to literature |

Focus areas present at Stage 3 but with no code confirmed beyond the ones above:
Creating written texts (possible further codes `EN3-CWT-02`, `EN3-CWT-03` —
unconfirmed) and Handwriting and digital transcription (possible codes
`EN3-HANDW-01`, `EN3-HANDW-02` — unconfirmed). None of these four are recorded
in this file or in `ENGLISH_NSW_OUTCOMES` until seen on a NESA page.
