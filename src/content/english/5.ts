import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 5 - NSW Stage 3.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Year 5 is Stage 3** - Stage 3 spans Years 5 and 6 - so every NSW code
 * here is an `EN3-` code. Only four `EN3-` codes are confirmed against
 * NESA's own pages at all - `EN3-VOCAB-01`, `EN3-SPELL-01`, `EN3-UARL-01`
 * and `EN3-CWT-01` - and this file cites two of them, `EN3-SPELL-01` and
 * `EN3-UARL-01`, matching the topic table this task was given. No other
 * `EN3-` code is cited, because no other one has been confirmed.
 *
 * **Word roots is morphology proper** (`AC9E5LY09`): six Latin roots -
 * `port` (carry), `dict` (say), `spect` (look), `struct` (build), `ject`
 * (throw) and `scrib` (write) - each spelled out across four derived words,
 * reusing the family/index scaffold the rhyme worked example and Year 3's
 * vowel-team spelling patterns already proved safe: draw the family first,
 * the target from it, the answer from the same family and the distractors
 * from other families, so a word is sometimes the answer and sometimes a
 * distractor. Six families rather than four widens the pool of possible
 * draws enough that the 600-draw leak measurement's train and test halves
 * stop repeatedly landing on the same underlying draw - four was measured to
 * leak on this topic's two hardest templates even though the scaffold itself
 * was sound, purely because so small a domain gets "memorised" by a rule
 * learned from only the buttons. A question naming a whole derived word's
 * *meaning* rather than its root's would be wrong for several draws -
 * `export` does not mean "to carry" the way `transport` does - so every
 * family-level question here asks what the *root* means, never what
 * the drawn word means; the two typed questions ask about a single word's
 * own dictionary sense instead, over a fresh six-word bank built for that.
 *
 * **Prefixes and suffixes moves past every earlier year's plain endings onto
 * -able and -ness**, both plain concatenation - `afford` + `able`, `kind` +
 * `ness` - over two bases chosen so the suffixed forms stay real words with
 * no spelling change, which is what lets the expression language's only
 * operation, appending, build them.
 *
 * **Homophones keeps the fix Year 3 and Year 4 both found and moves to a
 * harder set of words**: `stationary`/`stationery`, `principal`/`principle`,
 * `council`/`counsel` and `affect`/`effect` are pairs a Year 5 reader
 * mixes up in writing far more than in speech. Every set still offers
 * itself as the option set from more than one sentence, each one picking
 * out a different member, so the same buttons arrive with a different
 * correct answer depending on which sentence is read.
 *
 * **Figurative language is the one topic whose option set is genuinely
 * fixed** - `simile`, `metaphor` and `personification` are both the three
 * answers and the three distractors on every draw. That is fine and passes
 * on the merits: the answer values and the distractor values are the same
 * set, so there is no disjointness for the closed-set check to object to,
 * and because a fresh example is drawn every time, the fixed three labels
 * arrive with a different correct one close to a third of the time each -
 * which is what the prediction check actually asks for. What that needs is
 * a wide bank of unambiguous examples rather than a flag: fifteen sentences,
 * five a device, each written so only one of the three readings fits.
 *
 * **Spelling patterns carries two rules**: the `-f`/`-fe` to `-ves` plural
 * (`leaf` -> `leaves`), typed both ways and picked from as a `choice`, and a
 * six-family silent-letter scaffold - `kn`, `wr`, silent `b`, silent `g`,
 * silent `t` and silent `l` - built the same way the root families are, over
 * its own bank so nothing here repeats a word already spent on word roots or
 * prefixes and suffixes.
 *
 * **Six of twenty-two templates generate a typed answer, across word roots,
 * prefixes and suffixes and spelling patterns** - comfortably inside the
 * 15%-40% band and spread across three topics rather than one, so a child
 * secure in any single one of them still types somewhere else in the year.
 */

