import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { wordFrom, type WordBank } from './helpers';

/**
 * English course, Year 1 - NSW Stage 1.
 *
 * Written against ACARA's Australian Curriculum v9.0 English and the NSW
 * English K-10 Syllabus (2022), exactly as `index.ts` describes. NSW outcome
 * statements are Crown copyright and nothing here says what one covers - only
 * which code a template cites.
 *
 * **Stage 1 has no phonological-awareness outcome of its own** - it folds into
 * phonics and word knowledge - so rhyme cites `EN1-PHOKW-01` here where
 * Kindergarten's rhyme cited `ENE-PHOAW-01`. That is the syllabus, not a
 * citation getting lazy.
 *
 * **Year 1 is where typing starts.** The letter pad is QWERTY, not
 * alphabetical, so it costs a child nothing to type once they can spell a
 * short regular word - and plurals is exactly that: a bare `-s` or `-es` on a
 * one-syllable noun. Only plurals types, and only two of its four templates
 * do; every other topic stays tapped, the same case Kindergarten made for
 * everything.
 *
 * **Word classes could not reuse the rhyme/opposites trick of a shared word
 * bank split into two roles.** A naming word and a doing word are genuinely
 * different things - a verb is never a naming word - so there is no way to
 * draw a distractor from the answer's own values the way `hat` stands in for
 * `cat`. That is `propertyIsTheQuestion`'s shape exactly, and it is not
 * declared here: instead both the noun bank and the verb bank below run past
 * eight distinct words, which is what a closed set actually means
 * (`CLOSED_SET_MAX`) - a nine-plus-word vocabulary is not "three colours, two
 * units," it is a child's real word knowledge, and the option sets it produces
 * barely repeat across even a few hundred draws. The one genuinely closed
 * two-way choice here is `a` or `an` (`sentences.a-or-an`), and it passes for
 * the reason the doc gives for that check: which of the two is right changes
 * with every noun, so the same two buttons come with both answers.
 */

// ---------------------------------------------------------------------------
// Letters and sounds
//
// Kindergarten drilled single letters; Year 1 moves to the two-letter sounds
// that single-letter phonics can't reach - digraphs (sh, ch, th, wh) and
// consonant blends (bl, cr, st, sw) - plus the alphabet run in the direction
// Kindergarten didn't ask, "what comes before". Both sound families use the
// same family/index scaffold rhyme does below: a word's two-letter sound is
// read off which *family* it was drawn from, so a family also stands as a
// flat bank of its own four letters when a question wants the sound rather
// than the word.
// ---------------------------------------------------------------------------

// Six words a family rather than four - `content-shapes.md`'s own worked
// example uses four, but measuring an early four-word version of this
// template against held-out draws put it well above blind: only four
// families times four words times three "other family" choices is few enough
// distinct option sets that the same one recurs, and a set that recurs
// always carries the same answer. Six widens the option-set space enough
// that a repeat stops being the common case.
const DIGRAPH_FAMILIES: readonly WordBank[] = [
  ['ship', 'shop', 'shell', 'shed', 'shark', 'sheep'],
  ['chip', 'chin', 'chest', 'check', 'chill', 'chomp'],
  ['thin', 'thump', 'think', 'thud', 'thick', 'thorn'],
  ['whale', 'wheel', 'whisk', 'whip', 'wheat', 'white'],
];
const DIGRAPH_LETTERS: WordBank = ['sh', 'ch', 'th', 'wh'];

/** The word at `index` of digraph family `family`, as an expression. */
const DIGRAPH_WORD = (family: Expr, index: Expr): Expr =>
  DIGRAPH_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(DIGRAPH_FAMILIES[DIGRAPH_FAMILIES.length - 1], index)})`,
  );

const BLEND_FAMILIES: readonly WordBank[] = [
  ['black', 'blob', 'block', 'blank', 'bloom', 'blink'],
  ['crab', 'crib', 'crop', 'cross', 'crown', 'creek'],
  ['stop', 'stamp', 'sting', 'stack', 'stone', 'stump'],
  ['swim', 'swing', 'swan', 'sweep', 'sweet', 'swift'],
];

/** The word at `index` of blend family `family`, as an expression. */
const BLEND_WORD = (family: Expr, index: Expr): Expr =>
  BLEND_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(BLEND_FAMILIES[BLEND_FAMILIES.length - 1], index)})`,
  );

