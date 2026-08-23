import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 2 - NSW Stage 1.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Year 2 is still Stage 1** - Stage 1 spans Years 1 and 2 - so every NSW
 * code here is an `EN1-` code Year 1 also carries. That is the syllabus
 * working as written, not a citation copied lazily: `stageForLevel('2')` is
 * `S1`, the same stage `stageForLevel('1')` returns.
 *
 * **Plurals, past tense and compound words each get a typed pair.** A typed
 * question is the cheapest way to author a leak-proof template - there is no
 * option set for a rule to hide in - but concentrating it in one topic lets a
 * child who is secure there stop typing for the rest of the year. Five of
 * twenty-two templates generate a typed answer here, across those three
 * topics, comfortably inside the 15%-40% band.
 *
 * **Plurals steps past Year 1's bare -s/-es onto two rules that change the
 * base word itself**: consonant-plus-y becomes -ies, and words ending in a
 * bare f become -ves. Both are built from a stem *without* the final letter
 * that changes, because the expression language only concatenates - it
 * cannot drop a letter off a bound string - so `STEM + 'y'` builds the
 * singular and `STEM + 'ies'` builds the plural from the one value that never
 * changes.
 *
 * **Past tense is one rule, `-ed`, on verbs whose ending never doubles**
 * (`jump`, `walk`, `play`, `look`, `call`, `wash`) - doubling is Year 3's
 * content, and mixing it in here would make the question "which rule
 * applies" rather than "add -ed".
 *
 * **Word classes adds describing words to Year 1's naming/doing pair, and
 * reuses Year 1's fix for the same reason it existed**: a noun bank and a verb
 * bank cannot share values, so a three-way split into naming, doing and
 * describing words is `propertyIsTheQuestion`'s shape three times over. The
 * fix is the one `1.ts` already found - one three-word sentence carries all
 * three roles, and which role is asked for is chosen after the sentence is
 * built, so the same three buttons come with three different right answers
 * across draws. `name-the-word-type` runs the same trick with no sentence at
 * all: the three labels ("naming word", "doing word", "describing word") are
 * the *only* three buttons that ever appear, on every single draw, and that
 * is safe rather than an anchor precisely because which label is correct is
 * drawn uniformly - a fixed option set with a moving answer is the shape the
 * closed-set check exists to let through, not the shape it exists to catch.
 *
 * **Punctuation keeps the same three marks doing every job.** `.`, `?` and
 * `!` are the whole answer space for both templates that offer a choice, and
 * each is the correct answer on some draws and a wrong one on others -
 * exactly the overlap that keeps a closed three-item set from being a fixed
 * button to memorise.
 */

// ---------------------------------------------------------------------------
// Plurals
//
// Year 1 covered the bare -s/-es split; Year 2 moves to the two rules that
// change the base word itself. Both are built from a stem missing the letter
// the rule replaces, because `word + 'es'` only ever appends - it cannot turn
// a `y` into an `i`. `STEM + 'y'` is the word shown in the prompt and
// `STEM + 'ies'` is the typed answer, so the one stored value drives both and
// there is nothing for the two to drift apart on.
// ---------------------------------------------------------------------------

// Every stem here takes a consonant before the missing `y`, so every one
// takes -ies rather than a bare -s - mixing in `toy` or `boy` (vowel before
// the y) would need the rule as a second expression.
const Y_STEMS: WordBank = ['bab', 'cit', 'lad', 'part', 'pupp', 'famil'];

// Every stem here ends in a bare f (not fe), so every one takes -ves.
const F_STEMS: WordBank = ['lea', 'loa', 'shel', 'wol', 'scar', 'cal'];

// Whole-word banks for the two recognition templates below, index-aligned
// singular to plural. Mixed rules on purpose - recognising a correct plural
// does not require deriving it, so these draw on the wider vocabulary a
// recognition question can afford.
const PLURAL_BASE2: WordBank = ['baby', 'city', 'lady', 'leaf', 'wolf', 'shelf'];
const PLURAL_FORM2: WordBank = ['babies', 'cities', 'ladies', 'leaves', 'wolves', 'shelves'];

