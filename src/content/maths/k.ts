import type { QuestionTemplate } from '../../lib/templates/types';
import { dayName, shapeName, sideCount } from './helpers';

/**
 * One list every colour in a repeating pattern is drawn from. It is a single
 * list on purpose: a pattern whose colours come from separate lists makes the
 * answer identifiable by which list it belongs to, and the options are read
 * aloud, so a child who cannot read could pick the right button by the sound of
 * it rather than by the pattern.
 */
const PATTERN_COLOURS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const;

/** Kindergarten - NSW Early Stage 1. */
export const yearK: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Kindergarten (Foundation)
  //
  // Numbers to 20, subitising, part-part-whole to 10, practical addition,
  // subtraction and sharing, repeating patterns, direct comparison of length,
  // capacity and mass, the days of the week and the hour, naming shapes and
  // solids, and reading a graph.
  //
  // Plenty of these are a picture rather than a sentence, and each one is filed
  // with the topic it practises rather than in a group of its own: a graph is
  // read off the drawing, a solid has to be looked at, and a clock face and a
  // number line are the two places a number lives somewhere other than in the
  // words. Someone asking what Kindergarten asks about shapes should find all
  // of it in one run, which is also how the selector reasons about it.
  // ------------------------------------------------------------------
  {
    id: 'maths.K.counting-numbers.next',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'What number comes after {x}?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '19' }],
    answer: 'x + 1',
    hint: 'Count up one from {x}.',
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.counting-numbers.before',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'What number comes before {x}?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '20' }],
    answer: 'x - 1',
    hint: 'Count back one from {x}.',
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.counting-numbers.missing',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'Fill in the gap: {x}, {x + 1}, ?, {x + 3}',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '16' }],
    answer: 'x + 2',
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.counting-numbers.count-back',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'Counting backwards: {x}, {x - 1}, ?, {x - 3}',
    vars: [{ name: 'x', kind: 'int', min: '4', max: '20' }],
    answer: 'x - 2',
    hint: 'Take away one each time.',
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.counting-numbers.skip-twos',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'Counting by twos: {x}, {x + 2}, {x + 4}, ?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '12', step: 2 }],
    answer: 'x + 6',
    hint: 'Add two more each time.',
    tags: ['AC9MFA01', 'MAE-FG-02'],
  },
  {
    id: 'maths.K.counting-numbers.number-line',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'What number is the arrow pointing to?',
    // The line is ten long and starts at 0, 5 or 10, so the same answer is
    // shown on a different stretch of the number line on different seeds -
    // which is where this question's variation comes from, since the arrow's
    // position *is* the answer and cannot move.
    vars: [
      { name: 'base', kind: 'pick', from: [0, 5, 10] },
      { name: 'n', kind: 'int', min: 'base + 1', max: 'base + 9' },
    ],
    // Never on one of the three labelled ticks, so the number is always
    // counted off the small ones rather than read off a label.
    constraints: ['n != base + 5'],
    answer: 'n',
    hint: 'Start at the last number you can see, then count the small ticks.',
    // Both ends and the step are pinned together. A step left open is drawn at
    // whatever divides the line, so a whole number in 0-9 is sometimes shown on
    // a line reading 2.5 | 5 | 7.5 - legitimate, and the wrong line for a
    // five-year-old.
    figure: { kind: 'number-line', at: 'n', from: 'base', to: 'base + 10', step: '5' },
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.comparing-numbers.larger',
    subject: 'maths',
    topic: 'comparing numbers',
    level: 'K',
    prompt: 'Which number is larger, {x} or {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: '20' },
    ],
    constraints: ['x != y'],
    answer: 'max(x, y)',
    tags: ['AC9MFN03', 'MAE-RWN-01'],
  },
  {
    id: 'maths.K.comparing-numbers.smaller',
    subject: 'maths',
    topic: 'comparing numbers',
    level: 'K',
    prompt: 'Which number is smaller, {x} or {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: '20' },
    ],
    constraints: ['x != y'],
    answer: 'min(x, y)',
    tags: ['AC9MFN03', 'MAE-RWN-01'],
  },
  {
    id: 'maths.K.comparing-numbers.more-than',
    subject: 'maths',
    topic: 'comparing numbers',
    level: 'K',
    // A boolean answer makes this a true/false question; the two options are implied.
    prompt: 'True or false: {x} is more than {y}.',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: '20' },
    ],
    constraints: ['x != y'],
    answer: 'x > y',
    tags: ['AC9MFN03', 'MAE-RWN-01'],
  },
  {
    id: 'maths.K.comparing-numbers.between',
    subject: 'maths',
    topic: 'comparing numbers',
    level: 'K',
    prompt: 'Which number goes between {x} and {x + 2}?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '18' }],
    answer: 'x + 1',
    tags: ['AC9MFN01', 'MAE-RWN-02'],
  },
  {
    id: 'maths.K.addition.to-ten',
    subject: 'maths',
    topic: 'addition',
    level: 'K',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '9' },
      { name: 'y', kind: 'int', min: '1', max: '10 - x' },
    ],
    answer: 'x + y',
    hint: 'Start at {x} and count on {y} more.',
    tags: ['AC9MFN05', 'MAE-CSQ-01'],
  },
  {
    id: 'maths.K.addition.story',
    subject: 'maths',
    topic: 'addition',
    level: 'K',
    prompt: 'Ali has {x} shells. He finds {y} more. How many shells does he have now?',
    // From 2, so it never reads "Ali has 1 shells".
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '8' },
      { name: 'y', kind: 'int', min: '1', max: '6' },
    ],
    answer: 'x + y',
    tags: ['AC9MFN05', 'MAE-CSQ-01'],
  },
  {
    id: 'maths.K.addition.part-part-whole',
    subject: 'maths',
    topic: 'addition',
    level: 'K',
    prompt: 'You need 10 counters. You already have {x}. How many more do you need?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
    answer: '10 - x',
    hint: 'Count on from {x} up to 10.',
    tags: ['AC9MFN04', 'MAE-CSQ-02'],
  },
  {
    id: 'maths.K.subtraction.to-ten',
    subject: 'maths',
    topic: 'subtraction',
    level: 'K',
    prompt: 'What is {x} − {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'y', kind: 'int', min: '1', max: 'x - 1' },
    ],
    answer: 'x - y',
    hint: 'Count back {y} from {x}.',
    tags: ['AC9MFN05', 'MAE-CSQ-01'],
  },
  {
    id: 'maths.K.subtraction.story',
    subject: 'maths',
    topic: 'subtraction',
    level: 'K',
    // "{y} of them swim away" needs y to be plural to read right.
    prompt: 'There are {x} ducks on a pond. {y} of them swim away. How many are left?',
    vars: [
      { name: 'x', kind: 'int', min: '4', max: '10' },
      { name: 'y', kind: 'int', min: '2', max: 'x - 1' },
    ],
    answer: 'x - y',
    tags: ['AC9MFN05', 'MAE-CSQ-01'],
  },
  {
    id: 'maths.K.sharing.equal-groups',
    subject: 'maths',
    topic: 'sharing',
    level: 'K',
    prompt: '{total} apples are shared equally between {n} children. How many does each child get?',
    vars: [
      { name: 'n', kind: 'pick', from: [2, 5] },
      { name: 'each', kind: 'int', min: '1', max: '4' },
      { name: 'total', kind: 'expr', expr: 'n * each' },
    ],
    answer: 'each',
    hint: 'Share them out one at a time until they are all gone.',
    tags: ['AC9MFN06', 'MAE-FG-02'],
  },
  {
    id: 'maths.K.sharing.how-many-groups',
    subject: 'maths',
    topic: 'sharing',
    level: 'K',
    prompt: 'You have {total} stickers. How many children get {n} stickers each?',
    vars: [
      { name: 'n', kind: 'pick', from: [2, 5] },
      { name: 'groups', kind: 'int', min: '2', max: '4' },
      { name: 'total', kind: 'expr', expr: 'n * groups' },
    ],
    answer: 'groups',
    tags: ['AC9MFN06', 'MAE-FG-02'],
  },
  {
    id: 'maths.K.even-and-odd.next-even',
    subject: 'maths',
    topic: 'even and odd',
    level: 'K',
    prompt: '{x} is an even number. What is the next even number?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '18', step: 2 }],
    constraints: ['isEven(x)'],
    answer: 'x + 2',
    hint: 'Count on two from {x}.',
    tags: ['AC9MFA01', 'MAE-FG-02'],
  },
  {
    id: 'maths.K.patterns.repeating-two',
    subject: 'maths',
    topic: 'patterns',
    level: 'K',
    prompt: 'What comes next? {a}, {b}, {a}, {b}, {a}, ?',
    // Both colours from one list, kept apart by a constraint - the fix
    // `repeating-three` below already carried, and this one was left with the
    // two disjoint lists it describes. Drawn that way the answer was always the
    // yellow-or-orange-or-purple one and never the red-or-blue-or-green one, so
    // three named colours were two the answer could be and one it could not.
    // Worth 34 points over guessing with the pattern unread, and a third colour
    // from the same list is what closes it: `c` is a distractor the answer could
    // just as well have been.
    vars: [
      { name: 'a', kind: 'pick', from: PATTERN_COLOURS },
      { name: 'b', kind: 'pick', from: PATTERN_COLOURS },
      { name: 'c', kind: 'pick', from: PATTERN_COLOURS },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: 'b',
    answerType: 'choice',
    choices: { count: 3, distractors: ['a', 'c'] },
    hint: 'The pattern goes {a}, {b}, over and over.',
    tags: ['AC9MFA01', 'MAE-FG-01'],
  },
  {
    id: 'maths.K.patterns.repeating-three',
    subject: 'maths',
    topic: 'patterns',
    level: 'K',
    prompt: 'What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, ?',
    // All three colours come from one list, kept apart by constraints rather
    // than by which list they were drawn from. Three disjoint lists made the
    // answer always the yellow-or-orange one, and narration reads the options
    // aloud - so a child who cannot read could hear three colours and pick the
    // right button without ever looking at the pattern.
    vars: [
      { name: 'a', kind: 'pick', from: PATTERN_COLOURS },
      { name: 'b', kind: 'pick', from: PATTERN_COLOURS },
      { name: 'c', kind: 'pick', from: PATTERN_COLOURS },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: 'b',
    answerType: 'choice',
    choices: { count: 3, distractors: ['a', 'c'] },
    hint: 'The part that repeats is {a}, {b}, {c}.',
    tags: ['AC9MFA01', 'MAE-FG-01'],
  },
  {
    id: 'maths.K.measurement.longer',
    subject: 'maths',
    topic: 'measurement',
    level: 'K',
    prompt:
      'A red ribbon is {a} blocks long and a blue one is {b}. Which is longer, red or blue?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['a != b'],
    answer: "a > b ? 'red' : 'blue'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'red'", "'blue'"] },
    tags: ['AC9MFM01', 'MAE-GM-02'],
  },
  {
    id: 'maths.K.measurement.holds-more',
    subject: 'maths',
    topic: 'measurement',
    level: 'K',
    prompt:
      'A box holds {a} cups of sand. A jar holds {b} cups of sand. Which holds more, the box or the jar?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['a != b'],
    answer: "a > b ? 'box' : 'jar'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'box'", "'jar'"] },
    tags: ['AC9MFM01', 'MAE-3DS-02'],
  },
  {
    id: 'maths.K.measurement.heavier',
    subject: 'maths',
    topic: 'measurement',
    level: 'K',
    // A book and a shoe rather than a book and a feather: either really could
    // be the heavier one, so the balance is the only place the answer is.
    prompt:
      'A book balances {a} blocks. A shoe balances {b} blocks. Which is heavier, the book or the shoe?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['a != b'],
    answer: "a > b ? 'book' : 'shoe'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'book'", "'shoe'"] },
    tags: ['AC9MFM01', 'MAE-NSM-01'],
  },
  {
    id: 'maths.K.measurement.lightest',
    subject: 'maths',
    topic: 'measurement',
    level: 'K',
    // Three bags told apart by colour alone, so nothing a child already knows
    // about how heavy things are can answer it for them.
    prompt:
      'The red bag balances {a} blocks, the blue {b} and the green {c}. Which bag is the lightest?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
      { name: 'c', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: "a < b && a < c ? 'red' : b < c ? 'blue' : 'green'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'red'", "'blue'", "'green'"] },
    tags: ['AC9MFM01', 'MAE-NSM-01'],
  },
  {
    id: 'maths.K.time.day-after',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'Which day comes after {day}?',
    // Four days in a row, and `o` says where in that run the named day sits -
    // first, second or third, so the answer sits second, third or fourth.
    //
    // **The run used to be pinned to `before, day, after, twoAfter`**, which
    // put the answer third of four every single time. Seven days gave seven
    // option sets and seven answers, one to one, so the four buttons named the
    // day without the week being thought about at all: measured over 600
    // draws, keying on the option set alone, that beat the question 100% of
    // the time against a 25% blind guess. Sliding the window leaves the same
    // four sorts of distractor - the day named, the day before it, the day
    // after next - and takes the tell out. The named day is still always one
    // of the four, since it is the trap the question is really about.
    vars: [
      { name: 'n', kind: 'int', min: '0', max: '6' },
      { name: 'o', kind: 'pick', from: [0, 1, 2] },
      { name: 'day', kind: 'expr', expr: dayName('n') },
      { name: 'after', kind: 'expr', expr: dayName('mod(n + 1, 7)') },
      { name: 'd1', kind: 'expr', expr: dayName('mod(n - o + 7, 7)') },
      { name: 'd2', kind: 'expr', expr: dayName('mod(n - o + (o == 0 ? 2 : 1) + 7, 7)') },
      { name: 'd3', kind: 'expr', expr: dayName('mod(n - o + (o == 2 ? 2 : 3) + 7, 7)') },
    ],
    answer: 'after',
    answerType: 'choice',
    choices: { count: 4, distractors: ['d1', 'd2', 'd3'] },
    tags: ['AC9MFM02', 'MAE-NSM-02'],
  },
  {
    id: 'maths.K.time.day-before',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'Which day comes before {day}?',
    // The mirror of `day-after` above, and slid for the reason written there:
    // `o` is where the answer sits in the run of four, so the named day - one
    // later, and always on screen - lands second, third or fourth.
    vars: [
      { name: 'n', kind: 'int', min: '0', max: '6' },
      { name: 'o', kind: 'pick', from: [0, 1, 2] },
      { name: 'day', kind: 'expr', expr: dayName('n') },
      { name: 'before', kind: 'expr', expr: dayName('mod(n + 6, 7)') },
      { name: 'd1', kind: 'expr', expr: dayName('mod(n - 1 - o + (o == 0 ? 1 : 0) + 7, 7)') },
      { name: 'd2', kind: 'expr', expr: dayName('mod(n - 1 - o + (o <= 1 ? 2 : 1) + 7, 7)') },
      { name: 'd3', kind: 'expr', expr: dayName('mod(n - 1 - o + 3 + 7, 7)') },
    ],
    answer: 'before',
    answerType: 'choice',
    choices: { count: 4, distractors: ['d1', 'd2', 'd3'] },
    tags: ['AC9MFM02', 'MAE-NSM-02'],
  },

  // The two clock faces, and the one place in this file where the syllabuses
  // disagree. NSW puts hour time at Early Stage 1; ACARA puts reading a clock
  // at Year 2, and Foundation's one time description is about the days of the
  // week rather than about a dial - so these two cite NSW alone, and
  // `catalog.test.ts` names them rather than letting the gap go unremarked.
  {
    id: 'maths.K.time.oclock',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'What time is this?',
    // **The four hours are a run and the answer is drawn from inside it**, which
    // is the third go at these buttons and the first that measures clean.
    //
    // Two near hours and one further off is the right *kind* of distractor - a
    // misread hour hand lands next door, not across the dial. Drawn as -1, +1
    // and +4 the answer was the middle of three consecutive hours every time,
    // so the second go gave each offset a drawn sign. That moved the answer's
    // rank and left the shape: two hours within two of the answer and one three
    // to five away is a signature, and "the hour with two close neighbours"
    // still named the answer 59 times in a hundred against a 25 in a hundred
    // guess. A run has no such shape - every hour on screen has the same
    // neighbours as every other - so there is nothing left to read off.
    //
    // The hours wrap, so the run is drawn as its first hour and the answer as a
    // place inside it. Drawing the *answer* first and building the run around it
    // would leave the hours near 1 and 12 unable to sit at every place, and an
    // uneven answer is the thing being fixed.
    vars: [
      { name: 'lo', kind: 'int', min: '1', max: '12' },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'h', kind: 'expr', expr: 'mod(lo + k - 1, 12) + 1' },
    ],
    // O'clock only. Early Stage 1 reads the hour and Stage 1 adds half past,
    // and a time is not a thing the number pad can type - so the hours are
    // written out and tapped.
    answer: "h + ' o’clock'",
    answerType: 'choice',
    choices: {
      count: 4,
      // Four, one of which is the answer on every draw and is dropped as a
      // duplicate - which is what leaves exactly three wrong hours.
      distractors: [
        "(mod(lo - 1, 12) + 1) + ' o’clock'",
        "(mod(lo, 12) + 1) + ' o’clock'",
        "(mod(lo + 1, 12) + 1) + ' o’clock'",
        "(mod(lo + 2, 12) + 1) + ' o’clock'",
      ],
    },
    hint: 'The short hand tells you the hour.',
    // **`numerals` is pinned, and omitting it was a real bug rather than a
    // missing flourish.** An omitted field is a coin toss, so half of these drew
    // a dial with twelve bare ticks and no numbers on it at all - which is not
    // an Early Stage 1 question however carefully the hands are read. Nothing is
    // lost by pinning it: `minuteTicks` and the two continuously jittered hand
    // lengths already give hundreds of distinct figures per answer.
    figure: { kind: 'clock', hour: 'h', minute: '0', numerals: 'true' },
    tags: ['MAE-NSM-02'],
  },
  {
    id: 'maths.K.time.clock-says',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'True or false: this clock shows {h} o’clock.',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'right', kind: 'int', min: '0', max: '1' },
      // How far the wrong clock is out by. From 1 to 11, so a wrong one is
      // never accidentally the hour the question named.
      { name: 'off', kind: 'int', min: '1', max: '11' },
      { name: 'shown', kind: 'expr', expr: 'right == 1 ? h : mod(h + off - 1, 12) + 1' },
    ],
    answer: 'shown == h',
    // Pinned for the reason the question above gives, and it matters more here:
    // an unnumbered dial turns a true/false into a coin toss.
    figure: { kind: 'clock', hour: 'shown', minute: '0', numerals: 'true' },
    tags: ['MAE-NSM-02'],
  },
  {
    id: 'maths.K.shapes.sides',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'How many sides does a {shape} have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'] },
    ],
    answer:
      "shape == 'triangle' ? 3 : shape == 'square' ? 4 : shape == 'rectangle' ? 4 : shape == 'pentagon' ? 5 : 6",
    tags: ['AC9MFSP01', 'MAE-2DS-01'],
  },
  {
    id: 'maths.K.shapes.name',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'A shape has {n} equal sides and {n} corners. What is it called?',
    vars: [{ name: 'n', kind: 'pick', from: [3, 4, 5, 6] }],
    answer: shapeName('n'),
    answerType: 'choice',
    // The other three shapes, stepped round the 3..6 cycle so they never repeat.
    choices: {
      count: 4,
      distractors: [
        shapeName('mod(n - 2, 4) + 3'),
        shapeName('mod(n - 1, 4) + 3'),
        shapeName('mod(n, 4) + 3'),
      ],
    },
    tags: ['AC9MFSP01', 'MAE-2DS-01'],
  },

  // The first three questions in the course that are a picture rather than a
  // sentence. None of them says anything about rotation, so the same shape
  // arrives turned differently every time - a square recognised only sitting
  // flat on its base is a square recognised by its picture.
  {
    id: 'maths.K.shapes.name-picture',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'What shape is this?',
    vars: [
      // Three names that cannot both be true of one drawing. A square *is* a
      // rectangle, so those two can never share a screen here - and the way
      // round that is to drop one of the names from the question, not to swap
      // it out when a square turns up. Making the third button depend on what
      // was drawn put the answer in the option set: "hexagon" on screen meant
      // "square" every time, which answered a third of the questions outright
      // and took a picture-blind child from 33% to 67% - the anchoring failure
      // this feature exists to prevent, arriving through the buttons instead
      // of through the drawing. Rectangles are still drawn and counted by the
      // two questions below; it is only the naming that leaves them out.
      { name: 'shape', kind: 'pick', from: ['triangle', 'square', 'hexagon'] },
      // Equal-sided, two-sides-equal and no-sides-equal are all triangles, and
      // the drawn one is picked afresh: a child shown only the neat one learns
      // that picture instead of "three straight sides".
      { name: 'tri', kind: 'pick', from: ['equilateral', 'isosceles', 'scalene'] },
      { name: 'drawn', kind: 'expr', expr: "shape == 'triangle' ? tri : shape" },
    ],
    answer: 'shape',
    answerType: 'choice',
    // Fixed, so the three buttons are the same three whatever was drawn and
    // say nothing at all about which of them is right.
    choices: { count: 3, distractors: ["'triangle'", "'square'", "'hexagon'"] },
    figure: { kind: 'polygon', shape: 'drawn' },
    tags: ['AC9MFSP01', 'MAE-2DS-01'],
  },
  {
    id: 'maths.K.shapes.sides-picture',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'How many sides does this shape have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'equilateral',
          'isosceles',
          'scalene',
          'square',
          'rectangle',
          'trapezium',
          'pentagon',
          'hexagon',
        ],
      },
    ],
    answer: sideCount('shape'),
    hint: 'Touch each side as you count it.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9MFSP01', 'MAE-2DS-01'],
  },
  {
    id: 'maths.K.shapes.is-a-triangle',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'True or false: this shape is a triangle.',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'equilateral',
          'isosceles',
          'scalene',
          'right-triangle',
          'square',
          'rectangle',
          'trapezium',
          'pentagon',
          'hexagon',
        ],
      },
      // Through a variable rather than compared inline: `sideCount` is a
      // ternary chain, and `==` binds tighter than `?:`, so appending the
      // comparison would quietly test only the chain's last branch.
      { name: 'sides', kind: 'expr', expr: sideCount('shape') },
    ],
    answer: 'sides == 3',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9MFSP01', 'MAE-2DS-01'],
  },

  // Three dimensions. A solid is the other half of what Early Stage 1 means by
  // a shape, and every one of these is a picture for the reason the flat ones
  // above are: there is no sentence that asks what a cylinder looks like
  // without answering itself. The names are tapped, never spelled.
  {
    id: 'maths.K.shapes.solid-name',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'What is this called?',
    vars: [{ name: 'shape', kind: 'pick', from: ['cube', 'sphere', 'cone', 'cylinder'] }],
    answer: 'shape',
    answerType: 'choice',
    // Fixed, so the same four buttons appear whatever was drawn and none of
    // them says which one it is. Every one is a solid a five-year-old has
    // held, which is what makes a wrong tap a real mistake rather than a
    // shrug at a word they have never met.
    choices: { count: 4, distractors: ["'cube'", "'sphere'", "'cone'", "'cylinder'"] },
    // The view is pinned because the prompt commits to one: "what is this
    // called" of a net is a different question, and a harder one than Early
    // Stage 1 asks. Which way the solid leans and how tall or broad it is
    // still move on every seed.
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9MFSP01', 'MAE-3DS-01'],
  },
  {
    id: 'maths.K.shapes.solid-rolls',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'True or false: this shape can roll.',
    // A cone is left out on purpose. It does roll, in a circle, and that is a
    // conversation to have with a teacher rather than a button to be marked
    // wrong on.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'sphere', 'cylinder', 'square-pyramid'],
      },
    ],
    answer: "shape == 'sphere' || shape == 'cylinder'",
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9MFSP01', 'MAE-3DS-01'],
  },
  {
    id: 'maths.K.shapes.solid-everyday',
    subject: 'maths',
    topic: 'shapes',
    level: 'K',
    prompt: 'Which of these is shaped like this?',
    // A cuboid as well as a cube, and both of them a box. The naming question
    // above draws from four solids and this one from five, so the two do not
    // read as the same question twice when a session puts them near each other.
    vars: [
      // **Weighted, because five solids are four answers.** A cube and a
      // cuboid are both a box, so drawn flat "a box" was right two draws in
      // five and tapping it beat guessing by 15 points without the picture. A
      // weight each to the two that share an answer and two to the rest puts
      // all four buttons on a quarter of draws.
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'sphere', 'cone', 'cylinder'],
        weights: [1, 1, 2, 2, 2],
      },
    ],
    answer:
      "shape == 'sphere' ? 'a ball' : shape == 'cube' || shape == 'cuboid' ? 'a box' : " +
      "shape == 'cylinder' ? 'a can' : 'a party hat'",
    answerType: 'choice',
    choices: { count: 4, distractors: ["'a ball'", "'a box'", "'a can'", "'a party hat'"] },
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9MFSP01', 'MAE-3DS-01'],
  },
  {
    id: 'maths.K.data.most-counted',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'Sam counted cars: {a} red, {b} blue and {c} green. Which colour did he see most of?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '12' },
      { name: 'b', kind: 'int', min: '1', max: '12' },
      { name: 'c', kind: 'int', min: '1', max: '12' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: "a > b && a > c ? 'red' : b > c ? 'blue' : 'green'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'red'", "'blue'", "'green'"] },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },

  // Two kinds of graph - a column graph and a picture graph - which is where a
  // Kindergartener meets data as something read off a drawing rather than
  // counted out of a sentence. Each kind gets a pair: one question reading a
  // single row or column, and one comparing them.
  {
    id: 'maths.K.data.graph-count',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'This graph shows the pets in our class. How many children have a {pet}?',
    // Up to five, and the scale pinned to one, so every bar is read straight
    // off the rungs. A scale of two would put half the answers between two
    // lines, which is Year 2's question and not this one.
    vars: [
      { name: 'dog', kind: 'int', min: '1', max: '5' },
      { name: 'cat', kind: 'int', min: '1', max: '5' },
      { name: 'fish', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'pet', kind: 'expr', expr: "i == 0 ? 'dog' : i == 1 ? 'cat' : 'fish'" },
    ],
    // **Something has to be more than one.** Three values each drawn 1 to 5 are
    // all 1 once in every 125 draws, and at a scale of 1 that leaves the axis a
    // single step, which `bar` refuses outright - so this template would have
    // shipped and then failed in front of a child. It validated only because
    // `figureIssues` is sampled over fifty seeds and one in 125 is a coin toss
    // at that count. The constraint makes the draw impossible rather than rare;
    // it is on the maximum rather than on one named animal so that no pet is
    // quietly barred from ever being the answer 1. Rejection sampling throws
    // away under 1% of draws.
    constraints: ['max(dog, cat, fish) > 1'],
    answer: 'i == 0 ? dog : i == 1 ? cat : fish',
    hint: 'Find the name along the bottom, then count up.',
    figure: {
      kind: 'bar',
      values: "dog + ',' + cat + ',' + fish",
      labels: "'Dog,Cat,Fish'",
      scale: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.graph-most',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    // Toys rather than fruit: three categories leave about four characters
    // each for their names in a parent's report row, and "Banana" is six.
    prompt: 'This graph shows our favourite toys. Which toy did the most children pick?',
    vars: [
      { name: 'ball', kind: 'int', min: '1', max: '5' },
      { name: 'bike', kind: 'int', min: '1', max: '5' },
      { name: 'doll', kind: 'int', min: '1', max: '5' },
    ],
    constraints: ['ball != bike', 'bike != doll', 'ball != doll'],
    answer: "ball > bike && ball > doll ? 'Ball' : bike > doll ? 'Bike' : 'Doll'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Ball'", "'Bike'", "'Doll'"] },
    figure: {
      kind: 'bar',
      values: "ball + ',' + bike + ',' + doll",
      labels: "'Ball,Bike,Doll'",
      scale: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.picture-count',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    // "Stands for", not "is": the icon is a plain shape, and the graph says
    // what it stands for in its own key. A prompt may only name what the
    // figure draws.
    prompt: 'Each picture stands for one book. How many books did {who} read?',
    vars: [
      // Four at most: with one icon per book a fifth is one more than a
      // parent's report row can show as countable dots.
      { name: 'ana', kind: 'int', min: '1', max: '4' },
      { name: 'ben', kind: 'int', min: '1', max: '4' },
      { name: 'kim', kind: 'int', min: '1', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Ana' : i == 1 ? 'Ben' : 'Kim'" },
    ],
    answer: 'i == 0 ? ana : i == 1 ? ben : kim',
    hint: 'Count the pictures in that row.',
    // One thing per icon, pinned. A key of two turns counting into doubling,
    // which is two years away.
    figure: {
      kind: 'pictograph',
      counts: "ana + ',' + ben + ',' + kim",
      labels: "'Ana,Ben,Kim'",
      key: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.picture-fewest',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'Each picture stands for one shell. Who found the fewest shells?',
    vars: [
      // Four at most, as above: one icon per shell, and a fifth is one more
      // than a parent's report row can show as countable dots.
      { name: 'ana', kind: 'int', min: '1', max: '4' },
      { name: 'ben', kind: 'int', min: '1', max: '4' },
      { name: 'kim', kind: 'int', min: '1', max: '4' },
    ],
    constraints: ['ana != ben', 'ben != kim', 'ana != kim'],
    answer: "ana < ben && ana < kim ? 'Ana' : ben < kim ? 'Ben' : 'Kim'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Ana'", "'Ben'", "'Kim'"] },
    hint: 'The shortest row is the fewest.',
    figure: {
      kind: 'pictograph',
      counts: "ana + ',' + ben + ',' + kim",
      labels: "'Ana,Ben,Kim'",
      key: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },

  // ------------------------------------------------------------------
  // Position, halves, and four more readings of a graph.
  //
  // The strand pass that added these was closing the distance to NSW's own
  // 40/40/20 split across the three strands, and Kindergarten was the year
  // furthest from it - 20 Number and algebra against 16 Measurement and space
  // and 5 Statistics and probability. Two Early Stage 1 focus areas had no
  // question at all: `MAE-GM-01`, position and direction, and `MAE-GM-03`,
  // halves. Both are below.
  // ------------------------------------------------------------------

  // **A grid with no letters or numbers on it**, which is what makes this a
  // position question rather than a grid-reference one. NSW puts grid maps and
  // references at Stage 2 - Years 3 and 4 - so a lettered axis here would be
  // asking a five-year-old for a convention the syllabus teaches three years
  // later. `axisLabels: 'none'` leaves the grid as squares and the answer as
  // the words a child actually uses for where something is.
  //
  // The extent is left open, which is this kind's own answer to the anchoring
  // rule: the builder picks a different grid on every seed and the row the dot
  // is in is the same row whatever size the grid is.
  {
    id: 'maths.K.position.which-row',
    subject: 'maths',
    topic: 'position',
    level: 'K',
    prompt: 'Is the dot in the top row or the bottom row?',
    // Three rows, and the dot in the first or the last of them. The middle row
    // is deliberately not an answer: "middle" is a third word to read on a
    // button where the question is about two opposite ones, and a dot one row
    // from either edge of a taller grid is not clearly in either.
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '3' },
      { name: 'top', kind: 'pick', from: [1, 0] },
      // Row 3 is the top row: `grid` counts rows up from 1 at the bottom.
      { name: 'y', kind: 'expr', expr: 'top == 1 ? 3 : 1' },
    ],
    answer: "top == 1 ? 'top' : 'bottom'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'top'", "'bottom'"] },
    hint: 'The top row is the one right at the top of the grid.',
    figure: {
      kind: 'grid',
      at: "x + ',' + y",
      rows: '3',
      axisLabels: "'none'",
    },
    tags: ['AC9MFSP02', 'MAE-GM-01'],
  },
  {
    id: 'maths.K.position.which-side',
    subject: 'maths',
    topic: 'position',
    level: 'K',
    prompt: 'Is the dot on the left side or the right side?',
    // The columns pin rather than the rows, and for the reason the row
    // question pins rows: the dot sits in the first or the last column so that
    // "left" and "right" are true of it without a judgement call.
    vars: [
      { name: 'y', kind: 'int', min: '1', max: '3' },
      { name: 'left', kind: 'pick', from: [1, 0] },
      { name: 'x', kind: 'expr', expr: 'left == 1 ? 1 : 3' },
    ],
    answer: "left == 1 ? 'left' : 'right'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'left'", "'right'"] },
    hint: 'Left is the side your left hand is on.',
    figure: {
      kind: 'grid',
      at: "x + ',' + y",
      columns: '3',
      axisLabels: "'none'",
    },
    tags: ['AC9MFSP02', 'MAE-GM-01'],
  },

  // **Halves, and Year 1 asks these too** - `maths.1.fractions.is-half` and
  // `.how-much-shaded`. That is a restatement made legitimate by the year
  // rather than by the citation, which is the ordinary case: NSW carries
  // halves at Early Stage 1 (`MAE-GM-03`) *and* at Stage 1 (`MA1-GM-03`), and
  // these two are the easier reading. Year 1's boolean walks the shaded count
  // either side of the half over 4, 6 and 8 parts; this one only ever shows
  // two or four parts, so a child can see the halves without counting past
  // four. Keep them a step apart if either is ever reworked.
  {
    id: 'maths.K.fractions.is-half-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: 'K',
    prompt: 'True or false: half of this shape is shaded.',
    // Derived, never constrained. A constraint of the form "shade the half
    // half the time" is satisfied by redrawing the whole scope, so the branch
    // that is harder to satisfy gets thrown away more often and the answer
    // comes out lopsided - which is the mistake two Year 1 templates made and
    // had to be rewritten for. Here `half` decides the answer and `n` falls
    // out of it, so no draw is ever rejected and the split is the pick's.
    vars: [
      { name: 'd', kind: 'pick', from: [2, 4] },
      { name: 'half', kind: 'pick', from: [1, 0] },
      // **The whole shape shaded is one of the false answers, and on two parts
      // it is the only one.** A shape cut in two can be shaded one part - the
      // half - or both, so a "not the half" branch that only ever shades
      // between 1 and `d - 1` parts has nothing to draw at `d = 2` and answers
      // true anyway. Written that way first and measured at 84/16 true, which
      // is the skew this file's Year 1 siblings were rewritten for.
      //
      // `k` walks the shadings *other than* the half: 1 to `d`, with `d / 2`
      // stepped over. Two parts gives {2}; four gives {1, 3, 4}.
      { name: 'k', kind: 'int', min: '1', max: 'd - 1' },
      { name: 'n', kind: 'expr', expr: 'half == 1 ? d / 2 : (k < d / 2 ? k : k + 1)' },
    ],
    answer: 'n * 2 == d',
    hint: 'Half means the shaded parts and the plain parts are the same.',
    // `shape` left open: the prompt says "this shape" and names nothing, so a
    // circle, a strip and a rectangle are all honest drawings of it.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['MAE-GM-03'],
  },
  {
    id: 'maths.K.fractions.equal-parts',
    subject: 'maths',
    topic: 'fractions',
    level: 'K',
    prompt: 'How many equal parts is this shape cut into?',
    // Counting the parts rather than reading the fraction, which is where a
    // five-year-old meets a fraction first - the shape is cut fairly, and how
    // many pieces that made is a counting question with a picture.
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '6' },
      { name: 'n', kind: 'int', min: '1', max: 'd - 1' },
    ],
    answer: 'd',
    hint: 'Count all the parts, the shaded ones and the plain ones.',
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['MAE-GM-03'],
  },

  // Five more readings of a graph, which is the other half of the strand pass.
  // The two kinds above each had a pair - read one row, and compare the rows -
  // and this completes the set of things a five-year-old can be asked about a
  // display they can already read: the smallest, the total, and how much more
  // one is than another. Every one of them is `MAE-DATA-01`, which is the only
  // Statistics and probability outcome Early Stage 1 has - NSW has no Chance
  // focus area until Stage 1, so a chance question here would have no honest
  // NSW code to cite.
  {
    id: 'maths.K.data.graph-fewest',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'This graph shows the fruit we ate. Which fruit did the fewest children eat?',
    // Three-letter names throughout. `bar`'s room for a category name shrinks
    // as the value axis grows a digit, and a name over budget shrinks the very
    // budget it is measured against - so short nouns, and nothing that has to
    // be argued for.
    vars: [
      { name: 'fig', kind: 'int', min: '1', max: '5' },
      { name: 'pear', kind: 'int', min: '1', max: '5' },
      { name: 'plum', kind: 'int', min: '1', max: '5' },
    ],
    // Distinct so there is one fewest, and something above 1 so the axis has
    // more than a single step - which `bar` refuses outright. Three values
    // drawn 1 to 5 are all 1 about once in 125 draws, which a 50-seed
    // validation sample would pass by luck rather than by construction.
    constraints: ['fig != pear', 'pear != plum', 'fig != plum', 'max(fig, pear, plum) > 1'],
    answer: "fig < pear && fig < plum ? 'Fig' : pear < plum ? 'Pear' : 'Plum'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Fig'", "'Pear'", "'Plum'"] },
    hint: 'The shortest one is the fewest.',
    figure: {
      kind: 'bar',
      values: "fig + ',' + pear + ',' + plum",
      labels: "'Fig,Pear,Plum'",
      scale: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.graph-altogether',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'This graph shows the hats we found. How many hats are there altogether?',
    // **Two categories, not three.** The total is the point and a
    // five-year-old adds two numbers; three would make this a question about
    // adding three, which Kindergarten does not do. Two bars also leave the
    // most room a category name ever gets.
    vars: [
      { name: 'red', kind: 'int', min: '1', max: '5' },
      { name: 'blue', kind: 'int', min: '1', max: '5' },
    ],
    constraints: ['max(red, blue) > 1'],
    answer: 'red + blue',
    hint: 'Read both numbers off the graph, then add them.',
    figure: {
      kind: 'bar',
      values: "red + ',' + blue",
      labels: "'Red,Blue'",
      scale: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.graph-more-than',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'How many more children chose {big} than {small}?',
    // The two names come out of the draw rather than being written into the
    // prompt, so which bar is the taller one moves and the question cannot be
    // answered by learning that the first name is always the bigger.
    vars: [
      { name: 'cat', kind: 'int', min: '1', max: '5' },
      { name: 'dog', kind: 'int', min: '1', max: '5' },
      { name: 'big', kind: 'expr', expr: "cat > dog ? 'Cat' : 'Dog'" },
      { name: 'small', kind: 'expr', expr: "cat > dog ? 'Dog' : 'Cat'" },
    ],
    // Different, so the taller bar is a fact rather than a tie - and the
    // answer is then never 0, which is not a reading a child takes off a
    // graph.
    constraints: ['cat != dog'],
    answer: 'abs(cat - dog)',
    hint: 'Read both numbers off the graph, then take the smaller from the bigger.',
    figure: {
      kind: 'bar',
      values: "cat + ',' + dog",
      labels: "'Cat,Dog'",
      scale: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.picture-most',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'Each picture stands for one sticker. Who has the most stickers?',
    // Four at most and three-letter names, which is what a pictograph row
    // permits: the row label's width caps the icons in a row, and a
    // three-character name leaves room for four.
    vars: [
      { name: 'ivy', kind: 'int', min: '1', max: '4' },
      { name: 'joe', kind: 'int', min: '1', max: '4' },
      { name: 'sam', kind: 'int', min: '1', max: '4' },
    ],
    constraints: ['ivy != joe', 'joe != sam', 'ivy != sam'],
    answer: "ivy > joe && ivy > sam ? 'Ivy' : joe > sam ? 'Joe' : 'Sam'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Ivy'", "'Joe'", "'Sam'"] },
    hint: 'The longest row is the most.',
    figure: {
      kind: 'pictograph',
      counts: "ivy + ',' + joe + ',' + sam",
      labels: "'Ivy,Joe,Sam'",
      key: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
  {
    id: 'maths.K.data.picture-altogether',
    subject: 'maths',
    topic: 'data',
    level: 'K',
    prompt: 'Each picture stands for one shell. How many shells did they find altogether?',
    // Two rows, for `graph-altogether`'s reason.
    vars: [
      { name: 'mia', kind: 'int', min: '1', max: '4' },
      { name: 'tom', kind: 'int', min: '1', max: '4' },
    ],
    answer: 'mia + tom',
    hint: 'Count each row, then add the two numbers.',
    figure: {
      kind: 'pictograph',
      counts: "mia + ',' + tom",
      labels: "'Mia,Tom'",
      key: '1',
    },
    tags: ['AC9MFST01', 'MAE-DATA-01'],
  },
];
