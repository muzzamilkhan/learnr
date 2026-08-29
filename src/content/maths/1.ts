import type { QuestionTemplate } from '../../lib/templates/types';
import { equalSectors, shadedFills, shapeName, sideCount, solidWord } from './helpers';

/**
 * How many equal parts the chance spinners are cut into.
 *
 * **These are named rather than written out because `equalSectors` and
 * `shadedFills` take the same list and cannot check that they got it.** Both
 * write a chain of ternaries covering exactly the counts they are handed, and
 * a count outside that chain falls through to the last branch - so a template
 * whose `pick` offered a five-part spinner while the helper was told
 * `[3, 4, 6]` would draw six sectors for a five-part question, silently and on
 * every seed. One constant per list, used by the `pick` and by both helpers,
 * is what makes the mismatch unwritable.
 *
 * `SPINNER_PARTS` is the general set; `EVEN_SPINNER_PARTS` drops the odd one,
 * because "just as likely either way" needs a split the parts can actually
 * make.
 */
const SPINNER_PARTS = [3, 4, 6];
const EVEN_SPINNER_PARTS = [4, 6];

/** Year 1 - NSW Stage 1. */
export const year1: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 1
  //
  // Numbers to 120, partitioning into tens and ones, skip counting, addition
  // and subtraction within 20, equal sharing and grouping, money, informal
  // units of length and mass, durations in days and hours, half past on a
  // dial, halves and quarters of a shape, where something sits on a grid, the
  // language of chance, and reading a graph.
  //
  // A good half of the newer ones are a picture rather than a sentence, and
  // each is filed with the topic it practises rather than in a block of its
  // own - a spinner is what a chance question is *about*, a solid has to be
  // looked at, and a shaded shape is the only way to ask what a half is
  // without saying it. Someone asking what Year 1 does with shapes should find
  // the flat ones and the solid ones in one run, which is also how the
  // selector reasons about it.
  // ------------------------------------------------------------------
  {
    id: 'maths.1.counting-numbers.skip',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'Counting by {step}s: {x}, {x + step}, {x + 2 * step}, ?',
    vars: [
      { name: 'step', kind: 'pick', from: [2, 5, 10] },
      { name: 'x', kind: 'int', min: 'step', max: 'step * 5' },
    ],
    constraints: ['mod(x, step) == 0'],
    answer: 'x + 3 * step',
    hint: 'Add {step} each time.',
    tags: ['AC9M1A01', 'MA1-FG-01'],
  },
  {
    id: 'maths.1.counting-numbers.after-100',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What number comes after {x}?',
    vars: [{ name: 'x', kind: 'int', min: '95', max: '119' }],
    answer: 'x + 1',
    tags: ['AC9M1N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.1.counting-numbers.largest',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'Which of these is the largest: {a}, {b} or {c}?',
    vars: [
      { name: 'a', kind: 'int', min: '10', max: '120' },
      { name: 'b', kind: 'int', min: '10', max: '120' },
      { name: 'c', kind: 'int', min: '10', max: '120' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: 'max(a, b, c)',
    tags: ['AC9M1N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.1.counting-numbers.ten-more',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What is 10 more than {x}?',
    vars: [{ name: 'x', kind: 'int', min: '5', max: '109' }],
    answer: 'x + 10',
    hint: 'Only the tens digit changes.',
    tags: ['AC9M1N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.1.counting-numbers.ten-less',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What is 10 less than {x}?',
    vars: [{ name: 'x', kind: 'int', min: '15', max: '120' }],
    answer: 'x - 10',
    tags: ['AC9M1N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.1.counting-numbers.number-line',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What number is the arrow pointing to?',
    // Any ten of the first hundred, which is the year's range and also where
    // this question's variation has to come from: the arrow's position *is*
    // the answer and cannot move, so the stretch of line under it does.
    vars: [
      { name: 'base', kind: 'int', min: '0', max: '9' },
      { name: 'start', kind: 'expr', expr: 'base * 10' },
      { name: 'n', kind: 'int', min: 'start + 1', max: 'start + 9' },
    ],
    // Never on the middle labelled tick, so the number is always counted off
    // the small ones rather than read off a label.
    constraints: ['n != start + 5'],
    answer: 'n',
    hint: 'Start at the last number you can see, then count the small ticks.',
    // Both ends and the step pinned together, which is the only way to pin a
    // step at all: left open, a whole number is sometimes drawn on a line
    // reading 42.5 | 45 | 47.5, which is legitimate and not this year's line.
    figure: { kind: 'number-line', at: 'n', from: 'start', to: 'start + 10', step: '5' },
    tags: ['AC9M1N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.1.place-value.count-tens',
    subject: 'maths',
    topic: 'place value',
    level: '1',
    prompt: 'How many whole tens are there in {x}?',
    vars: [{ name: 'x', kind: 'int', min: '20', max: '99' }],
    answer: 'floor(x / 10)',
    hint: 'Look at the first digit of {x}.',
    tags: ['AC9M1N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.1.place-value.count-ones',
    subject: 'maths',
    topic: 'place value',
    level: '1',
    prompt: '{x} is {tens} tens and how many ones?',
    vars: [
      { name: 'x', kind: 'int', min: '21', max: '99' },
      { name: 'tens', kind: 'expr', expr: 'floor(x / 10)' },
    ],
    constraints: ['mod(x, 10) != 0'],
    answer: 'mod(x, 10)',
    tags: ['AC9M1N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.1.place-value.build',
    subject: 'maths',
    topic: 'place value',
    level: '1',
    prompt: 'What number is {tens} tens and {ones} ones?',
    // From 2, so it never reads "1 tens".
    vars: [
      { name: 'tens', kind: 'int', min: '2', max: '9' },
      { name: 'ones', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'tens * 10 + ones',
    tags: ['AC9M1N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.1.addition.small',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '9' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
    ],
    answer: 'x + y',
    hint: 'Start at {x} and count on {y} more.',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.addition.story',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'Mia has {x} stickers. She is given {y} more. How many does she have now?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '12' },
      { name: 'y', kind: 'int', min: '1', max: '8' },
    ],
    answer: 'x + y',
    tags: ['AC9M1N05', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.addition.within-twenty',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '6', max: '14' },
      { name: 'y', kind: 'int', min: '3', max: '20 - x' },
    ],
    answer: 'x + y',
    hint: 'Make ten first, then add what is left over.',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.addition.double',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'What is double {x}?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '10' }],
    answer: 'x * 2',
    hint: '{x} + {x}',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.addition.missing-part',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'What goes in the box? {x} + ? = {total}',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'rest', kind: 'int', min: '1', max: '10' },
      { name: 'total', kind: 'expr', expr: 'x + rest' },
    ],
    answer: 'rest',
    hint: 'Count on from {x} until you reach {total}.',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.subtraction.difference',
    subject: 'maths',
    topic: 'subtraction',
    level: '1',
    prompt: 'What is the difference between {x} and {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '5', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: '19' },
    ],
    constraints: ['x > y'],
    answer: 'x - y',
    hint: 'Count back from {x} until you reach {y}.',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.subtraction.story',
    subject: 'maths',
    topic: 'subtraction',
    level: '1',
    // "{y} of them" rather than "{y} fly away", and y from 2 so the verb agrees.
    prompt: 'There are {x} birds on a wall. {y} of them fly away. How many are left?',
    vars: [
      { name: 'x', kind: 'int', min: '5', max: '20' },
      { name: 'y', kind: 'int', min: '2', max: 'x - 1' },
    ],
    answer: 'x - y',
    tags: ['AC9M1N05', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.subtraction.within-twenty',
    subject: 'maths',
    topic: 'subtraction',
    level: '1',
    prompt: 'What is {x} − {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '12', max: '20' },
      { name: 'y', kind: 'int', min: '3', max: '9' },
    ],
    answer: 'x - y',
    hint: 'Take away enough to get down to ten first.',
    tags: ['AC9M1N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.1.sharing.equal-groups',
    subject: 'maths',
    topic: 'sharing',
    level: '1',
    prompt: '{total} pencils are shared equally between {n} friends. How many does each friend get?',
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '5' },
      { name: 'each', kind: 'int', min: '2', max: '6' },
      { name: 'total', kind: 'expr', expr: 'n * each' },
    ],
    answer: 'each',
    tags: ['AC9M1N06', 'MA1-FG-01'],
  },
  {
    id: 'maths.1.sharing.how-many-groups',
    subject: 'maths',
    topic: 'sharing',
    level: '1',
    prompt: 'How many groups of {n} can you make from {total} counters?',
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '5' },
      { name: 'groups', kind: 'int', min: '2', max: '8' },
      { name: 'total', kind: 'expr', expr: 'n * groups' },
    ],
    answer: 'groups',
    hint: 'Skip count by {n}s until you reach {total}.',
    tags: ['AC9M1N06', 'MA1-FG-01'],
  },
  {
    id: 'maths.1.sharing.array-count',
    subject: 'maths',
    topic: 'sharing',
    level: '1',
    prompt: 'How many dots are there altogether?',
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '5' },
      { name: 'c', kind: 'int', min: '2', max: '5' },
    ],
    answer: 'r * c',
    hint: 'Count the dots in one row, then skip count.',
    // `orientation` is deliberately left to jitter. The obligation to pin it
    // is about what the answer *asks*: this one asks for the total, which a
    // transpose leaves alone, so the jitter is free variation rather than a
    // coin toss over the answer. A question asking how many rows there are
    // would have to pin it.
    figure: { kind: 'array', rows: 'r', columns: 'c' },
    tags: ['AC9M1N06', 'MA1-FG-01'],
  },

  // Halves and quarters, which arrive this year because NSW puts them at
  // Stage 1 and ACARA waits until Year 2 - so these two cite the NSW outcome
  // alone rather than the nearest ACARA description, which would be a
  // citation about something else. The fraction is never simplified: two of
  // four parts shaded is drawn as two of four, because seeing that it is also
  // a half is the whole question.
  {
    id: 'maths.1.fractions.half-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: '1',
    prompt: 'True or false: half of this shape is shaded.',
    // Right half the time by construction rather than by luck. Two parts are
    // left out of the list: with only two to shade, one of them is a half and
    // there is no false case to draw.
    //
    // **The wrong half is stepped round rather than rejection-sampled**, and
    // that is not a stylistic choice. A constraint of the form "if right, hit
    // the half, otherwise miss it" is satisfied by redrawing *everything*, so
    // the branch that is harder to satisfy is thrown away more often: the
    // obvious spelling of this came out 78% false, and a child answering
    // "false" to every one of them would have scored three quarters on a
    // question they had not looked at. `off` walks the shaded counts either
    // side of the half instead, so no draw is ever rejected.
    vars: [
      { name: 'd', kind: 'pick', from: [4, 6, 8] },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'off', kind: 'int', min: '1', max: 'd - 2' },
      {
        name: 'n',
        kind: 'expr',
        expr: 'right == 1 ? d / 2 : mod(d / 2 - 1 + off, d - 1) + 1',
      },
    ],
    answer: 'n * 2 == d',
    hint: 'Half means the shaded parts and the plain parts are the same.',
    // `shape` is left open on purpose: the prompt says "this shape" and names
    // nothing, so a circle, a strip and a rectangle are all honest drawings of
    // it, and three shapes is variation this question would otherwise lack.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['MA1-GM-03'],
  },
  {
    id: 'maths.1.fractions.how-much-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: '1',
    prompt: 'How much of this shape is shaded?',
    // Four drawings, three answers: a half twice over, once as one of two
    // parts and once as two of four. That pairing is the point of the
    // question, and it is why the parts are enumerated rather than drawn.
    vars: [
      // **Weighted, because the four drawings are three answers.** A half is
      // drawn twice over, so flat picks made it the answer half the time and
      // tapping it beat guessing by 16 points with the shape unseen. One and
      // two are the two halves and get a weight each; the quarter and the three
      // quarters get two apiece, which puts each of the three answers on a
      // third of draws while leaving the pairing the question is for intact.
      { name: 'which', kind: 'pick', from: [0, 1, 2, 3], weights: [1, 2, 1, 2] },
      { name: 'd', kind: 'expr', expr: 'which == 0 ? 2 : 4' },
      { name: 'n', kind: 'expr', expr: 'which == 2 ? 2 : which == 3 ? 3 : 1' },
    ],
    // A fraction cannot be typed on a number pad, so it is tapped.
    answer: "n * 2 == d ? 'a half' : n == 1 ? 'a quarter' : 'three quarters'",
    answerType: 'choice',
    // The same three buttons whatever was drawn, so the option set never says
    // which one it is.
    choices: { count: 3, distractors: ["'a half'", "'a quarter'", "'three quarters'"] },
    hint: 'Count how many parts there are, then how many are shaded.',
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['MA1-GM-03'],
  },
  {
    id: 'maths.1.money.count-coins',
    subject: 'maths',
    topic: 'money',
    level: '1',
    prompt: 'How many {coin}c coins do you need to make {total}c?',
    vars: [
      { name: 'coin', kind: 'pick', from: [5, 10, 20] },
      { name: 'many', kind: 'int', min: '2', max: '8' },
      { name: 'total', kind: 'expr', expr: 'coin * many' },
    ],
    answer: 'many',
    hint: 'Skip count by {coin}s.',
    tags: ['AC9M1N05', 'MA1-FG-01'],
  },
  {
    id: 'maths.1.number-patterns.count-back',
    subject: 'maths',
    topic: 'number patterns',
    level: '1',
    prompt: 'What comes next? {x}, {x - step}, {x - 2 * step}, ?',
    vars: [
      { name: 'step', kind: 'pick', from: [2, 5, 10] },
      { name: 'x', kind: 'int', min: 'step * 4', max: 'step * 12' },
    ],
    constraints: ['mod(x, step) == 0'],
    answer: 'x - 3 * step',
    hint: 'The numbers go down by {step} each time.',
    tags: ['AC9M1A01', 'MA1-FG-01'],
  },
  {
    id: 'maths.1.number-patterns.repeating-unit',
    subject: 'maths',
    topic: 'number patterns',
    level: '1',
    prompt: 'What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, {b}, ?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '3' },
      { name: 'b', kind: 'int', min: '4', max: '6' },
      { name: 'c', kind: 'int', min: '7', max: '9' },
    ],
    answer: 'c',
    hint: 'The part that repeats is {a}, {b}, {c}.',
    tags: ['AC9M1A02'],
  },
  {
    id: 'maths.1.measurement.how-much-longer',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt:
      'A rope is {a} paperclips long. A pencil is {b} paperclips long. How many paperclips longer is the rope?',
    vars: [
      { name: 'a', kind: 'int', min: '8', max: '20' },
      { name: 'b', kind: 'int', min: '2', max: '7' },
    ],
    answer: 'a - b',
    tags: ['AC9M1M02', 'MA1-GM-02'],
  },
  {
    id: 'maths.1.measurement.mass-heaviest',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt:
      'A pear balances {a} marbles, an apple {b} and a lime {c}. Which is the heaviest?',
    vars: [
      { name: 'a', kind: 'int', min: '3', max: '15' },
      { name: 'b', kind: 'int', min: '3', max: '15' },
      { name: 'c', kind: 'int', min: '3', max: '15' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: "a > b && a > c ? 'the pear' : b > c ? 'the apple' : 'the lime'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'the pear'", "'the apple'", "'the lime'"] },
    hint: 'The heaviest one needs the most marbles to balance it.',
    tags: ['AC9M1M02', 'MA1-NSM-01'],
  },
  {
    id: 'maths.1.time.days-in-weeks',
    subject: 'maths',
    topic: 'time',
    level: '1',
    prompt: 'How many days are there in {n} weeks?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '6' }],
    answer: 'n * 7',
    hint: 'There are 7 days in one week.',
    tags: ['AC9M1M03', 'MA1-NSM-02'],
  },
  {
    id: 'maths.1.time.hours-in-days',
    subject: 'maths',
    topic: 'time',
    level: '1',
    prompt: 'How many hours are there in {n} days?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '4' }],
    answer: 'n * 24',
    hint: 'There are 24 hours in one day.',
    tags: ['AC9M1M03', 'MA1-NSM-02'],
  },
  // Reading a dial, which arrives this year because NSW puts o'clock at Early
  // Stage 1 and half past at Stage 1, where ACARA's read-an-analogue-clock
  // description is AC9M2M04, a year later. So these two cite the NSW outcome
  // alone - the Year K clock pair's exception, one stage on. The duration
  // questions above keep AC9M1M03, which is about weeks, days and hours and
  // genuinely fits them; it says nothing about a clock face.
  {
    id: 'maths.1.time.half-past',
    subject: 'maths',
    topic: 'time',
    level: '1',
    prompt: 'What time is this?',
    // **Two hours and two forms, so the four buttons are a 2x2 and neither
    // hand answers the question alone.** An earlier shape put three hours on
    // four buttons, one of them written twice, with the two wrong hours drawn
    // at deliberately different distances - one next door, one further off.
    // That spread was meant to stop the answer sitting in the middle of a run
    // of consecutive hours, and it did; what it also did was mark the far hour
    // as the odd one out, which named the answer's *form* and left a coin toss
    // between two buttons. Measured over 3,000 draws it answered 64% of these
    // with the clock unseen, against a 25% blind guess, and no reshuffling of
    // three hours across four buttons gets below the narrowing that structure
    // creates.
    //
    // Two hours crossed with two forms has no odd one out to find. The three
    // wrong buttons are the three ways to be wrong - right hour read with the
    // wrong hand, wrong hour read with the right one, and both wrong - which
    // is the misconception grid this question is for, and every one of the
    // four is equally often the answer. Reading the minute hand narrows it to
    // two and reading the hour hand narrows it to two, so only reading both
    // gets there: the buttons now ask for exactly what the dial shows.
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'half', kind: 'pick', from: [1, 0] },
      // Symmetric about nought and never nought, so the other hour is as
      // likely to sit below the answer's as above it. Any asymmetry here would
      // put the answer back in a findable place among the two.
      { name: 'off', kind: 'pick', from: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] },
      { name: 'g', kind: 'expr', expr: 'mod(h + off - 1, 12) + 1' },
    ],
    // O'clock and half past, which is the whole of what Stage 1 reads off a
    // dial - and a time is not something the number pad can type, so the
    // options are written out and tapped.
    answer: "half == 1 ? 'half past ' + h : h + ' o’clock'",
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        // The answer's hour, read with the wrong hand.
        "half == 1 ? h + ' o’clock' : 'half past ' + h",
        // The other hour, read with the right hand.
        "half == 1 ? 'half past ' + g : g + ' o’clock'",
        // Both wrong.
        "half == 1 ? g + ' o’clock' : 'half past ' + g",
      ],
    },
    hint: 'The long hand points straight down when it is half past.',
    // **`numerals` is pinned, and leaving it out would be a bug rather than a
    // missing flourish.** An omitted field is a coin toss, so half of these
    // would draw a dial with no numbers on it at all. Nothing is lost by
    // pinning it: the minute track and the two hand lengths still jitter.
    figure: { kind: 'clock', hour: 'h', minute: 'half == 1 ? 30 : 0', numerals: 'true' },
    tags: ['MA1-NSM-02'],
  },
  {
    id: 'maths.1.time.half-past-claim',
    subject: 'maths',
    topic: 'time',
    level: '1',
    prompt: 'True or false: this clock shows half past {h}.',
    // Right half the time, and the false half is wrong in one of two ways: the
    // right hour at the wrong minute, or half past the wrong hour. A false
    // case that only ever moved the hour would let a child answer by glancing
    // at the long hand and never reading the short one.
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'slip', kind: 'pick', from: [0, 1] },
      // From 1 to 11, so a moved hour is never accidentally the one claimed.
      { name: 'off', kind: 'int', min: '1', max: '11' },
      {
        name: 'shownHour',
        kind: 'expr',
        expr: 'right == 1 || slip == 0 ? h : mod(h + off - 1, 12) + 1',
      },
      { name: 'shownMinute', kind: 'expr', expr: 'right == 1 || slip == 1 ? 30 : 0' },
    ],
    answer: 'shownHour == h && shownMinute == 30',
    // Pinned for the reason above, and it matters more here: an unnumbered
    // dial turns a true/false into a coin toss.
    figure: { kind: 'clock', hour: 'shownHour', minute: 'shownMinute', numerals: 'true' },
    tags: ['MA1-NSM-02'],
  },
  {
    id: 'maths.1.shapes.corners',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'How many corners does {article} {shape} have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'],
      },
      // "a octagon" otherwise.
      { name: 'article', kind: 'expr', expr: "shape == 'octagon' ? 'an' : 'a'" },
    ],
    answer:
      "shape == 'triangle' ? 3 : shape == 'square' ? 4 : shape == 'rectangle' ? 4 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : 8",
    tags: ['AC9M1SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.1.shapes.name-picture',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'What shape is this?',
    vars: [
      { name: 'n', kind: 'pick', from: [3, 4, 5, 6] },
      { name: 'tri', kind: 'pick', from: ['equilateral', 'isosceles', 'scalene'] },
      {
        name: 'drawn',
        kind: 'expr',
        expr: "n == 3 ? tri : n == 4 ? 'square' : n == 5 ? 'pentagon' : 'hexagon'",
      },
    ],
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
    figure: { kind: 'polygon', shape: 'drawn' },
    tags: ['AC9M1SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.1.shapes.corners-picture',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'How many corners does this shape have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'equilateral',
          'isosceles',
          'right-triangle',
          'square',
          'rectangle',
          'rhombus',
          'kite',
          'pentagon',
          'hexagon',
          'octagon',
        ],
      },
    ],
    answer: sideCount('shape'),
    hint: 'A corner is where two sides meet.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M1SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.1.shapes.side-count-claim',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'True or false: this shape has {claim} sides.',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'equilateral',
          'scalene',
          'square',
          'rectangle',
          'trapezium',
          'kite',
          'pentagon',
          'hexagon',
        ],
      },
      { name: 'sides', kind: 'expr', expr: sideCount('shape') },
      // Right half the time, by construction. Drawn as a free number between 3
      // and 6 the claim came out true only a quarter of the time, because the
      // four-sided shapes outnumber the rest - and a child who answered "false"
      // to everything would have scored 75% on a topic they had learned nothing
      // about. The false case is a near miss rather than an obviously wrong
      // number, or the picture stops being read at all.
      { name: 'right', kind: 'pick', from: [1, 0] },
      {
        name: 'claim',
        kind: 'expr',
        // **The false claim is another shape's side count, never an offset from
        // this shape's.** Built as `sides + 1` or `sides - 1` it reached 7,
        // which no shape here has - so a claim of 7 could only ever be false,
        // and the whole question was answerable from the number alone on 62.5%
        // of draws. An offset used to build a false claim has to land inside the
        // set of answers the template can actually produce.
        //
        // Landing inside that set is necessary and was not sufficient, because
        // the eight shapes are not spread evenly over it: four of them are
        // quadrilaterals, so a claim of 4 is true more often than not whatever
        // the offset does. Every mapping keyed on the *side count* leaves that
        // skew somewhere - the best of them still scores 56%. Keying on the
        // **shape** is what fixes it: the four quadrilaterals are sent to four
        // different false claims, in the proportions the shape list itself
        // produces, so all of 3, 4, 5 and 6 come out exactly half true and the
        // claim carries no information at all without the picture. Every false
        // claim is still a count one of these shapes really has, which is what
        // keeps it a near miss rather than an obviously wrong number.
        expr:
          "right == 1 ? sides : sides != 4 ? 4 : " +
          "shape == 'square' || shape == 'rectangle' ? 3 : shape == 'trapezium' ? 5 : 6",
      },
    ],
    answer: 'sides == claim',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M1SP01', 'MA1-2DS-01'],
  },

  // Three dimensions. Kindergarten met four solids by name; this year adds the
  // pyramid, asks which of them curve, and counts the flat faces - all three a
  // picture, because there is no sentence that asks what a cylinder looks like
  // without answering itself. The names are tapped, never spelled.
  {
    id: 'maths.1.shapes.solid-name',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'What is this called?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'sphere', 'cone', 'cylinder', 'square-pyramid'] },
      {
        name: 'i',
        kind: 'expr',
        expr:
          "shape == 'cube' ? 0 : shape == 'sphere' ? 1 : shape == 'cone' ? 2 : " +
          "shape == 'cylinder' ? 3 : 4",
      },
      // Which of the five solids is left *out*. Four options out of five names
      // means one is always missing, and this is what stops which one it is
      // being a fact about the answer: `gap` steps from the answer, so every
      // set of four arises from each of its own four members equally often and
      // the buttons say nothing about which of them is right.
      { name: 'gap', kind: 'pick', from: [1, 2, 3, 4] },
      // The three steps that are not `gap`, smallest first. Written as
      // ternaries because the expression language has no list to filter.
      { name: 'a', kind: 'expr', expr: 'gap == 1 ? 2 : 1' },
      { name: 'b', kind: 'expr', expr: 'gap <= 2 ? 3 : 2' },
      { name: 'c', kind: 'expr', expr: 'gap == 4 ? 3 : 4' },
    ],
    answer: solidWord('i'),
    answerType: 'choice',
    // The other three solids, stepped round the list of five so they never
    // repeat and never include the answer twice. Every one of them is
    // something a six-year-old has held, which is what makes a wrong tap a
    // real mistake rather than a shrug at a word they have never met.
    //
    // **The steps are `gap`'s three leftovers rather than a fixed 1, 2, 3.**
    // Stepping by a fixed 1, 2, 3 always excluded the solid four along from
    // the answer, so the four names on screen named the answer outright: five
    // option sets, five answers, one to one. Measured over 600 draws, keying
    // on the option set alone and nothing else, that beat the question 100% of
    // the time against a 25% blind guess.
    choices: {
      count: 4,
      distractors: [solidWord('mod(i + a, 5)'), solidWord('mod(i + b, 5)'), solidWord('mod(i + c, 5)')],
    },
    // The view is pinned because the prompt commits to one: "what is this
    // called" of a net is a different question, and a later year's. Which way
    // the solid leans and how tall or broad it is still move on every seed.
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M1SP01', 'MA1-3DS-01'],
  },
  {
    id: 'maths.1.shapes.solid-curved',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'True or false: this shape has a curved surface.',
    // Three of the seven curve and four do not, so an even pick answers false
    // 57% of the time and "false" becomes the better guess. The weights are 4
    // on each curved solid and 3 on each flat one - twelve against twelve -
    // which is the same balance the two derived-offset questions get by
    // construction, bought here without narrowing the list of solids a child
    // sees.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'sphere', 'cone', 'cylinder', 'square-pyramid', 'triangular-prism'],
        weights: [3, 3, 4, 4, 4, 3, 3],
      },
    ],
    answer: "shape == 'sphere' || shape == 'cone' || shape == 'cylinder'",
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M1SP01', 'MA1-3DS-01'],
  },
  {
    id: 'maths.1.shapes.solid-flat-faces',
    subject: 'maths',
    topic: 'shapes',
    level: '1',
    prompt: 'How many flat faces does this shape have?',
    // The sphere is left out: "how many flat faces" answered nought is a fair
    // question and a strange first one, and a child typing 0 on the pad is
    // being asked to guess what the app wants rather than what the shape has.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'cone', 'cylinder', 'square-pyramid', 'triangular-prism'],
      },
    ],
    answer:
      "shape == 'cone' ? 1 : shape == 'cylinder' ? 2 : " +
      "shape == 'square-pyramid' || shape == 'triangular-prism' ? 5 : 6",
    hint: 'A flat face is a side you could stand the shape on.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M1SP01', 'MA1-3DS-01'],
  },

  // Where something is. Stage 1 describes a position in relation to what is
  // around it - so these two count squares and name a row rather than reading
  // a grid reference off the axes, which is the Stage 2 question. That is why
  // `axisLabels` is pinned to 'none': left open it jitters between numbers and
  // letters, and a numbered axis would print the first answer along the bottom
  // of the picture.
  {
    id: 'maths.1.position.grid-squares-left',
    subject: 'maths',
    topic: 'position',
    level: '1',
    // "In the same row" is in the prompt rather than only in the hint: without
    // it the question reads as whole columns just as easily as squares beside
    // the dot, and a hint is opt-in - a child who does not tap the bulb would
    // be answering a different question from the one being marked.
    prompt: 'How many squares are there to the left of the dot in the same row?',
    // Well inside what a report row can hold. A dot at the far corner of the
    // biggest legible grid leaves the builder exactly one grid to draw it on,
    // and the figure then stops varying at all - which the anchoring check
    // refuses with a message that names `figure.rotation` and points nowhere
    // near here.
    vars: [
      { name: 'c', kind: 'int', min: '2', max: '5' },
      { name: 'r', kind: 'int', min: '1', max: '4' },
    ],
    answer: 'c - 1',
    hint: 'Count along the row from the left edge up to the dot.',
    // The extent is left open, which is this kind's headline variation: the
    // same square sits in a visibly different part of a four-wide grid and a
    // ten-wide one, and no answer here depends on how big the grid is.
    figure: { kind: 'grid', at: "c + ',' + r", axisLabels: "'none'" },
    tags: ['AC9M1SP02', 'MA1-GM-01'],
  },
  {
    id: 'maths.1.position.grid-bottom-row',
    subject: 'maths',
    topic: 'position',
    level: '1',
    prompt: 'True or false: the dot is in the bottom row.',
    // Right half the time by construction: a free row would be in the bottom
    // one only a quarter of the time, and a child answering "false" to
    // everything would score three quarters on a question they had not read.
    vars: [
      { name: 'bottom', kind: 'pick', from: [1, 0] },
      { name: 'r', kind: 'int', min: 'bottom == 1 ? 1 : 2', max: 'bottom == 1 ? 1 : 4' },
      { name: 'c', kind: 'int', min: '1', max: '4' },
    ],
    answer: 'r == 1',
    figure: { kind: 'grid', at: "c + ',' + r", axisLabels: "'none'" },
    tags: ['AC9M1SP02', 'MA1-GM-01'],
  },
  {
    id: 'maths.1.data.compare-tallies',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt: 'A class tally shows {a} children chose cats and {b} chose dogs. How many more chose cats?',
    vars: [
      { name: 'a', kind: 'int', min: '6', max: '18' },
      { name: 'b', kind: 'int', min: '1', max: '5' },
    ],
    answer: 'a - b',
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },

  // Two kinds of graph, a column graph and a picture graph, and two reads of
  // each: one that has to be worked out with a number and one that has to be
  // judged. Kindergarten counted a single row and found the biggest; this year
  // totals a graph, takes a difference off it and weighs up a claim about it.
  {
    id: 'maths.1.data.graph-fewest',
    subject: 'maths',
    topic: 'data',
    level: '1',
    // Short fruit: three categories leave about four characters each for their
    // names in a parent's report row, and "Banana" is six.
    prompt: 'This graph shows the fruit our class picked. Which fruit did the fewest children pick?',
    vars: [
      { name: 'pear', kind: 'int', min: '1', max: '5' },
      { name: 'plum', kind: 'int', min: '1', max: '5' },
      { name: 'kiwi', kind: 'int', min: '1', max: '5' },
    ],
    // Three different values, which the question needs anyway and which also
    // puts the tallest column at 3 or more - so the axis can never come out a
    // single step, the draw a graph kind refuses outright. Impossible by
    // construction rather than merely unlikely: `figureIssues` samples fifty
    // seeds, and a one-in-a-hundred draw ships past a sample that size.
    constraints: ['pear != plum', 'plum != kiwi', 'pear != kiwi'],
    answer: "pear < plum && pear < kiwi ? 'Pear' : plum < kiwi ? 'Plum' : 'Kiwi'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Pear'", "'Plum'", "'Kiwi'"] },
    hint: 'The shortest column is the fewest.',
    // **`style` is pinned because the hint names a column.** Left open it
    // jitters between a column graph and a dot plot, and a dot plot has no
    // columns at all - measured at 1009 of 2000 draws, so half of the children
    // reading that hint aloud would be looking for something that is not
    // there. A prompt may only name what the figure draws, and a hint is a
    // prompt for this purpose. It is also the year's reading: NSW names the
    // column graph at Stage 1 and the dot plot at Stage 2.
    //
    // The lever this spends is affordable, and measured rather than guessed:
    // `style` is the kind's main answer to the anchoring rule, but the sixty
    // combinations of three distinct values carry the variation on their own,
    // and over 600 seeds the worst answer draws 197 distinct figures in 197
    // draws - every one of them different.
    figure: {
      kind: 'bar',
      values: "pear + ',' + plum + ',' + kiwi",
      labels: "'Pear,Plum,Kiwi'",
      scale: '1',
      style: "'column'",
    },
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.1.data.graph-difference',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt:
      'This graph shows how we travel to school. How many more children come by {more} than by {less}?',
    // Which two columns are compared moves as well as the numbers in them, so
    // the question is never the same pair twice running.
    vars: [
      // **Five at most, and the reason is the axis a *rejected* pin leaves
      // behind.** `scaleCandidates` keeps a pinned scale only while it leaves
      // at most five rungs, so a sixth child in a column throws the `scale: 1`
      // below away and the kind falls back to the ladder - where a step of 5
      // prints a rung reading `10`. The category budget is fed the widest rung
      // over *every* scale the kind might pick, so those two characters are
      // what refuse "Bike", and the axis a child finally sees is beside the
      // point. Probed both ways: `2,5,10` pinned to a step of 5 is an axis of
      // two rungs and still refuses "Bike", while `2,4,6` is clean because
      // every value divides by 2 and no candidate scale ever reaches 10.
      { name: 'car', kind: 'int', min: '1', max: '5' },
      { name: 'bus', kind: 'int', min: '1', max: '5' },
      { name: 'bike', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'k', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 3)' },
      { name: 'big', kind: 'expr', expr: 'i == 0 ? car : i == 1 ? bus : bike' },
      { name: 'small', kind: 'expr', expr: 'j == 0 ? car : j == 1 ? bus : bike' },
      { name: 'more', kind: 'expr', expr: "i == 0 ? 'car' : i == 1 ? 'bus' : 'bike'" },
      { name: 'less', kind: 'expr', expr: "j == 0 ? 'car' : j == 1 ? 'bus' : 'bike'" },
    ],
    // Asked the way round that has an answer, and it also puts the tallest
    // column at 2 or more, so the axis is never a single step.
    constraints: ['big > small'],
    answer: 'big - small',
    hint: 'Count both columns, then take the smaller away from the bigger.',
    // Pinned for the reason `graph-fewest` above gives: the hint says column,
    // so the figure has to draw one.
    figure: {
      kind: 'bar',
      values: "car + ',' + bus + ',' + bike",
      labels: "'Car,Bus,Bike'",
      scale: '1',
      style: "'column'",
    },
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.1.data.picture-total',
    subject: 'maths',
    topic: 'data',
    level: '1',
    // "Stands for", not "is": the icon is a plain shape, and the graph says
    // what it stands for in its own key. A prompt may only name what the
    // figure draws.
    prompt: 'Each picture stands for one book. How many books were read altogether?',
    // Four at most: a three-character row label leaves room for four icons in
    // a parent's report row, and raising the key so one icon stood for two is
    // a Stage 2 idea this year cannot reach for.
    vars: [
      { name: 'zoe', kind: 'int', min: '1', max: '4' },
      { name: 'sam', kind: 'int', min: '1', max: '4' },
      { name: 'eli', kind: 'int', min: '1', max: '4' },
    ],
    answer: 'zoe + sam + eli',
    hint: 'Count every picture in the graph.',
    figure: {
      kind: 'pictograph',
      counts: "zoe + ',' + sam + ',' + eli",
      labels: "'Zoe,Sam,Eli'",
      key: '1',
    },
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.1.data.picture-claim',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt: 'Each picture stands for one shell. True or false: {a} found more shells than {b}.',
    vars: [
      { name: 'ivy', kind: 'int', min: '1', max: '4' },
      { name: 'tom', kind: 'int', min: '1', max: '4' },
      { name: 'ben', kind: 'int', min: '1', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'k', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 3)' },
      { name: 'va', kind: 'expr', expr: 'i == 0 ? ivy : i == 1 ? tom : ben' },
      { name: 'vb', kind: 'expr', expr: 'j == 0 ? ivy : j == 1 ? tom : ben' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Ivy' : i == 1 ? 'Tom' : 'Ben'" },
      { name: 'b', kind: 'expr', expr: "j == 0 ? 'Ivy' : j == 1 ? 'Tom' : 'Ben'" },
    ],
    // The two rows compared are never equal, so the claim is true about half
    // the time whichever way round the pair came out.
    constraints: ['va != vb'],
    answer: 'va > vb',
    figure: {
      kind: 'pictograph',
      counts: "ivy + ',' + tom + ',' + ben",
      labels: "'Ivy,Tom,Ben'",
      key: '1',
    },
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },

  // Chance, which arrives with the spinner because it could not arrive
  // without one: "which part is the arrow most likely to stop on?" is not a
  // sentence with a hole in it. A spinner emits no text at all - a figure has
  // exactly two appearances - so these say "a shaded part" and "a part with no
  // shading", never a colour, and the fill names in the specs are grouping
  // keys that never reach the screen.
  {
    id: 'maths.1.chance.spinner-will-might',
    subject: 'maths',
    topic: 'chance',
    level: '1',
    prompt: 'The arrow on this spinner is spun. Will it stop on {part}?',
    // Whole half the time, so all three answers are reachable: a disc shaded
    // all over answers "It will" about the shaded parts and "It will not"
    // about the plain ones, and any other disc answers "It might" either way.
    // An *un*shaded whole disc cannot be drawn at all - one fill group is the
    // shaded group - which is why the question turns over rather than the
    // picture.
    vars: [
      { name: 'n', kind: 'pick', from: SPINNER_PARTS },
      { name: 'whole', kind: 'pick', from: [1, 0] },
      { name: 's', kind: 'int', min: 'whole == 1 ? n : 1', max: 'whole == 1 ? n : n - 1' },
      { name: 'asked', kind: 'pick', from: [1, 0] },
      {
        name: 'part',
        kind: 'expr',
        expr: "asked == 1 ? 'a shaded part' : 'a part with no shading'",
      },
    ],
    answer: "asked == 1 ? (s == n ? 'It will' : 'It might') : (s == n ? 'It will not' : 'It might')",
    answerType: 'choice',
    // **Two buttons, not three, and which two follows the question.** A button
    // that can never be right is not a distractor, it is a tell: asked about a
    // shaded part the answer is never "It will not", because a disc with no
    // shaded parts cannot be drawn (`shadedFills` - one group is the shaded
    // group), and asked about a plain part it is never "It will". The third
    // button was dead on every draw, so guessing between the two that could
    // happen answered half of these with the spinner unseen against a
    // one-in-three baseline. Both words still come up, on the question that
    // can produce them, and `whole` above already splits the two live answers
    // evenly - so what is left is a genuine coin toss the picture settles.
    choices: {
      count: 2,
      distractors: ["'It might'", "asked == 1 ? 'It will' : 'It will not'"],
    },
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', SPINNER_PARTS),
      fills: shadedFills('n', 's', SPINNER_PARTS),
    },
    tags: ['AC9M1P01', 'MA1-CHAN-01'],
  },
  {
    id: 'maths.1.chance.spinner-more-likely',
    subject: 'maths',
    topic: 'chance',
    level: '1',
    prompt: 'Is the arrow more likely to stop on a shaded part or on a part with no shading?',
    vars: [
      { name: 'n', kind: 'pick', from: SPINNER_PARTS },
      { name: 's', kind: 'int', min: '1', max: 'n - 1' },
    ],
    // Never an even split, which this question has no answer to. Every count
    // left over leaves the shaded parts ahead about as often as behind.
    constraints: ['s * 2 != n'],
    answer: "s * 2 > n ? 'a shaded part' : 'a part with no shading'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'a shaded part'", "'a part with no shading'"] },
    hint: 'More parts means more chance.',
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', SPINNER_PARTS),
      fills: shadedFills('n', 's', SPINNER_PARTS),
    },
    tags: ['AC9M1P01', 'MA1-CHAN-01'],
  },
  {
    id: 'maths.1.chance.spinner-same-chance',
    subject: 'maths',
    topic: 'chance',
    level: '1',
    prompt:
      'True or false: the arrow is just as likely to stop on a shaded part as on a part with no shading.',
    // An even number of parts, so an even split is drawable at all, and true
    // half the time by construction: left free, four parts would be split
    // evenly one time in three and six parts one time in five. `off` steps
    // round the counts either side of the even split rather than a constraint
    // rejecting the ones it does not want - see `fractions.half-shaded` for
    // what rejection sampling does to a balance like this.
    vars: [
      { name: 'n', kind: 'pick', from: EVEN_SPINNER_PARTS },
      { name: 'same', kind: 'pick', from: [1, 0] },
      { name: 'off', kind: 'int', min: '1', max: 'n - 2' },
      {
        name: 's',
        kind: 'expr',
        expr: 'same == 1 ? n / 2 : mod(n / 2 - 1 + off, n - 1) + 1',
      },
    ],
    answer: 's * 2 == n',
    hint: 'Count the shaded parts, then the parts with no shading.',
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', EVEN_SPINNER_PARTS),
      fills: shadedFills('n', 's', EVEN_SPINNER_PARTS),
    },
    tags: ['AC9M1P01', 'MA1-CHAN-01'],
  },

  // ------------------------------------------------------------------
  // Area, capacity, and three more readings of a display.
  //
  // The strand pass (issue #12). Year 1 sat at 23 Number and algebra, 17
  // Measurement and space and 8 Statistics and probability against NSW's rough
  // 40/40/20. Two Stage 1 focus areas had nothing at all - `MA1-2DS-02`, area
  // in informal units, and `MA1-3DS-02`, internal volume and capacity - and
  // `MA1-DATA-01` had nothing either, every data question here citing
  // `MA1-DATA-02` instead. Those three are what the ten below fill.
  // ------------------------------------------------------------------

  // **Area in informal units, drawn as squares.** `grid` with `axisLabels`
  // pinned to `'none'` is a rectangle ruled into unit squares, which is what
  // covering a surface with informal units looks like - and unlettered,
  // because grid *references* are Stage 2 content and this is not one.
  //
  // The extent is pinned to bound variables rather than left open, because the
  // answer is computed from it and a template cannot write an answer against a
  // number it never sees. Pinning the extent and `axisLabels` together uses up
  // both of this kind's usual levers, so what supplies the variation is the
  // marked square: it moves over every cell of the grid, which is 4 to 25
  // distinct pictures per extent.
  {
    id: 'maths.1.measurement.squares-cover',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt: 'How many squares cover this shape altogether?',
    vars: [
      { name: 'c', kind: 'int', min: '2', max: '5' },
      { name: 'r', kind: 'int', min: '2', max: '5' },
      // The marked square, anywhere inside. `at` is "column,row".
      { name: 'ax', kind: 'int', min: '1', max: 'c' },
      { name: 'ay', kind: 'int', min: '1', max: 'r' },
    ],
    answer: 'c * r',
    hint: 'Count the squares in one row, then count the rows.',
    figure: {
      kind: 'grid',
      at: "ax + ',' + ay",
      columns: 'c',
      rows: 'r',
      axisLabels: "'none'",
    },
    tags: ['AC9M1M02', 'MA1-2DS-02'],
  },
  {
    id: 'maths.1.measurement.squares-in-row',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    // The row rather than the whole shape, which is the step below counting
    // the lot and the one that makes counting the lot possible.
    prompt: 'How many squares are there in each row of this shape?',
    vars: [
      { name: 'c', kind: 'int', min: '2', max: '5' },
      { name: 'r', kind: 'int', min: '2', max: '5' },
      { name: 'ax', kind: 'int', min: '1', max: 'c' },
      { name: 'ay', kind: 'int', min: '1', max: 'r' },
    ],
    answer: 'c',
    hint: 'Count along one row, from one side to the other.',
    figure: {
      kind: 'grid',
      at: "ax + ',' + ay",
      columns: 'c',
      rows: 'r',
      axisLabels: "'none'",
    },
    tags: ['AC9M1M02', 'MA1-2DS-02'],
  },

  // Capacity, which `MA1-3DS-02` calls internal volume and Kindergarten only
  // ever compares two of. Year 1's step is the same one its length question
  // takes over Kindergarten's: not which holds more, but how much more.
  {
    id: 'maths.1.measurement.holds-most',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt: 'A mug holds {a} scoops, a jug {b} and a pot {c}. Which holds the most?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
      { name: 'c', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: "a > b && a > c ? 'the mug' : b > c ? 'the jug' : 'the pot'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'the mug'", "'the jug'", "'the pot'"] },
    hint: 'The one that holds the most scoops holds the most.',
    tags: ['AC9M1M02', 'MA1-3DS-02'],
  },
  {
    id: 'maths.1.measurement.holds-how-much-more',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt: 'A bottle fills {a} cups. A flask fills {b} cups. How many more cups does the bottle fill?',
    vars: [
      { name: 'b', kind: 'int', min: '2', max: '9' },
      { name: 'a', kind: 'int', min: 'b + 1', max: '20' },
    ],
    // `a` is drawn above `b` rather than the difference being taken with
    // `abs`, because the prompt names which of the two is the bigger and a
    // draw where it is not would make the prompt false.
    answer: 'a - b',
    hint: 'Take {b} away from {a}.',
    tags: ['AC9M1M02', 'MA1-3DS-02'],
  },
  {
    id: 'maths.1.measurement.mass-how-much-heavier',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt: 'A brick balances {a} blocks. A tin balances {b}. How many blocks heavier is the brick?',
    vars: [
      { name: 'b', kind: 'int', min: '2', max: '9' },
      { name: 'a', kind: 'int', min: 'b + 1', max: '20' },
    ],
    answer: 'a - b',
    hint: 'Take {b} away from {a}.',
    tags: ['AC9M1M02', 'MA1-NSM-01'],
  },
  {
    id: 'maths.1.measurement.shortest',
    subject: 'maths',
    topic: 'measurement',
    level: '1',
    prompt: 'A stick is {a} hands long, a rope {b} and a scarf {c}. Which is the shortest?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '15' },
      { name: 'b', kind: 'int', min: '2', max: '15' },
      { name: 'c', kind: 'int', min: '2', max: '15' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: "a < b && a < c ? 'the stick' : b < c ? 'the rope' : 'the scarf'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'the stick'", "'the rope'", "'the scarf'"] },
    hint: 'The one that measures the fewest hands is the shortest.',
    tags: ['AC9M1M01', 'MA1-GM-02'],
  },

  // `MA1-DATA-01` is gathering and organising data; `MA1-DATA-02` is
  // describing what a display shows. Every data question this year had cited
  // the second, so the two below ask the first question instead: how many
  // children the display is made of.
  {
    id: 'maths.1.data.graph-how-many-asked',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt: 'This graph shows our favourite pets. How many children were asked altogether?',
    vars: [
      // **Five, not six.** At `scale: '1'` a value of 6 leaves six labelled
      // rungs on the axis, one more than the five whose labels stay clear of
      // one another, and the figure is refused outright. The cap on the values
      // is the axis's, not the arithmetic's.
      { name: 'cat', kind: 'int', min: '1', max: '5' },
      { name: 'dog', kind: 'int', min: '1', max: '5' },
      { name: 'rat', kind: 'int', min: '1', max: '5' },
    ],
    // Something above 1, or the axis is a single step and `bar` refuses it.
    constraints: ['max(cat, dog, rat) > 1'],
    answer: 'cat + dog + rat',
    hint: 'Read all three numbers off the graph, then add them up.',
    figure: {
      kind: 'bar',
      values: "cat + ',' + dog + ',' + rat",
      labels: "'Cat,Dog,Rat'",
      scale: '1',
    },
    tags: ['AC9M1ST01', 'MA1-DATA-01'],
  },
  {
    id: 'maths.1.data.tally-how-many-asked',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt: 'A tally shows {a} chose red, {b} chose blue and {c} chose green. How many were asked?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
      { name: 'c', kind: 'int', min: '2', max: '12' },
    ],
    answer: 'a + b + c',
    hint: 'Add all three numbers together.',
    tags: ['AC9M1ST01', 'MA1-DATA-01'],
  },
  {
    id: 'maths.1.data.graph-equal-claim',
    subject: 'maths',
    topic: 'data',
    level: '1',
    prompt: 'This graph shows our lunches. True or false: as many chose {one} as chose {two}.',
    // Derived rather than constrained. "Make them equal half the time" as a
    // constraint is satisfied by redrawing the whole scope, so the branch that
    // is harder to satisfy is thrown away more often - which is what made two
    // of this year's true/false templates come out 78/22 before they were
    // rewritten. `same` decides, and the second value follows.
    vars: [
      // Five is the axis's ceiling at `scale: '1'` - see graph-how-many-asked
      // above for why a sixth rung is refused.
      { name: 'pie', kind: 'int', min: '2', max: '5' },
      { name: 'same', kind: 'pick', from: [1, 0] },
      { name: 'off', kind: 'int', min: '1', max: '4' },
      // Stepped round rather than added, so the second bar stays inside 1..5
      // without a constraint throwing draws away.
      { name: 'bun', kind: 'expr', expr: 'same == 1 ? pie : mod(pie + off - 1, 5) + 1' },
      { name: 'egg', kind: 'int', min: '1', max: '5' },
      { name: 'first', kind: 'pick', from: [1, 0] },
      // Which of the two the prompt names first also moves, so "the first one
      // named is the taller" is not a rule a child can learn.
      { name: 'one', kind: 'expr', expr: "first == 1 ? 'Pie' : 'Bun'" },
      { name: 'two', kind: 'expr', expr: "first == 1 ? 'Bun' : 'Pie'" },
    ],
    constraints: ['max(pie, bun, egg) > 1'],
    answer: 'pie == bun',
    hint: 'Two bars the same height mean the same number chose each.',
    figure: {
      kind: 'bar',
      values: "pie + ',' + bun + ',' + egg",
      labels: "'Pie,Bun,Egg'",
      scale: '1',
    },
    tags: ['AC9M1ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.1.chance.spinner-certain',
    subject: 'maths',
    topic: 'chance',
    level: '1',
    prompt: 'True or false: the arrow is certain to stop on a shaded part.',
    // Certain is the whole disc in one fill group, which is the one thing a
    // spinner draws that has no plain sector at all. The complement -
    // *impossible* to stop on a shaded part - cannot be drawn here and no
    // template should ask for it: the first-named group is the shaded one, so
    // a disc with nothing shaded is not a picture this kind can make.
    vars: [
      { name: 'n', kind: 'pick', from: SPINNER_PARTS },
      { name: 'certain', kind: 'pick', from: [1, 0] },
      { name: 's', kind: 'int', min: 'certain == 1 ? n : 1', max: 'certain == 1 ? n : n - 1' },
    ],
    answer: 's == n',
    hint: 'Certain means it cannot stop anywhere else.',
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', SPINNER_PARTS),
      fills: shadedFills('n', 's', SPINNER_PARTS),
    },
    tags: ['AC9M1P01', 'MA1-CHAN-01'],
  },
];
