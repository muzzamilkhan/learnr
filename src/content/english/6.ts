import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 6 - NSW Stage 3, and the last of the seven content years.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Year 6 is Stage 3, the same stage Year 5 carries**, so every NSW code
 * here is an `EN3-` code. Only four `EN3-` codes are confirmed against
 * NESA's own pages at all - `EN3-VOCAB-01`, `EN3-SPELL-01`, `EN3-UARL-01`
 * and `EN3-CWT-01` - and this file cites three of them, matching the topic
 * table this task was given: `EN3-SPELL-01` (word roots, spelling patterns),
 * `EN3-CWT-01` (word classes, punctuation) and `EN3-UARL-01` (figurative
 * language). No other `EN3-` code is cited, because no other one has been
 * confirmed, and a Stage 3 code sitting on both a Year 5 and a Year 6
 * template is the syllabus working as written, not a duplicate.
 *
 * **Word roots moves from Year 5's general Latin morphology to the specific
 * Latin and Greek roots `AC9E6LY09` names** - `port` (carry), `graph`
 * (write), `aqua` (water), `tele` (far), `scrib` (write) and `dict` (say) -
 * over new derived words, so the year is not a reskin of the six roots
 * Year 5 already drew from. Two of those six roots share a meaning
 * (`graph` and `scrib` both mean "write"), which is a genuine fact about
 * Latin and Greek and not an authoring accident, but it rules out any
 * question that goes from a *meaning* to a *root*: "which root means to
 * write?" would have two correct answers the moment both showed up as
 * options, the same dual-answer failure a frame admitting two words from
 * its own bank already is. So every choice or typed question here goes the
 * other way - from a named word or a named root to the fact about it - and
 * only `root-meaning`, which asks what a *specific* root means, restricts
 * itself to the four roots whose meaning is unique (`port`, `aqua`, `tele`,
 * `dict`) so its distractor set never contains two options with identical
 * text. `same-root` draws its two distractor words from fresh, independent
 * indices rather than reusing the target's or the answer's own index inside
 * the offset family - measured at a few thousand draws, reusing either (the
 * shape the rhyme worked example itself and Year 5's own `same-root` both
 * use) lets the modal answer for a given three-word option set beat blind
 * guessing by fifteen to seventeen points, a leak too small for a 600-draw
 * sample to reliably catch but real at scale. Fresh indices bring it back to
 * within a point of blind.
 *
 * **Word classes moves past Year 5's morphology entirely onto `AC9E6LA06`
 * - verbs, elaborated tenses and adverb groups** - a topic Year 5 does not
 * carry at all, so there is nothing here to compare against for reskinning.
 * Tense recognition and adverb-group recognition are kept as two separate
 * judgments rather than one boolean and one derived from it: a boolean over
 * past-versus-not would be a negation-derivable dual of `identify-tense`,
 * which already distinguishes past, present and future. `has-adverb` asks a
 * different question entirely - whether a sentence contains an adverb group
 * at all - a fact `identify-tense` says nothing about, and `which-is-adverb`
 * never tests either, since every sentence it shows already has one.
 *
 * **Figurative language widens Year 5's three devices to five**, adding
 * idiom and hyperbole as `AC9E6LA08` names, with a fresh set of twenty-five
 * example sentences rather than Year 5's fifteen reused. Five devices over
 * `MAX_CHOICES` (4) options means every choice template offers the answer
 * and three of the other four devices, never all five at once - the same
 * closed-set shape Year 5's three-device version uses, just with one device
 * left out of each individual set of buttons rather than none. `eliminate-one`
 * forces the three left-out slots into a permutation of the offsets that are
 * not the one already ruled out, so the three-device exclusion is exact
 * rather than approximate.
 *
 * **Punctuation is new to the course** - `AC9E6LA09`, commas for lists and
 * to separate clauses - and every template is `choice`, since a comma is not
 * a letter the pad can type. The category asked about - punctuated
 * correctly, missing a comma, or a comma in the wrong place - is drawn
 * uniformly rather than the answer always being "correct": an answer that
 * only ever came from the correct-sentences array, disjoint from a
 * distractor pool of only wrong sentences, is the odd-one-out failure again
 * wearing a grammar-check costume, and the measurement below caught it on
 * the first draft. Letting every category be the answer on some draws fixes
 * it the same way the five figurative-language devices fix it for
 * themselves.
 *
 * **Spelling patterns covers two generalisations `AC9E6LY08` names that
 * Year 5's `-f`/`-fe` and silent-letter patterns do not touch**: doubling
 * the final consonant before adding a suffix (`run` -> `running`) and the
 * consonant-plus-y plural (`baby` -> `babies`). Both are authored as
 * explicit word pairs rather than computed, because the expression
 * language can append a suffix but cannot double a letter or drop a `y`.
 *
 * **Four of twenty-two templates generate a typed answer, across word roots
 * and spelling patterns** - inside the 15%-40% band and spread across two
 * topics, so a child secure in one still types in the other.
 */