// ---------------------------------------------------------------------------
// Word roots
//
// Six Latin roots, four derived words each. `same-root` is the rhyme worked
// example's own scaffold applied to a new domain - draw the family, the
// target, the answer from the same family, the distractors from the others -
// and `which-comes-from-root`/`root-meaning` ask about the root's meaning,
// never the whole derived word's, because several of these words have
// drifted a long way from what their root alone means. The two typed
// templates below draw from a separate six-word bank paired with each
// word's own accurate dictionary sense instead.
// ---------------------------------------------------------------------------

const PORT_WORDS: WordBank = ['transport', 'export', 'import', 'report'];
const DICT_WORDS: WordBank = ['predict', 'verdict', 'dictate', 'contradict'];
const SPECT_WORDS: WordBank = ['inspect', 'respect', 'suspect', 'spectator'];
const STRUCT_WORDS: WordBank = ['construct', 'instruct', 'destruct', 'structure'];
const JECT_WORDS: WordBank = ['reject', 'inject', 'project', 'eject'];
const SCRIB_WORDS: WordBank = ['describe', 'subscribe', 'inscribe', 'prescribe'];

// Six families rather than four - a wider pool of family/index combinations
// than a smaller domain would give, which is what keeps the leak
// measurement's train and test halves from repeatedly landing on the same
// underlying draw and "memorising" a pattern that a child could never learn
// from the buttons alone.
const ROOT_FAMILIES: readonly WordBank[] = [
  PORT_WORDS,
  DICT_WORDS,
  SPECT_WORDS,
  STRUCT_WORDS,
  JECT_WORDS,
  SCRIB_WORDS,
];
const ROOT_NAME: readonly string[] = ['port', 'dict', 'spect', 'struct', 'ject', 'scrib'];
const ROOT_MEANING: readonly string[] = ['carry', 'say', 'look', 'build', 'throw', 'write'];

/** The literal string at index `i` of `list`, as an expression. */
const TEXT_AT = (list: readonly string[], i: Expr): Expr =>
  list
    .slice(0, -1)
    .reduceRight(
      (rest, text, index) => `${i} == ${index} ? "${text}" : ${rest}`,
      `"${list[list.length - 1]}"`,
    );