// ---------------------------------------------------------------------------
// Past tense
//
// One rule, `-ed`, on regular verbs whose ending never doubles - doubling is
// Year 3's content, and mixing it in here would make the question "which
// rule applies" rather than "add -ed".
// ---------------------------------------------------------------------------

const PAST_VERBS: WordBank = ['jump', 'walk', 'play', 'look', 'call', 'wash'];

/** The `-ed` form of the verb at `i`, as an expression. */
const PAST_FORM_AT = (i: Expr): Expr => `(${wordFrom(PAST_VERBS, i)}) + 'ed'`;

// ---------------------------------------------------------------------------
// Compound words
//
// Two whole-word halves per compound, concatenated rather than stored as a
// third bank - `word1 + word2` is what the answer already has to compute, so
// a separate `COMPOUND_FULL` list would only be a second name for the same
// value, free to drift from it.
// ---------------------------------------------------------------------------

const COMPOUND_WORD1: WordBank = ['cup', 'sun', 'foot', 'rain', 'tooth', 'bed'];
const COMPOUND_WORD2: WordBank = ['cake', 'flower', 'ball', 'bow', 'brush', 'room'];

/** The whole compound at `i` - `word1` joined to `word2` - as an expression. */
const COMPOUND_AT = (i: Expr): Expr =>
  `(${wordFrom(COMPOUND_WORD1, i)}) + (${wordFrom(COMPOUND_WORD2, i)})`;

// ---------------------------------------------------------------------------
// Word classes
//
// One three-word sentence carries a naming word, a doing word and a
// describing word at once, so asking about any one of the three offers the
// same three buttons whichever question was asked - the fix `1.ts` already
// found, extended from two roles to three. Read aloud on its own: a big dog
// running, a small cat jumping, a happy bird singing, a fast horse
// galloping, a funny monkey climbing, a little mouse hiding.
// ---------------------------------------------------------------------------

const SCENE_ADJ: WordBank = ['big', 'small', 'happy', 'fast', 'funny', 'little'];
const SCENE_NOUN: WordBank = ['dog', 'cat', 'bird', 'horse', 'monkey', 'mouse'];
const SCENE_VERB: WordBank = ['run', 'jump', 'sing', 'gallop', 'climb', 'hide'];

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

// Flat adjective-or-not bank for `is-adjective`: adjectives first, then eight
// nouns and verbs, so a truthful answer is exactly "the index is under 8".
// A fresh set from the scene triples above, so the two templates don't teach
// each other's words as a side effect of testing different things.
const ADJ_WORDS: WordBank = ['loud', 'quiet', 'tall', 'short', 'soft', 'bright', 'gentle', 'brave'];
const NON_ADJ_WORDS: WordBank = [
  'table',
  'chair',
  'apple',
  'swim',
  'read',
  'write',
  'window',
  'pencil',
];
const ADJ_FLAT: WordBank = [...ADJ_WORDS, ...NON_ADJ_WORDS];

// Flat doing-word-or-not bank for `is-doing-word`, on the same shape as Year
// 1's version but a fresh set of words - a mix of nouns and adjectives on the
// "not" side, so the question is "is this a doing word" and not "is this a
// noun", which a pure noun/verb bank would let a child answer by process of
// elimination alone.
const VERB_WORDS2: WordBank = ['skip', 'dance', 'draw', 'paint', 'laugh', 'clap', 'shout', 'crawl'];
const NON_VERB_WORDS2: WordBank = [
  'kite',
  'boat',
  'shiny',
  'cold',
  'basket',
  'sharp',
  'garden',
  'quick',
];
const VERB_FLAT: WordBank = [...VERB_WORDS2, ...NON_VERB_WORDS2];

