import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 3 - NSW Stage 2.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Year 3 is Stage 2** - Stage 2 spans Years 3 and 4 - so every NSW code
 * here is an `EN2-` code, and the same ones Year 4 will also carry: one
 * outcome honestly sitting on two years is the syllabus working as written,
 * not a citation copied lazily. The mistake this guards against is the
 * opposite one - an `EN1-` code left over from Year 2, which reads as
 * plausible and is simply the wrong stage.
 *
 * **Consonant doubling arrives here on purpose.** Year 2's past tense stayed
 * on verbs whose ending never doubles (`jump` -> `jumped`) precisely so that
 * doubling could be its own lesson rather than a trap hidden in an easier
 * one. `hop` -> `hopping` is Year 3's content, not a gap in Year 2's.
 *
 * **Every contraction and possessive question here is typed nowhere.**
 * `can't` and `dog's` both carry an apostrophe, and the letter pad has no
 * apostrophe key - the same reason the Year 6 integer questions are tapped
 * because the number pad has no minus key. Punctuation is entirely `choice`
 * in this file, and so are both possessive templates under word classes.
 *
 * **Homophones are naturally `choice` and naturally leaky**, because
 * "I went ___ the shop" over `to`/`too`/`two` is one fixed option set with
 * one fixed answer. The fix is not a flag - it is asking the question so the
 * answer moves: every homophone template here draws from several sentences
 * that each pick out a different member of the same closed set, so the same
 * buttons arrive with different correct answers across draws, and reading
 * the sentence is what the question is actually testing.
 *
 * **Prefixes/suffixes and spelling patterns carry the typed answers** - 4 of
 * 22 templates across those two topics, comfortably inside the 15%-40% band
 * and spread wide enough that a child secure in one of them still types in
 * the other.
 */

// ---------------------------------------------------------------------------
// Prefixes and suffixes
//
// Three rules, each a plain concatenation the expression language can build
// without dropping a letter: un- and re- attach in front, and -ing doubles
// the final consonant of a short verb before it lands. The doubled forms are
// stored whole, index-aligned to their bases, because the expression
// language can only append - it has no way to duplicate the last letter of
// a bound string.
// ---------------------------------------------------------------------------

const UN_BASE: WordBank = ['happy', 'kind', 'fair', 'safe', 'lucky', 'wise'];
const UN_FORM: WordBank = ['unhappy', 'unkind', 'unfair', 'unsafe', 'unlucky', 'unwise'];

const RE_BASE: WordBank = ['do', 'make', 'build', 'fill', 'play', 'tell'];
const RE_FORM: WordBank = ['redo', 'remake', 'rebuild', 'refill', 'replay', 'retell'];

// Every base here is a single short syllable ending in one vowel and one
// consonant, which is exactly the shape that doubles before -ing - mixing in
// a word like `look` (two vowels before the consonant) would need the rule
// as a second expression.
const DOUBLE_BASE: WordBank = ['hop', 'run', 'stop', 'swim', 'plan', 'grab'];
const DOUBLE_ING: WordBank = ['hopping', 'running', 'stopping', 'swimming', 'planning', 'grabbing'];

// ---------------------------------------------------------------------------
// Homophones
//
// Each family below is a closed set of same-sounding words, and every
// template offers the whole family as its option set. What keeps a fixed
// option set from becoming a fixed answer is that several sentences share
// it, each one picking out a different member - so `to`/`too`/`two` is one
// set of buttons that arrives with three different correct answers,
// depending on which sentence is read.
// ---------------------------------------------------------------------------

const TO_TOO_TWO: WordBank = ['to', 'too', 'two'];
const TO_TOO_TWO_SENTENCES: readonly string[] = [
  'We are going ? the beach.',
  'This soup is ? hot to eat.',
  'I have ? brothers.',
];

const THERE_THEIR: WordBank = ['there', 'their'];
const THERE_THEIR_SENTENCES: readonly string[] = [
  'Put the ball over ?.',
  'The children lost ? bags.',
];

const HERE_HEAR: WordBank = ['here', 'hear'];
const HERE_HEAR_SENTENCES: readonly string[] = ['Come and sit over ?.', 'Can you ? the birds?'];

const ONE_WON: WordBank = ['one', 'won'];
const ONE_WON_SENTENCES: readonly string[] = ['I only have ? apple.', 'Our team ? the game.'];

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
// One three-word sentence carries a naming, doing and describing word at
// once (the fix Year 1 found and Year 2 reused), and a second scaffold
// carries a base verb through present, past and future tense so the same
// sentence shape can be asked about any of the three.
// ---------------------------------------------------------------------------