/** The word at `index` of root family `family`, as an expression. */
const ROOT_WORD = (family: Expr, index: Expr): Expr =>
  ROOT_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(ROOT_FAMILIES[ROOT_FAMILIES.length - 1], index)})`,
  );

const ROOT_NAME_AT = (family: Expr): Expr => TEXT_AT(ROOT_NAME, family);
const ROOT_MEANING_AT = (family: Expr): Expr => TEXT_AT(ROOT_MEANING, family);

// A fresh bank for the typed templates - each word paired with its own
// accurate modern definition, not its root's etymology, so the clue is true
// of the whole word rather than of the family it happens to belong to.
const ROOT_CLUE_WORDS: WordBank = ['transport', 'predict', 'inspect', 'construct', 'dictate', 'respect'];
const ROOT_CLUE_TEXT: readonly string[] = [
  'carries something from one place to another',
  'says what will happen in the future',
  'looks closely to check something',
  'builds something out of parts',
  'says words for someone else to write down',
  'shows admiration for someone or something',
];

// ---------------------------------------------------------------------------
// Prefixes and suffixes
//
// Two suffixes, each a plain concatenation the expression language can build
// without dropping a letter: every base here ends in a consonant, so neither
// -able nor -ness nor a plain -ed for the choice prompt's own wording needs
// a spelling change.
// ---------------------------------------------------------------------------

const ABLE_BASE: WordBank = ['afford', 'accept', 'adjust', 'avoid', 'prevent', 'defend'];
const NESS_BASE: WordBank = ['kind', 'sad', 'dark', 'weak', 'calm', 'quiet'];

// ---------------------------------------------------------------------------
// Homophones
//
// Each family is a closed set of same-sounding (or, for affect/effect, near-
// identical) words, and every template offers the whole family as its
// option set across more than one sentence - each sentence picking out a
// different member, so the same buttons arrive with a different correct
// answer depending on which sentence is read.
// ---------------------------------------------------------------------------

const STATIONARY_STATIONERY: WordBank = ['stationary', 'stationery'];
const STATIONARY_STATIONERY_SENTENCES: readonly string[] = [
  'The car remained ? at the red light.',
  'She bought new pens and paper at the ? shop.',
];

const PRINCIPAL_PRINCIPLE: WordBank = ['principal', 'principle'];
const PRINCIPAL_PRINCIPLE_SENTENCES: readonly string[] = [
  'The ? of the school greeted the new students.',
  'Honesty is an important ? to live by.',
];

const COUNCIL_COUNSEL: WordBank = ['council', 'counsel'];
const COUNCIL_COUNSEL_SENTENCES: readonly string[] = [
  'The local ? decided to build a new park.',
  'The teacher gave her some helpful ? about her studies.',
];

const AFFECT_EFFECT: WordBank = ['affect', 'effect'];
const AFFECT_EFFECT_SENTENCES: readonly string[] = [
  'The rain did not ? our plans.',
  'The medicine had a strong ? on her.',
];

// ---------------------------------------------------------------------------
// Figurative language
//
// Three devices, five example sentences each - a wide bank rather than a
// flag. Every simile below carries "like" or "as ... as", which is not a
// leak but the definition; every metaphor states outright that one thing is
// another with neither word; every personification gives a human action to
// something that cannot act, and none of the fifteen borrows another
// device's own marker.
// ---------------------------------------------------------------------------

const SIMILE_EXAMPLES: readonly string[] = [
  'The wind roared like a lion through the valley.',
  'Her smile was as bright as the morning sun.',
  'He ran as fast as a cheetah chasing its prey.',
  'The old car rattled like a bag of tin cans.',
  'Her voice was as smooth as silk.',
];

const METAPHOR_EXAMPLES: readonly string[] = [
  'The classroom was a zoo during the fire drill.',
  'Time is a thief that steals our best moments.',
  'The stars were diamonds scattered across the sky.',
  'Her eyes were pools of sparkling water.',
  'The kitchen was a disaster zone after the party.',
];

const PERSONIFICATION_EXAMPLES: readonly string[] = [
  'The wind whispered secrets through the trees.',
  'The old house groaned when the storm rolled in.',
  'The sun smiled down on the sleepy village.',
  'The angry clouds glared at the picnic below.',
  'The leaves danced across the playground.',
];

const FIG_FAMILIES: readonly (readonly string[])[] = [
  SIMILE_EXAMPLES,
  METAPHOR_EXAMPLES,
  PERSONIFICATION_EXAMPLES,
];
const FIG_LABEL_LIST: readonly string[] = ['simile', 'metaphor', 'personification'];

// The defining feature of each device, index-aligned with `FIG_LABEL_LIST` -
// a second fixed three-item closed set, the same shape as the labels
// themselves, for the template that asks what signals a device rather than
// what it is called.
const FIG_SIGNAL_LIST: readonly string[] = [
  'the word like or as',
  'saying one thing is another',
  'giving human actions to something that is not human',
];

/** The example sentence at `index` of device family `type`, as an expression. */
const FIG_SENTENCE = (type: Expr, index: Expr): Expr =>
  FIG_FAMILIES.slice(0, -1).reduceRight(
    (rest, examples, t) => `${type} == ${t} ? (${TEXT_AT(examples, index)}) : ${rest}`,
    `(${TEXT_AT(FIG_FAMILIES[FIG_FAMILIES.length - 1], index)})`,
  );

/** "simile", "metaphor" or "personification", chosen by `type`, as an expression. */
const FIG_LABEL = (type: Expr): Expr => TEXT_AT(FIG_LABEL_LIST, type);

// ---------------------------------------------------------------------------
// Spelling patterns
//
// Two unrelated rules: the -f/-fe to -ves plural, and a six-family
// silent-letter scaffold over its own bank of thirty-six words, none shared
// with word roots or prefixes and suffixes.
// ---------------------------------------------------------------------------

const FVES_SINGULAR: WordBank = ['leaf', 'wolf', 'thief', 'life', 'shelf', 'wife'];
const FVES_PLURAL: WordBank = ['leaves', 'wolves', 'thieves', 'lives', 'shelves', 'wives'];

const SILENT_K: WordBank = ['knee', 'knife', 'knot', 'knock', 'know', 'knight'];
const SILENT_W: WordBank = ['wrist', 'wrong', 'write', 'wreck', 'wrap', 'wrinkle'];
const SILENT_B: WordBank = ['thumb', 'climb', 'comb', 'lamb', 'limb', 'crumb'];
const SILENT_G: WordBank = ['gnome', 'gnat', 'sign', 'design', 'gnaw', 'foreign'];
const SILENT_T: WordBank = ['listen', 'castle', 'often', 'fasten', 'soften', 'hasten'];
const SILENT_L: WordBank = ['walk', 'talk', 'half', 'yolk', 'chalk', 'folk'];

// Six families for the same reason word roots has six rather than four: a
// wider pool of family/index combinations than the domain word roots
// originally shipped with, which is what keeps this template's leak
// measurement comfortably clear rather than sitting close to the cutoff.
const SILENT_FAMILIES: readonly WordBank[] = [
  SILENT_K,
  SILENT_W,
  SILENT_B,
  SILENT_G,
  SILENT_T,
  SILENT_L,
];

/** The word at `index` of silent-letter family `family`, as an expression. */
const SILENT_WORD = (family: Expr, index: Expr): Expr =>
  SILENT_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(SILENT_FAMILIES[SILENT_FAMILIES.length - 1], index)})`,
  );