// ---------------------------------------------------------------------------
// Punctuation
//
// Every sentence here cycles through the same three endings in order, so
// `i % 3` is which mark it needs - a full stop, a question mark, then an
// exclamation mark, twice over. `MARK_AT` turns that index into the glyph
// itself, and every template below offers the same three glyphs as its whole
// option set, so no button is ever only ever the answer or only ever a
// distractor.
// ---------------------------------------------------------------------------

const PUNCT_SENTENCES: readonly string[] = [
  'I like ice cream',
  'What is your name',
  'That is amazing',
  'The sun is hot',
  'Where do you live',
  'Watch out',
];

/** The literal sentence at index `i` of `PUNCT_SENTENCES`, as an expression. */
const PUNCT_SENTENCE_AT = (i: Expr): Expr =>
  PUNCT_SENTENCES.slice(0, -1).reduceRight(
    (rest, sentence, index) => `${i} == ${index} ? '${sentence}' : ${rest}`,
    `'${PUNCT_SENTENCES[PUNCT_SENTENCES.length - 1]}'`,
  );

/** The mark at index `i` (0 = full stop, 1 = question mark, 2 = exclamation mark), as an expression. */
const MARK_AT = (i: Expr): Expr => `${i} == 0 ? '.' : (${i} == 1 ? '?' : '!')`;

/** "telling", "asking" or "exciting", chosen by `k` (0, 1 or 2), as an expression. */
const KIND_LABEL_AT = (k: Expr): Expr => `${k} == 0 ? 'telling' : (${k} == 1 ? 'asking' : 'exciting')`;

// "asking" and "exciting" both start with a vowel sound, so only "telling"
// takes "a" - the same a/an judgment Year 1's sentences topic already makes.
const KIND_ARTICLE_AT = (k: Expr): Expr => `${k} == 0 ? 'a' : 'an'`;

const PUNCT_STATEMENTS: readonly string[] = [
  'The dog is asleep',
  'My bag is red',
  'The classroom is quiet',
];
const PUNCT_QUESTIONS: readonly string[] = [
  'Is the dog asleep',
  'What colour is your bag',
  'Can we go outside',
];

/** The literal string at index `i` of `list`, as an expression. */
const TEXT_AT = (list: readonly string[], i: Expr): Expr =>
  list
    .slice(0, -1)
    .reduceRight(
      (rest, text, index) => `${i} == ${index} ? '${text}' : ${rest}`,
      `'${list[list.length - 1]}'`,
    );

// ---------------------------------------------------------------------------
// Synonyms
//
// The same family/index scaffold Year 1's opposites use, applied to pairs
// that mean the same thing rather than the reverse - `SYN_A`/`SYN_B` are
// interchangeable exactly as `OPP_A`/`OPP_B` are, so either side of a pair can
// be the target and the other the answer.
// ---------------------------------------------------------------------------

const SYN_A: WordBank = ['happy', 'big', 'small', 'quick', 'sad', 'scared'];
const SYN_B: WordBank = ['glad', 'large', 'little', 'fast', 'unhappy', 'afraid'];

/** The word at pair `p`, on side `s` (0 for `SYN_A`, 1 for `SYN_B`), as an expression. */
const SYNONYM_WORD = (p: Expr, s: Expr): Expr =>
  `${s} == 0 ? (${wordFrom(SYN_A, p)}) : (${wordFrom(SYN_B, p)})`;

