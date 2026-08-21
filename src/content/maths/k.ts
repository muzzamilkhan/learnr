import type { QuestionTemplate } from '@/lib/templates/types';
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
  // subtraction and sharing, repeating patterns, direct comparison of length
  // and capacity, days of the week, and naming shapes.
  //
  // The shape questions are where the first pictures in the course are: three
  // of them are a drawing with a caption rather than a sentence.
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
    vars: [
      { name: 'a', kind: 'pick', from: ['red', 'blue', 'green'] },
      { name: 'b', kind: 'pick', from: ['yellow', 'orange', 'purple'] },
    ],
    answer: 'b',
    answerType: 'choice',
    choices: { count: 3, distractors: ['a', "'yellow'", "'orange'", "'purple'"] },
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
      'A red ribbon is {a} blocks long. A blue ribbon is {b} blocks long. Which ribbon is longer, red or blue?',
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
    id: 'maths.K.time.day-after',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'Which day comes after {day}?',
    vars: [
      { name: 'n', kind: 'int', min: '0', max: '6' },
      { name: 'day', kind: 'expr', expr: dayName('n') },
      { name: 'after', kind: 'expr', expr: dayName('mod(n + 1, 7)') },
      { name: 'twoAfter', kind: 'expr', expr: dayName('mod(n + 2, 7)') },
      { name: 'before', kind: 'expr', expr: dayName('mod(n + 6, 7)') },
    ],
    answer: 'after',
    answerType: 'choice',
    choices: { count: 4, distractors: ['day', 'before', 'twoAfter'] },
    tags: ['AC9MFM02', 'MAE-NSM-02'],
  },
  {
    id: 'maths.K.time.day-before',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'Which day comes before {day}?',
    vars: [
      { name: 'n', kind: 'int', min: '0', max: '6' },
      { name: 'day', kind: 'expr', expr: dayName('n') },
      { name: 'before', kind: 'expr', expr: dayName('mod(n + 6, 7)') },
      { name: 'twoBefore', kind: 'expr', expr: dayName('mod(n + 5, 7)') },
      { name: 'after', kind: 'expr', expr: dayName('mod(n + 1, 7)') },
    ],
    answer: 'before',
    answerType: 'choice',
    choices: { count: 4, distractors: ['day', 'after', 'twoBefore'] },
    tags: ['AC9MFM02', 'MAE-NSM-02'],
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

  // ------------------------------------------------------------------
  // The rest of the pictures.
  //
  // Kindergarten's Space, Measurement and Statistics content, which a sentence
  // could not ask: a graph is read off the drawing, a solid has to be looked
  // at, and a clock face and a number line are the two places a number lives
  // somewhere other than in the words.
  //
  // Everything here is Early Stage 1 by NSW's placement, and everything but the
  // two clock faces is Foundation by ACARA's. Those two cite NSW alone: ACARA
  // places reading a clock at Year 2, and Foundation's one time description is
  // about the days of the week rather than about a dial, so there is no honest
  // ACARA code to put beside them. `catalog.test.ts` names them.
  // ------------------------------------------------------------------
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
    hint: 'Count on from the number before it.',
    // Both ends and the step are pinned together. A step left open is drawn at
    // whatever divides the line, so a whole number in 0-9 is sometimes shown on
    // a line reading 2.5 | 5 | 7.5 - legitimate, and the wrong line for a
    // five-year-old.
    figure: { kind: 'number-line', at: 'n', from: 'base', to: 'base + 10', step: '5' },
    tags: ['AC9MFN01', 'MAE-RWN-02'],
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
      'The red bag balances {a} blocks, the blue bag {b} blocks and the green bag {c} blocks. Which bag is the lightest?',
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
    id: 'maths.K.time.oclock',
    subject: 'maths',
    topic: 'time',
    level: 'K',
    prompt: 'What time is this?',
    vars: [{ name: 'h', kind: 'int', min: '1', max: '12' }],
    // O'clock only. Early Stage 1 reads the hour and Stage 1 adds half past,
    // and a time is not a thing the number pad can type - so the hours are
    // written out and tapped.
    answer: "h + ' o’clock'",
    answerType: 'choice',
    // The hour before, the hour after, and one from across the dial. They wrap
    // through 12, so the answer is sometimes the smallest hour on offer and
    // sometimes the largest.
    choices: {
      count: 4,
      distractors: [
        "(mod(h + 10, 12) + 1) + ' o’clock'",
        "(mod(h, 12) + 1) + ' o’clock'",
        "(mod(h + 4, 12) + 1) + ' o’clock'",
      ],
    },
    hint: 'The short hand tells you the hour.',
    figure: { kind: 'clock', hour: 'h', minute: '0' },
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
    figure: { kind: 'clock', hour: 'shown', minute: '0' },
    tags: ['MAE-NSM-02'],
  },
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
    vars: [{ name: 'shape', kind: 'pick', from: ['cube', 'sphere', 'cone', 'cylinder'] }],
    answer:
      "shape == 'sphere' ? 'a ball' : shape == 'cube' ? 'a box' : shape == 'cylinder' ? 'a can' : 'a party hat'",
    answerType: 'choice',
    choices: { count: 4, distractors: ["'a ball'", "'a box'", "'a can'", "'a party hat'"] },
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9MFSP01', 'MAE-3DS-01'],
  },
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
];
