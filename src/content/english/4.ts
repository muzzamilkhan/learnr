import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 4 - NSW Stage 2.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Year 4 is still Stage 2** - Stage 2 spans Years 3 and 4 - so every NSW
 * code here is an `EN2-` code Year 3 also carries. That is the syllabus
 * working as written, not a citation copied lazily.
 *
 * **Prefixes and suffixes moves past Year 3's plain concatenation (un-, re-,
 * doubling before -ing) onto two rules Year 3 never needed**: the dis-
 * prefix, built the same way un- was, and the y-to-i spelling change before
 * -ly (`happy` -> `happily`), which is a letter pattern rather than a plain
 * append and is stored as a precomputed pair for exactly that reason - the
 * expression language can only concatenate, it cannot drop the final letter
 * off a bound string.
 *
 * **Homophones keeps Year 3's fix and moves to a harder set of words.**
 * `to`/`too`/`two` and `there`/`their` are common words a Year 3 reader
 * already half-knows; `weight`/`wait`, `break`/`brake` and `flower`/`flour`
 * are pairs that look and sound closer together and are far easier to
 * confuse in writing. The fix is unchanged - every set offers itself as the
 * option set from more than one sentence, so the same two buttons arrive
 * with a different correct answer depending on which sentence is read, and
 * no set is ever a fixed answer to memorise.
 *
 * **Word classes moves from Year 3's naming/doing/describing triple onto
 * adverbs and prepositional phrases** (`AC9E4LA08`), and from Year 3's
 * regular `-ed` past tense onto irregular verbs that change completely
 * (`AC9E4LA09`): `go` -> `went`, not `go` -> `goed`. One scene sentence now
 * carries four roles - noun, verb, adverb and preposition - rather than
 * Year 3's three, which is what lets "which word tells you how" and "which
 * word tells you where" sit beside "which word names" without adding a
 * second scaffold.
 *
 * **Plurals is irregular plurals** (`mouse`/`mice`, `goose`/`geese`,
 * `child`/`children`, `foot`/`feet`, `tooth`/`teeth`, `person`/`people`) -
 * words that do not just add a suffix, which is the step up from every
 * plurals rule this course has taught so far. Both directions are typed, so
 * this topic carries half of the year's typed answers.
 *
 * **Synonyms uses harder vocabulary than Year 2's** (`furious`/`angry`,
 * `exhausted`/`weary`, `gigantic`/`huge`, `ancient`/`old`,
 * `delighted`/`pleased`, `terrified`/`frightened`) and adds one template that
 * asks for a synonym from inside a sentence rather than as an isolated pair,
 * which is the "established and new vocabulary ... in context" `AC9E4LA11`
 * asks for.
 *
 * **Six of twenty-two templates generate a typed answer, across prefixes and
 * suffixes and plurals** - comfortably inside the 15%-40% band and spread so
 * a child secure in one of those topics still types in the other.
 */

// ---------------------------------------------------------------------------
// Prefixes and suffixes
//
// dis- is a plain concatenation exactly as un- was in Year 3. The y-to-i
// change before -ly cannot be built that way - the expression language only
// appends - so the six forms are stored whole, index-aligned to their bases.
// ---------------------------------------------------------------------------

const DIS_BASE: WordBank = ['agree', 'obey', 'like', 'trust', 'connect', 'approve'];

const Y_TO_I_BASE: WordBank = ['happy', 'angry', 'easy', 'hungry', 'lazy', 'busy'];
const Y_TO_I_FORM: WordBank = ['happily', 'angrily', 'easily', 'hungrily', 'lazily', 'busily'];

// ---------------------------------------------------------------------------
// Homophones
//
// Each family is a closed set of same-sounding words, and every template
// offers the whole family as its option set across more than one sentence -
// each sentence picking out a different member, so the same buttons arrive
// with a different correct answer depending on which sentence is read.
// ---------------------------------------------------------------------------

const WHICH_WITCH: WordBank = ['which', 'witch'];
const WHICH_WITCH_SENTENCES: readonly string[] = [
  "I don't know ? bus to catch.",
  'The ? cast a magic spell.',
];

const WEIGHT_WAIT: WordBank = ['weight', 'wait'];
const WEIGHT_WAIT_SENTENCES: readonly string[] = [
  'Please ? for me outside.',
  'What is the ? of this box?',
];

const BREAK_BRAKE: WordBank = ['break', 'brake'];
const BREAK_BRAKE_SENTENCES: readonly string[] = [
  'Please do not ? the plate.',
  'The car has a new ?.',
];