export const year2: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Plurals
  // -------------------------------------------------------------------
  {
    id: 'english.2.plurals.add-ies',
    subject: 'english',
    topic: 'plurals',
    level: '2',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'stem', kind: 'expr', expr: wordFrom(Y_STEMS, 'i') },
      { name: 'word', kind: 'expr', expr: "stem + 'y'" },
    ],
    // Every stem takes a consonant before the y, so every one swaps y for
    // -ies rather than adding a bare -s.
    answer: "stem + 'ies'",
    answerType: 'text',
    hint: 'Change the y to an i and add -es.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.plurals.add-ves',
    subject: 'english',
    topic: 'plurals',
    level: '2',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'stem', kind: 'expr', expr: wordFrom(F_STEMS, 'i') },
      { name: 'word', kind: 'expr', expr: "stem + 'f'" },
    ],
    // Every stem here ends in a bare f (not fe), so every one swaps f for
    // -ves rather than adding a bare -s.
    answer: "stem + 'ves'",
    answerType: 'text',
    hint: 'Change the f to v and add -es.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.plurals.which-is-plural',
    subject: 'english',
    topic: 'plurals',
    level: '2',
    prompt: 'Which word means more than one {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_BASE2, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_FORM2, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        wordFrom(PLURAL_FORM2, '(i + d1) % 6'),
        wordFrom(PLURAL_FORM2, '(i + d2) % 6'),
      ],
    },
    hint: 'A plural word means more than one.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.plurals.which-is-singular',
    subject: 'english',
    topic: 'plurals',
    level: '2',
    prompt: 'Which word means just one, if {form} means more than one?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'form', kind: 'expr', expr: wordFrom(PLURAL_FORM2, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_BASE2, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        wordFrom(PLURAL_BASE2, '(i + d1) % 6'),
        wordFrom(PLURAL_BASE2, '(i + d2) % 6'),
      ],
    },
    hint: 'Take away the plural ending to find just one.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Past tense
  // -------------------------------------------------------------------
  {
    id: 'english.2.past-tense.write-past-tense',
    subject: 'english',
    topic: 'past tense',
    level: '2',
    prompt: 'Write the past tense of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PAST_VERBS, 'i') },
    ],
    answer: "word + 'ed'",
    answerType: 'text',
    hint: 'Add -ed to show it already happened.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.past-tense.which-is-past-tense',
    subject: 'english',
    topic: 'past tense',
    level: '2',
    prompt: 'Which word means {word} already happened?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PAST_VERBS, 'i') },
      { name: 'answer', kind: 'expr', expr: PAST_FORM_AT('i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [PAST_FORM_AT('(i + d1) % 6'), PAST_FORM_AT('(i + d2) % 6')],
    },
    hint: 'Add -ed to the word to make it past tense.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.past-tense.which-is-present',
    subject: 'english',
    topic: 'past tense',
    level: '2',
    prompt: 'Which word means this is happening now, if {form} means it already happened?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'form', kind: 'expr', expr: PAST_FORM_AT('i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PAST_VERBS, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(PAST_VERBS, '(i + d1) % 6'), wordFrom(PAST_VERBS, '(i + d2) % 6')],
    },
    hint: 'Take away the -ed to find the word for right now.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.past-tense.worked-example',
    subject: 'english',
    topic: 'past tense',
    level: '2',
    prompt: '{eWord} became {eForm} yesterday. Which word means {word} already happened?',
    vars: [
      { name: 'ei', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '1', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'eWord', kind: 'expr', expr: wordFrom(PAST_VERBS, 'ei') },
      { name: 'eForm', kind: 'expr', expr: PAST_FORM_AT('ei') },
      { name: 'word', kind: 'expr', expr: wordFrom(PAST_VERBS, '(ei + i) % 6') },
      { name: 'answer', kind: 'expr', expr: PAST_FORM_AT('(ei + i) % 6') },
    ],
    constraints: ['d1 != d2', 'd1 != i', 'd2 != i'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [PAST_FORM_AT('(ei + d1) % 6'), PAST_FORM_AT('(ei + d2) % 6')],
    },
    hint: 'Use the example to see how -ed is added.',
    tags: ['AC9E2LY12', 'EN1-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Compound words
  // -------------------------------------------------------------------
  {
    id: 'english.2.compound-words.combine',
    subject: 'english',
    topic: 'compound words',
    level: '2',
    prompt: 'What word do you get from {word1} and {word2}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word1', kind: 'expr', expr: wordFrom(COMPOUND_WORD1, 'i') },
      { name: 'word2', kind: 'expr', expr: wordFrom(COMPOUND_WORD2, 'i') },
    ],
    answer: 'word1 + word2',
    answerType: 'text',
    hint: 'Join the two words together, with nothing in between.',
    tags: ['AC9E2LY11', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.compound-words.find-missing-part',
    subject: 'english',
    topic: 'compound words',
    level: '2',
    prompt: '{frame}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'blankFirst', kind: 'pick', from: [0, 1] },
      { name: 'word1', kind: 'expr', expr: wordFrom(COMPOUND_WORD1, 'i') },
      { name: 'word2', kind: 'expr', expr: wordFrom(COMPOUND_WORD2, 'i') },
      { name: 'full', kind: 'expr', expr: 'word1 + word2' },
      {
        name: 'frame',
        kind: 'expr',
        expr:
          "blankFirst == 1 ? ('? and ' + word2 + ' make ' + full + '.') : " +
          "(word1 + ' and ? make ' + full + '.')",
      },
      { name: 'answer', kind: 'expr', expr: 'blankFirst == 1 ? word1 : word2' },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Say the whole word out loud and listen for the missing part.',
    tags: ['AC9E2LY11', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.compound-words.which-is-compound',
    subject: 'english',
    topic: 'compound words',
    level: '2',
    prompt: 'Which word is made by joining {word1} and {word2}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word1', kind: 'expr', expr: wordFrom(COMPOUND_WORD1, 'i') },
      { name: 'word2', kind: 'expr', expr: wordFrom(COMPOUND_WORD2, 'i') },
      { name: 'answer', kind: 'expr', expr: COMPOUND_AT('i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [COMPOUND_AT('(i + d1) % 6'), COMPOUND_AT('(i + d2) % 6')],
    },
    hint: 'Put the two words together to make one word.',
    tags: ['AC9E2LY11', 'EN1-SPELL-01'],
  },
  {
    id: 'english.2.compound-words.which-word-completes',
    subject: 'english',
    topic: 'compound words',
    level: '2',
    prompt: 'Which word goes with {word1} to make {full}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word1', kind: 'expr', expr: wordFrom(COMPOUND_WORD1, 'i') },
      { name: 'full', kind: 'expr', expr: COMPOUND_AT('i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(COMPOUND_WORD2, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(COMPOUND_WORD2, '(i + d1) % 6'), wordFrom(COMPOUND_WORD2, '(i + d2) % 6')],
    },
    hint: 'Think about what word finishes {full}.',
    tags: ['AC9E2LY11', 'EN1-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Word classes
  // -------------------------------------------------------------------
  {
    id: 'english.2.word-classes.identify-in-sentence',
    subject: 'english',
    topic: 'word classes',
    level: '2',
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
    tags: ['AC9E2LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.2.word-classes.name-the-word-type',
    subject: 'english',
    topic: 'word classes',
    level: '2',
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
    tags: ['AC9E2LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.2.word-classes.is-adjective',
    subject: 'english',
    topic: 'word classes',
    level: '2',
    prompt: 'Is {word} a describing word?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '15' },
      { name: 'word', kind: 'expr', expr: wordFrom(ADJ_FLAT, 'i') },
    ],
    answer: 'i < 8',
    hint: 'A describing word tells you what something is like.',
    tags: ['AC9E2LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.2.word-classes.is-doing-word',
    subject: 'english',
    topic: 'word classes',
    level: '2',
    prompt: 'Is {word} a doing word?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '15' },
      { name: 'word', kind: 'expr', expr: wordFrom(VERB_FLAT, 'i') },
    ],
    answer: 'i < 8',
    hint: 'A doing word tells you what someone or something does.',
    tags: ['AC9E2LA07', 'EN1-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Punctuation
  // -------------------------------------------------------------------
  {
    id: 'english.2.punctuation.which-mark',
    subject: 'english',
    topic: 'punctuation',
    level: '2',
    prompt: 'Which mark finishes this sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'sentence', kind: 'expr', expr: PUNCT_SENTENCE_AT('i') },
      { name: 'markIdx', kind: 'expr', expr: 'i % 3' },
      { name: 'answer', kind: 'expr', expr: MARK_AT('markIdx') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [MARK_AT('(markIdx + 1) % 3'), MARK_AT('(markIdx + 2) % 3')],
    },
    hint: 'A telling sentence ends with a full stop, a question ends with a question mark, and an exciting sentence ends with an exclamation mark.',
    tags: ['AC9E2LY06', 'EN1-CWT-01'],
  },
  {
    id: 'english.2.punctuation.name-the-mark',
    subject: 'english',
    topic: 'punctuation',
    level: '2',
    prompt: 'Which mark ends {article} {kind} sentence?',
    vars: [
      { name: 'k', kind: 'pick', from: [0, 1, 2] },
      { name: 'kind', kind: 'expr', expr: KIND_LABEL_AT('k') },
      { name: 'article', kind: 'expr', expr: KIND_ARTICLE_AT('k') },
      { name: 'answer', kind: 'expr', expr: MARK_AT('k') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [MARK_AT('(k + 1) % 3'), MARK_AT('(k + 2) % 3')],
    },
    hint: 'A full stop ends telling sentences, a question mark ends asking sentences, and an exclamation mark ends exciting sentences.',
    tags: ['AC9E2LY06', 'EN1-CWT-01'],
  },
  {
    id: 'english.2.punctuation.is-question',
    subject: 'english',
    topic: 'punctuation',
    level: '2',
    prompt: 'Does this sentence need a question mark? {sentence}',
    vars: [
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'j', kind: 'int', min: '0', max: '2' },
      {
        name: 'sentence',
        kind: 'expr',
        expr: `ok == 1 ? (${TEXT_AT(PUNCT_QUESTIONS, 'j')}) : (${TEXT_AT(PUNCT_STATEMENTS, 'j')})`,
      },
    ],
    answer: 'ok == 1',
    hint: 'A question mark comes at the end of a sentence that asks something.',
    tags: ['AC9E2LY06', 'EN1-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Synonyms
  // -------------------------------------------------------------------
  {
    id: 'english.2.synonyms.which-synonym',
    subject: 'english',
    topic: 'synonyms',
    level: '2',
    prompt: 'Which word means the same as {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 's2', kind: 'pick', from: [0, 1] },
      { name: 's3', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: SYNONYM_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM_WORD('p', '1 - s') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYNONYM_WORD('(p + d1) % 6', 's2'), SYNONYM_WORD('(p + d2) % 6', 's3')],
    },
    hint: 'A synonym means almost the same thing.',
    tags: ['AC9E2LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.2.synonyms.worked-example',
    subject: 'english',
    topic: 'synonyms',
    level: '2',
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
      { name: 'eTarget', kind: 'expr', expr: SYNONYM_WORD('ep', 'es') },
      { name: 'eAnswer', kind: 'expr', expr: SYNONYM_WORD('ep', '1 - es') },
      { name: 'target', kind: 'expr', expr: SYNONYM_WORD('(ep + p) % 6', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM_WORD('(ep + p) % 6', '1 - s') },
    ],
    constraints: ['d1 != d2', 'd1 != p', 'd2 != p'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [SYNONYM_WORD('(ep + d1) % 6', 's2'), SYNONYM_WORD('(ep + d2) % 6', 's3')],
    },
    hint: 'Use the example to see what "means the same" looks like.',
    tags: ['AC9E2LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.2.synonyms.two-choices',
    subject: 'english',
    topic: 'synonyms',
    level: '2',
    prompt: 'Which word means the same as {target}?',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'd', kind: 'int', min: '1', max: '5' },
      { name: 'sw', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: SYNONYM_WORD('p', 's') },
      { name: 'answer', kind: 'expr', expr: SYNONYM_WORD('p', '1 - s') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [SYNONYM_WORD('(p + d) % 6', 'sw')],
    },
    hint: 'Think of a word that means the same as {target}.',
    tags: ['AC9E2LA09', 'EN1-VOCAB-01'],
  },
];
