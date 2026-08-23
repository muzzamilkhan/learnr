import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Kindergarten - NSW Early Stage 1.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Kindergarten is entirely tapped.** An Early Stage 1 child is still
 * learning letter shapes, and the letter pad is a QWERTY layout rather than an
 * alphabetical one - asked to type "cat" they hunt three letters across three
 * rows, which measures pad navigation rather than phonics. Every template
 * below is `choice`, `boolean`, or a syllable count typed as a single digit on
 * the number pad.
 *
 * **Every word bank here is shared between the answer role and the distractor
 * role**, the rule the maths content never had to observe: English is closed
 * word lists, which is exactly the shape `validateTemplate`'s option-set
 * checks refuse. A bank is grouped into families - by rhyme, by syllable
 * count, by opposite pair, by which letter a word starts or ends with - and
 * every template draws its target from one family and its distractors from
 * the others, so a word or a letter is the right button on one draw and a
 * wrong one on the next.
 */

// ---------------------------------------------------------------------------
// Letters and sounds
//
// Eight words paired with their own true first letter, eight paired with
// their own true last letter, and five three-letter words paired with their
// own true medial vowel - indexed together so the correct letter for a word
// is read off the same index rather than computed, which the expression
// language has no way to do from a string. Every helper below is a plain
// `wordFrom` lookup rather than the two-argument "family, index" chain
// `content-shapes.md` calls `FAMILY_WORD`: each "family" here is a single
// word-letter pair, one flat bank rather than a list of them, and stepping
// the index by an offset (mod the bank's length) reaches a different pair's
// letter, which is what lets a letter be the answer for one word and a
// distractor for another.
// ---------------------------------------------------------------------------

const START_WORDS: WordBank = ['cat', 'dog', 'sun', 'pig', 'bed', 'fish', 'moon', 'ant'];
const START_LETTERS: WordBank = ['c', 'd', 's', 'p', 'b', 'f', 'm', 'a'];

const END_WORDS: WordBank = ['sun', 'dog', 'cup', 'bell', 'fish', 'web', 'jam', 'box'];
const END_LETTERS: WordBank = ['n', 'g', 'p', 'l', 'h', 'b', 'm', 'x'];

// Five words, one per vowel and no letter repeated - a repeated medial vowel
// would let an offset land on a different word with the same letter, which
// collides with the answer and leaves fewer than the three options declared.
const MIDDLE_WORDS: WordBank = ['cat', 'hen', 'pig', 'dog', 'cup'];
const MIDDLE_LETTERS: WordBank = ['a', 'e', 'i', 'o', 'u'];

/** The whole alphabet a letter-recognition question draws its options from. */
const ALPHABET: WordBank = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// ---------------------------------------------------------------------------
// Rhyme
//
// Four families of four, the shape `content-shapes.md` verifies end to end:
// the target and the answer share a family, and the distractors come from the
// other three - so `hat` is the answer when the target is `cat` and a
// distractor when the target is `dog`.
// ---------------------------------------------------------------------------

const RHYME_FAMILIES: readonly WordBank[] = [
  ['cat', 'hat', 'mat', 'sat'],
  ['dog', 'log', 'jog', 'fog'],
  ['pig', 'wig', 'dig', 'fig'],
  ['sun', 'run', 'bun', 'fun'],
];

/** The word at `index` of rhyme family `family`, as an expression. */
const RHYME_WORD = (family: Expr, index: Expr): Expr =>
  RHYME_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(RHYME_FAMILIES[RHYME_FAMILIES.length - 1], index)})`,
  );

// ---------------------------------------------------------------------------
// Syllables
//
// Three families by syllable count - one, two and three claps - built the
// same way as the rhyme families. A flat twelve-word list beside it gives the
// two `number` questions a single index to draw from, with `syllableCount`
// reading the count off which third of the list the index fell in rather
// than off the word itself, since the expression language cannot count
// letters or claps.
// ---------------------------------------------------------------------------

const SYLLABLE_FAMILIES: readonly WordBank[] = [
  ['cat', 'dog', 'sun', 'pig'],
  ['apple', 'garden', 'monkey', 'tiger'],
  ['banana', 'elephant', 'umbrella', 'butterfly'],
];

/** The word at `index` of syllable family `family` (0 = one clap, 2 = three), as an expression. */
const SYLLABLE_WORD = (family: Expr, index: Expr): Expr =>
  SYLLABLE_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(SYLLABLE_FAMILIES[SYLLABLE_FAMILIES.length - 1], index)})`,
  );