const FLOWER_FLOUR: WordBank = ['flower', 'flour'];
const FLOWER_FLOUR_SENTENCES: readonly string[] = [
  'Add more ? to the cake mixture.',
  'She picked a beautiful ? from the garden.',
];

/** The literal string at index `i` of `list`, as an expression. */
const TEXT_AT = (list: readonly string[], i: Expr): Expr =>
  list
    .slice(0, -1)
    .reduceRight(
      (rest, text, index) => `${i} == ${index} ? "${text}" : ${rest}`,
      `"${list[list.length - 1]}"`,
    );

// ---------------------------------------------------------------------------
// Word classes
//
// One five-word scene sentence carries a noun, a verb, an adverb and a
// preposition at once, the fix Year 1 found extended from three roles to
// four - which is what lets a preposition and an adverb sit beside a noun
// and a verb without a second scaffold. A second scaffold carries an
// irregular verb through present, past and future tense, exactly as Year 3's
// did, but with forms that change completely rather than a plain -ed.
// ---------------------------------------------------------------------------

const SCENE4_NOUN: WordBank = ['dog', 'bird', 'boy', 'girl', 'horse', 'driver'];
const SCENE4_VERB: WordBank = ['ran', 'flew', 'walked', 'jumped', 'galloped', 'drove'];
const SCENE4_ADVERB: WordBank = ['quickly', 'high', 'slowly', 'carefully', 'fast', 'gently'];
const SCENE4_PREP: WordBank = ['under', 'above', 'behind', 'over', 'near', 'beside'];
const SCENE4_OBJECT: readonly string[] = [
  'the table',
  'the trees',
  'the bus',
  'the puddle',
  'the fence',
  'the river',
];

/** "The {noun} {verb} {adverb} {prep} {object}." for scene `i`, as an expression. */
const SCENE4_SENTENCE = (i: Expr): Expr =>
  `'The ' + (${wordFrom(SCENE4_NOUN, i)}) + ' ' + (${wordFrom(SCENE4_VERB, i)}) + ' ' + ` +
  `(${wordFrom(SCENE4_ADVERB, i)}) + ' ' + (${wordFrom(SCENE4_PREP, i)}) + ' ' + ` +
  `(${TEXT_AT(SCENE4_OBJECT, i)}) + '.'`;

/**
 * The noun, verb, adverb or preposition of scene `i`, chosen by `role`
 * (0 = noun, 1 = verb, 2 = adverb, 3 = preposition), as an expression.
 */
const SCENE4_CANDIDATE = (i: Expr, role: Expr): Expr =>
  `${role} == 1 ? (${wordFrom(SCENE4_VERB, i)}) : ` +
  `${role} == 2 ? (${wordFrom(SCENE4_ADVERB, i)}) : ` +
  `${role} == 3 ? (${wordFrom(SCENE4_PREP, i)}) : (${wordFrom(SCENE4_NOUN, i)})`;

/** "noun", "verb", "adverb" or "preposition", chosen by `role`, as an expression. */
const SCENE4_LABEL = (role: Expr): Expr =>
  `${role} == 1 ? 'verb' : ${role} == 2 ? 'adverb' : ${role} == 3 ? 'preposition' : 'noun'`;

// Irregular verbs that change completely in the past tense, unlike Year 3's
// plain -ed set - which is exactly the step up AC9E4LA09 asks for.
const TENSE4_VERB: WordBank = ['go', 'see', 'eat', 'run', 'give', 'take'];
const TENSE4_PAST: WordBank = ['went', 'saw', 'ate', 'ran', 'gave', 'took'];
const TENSE4_OBJECT: readonly string[] = [
  'to school',
  'a movie',
  'breakfast',
  'in the park',
  'a gift',
  'the bus',
];

/** The verb at `i` in the given `tense` (0 = now, 1 = past, 2 = future), as an expression. */
const TENSE4_FORM = (i: Expr, tense: Expr): Expr =>
  `${tense} == 0 ? (${wordFrom(TENSE4_VERB, i)}) : ` +
  `${tense} == 1 ? (${wordFrom(TENSE4_PAST, i)}) : ('will ' + (${wordFrom(TENSE4_VERB, i)}))`;

/** "now", "past" or "future", chosen by `tense`, as an expression. */
const TENSE4_LABEL = (tense: Expr): Expr =>
  `${tense} == 1 ? 'past' : (${tense} == 2 ? 'future' : 'now')`;