const SCENE_ADJ: WordBank = ['tall', 'clever', 'brave', 'loud', 'curious', 'strong'];
const SCENE_NOUN: WordBank = ['giant', 'fox', 'knight', 'lion', 'student', 'farmer'];
const SCENE_VERB: WordBank = ['climb', 'hunt', 'fight', 'roar', 'study', 'plant'];

/** "The {adj} {noun} can {verb}." for triple `i`, as an expression. */
const SCENE_SENTENCE = (i: Expr): Expr =>
  `'The ' + (${wordFrom(SCENE_ADJ, i)}) + ' ' + (${wordFrom(SCENE_NOUN, i)}) + ` +
  `' can ' + (${wordFrom(SCENE_VERB, i)}) + '.'`;

/**
 * The naming, doing or describing word of triple `i`, chosen by `role`
 * (0 = naming, 1 = doing, 2 = describing), as an expression.
 */
const SCENE_CANDIDATE = (i: Expr, role: Expr): Expr =>
  `${role} == 1 ? (${wordFrom(SCENE_VERB, i)}) : ` +
  `${role} == 2 ? (${wordFrom(SCENE_ADJ, i)}) : (${wordFrom(SCENE_NOUN, i)})`;

/** "naming word", "doing word" or "describing word", chosen by `role`, as an expression. */
const SCENE_KIND_LABEL = (role: Expr): Expr =>
  `${role} == 1 ? 'doing word' : (${role} == 2 ? 'describing word' : 'naming word')`;

// None of these six doubles its final consonant before -ed, so the tense
// scaffold stays a plain append - doubling is the prefixes/suffixes topic's
// content and mixing it in here would make this question "which rule
// applies" rather than "which tense is this".
const TENSE_VERB: WordBank = ['walk', 'clean', 'cook', 'paint', 'watch', 'wash'];
const TENSE_OBJECT: readonly string[] = [
  'the dog',
  'my room',
  'dinner',
  'a picture',
  'a movie',
  'the car',
];

/** The verb at `i` in the given `tense` (0 = now, 1 = past, 2 = future), as an expression. */
const TENSE_FORM = (i: Expr, tense: Expr): Expr =>
  `${tense} == 0 ? (${wordFrom(TENSE_VERB, i)}) : ` +
  `${tense} == 1 ? ((${wordFrom(TENSE_VERB, i)}) + 'ed') : ('will ' + (${wordFrom(TENSE_VERB, i)}))`;

/** "now", "past" or "future", chosen by `tense`, as an expression. */
const TENSE_LABEL = (tense: Expr): Expr =>
  `${tense} == 1 ? 'past' : (${tense} == 2 ? 'future' : 'now')`;

/** "I {verb in tense} {object}." for triple `i`, as an expression. */
const TENSE_SENTENCE = (i: Expr, tense: Expr): Expr =>
  `'I ' + (${TENSE_FORM(i, tense)}) + ' ' + (${TEXT_AT(TENSE_OBJECT, i)}) + '.'`;

// Fresh bank for the boolean template, kept apart from the sentence
// scaffolds above so this question tests recognising a doing word on its
// own rather than recalling a sentence used to teach something else. A mix
// of nouns and adjectives on the "not" side, so the question is "is this a
// doing word" and not "is this a noun".
const VERB_WORDS3: WordBank = [
  'skip',
  'shout',
  'laugh',
  'crawl',
  'whisper',
  'giggle',
  'stretch',
  'wander',
];
const NON_VERB_WORDS3: WordBank = [
  'pumpkin',
  'ladder',
  'shiny',
  'narrow',
  'bucket',
  'glossy',
  'island',
  'wooden',
];
const VERB_FLAT3: WordBank = [...VERB_WORDS3, ...NON_VERB_WORDS3];

// ---------------------------------------------------------------------------
// Punctuation
//
// Apostrophes for contractions and for possession - both offer full words as
// buttons rather than asking for one to be typed, since the letter pad has
// no apostrophe key. Long and short contraction forms are index-aligned
// literal lists rather than one built from the other, because the join is
// irregular (`will not` -> `won't` drops more than a plain concatenation
// would).
// ---------------------------------------------------------------------------