/** The literal string at index `i` of `list`, as an expression. */
const TEXT_AT = (list: readonly string[], i: Expr): Expr =>
  list
    .slice(0, -1)
    .reduceRight(
      (rest, text, index) => `${i} == ${index} ? "${text}" : ${rest}`,
      `"${list[list.length - 1]}"`,
    );

// ---------------------------------------------------------------------------
// Word roots
//
// Six families, the roots AC9E6LY09 names. Every question goes from a named
// word or a named root to a fact about it - never from a meaning to a root,
// since `graph` and `scrib` share a meaning and that direction would produce
// two correct answers whenever both appeared as options.
// ---------------------------------------------------------------------------

const PORT_WORDS: WordBank = ['transport', 'import', 'export', 'portable'];
const GRAPH_WORDS: WordBank = ['photograph', 'autograph', 'paragraph', 'graphic'];
const AQUA_WORDS: WordBank = ['aquarium', 'aquatic', 'aqueduct', 'aquamarine'];
const TELE_WORDS: WordBank = ['telephone', 'television', 'telescope', 'telepathy'];
const SCRIB_WORDS: WordBank = ['scribble', 'ascribe', 'inscribe', 'describe'];
const DICT_WORDS: WordBank = ['dictionary', 'dictator', 'predict', 'verdict'];

const ROOT_FAMILIES: readonly WordBank[] = [
  PORT_WORDS,
  GRAPH_WORDS,
  AQUA_WORDS,
  TELE_WORDS,
  SCRIB_WORDS,
  DICT_WORDS,
];
const ROOT_NAME: readonly string[] = ['port', 'graph', 'aqua', 'tele', 'scrib', 'dict'];
const ROOT_MEANING: readonly string[] = ['carry', 'write', 'water', 'far', 'write', 'say'];