// A fresh eight letters, not Kindergarten's a-h, so "what comes before" has
// its own bank rather than quietly retracing the letter-after questions a
// child may have already answered this session.
const ALPHABET: WordBank = ['i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'];

// ---------------------------------------------------------------------------
// Rhyme
//
// The exact family/index shape `content-shapes.md` verifies end to end,
// applied to four fresh families so this topic doesn't just replay
// Kindergarten's cat/dog/sun/pig set under a new year number. Two templates
// (`which-rhymes`, `finish-the-rhyme`) mirror Kindergarten directly; the other
// two step the *questions* up rather than the words - naming a rhyme from two
// given examples instead of one, and reasoning from a worked pair the way
// Kindergarten's opposites already do.
// ---------------------------------------------------------------------------

// Six words a family, for the reason the digraph families above give: four
// families of four leave too few distinct option sets for the distractor
// offsets to spread over, and a set that recurs always carries the same
// answer.
const RHYME_FAMILIES: readonly WordBank[] = [
  ['star', 'car', 'far', 'jar', 'bar', 'tar'],
  ['nest', 'best', 'rest', 'test', 'pest', 'vest'],
  ['clock', 'sock', 'rock', 'lock', 'dock', 'block'],
  ['bee', 'tree', 'free', 'key', 'three', 'see'],
];

/** The word at `index` of rhyme family `family`, as an expression. */
const RHYME_WORD = (family: Expr, index: Expr): Expr =>
  RHYME_FAMILIES.slice(0, -1).reduceRight(
    (rest, bank, i) => `${family} == ${i} ? (${wordFrom(bank, index)}) : ${rest}`,
    `(${wordFrom(RHYME_FAMILIES[RHYME_FAMILIES.length - 1], index)})`,
  );

// ---------------------------------------------------------------------------
// Plurals
//
// The suffix-typing pair `content-shapes.md` calls Shape B, each drawing from
// a bank that takes only one rule - `PLAIN_WORDS` never hisses, `HISS_WORDS`
// always does - so the question is naming the word rather than choosing the
// rule. The recognition pair beside them shares one bank in both directions:
// `PLURAL_BASE` and `PLURAL_FORM` are index-aligned, so "cats" is the answer
// when the word is "cat" and a distractor when the word is "dog" - the same
// overlap rhyme's families give it, applied to whole words instead of parts
// of one.
// ---------------------------------------------------------------------------

const PLAIN_WORDS: WordBank = ['cat', 'dog', 'hat', 'cup', 'pen', 'bird'];
const HISS_WORDS: WordBank = ['box', 'bus', 'fox', 'dish', 'brush', 'match'];

const PLURAL_BASE: WordBank = ['cat', 'box', 'dog', 'bus', 'hat', 'fox'];
const PLURAL_FORM: WordBank = ['cats', 'boxes', 'dogs', 'buses', 'hats', 'foxes'];

// ---------------------------------------------------------------------------
// Opposites
//
// Six pairs, one bank per side of the pair - the same shape Kindergarten's
// opposites use, with its own six words so this topic isn't a rerun of
// hot/cold and big/small under a new year number.
//
// Both `OPP_A` and `OPP_B` are plain, single-syllable, regular words - as
// typeable as a plurals suffix - so `write-opposite` and its worked-example
// pair type the same content the three `choice` templates above already
// recognise, the same way `plurals` answers the identical idea both ways.
// That is deliberate: Year 1's typed exposure sat entirely in `plurals`
// before these two, which meant a child whose plurals went secure could stop
// typing for the rest of the year - and "Year 1 is where typing starts"
// stops being true in practice for exactly the children doing well.
// ---------------------------------------------------------------------------

const OPP_A: WordBank = ['happy', 'open', 'full', 'loud', 'early', 'clean'];
const OPP_B: WordBank = ['sad', 'shut', 'empty', 'quiet', 'late', 'dirty'];

/** The word at pair `p`, on side `s` (0 for `OPP_A`, 1 for `OPP_B`), as an expression. */
const OPPOSITE_WORD = (p: Expr, s: Expr): Expr =>
  `${s} == 0 ? (${wordFrom(OPP_A, p)}) : (${wordFrom(OPP_B, p)})`;