const CONTR_LONG: readonly string[] = ['do not', 'is not', 'are not', 'have not', 'was not', 'will not'];
const CONTR_SHORT: readonly string[] = ["don't", "isn't", "aren't", "haven't", "wasn't", "won't"];

const POSS_NOUN: WordBank = ['dog', 'cat', 'teacher', 'sister', 'boy', 'girl'];

/** The possessive of the noun at `i` - the noun plus 's - as an expression. */
const POSSESSIVE_AT = (i: Expr): Expr => `(${wordFrom(POSS_NOUN, i)}) + "'s"`;

// ---------------------------------------------------------------------------
// Spelling patterns
//
// Two unrelated patterns. Every verb here forms its noun by plain
// concatenation - `act` + `ion` really is `action` - so nothing needs a
// precomputed second bank the way the doubled -ing forms above do. The
// vowel-team families reuse the rhyme worked example's own scaffold: four
// families sharing one shape, so a word from any of them can be a
// distractor for any other and the answer values and the distractor values
// genuinely overlap.
// ---------------------------------------------------------------------------

const ION_VERBS: WordBank = ['act', 'invent', 'collect', 'connect', 'direct', 'correct'];

const SPELL_FAMILIES: readonly WordBank[] = [
  ['rain', 'pain', 'main', 'chain'],
  ['tree', 'free', 'green', 'sheep'],
  ['boat', 'coat', 'road', 'soap'],
  ['light', 'night', 'right', 'sight'],
];