const SYLLABLE_WORDS: WordBank = [
  'cat',
  'dog',
  'sun',
  'pig',
  'apple',
  'garden',
  'monkey',
  'tiger',
  'banana',
  'elephant',
  'umbrella',
  'butterfly',
];

/** How many claps the word at `i` of `SYLLABLE_WORDS` takes - one clap for the first four, two for the next four, three for the last four. */
const syllableCount = (i: Expr): Expr => `${i} <= 3 ? 1 : ${i} <= 7 ? 2 : 3`;

// ---------------------------------------------------------------------------
// Opposites
//
// Six pairs, one word bank per side of the pair - `hot` always at the same
// index as its own `cold`, `big` at the same index as its own `small` - so
// the opposite of the word at index `p` on side `s` is the word at the same
// index on side `1 - s`. Either side can be the target, which is what makes
// `cold` the answer when the target is `hot` and a distractor when the
// target is `big`.
// ---------------------------------------------------------------------------

const OPP_A: WordBank = ['hot', 'big', 'up', 'fast', 'day', 'wet'];
const OPP_B: WordBank = ['cold', 'small', 'down', 'slow', 'night', 'dry'];

/** The word at pair `p`, on side `s` (0 for `OPP_A`, 1 for `OPP_B`), as an expression. */
const OPPOSITE_WORD = (p: Expr, s: Expr): Expr =>
  `${s} == 0 ? (${wordFrom(OPP_A, p)}) : (${wordFrom(OPP_B, p)})`;

// ---------------------------------------------------------------------------
// Sentences
//
// Three pairs of "correct, incorrect" whole sentences, for the three
// `boolean` questions - `content-shapes.md`'s worked Shape C, applied to a
// capital letter, a full stop, and a complete idea. `PAIR_TEXT` reads the
// pair at index `i` and picks the right or the wrong version off `ok`, the
// same "family, index" chain as everything above, specialised so each
// "family" is one pair of strings rather than a bank of words.
//
// The two fill-in-the-blank choice questions share the letters-and-sounds
// technique rather than the rhyme one: each frame names its own missing word
// by position, one word per index, so the frame - not the option set - is
// what tells a repeat of the same three buttons which one is right this time.
// ---------------------------------------------------------------------------

const CAPITAL_SENTENCES: readonly (readonly [string, string])[] = [
  ['The dog runs fast.', 'the dog runs fast.'],
  ['A cat sleeps all day.', 'a cat sleeps all day.'],
  ['My ball is red.', 'my ball is red.'],
  ['We like the park.', 'we like the park.'],
  ['She can jump high.', 'she can jump high.'],
  ['It is a sunny day.', 'it is a sunny day.'],
];

const FULL_STOP_SENTENCES: readonly (readonly [string, string])[] = [
  ['I like my dog.', 'I like my dog'],
  ['The sun is hot.', 'The sun is hot'],
  ['We play in the sand.', 'We play in the sand'],
  ['She has a red hat.', 'She has a red hat'],
  ['The bird can sing.', 'The bird can sing'],
  ['My mum reads to me.', 'My mum reads to me'],
];