// ---------------------------------------------------------------------------
// Word classes
//
// A naming word and a doing word cannot share values the way `hat` and `cat`
// do - a verb is never a naming word - so a bank split cleanly into a noun
// list and a verb list is `propertyIsTheQuestion`'s shape exactly: measuring
// an early version of this file's plain "which word is a naming word?"
// against held-out draws found it 100% solvable from the two buttons alone,
// because whichever word was not the fixed decoy always was the answer. It
// was replaced rather than declared, on the reasoning the brief asks for:
// the bank was built wrong.
//
// The fix is the one `content-shapes.md` hints at - the *same* two words are
// on screen every time, and which one is correct depends on which question
// was asked, not on which word it is. Six noun/verb pairs make six little
// sentences ("The dog can run."); `word-classes.naming-or-doing` then asks
// about *either* the naming word or the doing word in that sentence, chosen
// by a coin flip that also picks the answer. So `{dog, run}` is the option
// set on every draw of pair 0, and it is offered with `dog` correct about
// half the time and `run` correct the other half - there is no rule to learn
// from the buttons, only from reading which question was actually asked.
// `is-doing-word` is the same distinction as a bare boolean, which carries no
// option set to leak from at all.
//
// **`is-doing-word` and a first draft of `is-naming-word` were logical duals
// over the identical draw** - same `i` (0-19), same `CLASS_WORDS` bank, one
// answer the literal negation of the other (`i >= 10` against `i < 10`).
// Every word in that bank is exclusively a noun or exclusively a verb, so a
// child who answered one correctly answered the other by negation without
// exercising any new judgement - the mechanical duplicate test never catches
// it because the answer *expressions* differ, but it is the same evidence
// asked twice. `naming-word-in-context` replaces it: a fresh three-word
// sentence ("The dog can chase the ball.") with a *subject* noun and an
// *object* noun either side of the verb, so recognising the object as a
// naming word too is new evidence `is-doing-word-in-sentence` never
// provides - that template's own sentences only ever have one noun to ask
// about.
// ---------------------------------------------------------------------------

const NOUN_WORDS: WordBank = [
  'dog',
  'cat',
  'bird',
  'ball',
  'sock',
  'chair',
  'table',
  'apple',
  'house',
  'tree',
];
const VERB_WORDS: WordBank = [
  'run',
  'jump',
  'swim',
  'sing',
  'read',
  'write',
  'sleep',
  'hop',
  'skip',
  'dance',
];
// One flat bank for the plain "is this a doing word?" question - nouns first,
// then verbs, so a truthful answer is exactly "the index is 10 or more".
const CLASS_WORDS: WordBank = [...NOUN_WORDS, ...VERB_WORDS];

const SENT_NOUNS: WordBank = ['dog', 'cat', 'bird', 'fish', 'frog', 'rabbit'];
const SENT_VERBS: WordBank = ['run', 'swim', 'fly', 'dart', 'hop', 'dig'];

/** "The {noun} can {verb}." for pair `i`, as an expression. */
const CLASS_SENTENCE = (i: Expr): Expr =>
  `'The ' + (${wordFrom(SENT_NOUNS, i)}) + ' can ' + (${wordFrom(SENT_VERBS, i)}) + '.'`;

/** The noun or the verb of pair `i`, chosen by `ok` (1 for the verb), as an expression. */
const CLASS_CANDIDATE = (i: Expr, ok: Expr): Expr =>
  `${ok} == 1 ? (${wordFrom(SENT_VERBS, i)}) : (${wordFrom(SENT_NOUNS, i)})`;

/** "naming word" or "doing word", chosen by `asksVerb` (1 for doing word), as an expression. */
const CLASS_KIND_LABEL = (asksVerb: Expr): Expr =>
  `${asksVerb} == 1 ? 'doing word' : 'naming word'`;

// A three-word sentence - subject, verb, object - so a naming-word question
// has two nouns to ask about rather than the one `SENT_NOUNS` pairs give
// `is-doing-word-in-sentence`. All three banks share index `i`, so there are
// six whole sentences here, not a cross of every subject with every object -
// each was read aloud on its own (a dog chasing a ball, a cat catching a
// bug, a bird watching a kite, a frog following a worm, a rabbit finding a
// leaf, a mouse seeing a stick) to check none of the six comes out strange.
const SUBJ_NOUNS: WordBank = ['dog', 'cat', 'bird', 'frog', 'rabbit', 'mouse'];
const SCENE_VERBS: WordBank = ['chase', 'catch', 'watch', 'follow', 'find', 'see'];
const OBJ_NOUNS: WordBank = ['ball', 'bug', 'kite', 'worm', 'leaf', 'stick'];