export const year5: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Word roots
  // -------------------------------------------------------------------
  {
    id: 'english.5.word-roots.same-root',
    subject: 'english',
    topic: 'word roots',
    level: '5',
    prompt: 'Which word has the same root as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'target', kind: 'expr', expr: ROOT_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: ROOT_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [ROOT_WORD('(f + d1) % 6', 't'), ROOT_WORD('(f + d2) % 6', 'a')],
    },
    hint: 'Look for the part of the word that stays the same and means the same thing.',
    tags: ['AC9E5LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.word-roots.which-comes-from-root',
    subject: 'english',
    topic: 'word roots',
    level: '5',
    prompt: 'Which word comes from a root meaning to {meaning}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'j', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'meaning', kind: 'expr', expr: ROOT_MEANING_AT('f') },
      { name: 'answer', kind: 'expr', expr: ROOT_WORD('f', 'i') },
    ],
    // One distractor reuses the answer's own index `i` in a different family,
    // and the other uses a separate free index `j` - the same shape the
    // rhyme worked example uses for its own two distractors, so no index is
    // ever unique to the answer's slot the way a fixed `i + 1`/`i + 2` offset
    // would make it.
    constraints: ['i != j', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [ROOT_WORD('(f + d1) % 6', 'i'), ROOT_WORD('(f + d2) % 6', 'j')],
    },
    hint: 'The root inside each word shows which family it belongs to.',
    tags: ['AC9E5LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.word-roots.root-meaning',
    subject: 'english',
    topic: 'word roots',
    level: '5',
    prompt: 'What does the root in {word} mean?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: ROOT_WORD('f', 'i') },
      { name: 'answer', kind: 'expr', expr: ROOT_MEANING_AT('f') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The six meanings are a closed set the answer and the distractors both
      // draw from - the same shape the figurative-language labels use - so
      // there is no disjointness, and which two wrong meanings show up moves
      // with `d1`/`d2` rather than being the same three every time.
      distractors: [ROOT_MEANING_AT('(f + d1) % 6'), ROOT_MEANING_AT('(f + d2) % 6')],
    },
    hint: 'Think about what all the words in that family have in common.',
    tags: ['AC9E5LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.word-roots.write-root',
    subject: 'english',
    topic: 'word roots',
    level: '5',
    prompt: 'Write the root inside {word}.',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'word', kind: 'expr', expr: ROOT_WORD('f', 'i') },
      { name: 'answer', kind: 'expr', expr: ROOT_NAME_AT('f') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Look for the meaningful chunk of letters shared by that word family.',
    tags: ['AC9E5LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.word-roots.write-by-clue',
    subject: 'english',
    topic: 'word roots',
    level: '5',
    prompt: 'Write the word that {clue}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'clue', kind: 'expr', expr: TEXT_AT(ROOT_CLUE_TEXT, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(ROOT_CLUE_WORDS, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Break the clue down into the single action it describes.',
    tags: ['AC9E5LY09', 'EN3-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Prefixes and suffixes
  // -------------------------------------------------------------------
  {
    id: 'english.5.prefixes-and-suffixes.write-able',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '5',
    prompt: 'Write the adjective made by adding -able to {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(ABLE_BASE, 'i') },
    ],
    answer: "word + 'able'",
    answerType: 'text',
    hint: 'Add -able to the end of the word.',
    tags: ['AC9E5LY10', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.prefixes-and-suffixes.write-ness',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '5',
    prompt: 'Write the noun made by adding -ness to {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(NESS_BASE, 'i') },
    ],
    answer: "word + 'ness'",
    answerType: 'text',
    hint: 'Add -ness to the end of the word.',
    tags: ['AC9E5LY10', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.prefixes-and-suffixes.which-can-be-done',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '5',
    prompt: 'Which word describes something that can be {word}ed?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(ABLE_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: "word + 'able'" },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        `(${wordFrom(ABLE_BASE, '(i + d1) % 6')}) + 'able'`,
        `(${wordFrom(ABLE_BASE, '(i + d2) % 6')}) + 'able'`,
      ],
    },
    hint: 'Add -able to the end of the word.',
    tags: ['AC9E5LY10', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.prefixes-and-suffixes.which-is-the-state',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '5',
    prompt: 'Which word means the state of being {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(NESS_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: "word + 'ness'" },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        `(${wordFrom(NESS_BASE, '(i + d1) % 6')}) + 'ness'`,
        `(${wordFrom(NESS_BASE, '(i + d2) % 6')}) + 'ness'`,
      ],
    },
    hint: 'Add -ness to the end of the word.',
    tags: ['AC9E5LY10', 'EN3-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Homophones
  // -------------------------------------------------------------------
  {
    id: 'english.5.homophones.stationary-stationery',
    subject: 'english',
    topic: 'homophones',
    level: '5',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(STATIONARY_STATIONERY_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(STATIONARY_STATIONERY, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(STATIONARY_STATIONERY, '1 - j')],
    },
    hint: 'One of these words means not moving, and the other is paper and pens for writing.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.homophones.principal-principle',
    subject: 'english',
    topic: 'homophones',
    level: '5',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(PRINCIPAL_PRINCIPLE_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PRINCIPAL_PRINCIPLE, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(PRINCIPAL_PRINCIPLE, '1 - j')],
    },
    hint: 'One of these words is the head of a school, and the other is a rule you believe in.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.homophones.council-counsel',
    subject: 'english',
    topic: 'homophones',
    level: '5',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(COUNCIL_COUNSEL_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(COUNCIL_COUNSEL, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(COUNCIL_COUNSEL, '1 - j')],
    },
    hint: 'One of these words is a group that governs, and the other is advice.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.homophones.affect-effect',
    subject: 'english',
    topic: 'homophones',
    level: '5',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(AFFECT_EFFECT_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(AFFECT_EFFECT, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(AFFECT_EFFECT, '1 - j')],
    },
    hint: 'One of these words is usually a verb meaning to change something, and the other is usually a noun for a result.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Figurative language
  // -------------------------------------------------------------------
  {
    id: 'english.5.figurative-language.identify',
    subject: 'english',
    topic: 'figurative language',
    level: '5',
    prompt: 'Which one is this? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: FIG_LABEL('type') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The three device names are the whole option set on every draw - which
      // one is correct depends only on `type`, drawn uniformly.
      distractors: [FIG_LABEL('(type + 1) % 3'), FIG_LABEL('(type + 2) % 3')],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.',
    tags: ['AC9E5LE04', 'EN3-UARL-01'],
  },
  {
    id: 'english.5.figurative-language.what-signals-it',
    subject: 'english',
    topic: 'figurative language',
    level: '5',
    prompt: 'What tells you this is a {label}? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: FIG_LABEL('type') },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(FIG_SIGNAL_LIST, 'type') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The three signals are the whole option set on every draw, exactly
      // like the three device names in `identify` - which one is correct
      // depends only on `type`, drawn uniformly.
      distractors: [
        TEXT_AT(FIG_SIGNAL_LIST, '(type + 1) % 3'),
        TEXT_AT(FIG_SIGNAL_LIST, '(type + 2) % 3'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.',
    tags: ['AC9E5LE04', 'EN3-UARL-01'],
  },
  {
    id: 'english.5.figurative-language.match-the-example',
    subject: 'english',
    topic: 'figurative language',
    level: '5',
    prompt: 'Which sentence is an example of {label}?',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: FIG_LABEL('type') },
      { name: 'answer', kind: 'expr', expr: FIG_SENTENCE('type', 'i0') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        FIG_SENTENCE('(type + 1) % 3', 'i1'),
        FIG_SENTENCE('(type + 2) % 3', 'i2'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.',
    tags: ['AC9E5LE04', 'EN3-UARL-01'],
  },
  {
    id: 'english.5.figurative-language.same-device',
    subject: 'english',
    topic: 'figurative language',
    level: '5',
    prompt: 'Which sentence uses the same kind of figurative language as this one? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'iSame', kind: 'int', min: '1', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i0') },
      { name: 'answer', kind: 'expr', expr: FIG_SENTENCE('type', '(i0 + iSame) % 5') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        FIG_SENTENCE('(type + 1) % 3', 'i1'),
        FIG_SENTENCE('(type + 2) % 3', 'i2'),
      ],
    },
    hint: 'Look for what the sentences do, not just what they are about.',
    tags: ['AC9E5LE04', 'EN3-UARL-01'],
  },
  {
    id: 'english.5.figurative-language.eliminate-one',
    subject: 'english',
    topic: 'figurative language',
    level: '5',
    prompt: 'This is not a {wrongLabel}. What is it? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'off', kind: 'pick', from: [1, 2] },
      { name: 'wrongType', kind: 'expr', expr: '(type + off) % 3' },
      { name: 'wrongLabel', kind: 'expr', expr: FIG_LABEL('wrongType') },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: FIG_LABEL('type') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // All three device names are still offered - naming the wrong one rules
      // out only one of the two remaining candidates, so the sentence still
      // has to be read.
      distractors: [FIG_LABEL('(type + 1) % 3'), FIG_LABEL('(type + 2) % 3')],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, and personification gives human actions to something that is not human.',
    tags: ['AC9E5LE04', 'EN3-UARL-01'],
  },

  // -------------------------------------------------------------------
  // Spelling patterns
  // -------------------------------------------------------------------
  {
    id: 'english.5.spelling-patterns.write-plural',
    subject: 'english',
    topic: 'spelling patterns',
    level: '5',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(FVES_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(FVES_PLURAL, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Change the f or fe to v, then add -es.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.spelling-patterns.write-singular',
    subject: 'english',
    topic: 'spelling patterns',
    level: '5',
    prompt: 'Write the singular of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(FVES_PLURAL, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(FVES_SINGULAR, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Change the v back to f or fe.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.spelling-patterns.which-is-plural',
    subject: 'english',
    topic: 'spelling patterns',
    level: '5',
    prompt: 'Which word is the plural of {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(FVES_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(FVES_PLURAL, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(FVES_PLURAL, '(i + d1) % 6'), wordFrom(FVES_PLURAL, '(i + d2) % 6')],
    },
    hint: 'Change the f or fe to v, then add -es.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.5.spelling-patterns.same-silent-pattern',
    subject: 'english',
    topic: 'spelling patterns',
    level: '5',
    prompt: 'Which word has the same silent letter pattern as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'target', kind: 'expr', expr: SILENT_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: SILENT_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SILENT_WORD('(f + d1) % 6', 't'), SILENT_WORD('(f + d2) % 6', 'a')],
    },
    hint: 'Look for the same silent letter combination.',
    tags: ['AC9E5LY08', 'EN3-SPELL-01'],
  },
];