const FRAGMENT_SENTENCES: readonly (readonly [string, string])[] = [
  ['The little dog barks loudly.', 'the little dog'],
  ['My sister likes to draw.', 'likes to draw'],
  ['We ran to the bus stop.', 'to the bus stop'],
  ['The cake smells so good.', 'so good'],
  ['A frog jumped into the pond.', 'into the pond'],
  ['Our teacher reads us a story.', 'reads us a'],
];

/** The correct or incorrect text of pair `i` from `pairs`, chosen by `ok` (1 for correct), as an expression. */
const PAIR_TEXT = (pairs: readonly (readonly [string, string])[], i: Expr, ok: Expr): Expr =>
  pairs
    .slice(0, -1)
    .reduceRight(
      (rest, [good, bad], index) =>
        `${i} == ${index} ? (${ok} == 1 ? '${good}' : '${bad}') : ${rest}`,
      `(${ok} == 1 ? '${pairs[pairs.length - 1][0]}' : '${pairs[pairs.length - 1][1]}')`,
    );

const NOUN_FRAMES: readonly string[] = [
  'My pet ? can bark.',
  'The furry ? can purr.',
  'The bright ? is hot.',
  'I kicked the ? to my friend.',
  'The little ? can fly.',
  'The ? swims in the pond.',
];
const NOUN_WORDS: WordBank = ['dog', 'cat', 'sun', 'ball', 'bird', 'fish'];

const VERB_FRAMES: readonly string[] = [
  'The dog can ? fast.',
  'The bird can ? high.',
  'At night we ?.',
  'The fish can ? well.',
  'The baby likes to ?.',
  'My cat likes to ? all day.',
];
const VERB_WORDS: WordBank = ['run', 'fly', 'sleep', 'swim', 'crawl', 'nap'];

/** The frame at index `i` of `frames`, as an expression string literal. */
const FRAME_TEXT = (frames: readonly string[], i: Expr): Expr =>
  frames
    .slice(0, -1)
    .reduceRight(
      (rest, frame, index) => `${i} == ${index} ? '${frame}' : ${rest}`,
      `'${frames[frames.length - 1]}'`,
    );