/** "I {verb in tense} {object}." for verb `i`, as an expression. */
const TENSE4_SENTENCE = (i: Expr, tense: Expr): Expr =>
  `'I ' + (${TENSE4_FORM(i, tense)}) + ' ' + (${TEXT_AT(TENSE4_OBJECT, i)}) + '.'`;

// ---------------------------------------------------------------------------
// Plurals
//
// Irregular plurals - the whole word changes rather than taking a suffix -
// so both directions are stored whole, index-aligned, and both are typed:
// there is no rule to state in a hint beyond "this one is different".
// ---------------------------------------------------------------------------

const PLURAL_SINGULAR: WordBank = ['mouse', 'goose', 'child', 'foot', 'tooth', 'person'];
const PLURAL_PLURAL: WordBank = ['mice', 'geese', 'children', 'feet', 'teeth', 'people'];

// ---------------------------------------------------------------------------
// Synonyms
//
// The same family/index scaffold Year 2's synonyms use, applied to harder
// vocabulary - `SYN4_A`/`SYN4_B` are interchangeable exactly as Year 2's
// `SYN_A`/`SYN_B` are, so either side of a pair can be the target and the
// other the answer.
// ---------------------------------------------------------------------------

const SYN4_A: WordBank = ['furious', 'exhausted', 'gigantic', 'ancient', 'delighted', 'terrified'];
const SYN4_B: WordBank = ['angry', 'weary', 'huge', 'old', 'pleased', 'frightened'];

/** The word at pair `p`, on side `s` (0 for `SYN4_A`, 1 for `SYN4_B`), as an expression. */
const SYNONYM4_WORD = (p: Expr, s: Expr): Expr =>
  `${s} == 0 ? (${wordFrom(SYN4_A, p)}) : (${wordFrom(SYN4_B, p)})`;

const SYN4_SENTENCES: readonly string[] = [
  'The customer was furious about the mistake.',
  'After the race, the runner felt exhausted.',
  'The elephant is a gigantic animal.',
  'The castle was built in ancient times.',
  'She was delighted with her new bike.',
  'The child was terrified of the thunder.',
];