/** The word at `index` of family `family`, as an expression. */
const SPELL_WORD = (family: Expr, index: Expr): Expr =>
  SPELL_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(SPELL_FAMILIES[SPELL_FAMILIES.length - 1], index)})`,
  );

export const year3: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Prefixes and suffixes
  // -------------------------------------------------------------------
  {
    id: 'english.3.prefixes-and-suffixes.add-un',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '3',
    prompt: 'Write the word that means not {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(UN_BASE, 'i') },
    ],
    answer: "'un' + word",
    answerType: 'text',
    hint: 'Add un- to the front of the word.',
    tags: ['AC9E3LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.prefixes-and-suffixes.double-add-ing',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '3',
    prompt: 'Write {word} with -ing added.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(DOUBLE_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(DOUBLE_ING, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Double the last letter before adding -ing.',
    tags: ['AC9E3LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.prefixes-and-suffixes.which-means-not',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '3',
    prompt: 'Which word means not {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(UN_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(UN_FORM, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(UN_FORM, '(i + d1) % 6'), wordFrom(UN_FORM, '(i + d2) % 6')],
    },
    hint: 'Un- at the start of a word means not.',
    tags: ['AC9E3LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.prefixes-and-suffixes.which-is-happening-now',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '3',
    prompt: 'Which word means {word} is happening right now?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(DOUBLE_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(DOUBLE_ING, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(DOUBLE_ING, '(i + d1) % 6'), wordFrom(DOUBLE_ING, '(i + d2) % 6')],
    },
    hint: 'Double the last letter, then add -ing.',
    tags: ['AC9E3LY10', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.prefixes-and-suffixes.which-means-again',
    subject: 'english',
    topic: 'prefixes and suffixes',
    level: '3',
    prompt: 'Which word means to {word} again?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(RE_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(RE_FORM, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(RE_FORM, '(i + d1) % 6'), wordFrom(RE_FORM, '(i + d2) % 6')],
    },
    hint: 'Re- at the start of a word means again.',
    tags: ['AC9E3LY10', 'EN2-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Homophones
  // -------------------------------------------------------------------
  {
    id: 'english.3.homophones.to-too-two',
    subject: 'english',
    topic: 'homophones',
    level: '3',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1, 2] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(TO_TOO_TWO_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(TO_TOO_TWO, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(TO_TOO_TWO, '(j + 1) % 3'), wordFrom(TO_TOO_TWO, '(j + 2) % 3')],
    },
    hint: 'Read the whole sentence to hear which one fits.',
    tags: ['AC9E3LY12', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.homophones.there-their',
    subject: 'english',
    topic: 'homophones',
    level: '3',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(THERE_THEIR_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(THERE_THEIR, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(THERE_THEIR, '1 - j')],
    },
    hint: 'One of these two words points to a place, and the other shows something belongs to someone.',
    tags: ['AC9E3LY12', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.homophones.here-hear',
    subject: 'english',
    topic: 'homophones',
    level: '3',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(HERE_HEAR_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(HERE_HEAR, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(HERE_HEAR, '1 - j')],
    },
    hint: 'One of these two words points to a place, and the other is about listening.',
    tags: ['AC9E3LY12', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.homophones.one-won',
    subject: 'english',
    topic: 'homophones',
    level: '3',
    prompt: 'Which word completes the sentence? {sentence}',
    vars: [
      { name: 'j', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(ONE_WON_SENTENCES, 'j') },
      { name: 'answer', kind: 'expr', expr: wordFrom(ONE_WON, 'j') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [wordFrom(ONE_WON, '1 - j')],
    },
    hint: 'One of these two words is a number, and the other means came first in a game.',
    tags: ['AC9E3LY12', 'EN2-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Word classes
  // -------------------------------------------------------------------
  {
    id: 'english.3.word-classes.identify-in-sentence',
    subject: 'english',
    topic: 'word classes',
    level: '3',
    prompt: 'Which word in this sentence is the {kind}? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'role', kind: 'pick', from: [0, 1, 2] },
      { name: 'sentence', kind: 'expr', expr: SCENE_SENTENCE('i') },
      { name: 'kind', kind: 'expr', expr: SCENE_KIND_LABEL('role') },
      { name: 'answer', kind: 'expr', expr: SCENE_CANDIDATE('i', 'role') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The other two words of the same triple - always the same three
      // buttons for a given sentence, whichever role was asked about.
      distractors: [SCENE_CANDIDATE('i', '(role + 1) % 3'), SCENE_CANDIDATE('i', '(role + 2) % 3')],
    },
    hint: 'A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.',
    tags: ['AC9E3LA07', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.word-classes.name-the-word-type',
    subject: 'english',
    topic: 'word classes',
    level: '3',
    prompt: 'In this sentence, what kind of word is {candidate}? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'role', kind: 'pick', from: [0, 1, 2] },
      { name: 'sentence', kind: 'expr', expr: SCENE_SENTENCE('i') },
      { name: 'candidate', kind: 'expr', expr: SCENE_CANDIDATE('i', 'role') },
      { name: 'answer', kind: 'expr', expr: SCENE_KIND_LABEL('role') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The three labels are the whole option set on every draw - which one
      // is correct depends only on `role`, drawn uniformly, so the fixed set
      // never predicts the answer.
      distractors: [SCENE_KIND_LABEL('(role + 1) % 3'), SCENE_KIND_LABEL('(role + 2) % 3')],
    },
    hint: 'A naming word names something, a doing word tells you what it does, and a describing word tells you what it is like.',
    tags: ['AC9E3LA07', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.word-classes.identify-verb-tense',
    subject: 'english',
    topic: 'word classes',
    level: '3',
    prompt: 'Is this happening in the past, now, or in the future? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'tense', kind: 'pick', from: [0, 1, 2] },
      { name: 'sentence', kind: 'expr', expr: TENSE_SENTENCE('i', 'tense') },
      { name: 'answer', kind: 'expr', expr: TENSE_LABEL('tense') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // "now", "past" and "future" are the whole option set on every draw -
      // which one is correct depends only on `tense`, drawn uniformly.
      distractors: [TENSE_LABEL('(tense + 1) % 3'), TENSE_LABEL('(tense + 2) % 3')],
    },
    hint: 'Look at the verb: does it end in -ed, or does it start with will?',
    tags: ['AC9E3LA08', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.word-classes.future-tense-form',
    subject: 'english',
    topic: 'word classes',
    level: '3',
    prompt: 'Which word means {word} will happen, if {word} means it is happening now?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(TENSE_VERB, 'i') },
      { name: 'answer', kind: 'expr', expr: "'will ' + word" },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        `'will ' + (${wordFrom(TENSE_VERB, '(i + d1) % 6')})`,
        `'will ' + (${wordFrom(TENSE_VERB, '(i + d2) % 6')})`,
      ],
    },
    hint: 'Add will before the word to show it will happen in the future.',
    tags: ['AC9E3LA08', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.word-classes.is-a-verb',
    subject: 'english',
    topic: 'word classes',
    level: '3',
    prompt: 'Is {word} a doing word?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '15' },
      { name: 'word', kind: 'expr', expr: wordFrom(VERB_FLAT3, 'i') },
    ],
    answer: 'i < 8',
    hint: 'A doing word tells you what someone or something does.',
    tags: ['AC9E3LA07', 'EN2-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Punctuation
  // -------------------------------------------------------------------
  {
    id: 'english.3.punctuation.which-is-contraction',
    subject: 'english',
    topic: 'punctuation',
    level: '3',
    prompt: 'Which word means the same as {long}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'long', kind: 'expr', expr: TEXT_AT(CONTR_LONG, 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(CONTR_SHORT, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [TEXT_AT(CONTR_SHORT, '(i + d1) % 6'), TEXT_AT(CONTR_SHORT, '(i + d2) % 6')],
    },
    hint: 'A contraction joins two words and uses an apostrophe for the missing letters.',
    tags: ['AC9E3LA11', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.punctuation.which-is-long-form',
    subject: 'english',
    topic: 'punctuation',
    level: '3',
    prompt: 'Which words mean the same as {short}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'short', kind: 'expr', expr: TEXT_AT(CONTR_SHORT, 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(CONTR_LONG, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [TEXT_AT(CONTR_LONG, '(i + d1) % 6'), TEXT_AT(CONTR_LONG, '(i + d2) % 6')],
    },
    hint: 'Say the contraction slowly to hear the two words inside it.',
    tags: ['AC9E3LA11', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.punctuation.which-is-possessive',
    subject: 'english',
    topic: 'punctuation',
    level: '3',
    prompt: 'Which word means belonging to the {noun}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'noun', kind: 'expr', expr: wordFrom(POSS_NOUN, 'i') },
      { name: 'answer', kind: 'expr', expr: POSSESSIVE_AT('i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [POSSESSIVE_AT('(i + d1) % 6'), POSSESSIVE_AT('(i + d2) % 6')],
    },
    hint: 'Add an apostrophe and an s to show something belongs to someone.',
    tags: ['AC9E3LA11', 'EN2-CWT-01'],
  },
  {
    id: 'english.3.punctuation.which-is-the-owner',
    subject: 'english',
    topic: 'punctuation',
    level: '3',
    prompt: 'Which word means just the owner, if {poss} means it belongs to them?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'poss', kind: 'expr', expr: POSSESSIVE_AT('i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(POSS_NOUN, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(POSS_NOUN, '(i + d1) % 6'), wordFrom(POSS_NOUN, '(i + d2) % 6')],
    },
    hint: 'Take away the apostrophe and s to find the owner.',
    tags: ['AC9E3LA11', 'EN2-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Spelling patterns
  // -------------------------------------------------------------------
  {
    id: 'english.3.spelling-patterns.add-ion',
    subject: 'english',
    topic: 'spelling patterns',
    level: '3',
    prompt: 'Write the noun made by adding -ion to {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(ION_VERBS, 'i') },
    ],
    answer: "word + 'ion'",
    answerType: 'text',
    hint: 'Add -ion to the end of the word.',
    tags: ['AC9E3LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.spelling-patterns.which-is-ion-noun',
    subject: 'english',
    topic: 'spelling patterns',
    level: '3',
    prompt: 'Which word is made by adding -ion to {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(ION_VERBS, 'i') },
      { name: 'answer', kind: 'expr', expr: "word + 'ion'" },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        `(${wordFrom(ION_VERBS, '(i + d1) % 6')}) + 'ion'`,
        `(${wordFrom(ION_VERBS, '(i + d2) % 6')}) + 'ion'`,
      ],
    },
    hint: 'Add -ion to the end of the word.',
    tags: ['AC9E3LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.spelling-patterns.find-base-word',
    subject: 'english',
    topic: 'spelling patterns',
    level: '3',
    prompt: 'Write the base word that {noun} comes from.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(ION_VERBS, 'i') },
      { name: 'noun', kind: 'expr', expr: "word + 'ion'" },
    ],
    answer: 'word',
    answerType: 'text',
    hint: 'Take away -ion to find the base word.',
    tags: ['AC9E3LY11', 'EN2-SPELL-01'],
  },
  {
    id: 'english.3.spelling-patterns.which-same-pattern',
    subject: 'english',
    topic: 'spelling patterns',
    level: '3',
    prompt: 'Which word has the same letter pattern as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'target', kind: 'expr', expr: SPELL_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: SPELL_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SPELL_WORD('(f + d1) % 4', 't'), SPELL_WORD('(f + d2) % 4', 'a')],
    },
    hint: 'Look for the same group of letters making the same sound.',
    tags: ['AC9E3LY11', 'EN2-SPELL-01'],
  },
];