/** The word at `index` of root family `family`, as an expression. */
const ROOT_WORD = (family: Expr, index: Expr): Expr =>
  ROOT_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(ROOT_FAMILIES[ROOT_FAMILIES.length - 1], index)})`,
  );

const ROOT_NAME_AT = (family: Expr): Expr => TEXT_AT(ROOT_NAME, family);
const ROOT_MEANING_AT = (family: Expr): Expr => TEXT_AT(ROOT_MEANING, family);

// The four roots above whose meaning is not shared with another root in this
// file - the only ones a meaning-to-root question can safely be built from.
const UNIQUE_ROOT_NAME: readonly string[] = ['port', 'aqua', 'tele', 'dict'];
const UNIQUE_ROOT_MEANING: readonly string[] = ['carry', 'water', 'far', 'say'];

// ---------------------------------------------------------------------------
// Word classes
//
// AC9E6LA06 - verbs, elaborated tenses and adverb groups. Kept as two
// separate judgments (which tense, and whether an adverb group is present)
// rather than a tense choice plus its negation as a boolean.
// ---------------------------------------------------------------------------

const TENSE_LABEL: readonly string[] = ['past', 'present', 'future'];

const TENSE_PAST: readonly string[] = [
  'The chef cooked dinner for the whole family.',
  'She had finished her homework before dinner.',
  'The dog was barking loudly all morning.',
  'They walked to the park after school.',
];
const TENSE_PRESENT: readonly string[] = [
  'The chef cooks dinner for the whole family.',
  'She is finishing her homework before dinner.',
  'The dog barks loudly every morning.',
  'They walk to the park after school.',
];
const TENSE_FUTURE: readonly string[] = [
  'The chef will cook dinner for the whole family.',
  'She will finish her homework before dinner.',
  'The dog will bark loudly tomorrow morning.',
  'They will walk to the park after school.',
];
const TENSE_FAMILIES: readonly (readonly string[])[] = [TENSE_PAST, TENSE_PRESENT, TENSE_FUTURE];

/** The example sentence at `index` of tense family `type`, as an expression. */
const TENSE_SENTENCE = (type: Expr, index: Expr): Expr =>
  TENSE_FAMILIES.slice(0, -1).reduceRight(
    (rest, examples, t) => `${type} == ${t} ? (${TEXT_AT(examples, index)}) : ${rest}`,
    `(${TEXT_AT(TENSE_FAMILIES[TENSE_FAMILIES.length - 1], index)})`,
  );

// Sentences that contain an adverb group, each paired with its own adverb.
// The identification template draws its distractors from `ADV_ANSWER`
// itself - other sentences' adverbs, not a verb or a noun - so every option
// is a genuine adverb and only one of them is the word this sentence uses.
const ADV_SENTENCES: readonly string[] = [
  'She sang beautifully during the concert.',
  'The children played quietly in the library.',
  'He quickly finished his lunch before class.',
  'The old bridge creaked loudly in the storm.',
  'They arrived early for the school assembly.',
];
const ADV_ANSWER: readonly string[] = ['beautifully', 'quietly', 'quickly', 'loudly', 'early'];

// Sentences with no adverb group at all, for the boolean's false case -
// matched in count and register to the true case above so nothing but the
// property being asked about tells the two apart.
const NO_ADV_SENTENCES: readonly string[] = [
  'The teacher read a book to the class.',
  'The farmer grew vegetables in the field.',
  'The builder fixed the broken window.',
  'The artist painted a picture of the harbour.',
  'The baker made bread for the shop.',
];

// ---------------------------------------------------------------------------
// Figurative language
//
// Five devices, five example sentences each. Every simile carries "like" or
// "as ... as"; every metaphor states outright that one thing is another with
// neither word; every personification gives a human action to something
// that cannot act; every idiom is a fixed expression whose literal words are
// not its meaning; every hyperbole is a deliberate exaggeration carrying
// none of the other four devices' own markers.
// ---------------------------------------------------------------------------

const SIMILE_EXAMPLES: readonly string[] = [
  'Her skin was as soft as a rose petal.',
  'He fought like a lion to win the match.',
  'The lake was as still as glass in the morning.',
  'She moved through the crowd like a shadow.',
  'The ice was as cold as a winter night.',
];

const METAPHOR_EXAMPLES: readonly string[] = [
  'The library was a treasure chest of stories.',
  'His words were daggers aimed at her pride.',
  'The playground was a battlefield at lunchtime.',
  'Her laughter was music drifting through the house.',
  'The city streets were rivers of moving cars.',
];

const PERSONIFICATION_EXAMPLES: readonly string[] = [
  'The camera caught the moment the fireworks kissed the sky.',
  'The old clock coughed out its final chime.',
  'The waves raced each other onto the shore.',
  'The garden gate creaked a complaint when it opened.',
  'The storm clouds argued loudly overhead.',
];

const IDIOM_EXAMPLES: readonly string[] = [
  'Grandpa always says it is raining cats and dogs outside.',
  'Once the news broke, the cat was out of the bag.',
  'She told him to break a leg before the concert.',
  'After the long flight, he felt under the weather.',
  'The whole class had to hit the books before the exam.',
];

const HYPERBOLE_EXAMPLES: readonly string[] = [
  'I have told you a million times to tidy your room.',
  'This backpack weighs a tonne after a day at school.',
  'I am so hungry I could eat an entire elephant.',
  'Grandma is older than the mountains behind our house.',
  'The queue for the roller coaster went on forever and ever.',
];

const FIG_FAMILIES: readonly (readonly string[])[] = [
  SIMILE_EXAMPLES,
  METAPHOR_EXAMPLES,
  PERSONIFICATION_EXAMPLES,
  IDIOM_EXAMPLES,
  HYPERBOLE_EXAMPLES,
];
const FIG_LABEL_LIST: readonly string[] = ['simile', 'metaphor', 'personification', 'idiom', 'hyperbole'];
const FIG_SIGNAL_LIST: readonly string[] = [
  'the word like or as',
  'saying one thing is another thing',
  'giving human actions to something that is not human',
  'a saying whose words do not mean what they seem to say',
  'a wild exaggeration not meant to be taken literally',
];

/** The example sentence at `index` of device family `type`, as an expression. */
const FIG_SENTENCE = (type: Expr, index: Expr): Expr =>
  FIG_FAMILIES.slice(0, -1).reduceRight(
    (rest, examples, t) => `${type} == ${t} ? (${TEXT_AT(examples, index)}) : ${rest}`,
    `(${TEXT_AT(FIG_FAMILIES[FIG_FAMILIES.length - 1], index)})`,
  );

/** One of the five device names, chosen by `type`, as an expression. */
const FIG_LABEL = (type: Expr): Expr => TEXT_AT(FIG_LABEL_LIST, type);

// ---------------------------------------------------------------------------
// Punctuation
//
// AC9E6LA09 - commas for lists and to separate clauses. Every set below is
// [correct, missing a comma, comma in the wrong place]. The category asked
// about is drawn uniformly rather than always being "correct", the same fix
// the figurative-language families already use: an answer that only ever
// came from the "correct" array and never from "missing" or "misplaced"
// would be a closed set the size of "correct" alone, disjoint from its own
// distractors - structurally the odd-one-out failure again, just spelled as
// a grammar check instead of a rhyme. Drawing the category first, so every
// one of the three can be the answer, keeps the two pools the same set.
// ---------------------------------------------------------------------------

const PUNCT_LABEL_3: readonly string[] = [
  'punctuated correctly',
  'missing a comma',
  'with a comma in the wrong place',
];
const PUNCT_LABEL_2: readonly string[] = ['punctuated correctly', 'missing a comma'];

const LIST_CORRECT: readonly string[] = [
  'We packed apples, bananas and grapes for the picnic.',
  'The zoo has lions, tigers and bears in the north wing.',
  'She bought pencils, rulers and erasers for school.',
  'We saw dolphins, turtles and seals at the aquarium.',
  'The recipe needs flour, sugar and butter for the cake.',
];
const LIST_MISSING: readonly string[] = [
  'We packed apples bananas and grapes for the picnic.',
  'The zoo has lions tigers and bears in the north wing.',
  'She bought pencils rulers and erasers for school.',
  'We saw dolphins turtles and seals at the aquarium.',
  'The recipe needs flour sugar and butter for the cake.',
];
const LIST_MISPLACED: readonly string[] = [
  'We packed apples, bananas and, grapes for the picnic.',
  'The zoo has lions, tigers and, bears in the north wing.',
  'She bought pencils, rulers and, erasers for school.',
  'We saw dolphins, turtles and, seals at the aquarium.',
  'The recipe needs flour, sugar and, butter for the cake.',
];

const CLAUSE_CORRECT: readonly string[] = [
  'After the game finished, the players shook hands.',
  'Although it was raining, the match went ahead.',
  'Before the bell rang, the students packed their bags.',
  'Since the bus was late, we walked to school instead.',
  'While the teacher spoke, the class listened quietly.',
];
const CLAUSE_MISSING: readonly string[] = [
  'After the game finished the players shook hands.',
  'Although it was raining the match went ahead.',
  'Before the bell rang the students packed their bags.',
  'Since the bus was late we walked to school instead.',
  'While the teacher spoke the class listened quietly.',
];
const CLAUSE_MISPLACED: readonly string[] = [
  'After the game, finished the players shook hands.',
  'Although it, was raining the match went ahead.',
  'Before the bell, rang the students packed their bags.',
  'Since the bus, was late we walked to school instead.',
  'While the teacher, spoke the class listened quietly.',
];

const COMPOUND_CORRECT: readonly string[] = [
  'The rain stopped, but the sun did not come out.',
  'She wanted to go outside, but it started to rain.',
  'The team trained hard, and they won the final.',
  'He forgot his lunch, so he borrowed some money.',
  'The power went out, but the lights came back on soon.',
];
const COMPOUND_MISSING: readonly string[] = [
  'The rain stopped but the sun did not come out.',
  'She wanted to go outside but it started to rain.',
  'The team trained hard and they won the final.',
  'He forgot his lunch so he borrowed some money.',
  'The power went out but the lights came back on soon.',
];

// The combined pools the sentence-given-category template draws from - the
// list and clause correct/missing/misplaced sets end to end, ten sentences a
// category, so the fixed three-label option set arrives with a different
// underlying sentence on every draw.
const ISSUE_CORRECT: readonly string[] = [...LIST_CORRECT, ...CLAUSE_CORRECT];
const ISSUE_MISSING: readonly string[] = [...LIST_MISSING, ...CLAUSE_MISSING];
const ISSUE_MISPLACED: readonly string[] = [...LIST_MISPLACED, ...CLAUSE_MISPLACED];

const LIST_FAMILIES: readonly (readonly string[])[] = [LIST_CORRECT, LIST_MISSING, LIST_MISPLACED];
const CLAUSE_FAMILIES: readonly (readonly string[])[] = [
  CLAUSE_CORRECT,
  CLAUSE_MISSING,
  CLAUSE_MISPLACED,
];
const COMPOUND_FAMILIES: readonly (readonly string[])[] = [COMPOUND_CORRECT, COMPOUND_MISSING];

/** Builds a `(category, index) -> sentence` expression over a family list. */
const familySentence = (families: readonly (readonly string[])[]) => (cat: Expr, i: Expr): Expr =>
  families
    .slice(0, -1)
    .reduceRight(
      (rest, examples, c) => `${cat} == ${c} ? (${TEXT_AT(examples, i)}) : ${rest}`,
      `(${TEXT_AT(families[families.length - 1], i)})`,
    );

const LIST_SENTENCE = familySentence(LIST_FAMILIES);
const CLAUSE_SENTENCE = familySentence(CLAUSE_FAMILIES);
const COMPOUND_SENTENCE = familySentence(COMPOUND_FAMILIES);

// ---------------------------------------------------------------------------
// Spelling patterns
//
// AC9E6LY08's two generalisations Year 5 does not touch. Both are explicit
// word pairs, since the expression language can append a suffix but cannot
// double a letter or drop a final y.
// ---------------------------------------------------------------------------

const DOUBLE_BASE: WordBank = ['run', 'stop', 'plan', 'drop', 'swim', 'grab'];
const DOUBLE_ING: WordBank = ['running', 'stopping', 'planning', 'dropping', 'swimming', 'grabbing'];

const Y_SINGULAR: WordBank = ['baby', 'city', 'puppy', 'story', 'family', 'country'];
const Y_PLURAL: WordBank = ['babies', 'cities', 'puppies', 'stories', 'families', 'countries'];

export const year6: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Word roots
  // -------------------------------------------------------------------
  {
    id: 'english.6.word-roots.same-root',
    subject: 'english',
    topic: 'word roots',
    level: '6',
    prompt: 'Which word has the same root as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 't', kind: 'int', min: '0', max: '3' },
      { name: 'a', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      // Fresh indices for the two distractor words, independent of `t` and
      // `a` - reusing either would tie a distractor's position within its
      // family to the target's or the answer's own position, a correlation
      // a large-sample measurement (rather than validateTemplate's checks)
      // turns up as a several-point prediction leak.
      { name: 'i1', kind: 'int', min: '0', max: '3' },
      { name: 'i2', kind: 'int', min: '0', max: '3' },
      { name: 'target', kind: 'expr', expr: ROOT_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: ROOT_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [ROOT_WORD('(f + d1) % 6', 'i1'), ROOT_WORD('(f + d2) % 6', 'i2')],
    },
    hint: 'Look for the part of the word that stays the same and means the same thing.',
    tags: ['AC9E6LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.word-roots.which-root-is-in',
    subject: 'english',
    topic: 'word roots',
    level: '6',
    prompt: 'Which root is inside the word {word}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: ROOT_WORD('f', 'i') },
      { name: 'answer', kind: 'expr', expr: ROOT_NAME_AT('f') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // The six root names are always distinct strings even though two of
      // their meanings coincide, so naming a root rather than its meaning
      // never risks two identical buttons.
      distractors: [ROOT_NAME_AT('(f + d1) % 6'), ROOT_NAME_AT('(f + d2) % 6')],
    },
    hint: 'Look for the meaningful chunk of letters shared by that word family.',
    tags: ['AC9E6LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.word-roots.root-meaning',
    subject: 'english',
    topic: 'word roots',
    level: '6',
    prompt: 'What does the root {root} mean?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'root', kind: 'expr', expr: TEXT_AT(UNIQUE_ROOT_NAME, 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(UNIQUE_ROOT_MEANING, 'i') },
    ],
    // Restricted to the four roots whose meaning nothing else in this file
    // shares, so the two distractors can never coincide with the answer's
    // own text.
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        TEXT_AT(UNIQUE_ROOT_MEANING, '(i + d1) % 4'),
        TEXT_AT(UNIQUE_ROOT_MEANING, '(i + d2) % 4'),
      ],
    },
    hint: 'Think about what all the words built from that root have in common.',
    tags: ['AC9E6LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.word-roots.write-root',
    subject: 'english',
    topic: 'word roots',
    level: '6',
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
    tags: ['AC9E6LY09', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.word-roots.write-meaning',
    subject: 'english',
    topic: 'word roots',
    level: '6',
    prompt: 'Write what the root in {word} means.',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'word', kind: 'expr', expr: ROOT_WORD('f', 'i') },
      { name: 'answer', kind: 'expr', expr: ROOT_MEANING_AT('f') },
    ],
    // Two roots share the meaning "write", but that is not a dual-answer
    // risk here: the word in the prompt fixes one specific root, so there is
    // exactly one correct string to type, whichever root it happens to be.
    answer: 'answer',
    answerType: 'text',
    hint: 'Think about what all the words built from that root have in common.',
    tags: ['AC9E6LY09', 'EN3-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Word classes
  // -------------------------------------------------------------------
  {
    id: 'english.6.word-classes.identify-tense',
    subject: 'english',
    topic: 'word classes',
    level: '6',
    prompt: 'Which one is this? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'sentence', kind: 'expr', expr: TENSE_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(TENSE_LABEL, 'type') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [TEXT_AT(TENSE_LABEL, '(type + 1) % 3'), TEXT_AT(TENSE_LABEL, '(type + 2) % 3')],
    },
    hint: 'Look at the verb group to see when the action happens.',
    tags: ['AC9E6LA06', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.word-classes.same-tense',
    subject: 'english',
    topic: 'word classes',
    level: '6',
    prompt: 'Which sentence is in the same tense as this one? {sentence}',
    vars: [
      { name: 'type', kind: 'pick', from: [0, 1, 2] },
      { name: 'i0', kind: 'int', min: '0', max: '3' },
      { name: 'iSame', kind: 'int', min: '1', max: '3' },
      { name: 'i1', kind: 'int', min: '0', max: '3' },
      { name: 'i2', kind: 'int', min: '0', max: '3' },
      { name: 'sentence', kind: 'expr', expr: TENSE_SENTENCE('type', 'i0') },
      { name: 'answer', kind: 'expr', expr: TENSE_SENTENCE('type', '(i0 + iSame) % 4') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        TENSE_SENTENCE('(type + 1) % 3', 'i1'),
        TENSE_SENTENCE('(type + 2) % 3', 'i2'),
      ],
    },
    hint: 'Look at what each verb group is doing, not just what the sentence is about.',
    tags: ['AC9E6LA06', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.word-classes.which-is-adverb',
    subject: 'english',
    topic: 'word classes',
    level: '6',
    prompt: 'Which of these adverbs is used in this sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'sentence', kind: 'expr', expr: TEXT_AT(ADV_SENTENCES, 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(ADV_ANSWER, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // Every option is a genuine adverb from `ADV_ANSWER` - the answer's
      // own value pool - rather than a verb or noun that could never be an
      // adverb at all. A verb/noun distractor would make the adverb always
      // the odd one out by word class alone, the closed-set failure the
      // rhyme worked example's overlapping families avoid; here the wrong
      // buttons are adverbs too, just not the one this sentence uses.
      distractors: [TEXT_AT(ADV_ANSWER, '(i + d1) % 5'), TEXT_AT(ADV_ANSWER, '(i + d2) % 5')],
    },
    hint: 'Find the word that describes how the action happens, and check it is the one used here.',
    tags: ['AC9E6LA06', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.word-classes.has-adverb',
    subject: 'english',
    topic: 'word classes',
    level: '6',
    prompt: 'Does this sentence contain an adverb group? {sentence}',
    vars: [
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      {
        name: 'sentence',
        kind: 'expr',
        expr: `ok == 1 ? (${TEXT_AT(ADV_SENTENCES, 'i')}) : (${TEXT_AT(NO_ADV_SENTENCES, 'i')})`,
      },
    ],
    answer: 'ok == 1',
    hint: 'An adverb usually describes how, when or where something happens.',
    tags: ['AC9E6LA06', 'EN3-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Figurative language
  // -------------------------------------------------------------------
  {
    id: 'english.6.figurative-language.identify',
    subject: 'english',
    topic: 'figurative language',
    level: '6',
    prompt: 'Which one is this? {sentence}',
    vars: [
      { name: 'type', kind: 'int', min: '0', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'd3', kind: 'int', min: '1', max: '4' },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: FIG_LABEL('type') },
    ],
    constraints: ['d1 != d2', 'd1 != d3', 'd2 != d3'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        FIG_LABEL('(type + d1) % 5'),
        FIG_LABEL('(type + d2) % 5'),
        FIG_LABEL('(type + d3) % 5'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.',
    tags: ['AC9E6LA08', 'EN3-UARL-01'],
  },
  {
    id: 'english.6.figurative-language.what-signals-it',
    subject: 'english',
    topic: 'figurative language',
    level: '6',
    // The device name is never named in the prompt - only in `identify`'s
    // own answer buttons - because `FIG_SIGNAL_LIST` is a fixed one-to-one
    // mapping off `type`. Naming the device here would let a child answer
    // from the label alone without reading `{sentence}` at all.
    prompt: 'What tells you this sentence uses figurative language? {sentence}',
    vars: [
      { name: 'type', kind: 'int', min: '0', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'd3', kind: 'int', min: '1', max: '4' },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(FIG_SIGNAL_LIST, 'type') },
    ],
    constraints: ['d1 != d2', 'd1 != d3', 'd2 != d3'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        TEXT_AT(FIG_SIGNAL_LIST, '(type + d1) % 5'),
        TEXT_AT(FIG_SIGNAL_LIST, '(type + d2) % 5'),
        TEXT_AT(FIG_SIGNAL_LIST, '(type + d3) % 5'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.',
    tags: ['AC9E6LA08', 'EN3-UARL-01'],
  },
  {
    id: 'english.6.figurative-language.match-the-example',
    subject: 'english',
    topic: 'figurative language',
    level: '6',
    prompt: 'Which sentence is an example of {label}?',
    vars: [
      { name: 'type', kind: 'int', min: '0', max: '4' },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'd3', kind: 'int', min: '1', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'i3', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: FIG_LABEL('type') },
      { name: 'answer', kind: 'expr', expr: FIG_SENTENCE('type', 'i0') },
    ],
    constraints: ['d1 != d2', 'd1 != d3', 'd2 != d3'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        FIG_SENTENCE('(type + d1) % 5', 'i1'),
        FIG_SENTENCE('(type + d2) % 5', 'i2'),
        FIG_SENTENCE('(type + d3) % 5', 'i3'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.',
    tags: ['AC9E6LA08', 'EN3-UARL-01'],
  },
  {
    id: 'english.6.figurative-language.same-device',
    subject: 'english',
    topic: 'figurative language',
    level: '6',
    prompt: 'Which sentence uses the same kind of figurative language as this one? {sentence}',
    vars: [
      { name: 'type', kind: 'int', min: '0', max: '4' },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'iSame', kind: 'int', min: '1', max: '4' },
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'd3', kind: 'int', min: '1', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'i3', kind: 'int', min: '0', max: '4' },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i0') },
      { name: 'answer', kind: 'expr', expr: FIG_SENTENCE('type', '(i0 + iSame) % 5') },
    ],
    constraints: ['d1 != d2', 'd1 != d3', 'd2 != d3'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        FIG_SENTENCE('(type + d1) % 5', 'i1'),
        FIG_SENTENCE('(type + d2) % 5', 'i2'),
        FIG_SENTENCE('(type + d3) % 5', 'i3'),
      ],
    },
    hint: 'Look at what each sentence does, not just what it is about.',
    tags: ['AC9E6LA08', 'EN3-UARL-01'],
  },
  {
    id: 'english.6.figurative-language.eliminate-one',
    subject: 'english',
    topic: 'figurative language',
    level: '6',
    prompt: 'This is not a {wrongLabel}. What is it? {sentence}',
    vars: [
      { name: 'type', kind: 'int', min: '0', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '4' },
      { name: 'off', kind: 'int', min: '1', max: '4' },
      // `off`, `d1`, `d2` and `d3` are forced into a permutation of 1-4, so
      // the three distractors are exactly the three devices that are
      // neither the answer nor the one already ruled out - never a repeat
      // of `wrongType` and never a fourth copy of the answer.
      { name: 'd1', kind: 'int', min: '1', max: '4' },
      { name: 'd2', kind: 'int', min: '1', max: '4' },
      { name: 'd3', kind: 'int', min: '1', max: '4' },
      { name: 'wrongType', kind: 'expr', expr: '(type + off) % 5' },
      { name: 'wrongLabel', kind: 'expr', expr: FIG_LABEL('wrongType') },
      { name: 'sentence', kind: 'expr', expr: FIG_SENTENCE('type', 'i') },
      { name: 'answer', kind: 'expr', expr: FIG_LABEL('type') },
    ],
    constraints: ['off != d1', 'off != d2', 'off != d3', 'd1 != d2', 'd1 != d3', 'd2 != d3'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        FIG_LABEL('(type + d1) % 5'),
        FIG_LABEL('(type + d2) % 5'),
        FIG_LABEL('(type + d3) % 5'),
      ],
    },
    hint: 'A simile uses like or as, a metaphor says one thing is another, personification gives human actions to something not human, an idiom does not mean its literal words, and hyperbole is a wild exaggeration.',
    tags: ['AC9E6LA08', 'EN3-UARL-01'],
  },

  // -------------------------------------------------------------------
  // Punctuation
  // -------------------------------------------------------------------
  {
    id: 'english.6.punctuation.list-issue',
    subject: 'english',
    topic: 'punctuation',
    level: '6',
    prompt: 'Which sentence is {label} in its list?',
    vars: [
      { name: 'cat', kind: 'pick', from: [0, 1, 2] },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: TEXT_AT(PUNCT_LABEL_3, 'cat') },
      { name: 'answer', kind: 'expr', expr: LIST_SENTENCE('cat', 'i0') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      // `cat` is drawn uniformly across all three categories, so the answer
      // is sometimes the correctly-punctuated sentence and sometimes one of
      // the two wrong ones - the same fix figurative language's five
      // families already rely on, so no category is ever the odd one out.
      distractors: [LIST_SENTENCE('(cat + 1) % 3', 'i1'), LIST_SENTENCE('(cat + 2) % 3', 'i2')],
    },
    hint: 'Put a comma after every item in the list except the last one.',
    tags: ['AC9E6LA09', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.punctuation.clause-issue',
    subject: 'english',
    topic: 'punctuation',
    level: '6',
    prompt: 'Which sentence is {label} after its opening clause?',
    vars: [
      { name: 'cat', kind: 'pick', from: [0, 1, 2] },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'i2', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: TEXT_AT(PUNCT_LABEL_3, 'cat') },
      { name: 'answer', kind: 'expr', expr: CLAUSE_SENTENCE('cat', 'i0') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        CLAUSE_SENTENCE('(cat + 1) % 3', 'i1'),
        CLAUSE_SENTENCE('(cat + 2) % 3', 'i2'),
      ],
    },
    hint: 'A comma follows the opening clause, before the main part of the sentence begins.',
    tags: ['AC9E6LA09', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.punctuation.compound-issue',
    subject: 'english',
    topic: 'punctuation',
    level: '6',
    prompt: 'Which sentence is {label} before the joining word?',
    vars: [
      { name: 'cat', kind: 'pick', from: [0, 1] },
      { name: 'i0', kind: 'int', min: '0', max: '4' },
      { name: 'i1', kind: 'int', min: '0', max: '4' },
      { name: 'label', kind: 'expr', expr: TEXT_AT(PUNCT_LABEL_2, 'cat') },
      { name: 'answer', kind: 'expr', expr: COMPOUND_SENTENCE('cat', 'i0') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [COMPOUND_SENTENCE('1 - cat', 'i1')],
    },
    hint: 'Two complete sentences joined by and, but or so need a comma before the joining word.',
    tags: ['AC9E6LA09', 'EN3-CWT-01'],
  },
  {
    id: 'english.6.punctuation.identify-issue',
    subject: 'english',
    topic: 'punctuation',
    level: '6',
    prompt: 'What is true of the commas in this sentence? {sentence}',
    vars: [
      { name: 'cat', kind: 'pick', from: [0, 1, 2] },
      { name: 'i', kind: 'int', min: '0', max: '9' },
      {
        name: 'sentence',
        kind: 'expr',
        expr: `cat == 0 ? (${TEXT_AT(ISSUE_CORRECT, 'i')}) : cat == 1 ? (${TEXT_AT(ISSUE_MISSING, 'i')}) : (${TEXT_AT(ISSUE_MISPLACED, 'i')})`,
      },
      { name: 'answer', kind: 'expr', expr: TEXT_AT(PUNCT_LABEL_3, 'cat') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        TEXT_AT(PUNCT_LABEL_3, '(cat + 1) % 3'),
        TEXT_AT(PUNCT_LABEL_3, '(cat + 2) % 3'),
      ],
    },
    hint: 'Check whether every comma is needed, missing, or in the wrong place.',
    tags: ['AC9E6LA09', 'EN3-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Spelling patterns
  // -------------------------------------------------------------------
  {
    id: 'english.6.spelling-patterns.write-doubled-ing',
    subject: 'english',
    topic: 'spelling patterns',
    level: '6',
    prompt: 'Write the word formed by adding -ing to {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(DOUBLE_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(DOUBLE_ING, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Double the final consonant before adding -ing.',
    tags: ['AC9E6LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.spelling-patterns.which-is-doubled-ing',
    subject: 'english',
    topic: 'spelling patterns',
    level: '6',
    prompt: 'Which word is formed by adding -ing to {word}?',
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
    hint: 'Double the final consonant before adding -ing.',
    tags: ['AC9E6LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.spelling-patterns.write-plural-y',
    subject: 'english',
    topic: 'spelling patterns',
    level: '6',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(Y_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(Y_PLURAL, 'i') },
    ],
    answer: 'answer',
    answerType: 'text',
    hint: 'Change the y to i, then add -es.',
    tags: ['AC9E6LY08', 'EN3-SPELL-01'],
  },
  {
    id: 'english.6.spelling-patterns.which-is-plural-y',
    subject: 'english',
    topic: 'spelling patterns',
    level: '6',
    prompt: 'Which word is the plural of {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(Y_SINGULAR, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(Y_PLURAL, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(Y_PLURAL, '(i + d1) % 6'), wordFrom(Y_PLURAL, '(i + d2) % 6')],
    },
    hint: 'Change the y to i, then add -es.',
    tags: ['AC9E6LY08', 'EN3-SPELL-01'],
  },
];