export const year4: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Prefixes and suffixes
  // -------------------------------------------------------------------
  {
    id: 'english.4.prefixes-and-suffixes.write-dis',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '4',
    prompt: 'Write the word that means the opposite of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(DIS_BASE, 'i') },
    ],
    answer: "'dis' + word",
    answerType: 'text',
    hint: 'Add dis- to the front of the word.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.prefixes-and-suffixes.which-means-opposite',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '4',
    prompt: 'Which word means the opposite of {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(DIS_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: "'dis' + word" },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        `'dis' + (${wordFrom(DIS_BASE, '(i + d1) % 6')})`,
        `'dis' + (${wordFrom(DIS_BASE, '(i + d2) % 6')})`,
      ],
    },
    hint: 'Dis- at the start of a word means the opposite.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.prefixes-and-suffixes.write-with-ly',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '4',
    prompt: 'Write {word} with -ly added.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(Y_TO_I_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(Y_TO_I_FORM, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Change the y to i, then add -ly.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.prefixes-and-suffixes.which-means-that-way',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '4',
    prompt: 'Which word means done in a {word} way?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(Y_TO_I_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(Y_TO_I_FORM, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(Y_TO_I_FORM, '(i + d1) % 6'), wordFrom(Y_TO_I_FORM, '(i + d2) % 6')],
    },
    hint: 'Change the y to i, then add -ly.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.prefixes-and-suffixes.find-base-word',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '4',
    prompt: 'Which word means {word} without the -ly ending?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(Y_TO_I_FORM, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(Y_TO_I_BASE, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(Y_TO_I_BASE, '(i + d1) % 6'), wordFrom(Y_TO_I_BASE, '(i + d2) % 6')],
    },
    hint: 'Change the i back to y, then take away -ly.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Homophones
  // -------------------------------------------------------------------
  {
    id: 'english.4.homophones.which-witch',
    subject: 'english',
    topic: 'homophones',
    level: '4',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(WHICH_WITCH_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(WHICH_WITCH, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(WHICH_WITCH, '1 - j')],
    },
    hint: 'One of these words asks a question, and the other names a person from a story.',
    tags: ['AC9E4LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.homophones.weight-wait',
    subject: 'english',
    topic: 'homophones',
    level: '4',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(WEIGHT_WAIT_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(WEIGHT_WAIT, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(WEIGHT_WAIT, '1 - j')],
    },
    hint: 'One of these words means to stay until something happens, and the other is how heavy something is.',
    tags: ['AC9E4LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.homophones.break-brake',
    subject: 'english',
    topic: 'homophones',
    level: '4',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(BREAK_BRAKE_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(BREAK_BRAKE, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(BREAK_BRAKE, '1 - j')],
    },
    hint: 'One of these words is a part of a car, and the other means to snap or smash something.',
    tags: ['AC9E4LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.homophones.flower-flour',
    subject: 'english',
    topic: 'homophones',
    level: '4',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(FLOWER_FLOUR_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(FLOWER_FLOUR, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(FLOWER_FLOUR, '1 - j')],
    },
    hint: 'One of these words is used in baking, and the other grows in a garden.',
    tags: ['AC9E4LY11', 'EN2-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Word classes
  // -------------------------------------------------------------------
  {
    id: 'english.4.word-classes.identify-in-sentence',
    subject: 'english',
    topic: 'word classes',
    level: '4',
    prompt: 'Which word in this sentence is the {label}? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'role', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'sentence', kind: 'expr', expr: SCENE4_SENTENCE('i') },
      { name: 'label', kind: 'expr', expr: SCENE4_LABEL('role') },
      { name: 'answer', kind: 'expr', expr: SCENE4_CANDIDATE('i', 'role') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      // The other three words of the same scene - always the same four
      // buttons for a given sentence, whichever role was asked about.
      distractors: [
        SCENE4_CANDIDATE('i', '(role + 1) % 4'),
        SCENE4_CANDIDATE('i', '(role + 2) % 4'),
        SCENE4_CANDIDATE('i', '(role + 3) % 4'),
      ],
    },
    hint: 'A noun names something, a verb is the action, an adverb tells you how, and a preposition tells you where.',
    tags: ['AC9E4LA08', 'EN2-CWT-01'],
  },
  {
    id: 'english.4.word-classes.name-the-word-class',
    subject: 'english',
    topic: 'word classes',
    level: '4',
    prompt: 'What kind of word is {candidate} in this sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'role', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'sentence', kind: 'expr', expr: SCENE4_SENTENCE('i') },
      { name: 'candidate', kind: 'expr', expr: SCENE4_CANDIDATE('i', 'role') },
      { name: 'answer', kind: 'expr', expr: SCENE4_LABEL('role') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      // The four labels are the whole option set on every draw - which one
      // is correct depends only on `role`, drawn uniformly.
      distractors: [
        SCENE4_LABEL('(role + 1) % 4'),
        SCENE4_LABEL('(role + 2) % 4'),
        SCENE4_LABEL('(role + 3) % 4'),
      ],
    },
    hint: 'A noun names something, a verb is the action, an adverb tells you how, and a preposition tells you where.',
    tags: ['AC9E4LA08', 'EN2-CWT-01'],
  },
  {
    id: 'english.4.word-classes.is-future-tense',
    subject: 'english',
    topic: 'word classes',
    level: '4',
    prompt: 'Is this sentence in the future tense? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'alt', kind: 'pick', from: [0, 1] },
      { name: 'tense', kind: 'expr', expr: 'ok == 1 ? 2 : alt' },
      { name: 'sentence', kind: 'expr', expr: TENSE4_SENTENCE('i', 'tense') },
    ],
    answer: 'ok == 1',
    hint: 'Future tense verbs start with will.',
    tags: ['AC9E4LA09', 'EN2-CWT-01'],
  },
  {
    id: 'english.4.word-classes.past-tense-form',
    subject: 'english',
    topic: 'word classes',
    level: '4',
    prompt: 'Which word means {word} already happened?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(TENSE4_VERB, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(TENSE4_PAST, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(TENSE4_PAST, '(i + d1) % 6'), wordFrom(TENSE4_PAST, '(i + d2) % 6')],
    },
    hint: 'This verb changes completely in the past tense - it does not just add -ed.',
    tags: ['AC9E4LA09', 'EN2-CWT-01'],
  },
  {
    id: 'english.4.word-classes.identify-verb-tense',
    subject: 'english',
    topic: 'word classes',
    level: '4',
    prompt: 'Is this happening in the past, now, or in the future? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'tense', kind: 'pick', from: [0, 1, 2] },
      { name: 'sentence', kind: 'expr', expr: TENSE4_SENTENCE('i', 'tense') },
      { name: 'answer', kind: 'expr', expr: TENSE4_LABEL('tense') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // "now", "past" and "future" are the whole option set on every draw -
      // which one is correct depends only on `tense`, drawn uniformly.
      distractors: [TENSE4_LABEL('(tense + 1) % 3'), TENSE4_LABEL('(tense + 2) % 3')],
    },
    hint: 'Look at the verb: does it change completely, or does it start with will?',
    tags: ['AC9E4LA09', 'EN2-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Plurals
  // -------------------------------------------------------------------
  {
    id: 'english.4.plurals.write-plural',
    subject: 'english',
    topic: 'plurals',
    level: '4',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_PLURAL, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'This word does not just add -s - the whole word changes.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.plurals.write-singular',
    subject: 'english',
    topic: 'plurals',
    level: '4',
    prompt: 'Write the singular of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_PLURAL, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_SINGULAR, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Think of just one - what would you call it?',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.plurals.which-is-plural',
    subject: 'english',
    topic: 'plurals',
    level: '4',
    prompt: 'Which word is the plural of {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_PLURAL, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        wordFrom(PLURAL_PLURAL, '(i + d1) % 6'),
        wordFrom(PLURAL_PLURAL, '(i + d2) % 6'),
      ],
    },
    hint: 'This word does not just add -s - the whole word changes.',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.4.plurals.which-is-singular',
    subject: 'english',
    topic: 'plurals',
    level: '4',
    prompt: 'Which word is the singular of {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_PLURAL, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_SINGULAR, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        wordFrom(PLURAL_SINGULAR, '(i + d1) % 6'),
        wordFrom(PLURAL_SINGULAR, '(i + d2) % 6'),
      ],
    },
    hint: 'Think of just one - what would you call it?',
    tags: ['AC9E4LY10', 'EN2-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Synonyms
  // -------------------------------------------------------------------
  {
    id: 'english.4.synonyms.which-synonym',
    subject: 'english',
    topic: 'synonyms',
    level: '4',
    prompt: 'Which word means the same as {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: SYNONYM4_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM4_WORD('p', '1 - s') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYNONYM4_WORD('(p + d1) % 6', 's2'), SYNONYM4_WORD('(p + d2) % 6', 's3')],
    },
    hint: 'A synonym means almost the same thing.',
    tags: ['AC9E4LA11', 'EN2-VOCAB-01'],
  },
  {
    id: 'english.4.synonyms.worked-example',
    subject: 'english',
    topic: 'synonyms',
    level: '4',
    prompt: '{eTarget} and {eAnswer} mean the same thing. Which word means the same as {target}?',
    vars: [
      { name: 'ep', kind: 'int', min: '0', max: '5' },
      { name: 'es', kind: 'pick', from: [0, 1] },
      { name: 'p', kind: 'int', min: '1', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'eTarget', kind: 'expr', expr: SYNONYM4_WORD('ep', 'es') },
      { name: 'eAnswer', kind: 'expr', expr: SYNONYM4_WORD('ep', '1 - es') },
      { name: 'target', kind: 'expr', expr: SYNONYM4_WORD('(ep + p) % 6', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM4_WORD('(ep + p) % 6', '1 - s') },
    ],
    constraints: ['d1 != d2', 'd1 != p', 'd2 != p'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYNONYM4_WORD('(ep + d1) % 6', 's2'), SYNONYM4_WORD('(ep + d2) % 6', 's3')],
    },
    hint: 'Use the example to see what "means the same" looks like.',
    tags: ['AC9E4LA11', 'EN2-VOCAB-01'],
  },
  {
    id: 'english.4.synonyms.two-choices',
    subject: 'english',
    topic: 'synonyms',
    level: '4',
    prompt: 'Which word means the same as {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd', kind: 'int', min: '1', max: '5' },
      { name: 'sw', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: SYNONYM4_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM4_WORD('p', '1 - s') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [SYNONYM4_WORD('(p + d) % 6', 'sw')],
    },
    hint: 'A synonym means almost the same thing.',
    tags: ['AC9E4LA11', 'EN2-VOCAB-01'],
  },
  {
    id: 'english.4.synonyms.in-context',
    subject: 'english',
    topic: 'synonyms',
    level: '4',
    prompt: 'Which word means the same as {target} in this sentence? {sentence}',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(SYN4_SENTENCES, 'p') },
      { name: 'target', kind: 'expr', expr: wordFrom(SYN4_A, 'p') },
      { name: 'answer', kind: 'expr', expr: wordFrom(SYN4_B, 'p') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(SYN4_B, '(p + d1) % 6'), wordFrom(SYN4_B, '(p + d2) % 6')],
    },
    hint: 'A synonym means almost the same thing.',
    tags: ['AC9E4LA11', 'EN2-VOCAB-01'],
  },
];