/** "The {subj} can {verb} the {obj}." for triple `i`, as an expression. */
const SCENE_SENTENCE = (i: Expr): Expr =>
  `'The ' + (${wordFrom(SUBJ_NOUNS, i)}) + ' can ' + (${wordFrom(SCENE_VERBS, i)}) + ` +
  `' the ' + (${wordFrom(OBJ_NOUNS, i)}) + '.'`;

/**
 * The subject, the verb or the object of triple `i`, chosen by `role`
 * (0 = subject, 1 = verb, 2 = object), as an expression.
 */
const SCENE_CANDIDATE = (i: Expr, role: Expr): Expr =>
  `${role} == 1 ? (${wordFrom(SCENE_VERBS, i)}) : ` +
  `${role} == 2 ? (${wordFrom(OBJ_NOUNS, i)}) : (${wordFrom(SUBJ_NOUNS, i)})`;

// ---------------------------------------------------------------------------
// Sentences
//
// One boolean pair-text technique, reused for two different judgements: a
// proper noun's capital letter (`NAME_SENTENCES`, the name always mid-sentence
// so the sentence's own opening capital stays constant between the correct and
// incorrect version - the only thing that changes is the property being
// asked about) and choosing "a" or "an" (`AAN_SENTENCES`). The fill-in-the-
// blank beside them asks the same "a" or "an" question the other way round:
// given the noun, choose the article - and it is the one genuinely two-valued
// choice in this file, safe for the reason the top comment gives.
// ---------------------------------------------------------------------------

const NAME_SENTENCES: readonly (readonly [string, string])[] = [
  ['I played with Tom today.', 'I played with tom today.'],
  ['We visited Ben at his house.', 'We visited ben at his house.'],
  ['I saw Sam at the shop.', 'I saw sam at the shop.'],
  ['My friend Amy can swim.', 'My friend amy can swim.'],
  ['Our dog likes Zoe the best.', 'Our dog likes zoe the best.'],
  ['I gave Max a big hug.', 'I gave max a big hug.'],
];

// Five nouns that take "an" (they start with a vowel sound) and five that
// take "a" - elephant, apple, orange, umbrella and ant, then dog, cat, ball,
// house and banana. `AAN_ARTICLE`, `AAN_SENTENCES` and `AAN_FRAMES` all name
// them in that same order, so the three stay in step without a fourth bank
// of bare nouns nothing below actually indexes into. `AAN_FRAMES` names them
// a third time, one full sentence each rather than a bare noun after a fixed
// verb - a single frame ("I ate ? {noun}.") read the same over all ten
// produced "I ate an elephant." and, for the two pet nouns, something worse
// than nonsense ("I ate a dog."). Every frame here gives its own noun the
// verb it actually goes with, the same discipline `AAN_SENTENCES` already
// uses.
const AAN_ARTICLE: WordBank = ['an', 'an', 'an', 'an', 'an', 'a', 'a', 'a', 'a', 'a'];

const AAN_SENTENCES: readonly (readonly [string, string])[] = [
  ['I saw an elephant.', 'I saw a elephant.'],
  ['She ate an apple.', 'She ate a apple.'],
  ['He picked an orange.', 'He picked a orange.'],
  ['I have an umbrella.', 'I have a umbrella.'],
  ['There is an ant.', 'There is a ant.'],
  ['I saw a dog.', 'I saw an dog.'],
  ['She has a cat.', 'She has an cat.'],
  ['He kicked a ball.', 'He kicked an ball.'],
  ['We live in a house.', 'We live in an house.'],
  ['I ate a banana.', 'I ate an banana.'],
];

// One sentence per noun, blank where the article goes, each noun given a verb
// it actually fits - unlike the fixed "I ate ?" frame this replaced, nothing
// here asks a child to eat an umbrella or a pet. Index-aligned with
// `AAN_ARTICLE` and `AAN_SENTENCES` so the same noun order runs through all
// three banks.
const AAN_FRAMES: readonly string[] = [
  'I saw ? elephant at the zoo.',
  'She ate ? apple for lunch.',
  'He picked ? orange from the tree.',
  'I opened ? umbrella in the rain.',
  'There is ? ant on the table.',
  'I saw ? dog in the park.',
  'She has ? cat at home.',
  'He kicked ? ball across the yard.',
  'We live in ? house on the hill.',
  'I ate ? banana for lunch.',
];