export const yearK: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Letters and sounds
  // -------------------------------------------------------------------
  {
    id: 'english.K.letters-and-sounds.starts-with',
    subject: 'english',
    topic: 'letters and sounds',
    level: 'K',
    prompt: 'Which letter does {word} start with?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '7' },
      { name: 'd1', kind: 'int', min: '1', max: '7' },
      { name: 'd2', kind: 'int', min: '1', max: '7' },
      { name: 'word', kind: 'expr', expr: wordFrom(START_WORDS, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(START_LETTERS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(START_LETTERS, '(i + d1) % 8'), wordFrom(START_LETTERS, '(i + d2) % 8')],
    },
    hint: 'Say the word slowly. What sound do you hear first?',
    tags: ['AC9EFLY10', 'ENE-PHOKW-01'],
  },
  {
    id: 'english.K.letters-and-sounds.ends-with',
    subject: 'english',
    topic: 'letters and sounds',
    level: 'K',
    prompt: 'Which letter does {word} end with?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '7' },
      { name: 'd1', kind: 'int', min: '1', max: '7' },
      { name: 'd2', kind: 'int', min: '1', max: '7' },
      { name: 'word', kind: 'expr', expr: wordFrom(END_WORDS, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(END_LETTERS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(END_LETTERS, '(i + d1) % 8'), wordFrom(END_LETTERS, '(i + d2) % 8')],
    },
    hint: 'Say the word slowly. What sound do you hear last?',
    tags: ['AC9EFLY10', 'ENE-PHOKW-01'],
  },
  {
    id: 'english.K.letters-and-sounds.middle-sound',
    subject: 'english',
    topic: 'letters and sounds',
    level: 'K',
    prompt: 'Which letter says the middle sound in {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'word', kind: 'expr', expr: wordFrom(MIDDLE_WORDS, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(MIDDLE_LETTERS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(MIDDLE_LETTERS, '(i + d1) % 5'), wordFrom(MIDDLE_LETTERS, '(i + d2) % 5')],
    },
    hint: 'Stretch the word out. What sound is in the middle?',
    tags: ['AC9EFLY10', 'ENE-PHOKW-01'],
  },
  {
    id: 'english.K.letters-and-sounds.find-letter',
    subject: 'english',
    topic: 'letters and sounds',
    level: 'K',
    prompt: 'Which one is the letter {target}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '7' },
      { name: 'd1', kind: 'int', min: '1', max: '7' },
      { name: 'd2', kind: 'int', min: '1', max: '7' },
      { name: 'target', kind: 'expr', expr: wordFrom(ALPHABET, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(ALPHABET, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(ALPHABET, '(i + d1) % 8'), wordFrom(ALPHABET, '(i + d2) % 8')],
    },
    hint: 'Look for the shape of that letter.',
    tags: ['AC9EFLY13', 'ENE-PHOKW-01'],
  },
  {
    id: 'english.K.letters-and-sounds.word-for-sound',
    subject: 'english',
    topic: 'letters and sounds',
    level: 'K',
    prompt: 'Which word starts with the same sound as {letter}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '7' },
      { name: 'd1', kind: 'int', min: '1', max: '7' },
      { name: 'd2', kind: 'int', min: '1', max: '7' },
      { name: 'letter', kind: 'expr', expr: wordFrom(START_LETTERS, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(START_WORDS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(START_WORDS, '(i + d1) % 8'), wordFrom(START_WORDS, '(i + d2) % 8')],
    },
    hint: 'Say each word out loud and listen to the first sound.',
    tags: ['AC9EFLY13', 'ENE-PHOKW-01'],
  },

  // -------------------------------------------------------------------
  // Rhyme
  // -------------------------------------------------------------------
  {
    id: 'english.K.rhyme.which-rhymes',
    subject: 'english',
    topic: 'rhyme',
    level: 'K',
    prompt: 'Which word rhymes with {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('(f + d1) % 4', 't'), RHYME_WORD('(f + d2) % 4', 'a')],
    },
    hint: 'Say the words out loud. Rhyming words end with the same sound.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.rhyme.finish-the-rhyme',
    subject: 'english',
    topic: 'rhyme',
    level: 'K',
    prompt: 'Finish the rhyme: {target} and ?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('(f + d1) % 4', 't'), RHYME_WORD('(f + d2) % 4', 'a')],
    },
    hint: 'Think of a word that ends with the same sound as {target}.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.rhyme.not-rhyme',
    subject: 'english',
    topic: 'rhyme',
    level: 'K',
    prompt: 'Which word does NOT rhyme with {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'g', kind: 'int', min: '1', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '0', max: '3' },
      { name: 'd2', kind: 'int', min: '0', max: '3' },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('(f + g) % 4', 'a') },
    ],
    // The two distractors are rhyming words from the target's own family,
    // different indices so the two buttons cannot coincide with each other or
    // with the target itself.
    constraints: ['d1 != t', 'd2 != t', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('f', 'd1'), RHYME_WORD('f', 'd2')],
    },
    hint: 'Two of these sound the same at the end. Find the one that sounds different.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.rhyme.pick-of-two',
    subject: 'english',
    topic: 'rhyme',
    level: 'K',
    prompt: 'Which word rhymes with {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'g', kind: 'int', min: '1', max: '3' },
      { name: 'b', kind: 'int', min: '0', max: '3' },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['t != a'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [RHYME_WORD('(f + g) % 4', 'b')],
    },
    hint: 'Say the words out loud.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },

  // -------------------------------------------------------------------
  // Syllables
  // -------------------------------------------------------------------
  {
    id: 'english.K.syllables.count-claps',
    subject: 'english',
    topic: 'syllables',
    level: 'K',
    prompt: 'How many claps are in {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '11' },
      { name: 'word', kind: 'expr', expr: wordFrom(SYLLABLE_WORDS, 'i') },
    ],
    answer: syllableCount('i'),
    hint: 'Clap once for each part of the word.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.syllables.count-parts',
    subject: 'english',
    topic: 'syllables',
    level: 'K',
    prompt: 'Break {word} into parts. How many parts does it have?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '11' },
      { name: 'word', kind: 'expr', expr: wordFrom(SYLLABLE_WORDS, 'i') },
    ],
    answer: syllableCount('i'),
    hint: 'Say the word slowly and count the beats.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.syllables.which-has-n',
    subject: 'english',
    topic: 'syllables',
    level: 'K',
    prompt: 'Which word has {n} claps?',
    vars: [
      { name: 'fam', kind: 'int', min: '0', max: '2' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 't1', kind: 'int', min: '0', max: '3' },
      { name: 't2', kind: 'int', min: '0', max: '3' },
      { name: 'n', kind: 'expr', expr: 'fam + 1' },
      { name: 'answer', kind: 'expr', expr: SYLLABLE_WORD('fam', 'a') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYLLABLE_WORD('(fam + 1) % 3', 't1'), SYLLABLE_WORD('(fam + 2) % 3', 't2')],
    },
    hint: 'Clap each word out to count its parts.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },
  {
    id: 'english.K.syllables.odd-clap-count',
    subject: 'english',
    topic: 'syllables',
    level: 'K',
    prompt: 'Which word does NOT have {n} claps?',
    vars: [
      // `nFam` names the clap-count the question asks about; the two
      // distractors are two *different* words that genuinely have that many
      // claps, drawn by index so they are not always the same two words, and
      // the answer comes from a different, randomly offset family - the same
      // shape as `rhyme.not-rhyme`, and for the same reason: fixing the
      // distractors to two literal indices would make the option set itself
      // (rather than the child's counting) decide the answer.
      { name: 'nFam', kind: 'int', min: '0', max: '2' },
      { name: 'd1', kind: 'int', min: '0', max: '3' },
      { name: 'd2', kind: 'int', min: '0', max: '3' },
      { name: 'g', kind: 'int', min: '1', max: '2' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'n', kind: 'expr', expr: 'nFam + 1' },
      { name: 'answer', kind: 'expr', expr: SYLLABLE_WORD('(nFam + g) % 3', 'a') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYLLABLE_WORD('nFam', 'd1'), SYLLABLE_WORD('nFam', 'd2')],
    },
    hint: 'Clap each word. Two of them have the same number of parts.',
    tags: ['AC9EFLY09', 'ENE-PHOAW-01'],
  },

  // -------------------------------------------------------------------
  // Opposites
  // -------------------------------------------------------------------
  {
    id: 'english.K.opposites.which-opposite',
    subject: 'english',
    topic: 'opposites',
    level: 'K',
    prompt: 'What is the opposite of {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: OPPOSITE_WORD('p', '1 - s') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [OPPOSITE_WORD('(p + d1) % 6', 's2'), OPPOSITE_WORD('(p + d2) % 6', 's3')],
    },
    hint: 'An opposite means the total reverse.',
    tags: ['AC9EFLA08', 'ENE-VOCAB-01'],
  },
  {
    id: 'english.K.opposites.opposite-of-two',
    subject: 'english',
    topic: 'opposites',
    level: 'K',
    prompt: 'Which word means the opposite of {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd', kind: 'int', min: '1', max: '5' },
      { name: 'sw', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: OPPOSITE_WORD('p', '1 - s') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [OPPOSITE_WORD('(p + d) % 6', 'sw')],
    },
    hint: 'Think of the total opposite of {target}.',
    tags: ['AC9EFLA08', 'ENE-VOCAB-01'],
  },
  {
    id: 'english.K.opposites.fill-in-opposite',
    subject: 'english',
    topic: 'opposites',
    level: 'K',
    prompt: 'Finish it: {target} and ? are opposites.',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: OPPOSITE_WORD('p', '1 - s') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [OPPOSITE_WORD('(p + d1) % 6', 's2'), OPPOSITE_WORD('(p + d2) % 6', 's3')],
    },
    hint: 'The missing word means the total reverse of {target}.',
    tags: ['AC9EFLA08', 'ENE-VOCAB-01'],
  },
  {
    id: 'english.K.opposites.worked-example',
    subject: 'english',
    topic: 'opposites',
    level: 'K',
    prompt: '{eTarget} and {eAnswer} are opposites. What is the opposite of {target}?',
    vars: [
      { name: 'ep', kind: 'int', min: '0', max: '5' },
      { name: 'es', kind: 'pick', from: [0, 1] },
      { name: 'p', kind: 'int', min: '1', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'eTarget', kind: 'expr', expr: OPPOSITE_WORD('ep', 'es') },
      { name: 'eAnswer', kind: 'expr', expr: OPPOSITE_WORD('ep', '1 - es') },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('(ep + p) % 6', 's') },
      { name: 'answer', kind: 'expr', expr: OPPOSITE_WORD('(ep + p) % 6', '1 - s') },
    ],
    constraints: ['d1 != d2', 'd1 != p', 'd2 != p'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        OPPOSITE_WORD('(ep + d1) % 6', 's2'),
        OPPOSITE_WORD('(ep + d2) % 6', 's3'),
      ],
    },
    hint: 'Use the example to see what "opposite" means.',
    tags: ['AC9EFLA08', 'ENE-VOCAB-01'],
  },

  // -------------------------------------------------------------------
  // Sentences
  // -------------------------------------------------------------------
  {
    id: 'english.K.sentences.starts-with-capital',
    subject: 'english',
    topic: 'sentences',
    level: 'K',
    prompt: 'Does this sentence start correctly? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: PAIR_TEXT(CAPITAL_SENTENCES, 'i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: 'A sentence always starts with a capital letter.',
    tags: ['AC9EFLA09', 'ENE-CWT-01'],
  },
  {
    id: 'english.K.sentences.ends-with-full-stop',
    subject: 'english',
    topic: 'sentences',
    level: 'K',
    prompt: 'Does this sentence end correctly? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: PAIR_TEXT(FULL_STOP_SENTENCES, 'i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: 'A telling sentence ends with a full stop.',
    tags: ['AC9EFLA09', 'ENE-CWT-01'],
  },
  {
    id: 'english.K.sentences.is-a-sentence',
    subject: 'english',
    topic: 'sentences',
    level: 'K',
    prompt: 'Is this a whole sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: PAIR_TEXT(FRAGMENT_SENTENCES, 'i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: 'A whole sentence tells a complete idea.',
    tags: ['AC9EFLA09', 'ENE-CWT-01'],
  },
  {
    id: 'english.K.sentences.complete-with-noun',
    subject: 'english',
    topic: 'sentences',
    level: 'K',
    prompt: 'Which word finishes the sentence? {frame}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'frame', kind: 'expr', expr: FRAME_TEXT(NOUN_FRAMES, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(NOUN_WORDS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(NOUN_WORDS, '(i + d1) % 6'), wordFrom(NOUN_WORDS, '(i + d2) % 6')],
    },
    hint: 'Read the sentence and see which word makes sense.',
    tags: ['AC9EFLA09', 'ENE-CWT-01'],
  },
  {
    id: 'english.K.sentences.complete-with-verb',
    subject: 'english',
    topic: 'sentences',
    level: 'K',
    prompt: 'Which word finishes the sentence? {frame}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'frame', kind: 'expr', expr: FRAME_TEXT(VERB_FRAMES, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(VERB_WORDS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(VERB_WORDS, '(i + d1) % 6'), wordFrom(VERB_WORDS, '(i + d2) % 6')],
    },
    hint: 'Read the sentence and see which word makes sense.',
    tags: ['AC9EFLA09', 'ENE-CWT-01'],
  },
];