/** The frame at index `i` of `frames`, as an expression string literal. */
const FRAME_TEXT = (frames: readonly string[], i: Expr): Expr =>
  frames
    .slice(0, -1)
    .reduceRight(
      (rest, frame, index) => `${i} == ${index} ? '${frame}' : ${rest}`,
      `'${frames[frames.length - 1]}'`,
    );

/** The correct or incorrect text of pair `i` from `pairs`, chosen by `ok` (1 for correct), as an expression. */
const PAIR_TEXT = (pairs: readonly (readonly [string, string])[], i: Expr, ok: Expr): Expr =>
  pairs
    .slice(0, -1)
    .reduceRight(
      (rest, [good, bad], index) =>
        `${i} == ${index} ? (${ok} == 1 ? '${good}' : '${bad}') : ${rest}`,
      `(${ok} == 1 ? '${pairs[pairs.length - 1][0]}' : '${pairs[pairs.length - 1][1]}')`,
    );

export const year1: QuestionTemplate[] = [
  // -------------------------------------------------------------------
  // Letters and sounds
  // -------------------------------------------------------------------
  {
    id: 'english.1.letters-and-sounds.digraph-word',
    subject: 'english',
    topic: 'letters and sounds',
    level: '1',
    prompt: 'Which word starts with the same two letters as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      // Independent of `t` and `a`, the same reason `finish-the-rhyme` gives:
      // reusing them for the distractors ties the option set's identity to
      // the target and the answer and narrows how many distinct sets the
      // draws actually reach.
      { name: 'e1', kind: 'int', min: '0', max: '5' },
      { name: 'e2', kind: 'int', min: '0', max: '5' },
      { name: 'target', kind: 'expr', expr: DIGRAPH_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: DIGRAPH_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [DIGRAPH_WORD('(f + d1) % 4', 'e1'), DIGRAPH_WORD('(f + d2) % 4', 'e2')],
    },
    hint: 'Say the start of each word. Two letters together can make one sound.',
    tags: ['AC9E1LY11', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.letters-and-sounds.digraph-letters',
    subject: 'english',
    topic: 'letters and sounds',
    level: '1',
    prompt: 'Which two letters does {word} start with?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'fd1', kind: 'int', min: '1', max: '3' },
      { name: 'fd2', kind: 'int', min: '1', max: '3' },
      { name: 'word', kind: 'expr', expr: DIGRAPH_WORD('f', 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(DIGRAPH_LETTERS, 'f') },
    ],
    constraints: ['fd1 != fd2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [
        wordFrom(DIGRAPH_LETTERS, '(f + fd1) % 4'),
        wordFrom(DIGRAPH_LETTERS, '(f + fd2) % 4'),
      ],
    },
    hint: 'Say the word slowly. What two letters make the first sound?',
    tags: ['AC9E1LY12', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.letters-and-sounds.blend-word',
    subject: 'english',
    topic: 'letters and sounds',
    level: '1',
    prompt: 'Which word begins with the same blend as {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'e1', kind: 'int', min: '0', max: '5' },
      { name: 'e2', kind: 'int', min: '0', max: '5' },
      { name: 'target', kind: 'expr', expr: BLEND_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: BLEND_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [BLEND_WORD('(f + d1) % 4', 'e1'), BLEND_WORD('(f + d2) % 4', 'e2')],
    },
    hint: 'Say the start of each word. Two letters together can start a blend.',
    tags: ['AC9E1LY11', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.letters-and-sounds.alphabet-before',
    subject: 'english',
    topic: 'letters and sounds',
    level: '1',
    prompt: 'Which letter comes right before {target} in the alphabet?',
    vars: [
      // `i` starts at 1 rather than 0 so `i - 1` never asks about a letter
      // before the first one in this bank - the same honest end effect
      // Kindergarten's alphabet-next has at its own end.
      { name: 'i', kind: 'int', min: '1', max: '7' },
      { name: 'j1', kind: 'int', min: '0', max: '7' },
      { name: 'j2', kind: 'int', min: '0', max: '7' },
      { name: 'target', kind: 'expr', expr: wordFrom(ALPHABET, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(ALPHABET, 'i - 1') },
    ],
    constraints: ['j1 != i - 1', 'j2 != i - 1', 'j1 != j2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(ALPHABET, 'j1'), wordFrom(ALPHABET, 'j2')],
    },
    hint: 'Say the alphabet from the start and stop just before {target}.',
    tags: ['AC9E1LY12', 'EN1-PHOKW-01'],
  },

  // -------------------------------------------------------------------
  // Rhyme
  // -------------------------------------------------------------------
  {
    id: 'english.1.rhyme.which-rhymes',
    subject: 'english',
    topic: 'rhyme',
    level: '1',
    prompt: 'Which word rhymes with {target}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
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
    tags: ['AC9E1LE04', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.rhyme.finish-the-rhyme',
    subject: 'english',
    topic: 'rhyme',
    level: '1',
    prompt: 'Finish the rhyme: {target} and ?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      // Independent of `t` and `a` for the reason Kindergarten's own version
      // gives: reusing them for the distractors ties the option set's
      // identity to the target and the answer and narrows how many distinct
      // sets the draws actually reach.
      { name: 'e1', kind: 'int', min: '0', max: '5' },
      { name: 'e2', kind: 'int', min: '0', max: '5' },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['t != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('(f + d1) % 4', 'e1'), RHYME_WORD('(f + d2) % 4', 'e2')],
    },
    hint: 'Think of a word that ends with the same sound as {target}.',
    tags: ['AC9E1LE04', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.rhyme.rhymes-with-both',
    subject: 'english',
    topic: 'rhyme',
    level: '1',
    prompt: 'Which word rhymes with both {target1} and {target2}?',
    vars: [
      { name: 'f', kind: 'int', min: '0', max: '3' },
      { name: 't1', kind: 'int', min: '0', max: '5' },
      { name: 't2', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'target1', kind: 'expr', expr: RHYME_WORD('f', 't1') },
      { name: 'target2', kind: 'expr', expr: RHYME_WORD('f', 't2') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['t1 != t2', 'a != t1', 'a != t2', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('(f + d1) % 4', 't1'), RHYME_WORD('(f + d2) % 4', 't2')],
    },
    hint: 'All the words in the family end with the same sound.',
    tags: ['AC9E1LE04', 'EN1-PHOKW-01'],
  },
  {
    id: 'english.1.rhyme.worked-example',
    subject: 'english',
    topic: 'rhyme',
    level: '1',
    prompt: '{eTarget} and {eAnswer} rhyme. Which word rhymes with {target}?',
    vars: [
      { name: 'ef', kind: 'int', min: '0', max: '3' },
      { name: 'et', kind: 'int', min: '0', max: '5' },
      { name: 'ea', kind: 'int', min: '0', max: '5' },
      { name: 'p', kind: 'int', min: '1', max: '3' },
      { name: 't', kind: 'int', min: '0', max: '5' },
      { name: 'a', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '3' },
      { name: 'd2', kind: 'int', min: '1', max: '3' },
      { name: 'e1', kind: 'int', min: '0', max: '5' },
      { name: 'e2', kind: 'int', min: '0', max: '5' },
      { name: 'f', kind: 'expr', expr: '(ef + p) % 4' },
      { name: 'eTarget', kind: 'expr', expr: RHYME_WORD('ef', 'et') },
      { name: 'eAnswer', kind: 'expr', expr: RHYME_WORD('ef', 'ea') },
      { name: 'target', kind: 'expr', expr: RHYME_WORD('f', 't') },
      { name: 'answer', kind: 'expr', expr: RHYME_WORD('f', 'a') },
    ],
    constraints: ['et != ea', 't != a', 'd1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [RHYME_WORD('(f + d1) % 4', 'e1'), RHYME_WORD('(f + d2) % 4', 'e2')],
    },
    hint: 'Use the example to hear what sound you are listening for.',
    tags: ['AC9E1LE04', 'EN1-PHOKW-01'],
  },

  // -------------------------------------------------------------------
  // Plurals
  // -------------------------------------------------------------------
  {
    id: 'english.1.plurals.add-s',
    subject: 'english',
    topic: 'plurals',
    level: '1',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLAIN_WORDS, 'i') },
    ],
    // Every word in PLAIN_WORDS ends in a plain consonant sound, so every
    // plural takes a bare -s. Mixing in a hissing word would need the rule as
    // a second expression, and the question is about the word rather than
    // about which rule applies.
    answer: "word + 's'",
    answerType: 'text',
    hint: 'Most words just add -s to become plural.',
    tags: ['AC9E1LY15', 'EN1-SPELL-01'],
  },
  {
    id: 'english.1.plurals.add-es',
    subject: 'english',
    topic: 'plurals',
    level: '1',
    prompt: 'Write the plural of {word}.',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(HISS_WORDS, 'i') },
    ],
    answer: "word + 'es'",
    answerType: 'text',
    hint: 'Words ending in s, x, ch or sh add -es to become plural.',
    tags: ['AC9E1LY15', 'EN1-SPELL-01'],
  },
  {
    id: 'english.1.plurals.which-is-plural',
    subject: 'english',
    topic: 'plurals',
    level: '1',
    prompt: 'Which word means more than one {word}?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'word', kind: 'expr', expr: wordFrom(PLURAL_BASE, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_FORM, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(PLURAL_FORM, '(i + d1) % 6'), wordFrom(PLURAL_FORM, '(i + d2) % 6')],
    },
    hint: 'A plural word means more than one.',
    tags: ['AC9E1LY15', 'EN1-SPELL-01'],
  },
  {
    id: 'english.1.plurals.which-is-singular',
    subject: 'english',
    topic: 'plurals',
    level: '1',
    prompt: 'Which word means just one, if {form} means more than one?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'd1', kind: 'int', min: '1', max: '5' },
      { name: 'd2', kind: 'int', min: '1', max: '5' },
      { name: 'form', kind: 'expr', expr: wordFrom(PLURAL_FORM, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(PLURAL_BASE, 'i') },
    ],
    constraints: ['d1 != d2'],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 3,
      distractors: [wordFrom(PLURAL_BASE, '(i + d1) % 6'), wordFrom(PLURAL_BASE, '(i + d2) % 6')],
    },
    hint: 'Take away the -s or -es to find just one.',
    tags: ['AC9E1LY15', 'EN1-SPELL-01'],
  },

  // -------------------------------------------------------------------
  // Opposites
  // -------------------------------------------------------------------
  {
    id: 'english.1.opposites.which-opposite',
    subject: 'english',
    topic: 'opposites',
    level: '1',
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
    tags: ['AC9E1LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.1.opposites.opposite-of-two',
    subject: 'english',
    topic: 'opposites',
    level: '1',
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
    tags: ['AC9E1LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.1.opposites.worked-example',
    subject: 'english',
    topic: 'opposites',
    level: '1',
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
      distractors: [OPPOSITE_WORD('(ep + d1) % 6', 's2'), OPPOSITE_WORD('(ep + d2) % 6', 's3')],
    },
    hint: 'Use the example to see what "opposite" means.',
    tags: ['AC9E1LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.1.opposites.write-opposite',
    subject: 'english',
    topic: 'opposites',
    level: '1',
    prompt: 'Write the opposite of {target}.',
    vars: [
      { name: 'p', kind: 'int', min: '0', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('p', 's') },
    ],
    answer: OPPOSITE_WORD('p', '1 - s'),
    answerType: 'text',
    hint: 'An opposite means the total reverse.',
    tags: ['AC9E1LA09', 'EN1-VOCAB-01'],
  },
  {
    id: 'english.1.opposites.write-opposite-worked-example',
    subject: 'english',
    topic: 'opposites',
    level: '1',
    prompt: '{eTarget} and {eAnswer} are opposites. Write the opposite of {target}.',
    vars: [
      { name: 'ep', kind: 'int', min: '0', max: '5' },
      { name: 'es', kind: 'pick', from: [0, 1] },
      { name: 'p', kind: 'int', min: '1', max: '5' },
      { name: 's', kind: 'pick', from: [0, 1] },
      { name: 'eTarget', kind: 'expr', expr: OPPOSITE_WORD('ep', 'es') },
      { name: 'eAnswer', kind: 'expr', expr: OPPOSITE_WORD('ep', '1 - es') },
      { name: 'target', kind: 'expr', expr: OPPOSITE_WORD('(ep + p) % 6', 's') },
    ],
    answer: OPPOSITE_WORD('(ep + p) % 6', '1 - s'),
    answerType: 'text',
    hint: 'Use the example to see what "opposite" means.',
    tags: ['AC9E1LA09', 'EN1-VOCAB-01'],
  },

  // -------------------------------------------------------------------
  // Word classes
  // -------------------------------------------------------------------
  {
    id: 'english.1.word-classes.naming-or-doing',
    subject: 'english',
    topic: 'word classes',
    level: '1',
    prompt: 'Which word in this sentence is the {kind}? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'asksVerb', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: CLASS_SENTENCE('i') },
      { name: 'kind', kind: 'expr', expr: CLASS_KIND_LABEL('asksVerb') },
      { name: 'answer', kind: 'expr', expr: CLASS_CANDIDATE('i', 'asksVerb') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      // The one word in the sentence that is not the answer - always the
      // *other* half of the same pair, so a draw's two buttons are the same
      // whichever question was asked, and only reading the prompt says which
      // one is right this time.
      distractors: [CLASS_CANDIDATE('i', '1 - asksVerb')],
    },
    hint: 'The naming word names something. The doing word tells you what it does.',
    tags: ['AC9E1LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.1.word-classes.is-doing-word',
    subject: 'english',
    topic: 'word classes',
    level: '1',
    prompt: 'Is {word} a doing word?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '19' },
      { name: 'word', kind: 'expr', expr: wordFrom(CLASS_WORDS, 'i') },
    ],
    answer: 'i >= 10',
    hint: 'A doing word tells you what someone or something does.',
    tags: ['AC9E1LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.1.word-classes.naming-word-in-context',
    subject: 'english',
    topic: 'word classes',
    level: '1',
    prompt: 'Is {candidate} a naming word in this sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'askVerb', kind: 'pick', from: [0, 1] },
      // When `askVerb` is 0 the candidate is a noun either way, so a second
      // coin picks *which* noun - subject or object - rather than always
      // asking about the subject. That is the new evidence this template
      // adds over `is-doing-word-in-sentence`: an object noun is a naming
      // word too, not just the one at the front of the sentence.
      { name: 'objPick', kind: 'pick', from: [0, 1] },
      { name: 'role', kind: 'expr', expr: "askVerb == 1 ? 1 : (objPick == 1 ? 2 : 0)" },
      { name: 'sentence', kind: 'expr', expr: SCENE_SENTENCE('i') },
      { name: 'candidate', kind: 'expr', expr: SCENE_CANDIDATE('i', 'role') },
    ],
    answer: 'role != 1',
    hint: 'A naming word names a person, animal or thing.',
    tags: ['AC9E1LA07', 'EN1-CWT-01'],
  },
  {
    id: 'english.1.word-classes.is-doing-word-in-sentence',
    subject: 'english',
    topic: 'word classes',
    level: '1',
    prompt: 'Is {candidate} the doing word in this sentence? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: CLASS_SENTENCE('i') },
      { name: 'candidate', kind: 'expr', expr: CLASS_CANDIDATE('i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: 'The doing word tells you what the naming word can do.',
    tags: ['AC9E1LA07', 'EN1-CWT-01'],
  },

  // -------------------------------------------------------------------
  // Sentences
  // -------------------------------------------------------------------
  {
    id: 'english.1.sentences.name-capital',
    subject: 'english',
    topic: 'sentences',
    level: '1',
    prompt: 'Does this sentence use a capital letter correctly for the name? {sentence}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '5' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: PAIR_TEXT(NAME_SENTENCES, 'i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: "A person's name always starts with a capital letter.",
    tags: ['AC9E1LA10', 'EN1-CWT-01'],
  },
  {
    id: 'english.1.sentences.a-or-an-in-sentence',
    subject: 'english',
    topic: 'sentences',
    level: '1',
    prompt: "Does this sentence use 'a' or 'an' correctly? {sentence}",
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '9' },
      { name: 'ok', kind: 'pick', from: [0, 1] },
      { name: 'sentence', kind: 'expr', expr: PAIR_TEXT(AAN_SENTENCES, 'i', 'ok') },
    ],
    answer: 'ok == 1',
    hint: "Use 'an' before a word that starts with a vowel sound.",
    tags: ['AC9E1LA10', 'EN1-CWT-01'],
  },
  {
    id: 'english.1.sentences.a-or-an',
    subject: 'english',
    topic: 'sentences',
    level: '1',
    prompt: 'Which word finishes the sentence? {frame}',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '9' },
      { name: 'frame', kind: 'expr', expr: FRAME_TEXT(AAN_FRAMES, 'i') },
      { name: 'answer', kind: 'expr', expr: wordFrom(AAN_ARTICLE, 'i') },
    ],
    answer: 'answer',
    answerType: 'choice',
    choices: {
      count: 2,
      distractors: [`(${wordFrom(AAN_ARTICLE, 'i')}) == 'a' ? 'an' : 'a'`],
    },
    hint: "Use 'an' before a word that starts with a vowel sound.",
    tags: ['AC9E1LA10', 'EN1-CWT-01'],
  },
];
