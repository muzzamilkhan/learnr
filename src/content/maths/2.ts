import type { Expr, QuestionTemplate } from '@/lib/templates/types';
import { equalSectors, shadedFills, sideCount } from './helpers';

/**
 * How many equal parts the chance spinners are cut into. Named for the reason
 * `1.ts` names its own list: `equalSectors` and `shadedFills` both write a
 * chain of ternaries covering exactly the counts they are handed, and neither
 * can check that it got the same list the `pick` did - a count outside the
 * chain falls through to the last branch and draws the wrong spinner, silently
 * and on every seed.
 */
const SPINNER_PARTS = [3, 4, 6];

/**
 * The letter a grid map writes along the bottom for column `i`, for `i` an
 * expression giving 1 to 4 - `A` for the first column, as `grid-kind` draws
 * it. The expression language has no way to step a character, so the four
 * letters this year's grids can reach are written out; a grid wider than that
 * is past what a parent's report row can label anyway.
 */
const columnLetter = (i: Expr): Expr =>
  `${i} == 1 ? 'A' : ${i} == 2 ? 'B' : ${i} == 3 ? 'C' : 'D'`;

/** Year 2 - NSW Stage 1. */
export const year2: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 2
  //
  // Numbers to 1000 and three-digit place value, halves, quarters and eighths
  // through repeated halving, addition and subtraction facts to 20, the twos
  // multiplication facts, money, additive patterns, calendars, clock times to
  // the quarter hour, and quarter and half turns - and then the picture
  // questions: a number line into the hundreds, arrays, eighths of a shape,
  // mass in informal units, solids counted by face, edge and corner, a grid
  // map read as a square reference, graphs where one step or one icon stands
  // for more than one thing, and chance said in the four words Stage 1 ends on.
  //
  // Each is filed with the topic it practises rather than in a block of its
  // own - the ruling Year K made and Year 1 followed. Someone asking what Year
  // 2 does with shapes should find the flat ones and the solid ones in one
  // run, which is also how the selector reasons about it.
  // ------------------------------------------------------------------
  {
    id: 'maths.2.counting-numbers.largest',
    subject: 'maths',
    topic: 'counting numbers',
    level: '2',
    prompt: 'Which of these is the largest: {a}, {b} or {c}?',
    vars: [
      { name: 'a', kind: 'int', min: '100', max: '999' },
      { name: 'b', kind: 'int', min: '100', max: '999' },
      { name: 'c', kind: 'int', min: '100', max: '999' },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: 'max(a, b, c)',
    hint: 'Compare the hundreds first.',
    tags: ['AC9M2N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.2.counting-numbers.number-line',
    subject: 'maths',
    topic: 'counting numbers',
    level: '2',
    prompt: 'What number is the arrow pointing to?',
    // Any hundred of the year's range, which is also where this question's
    // variation has to come from: the arrow's position *is* the answer and
    // cannot move, so the stretch of line under it does. Year 1 read tens off
    // a line ten wide; this reads tens off a line a hundred wide, which is the
    // step up.
    //
    // **The line carries two numbers, not three, and that is a measurement
    // rather than a taste.** Three-digit labels are wide, and a line a hundred
    // wide labelled every fifty - the obvious first draft - was refused
    // outright: "3 numbers as wide as 800 cannot be spread along the line
    // without touching one another in a report".
    //
    // **Fifty wide rather than a hundred, so a small tick is always worth
    // ten.** A hundred-wide line was drawable, and it cut itself into *five*
    // whenever the arrow stood on a multiple of twenty - the builder prefers
    // the coarsest subdivision the arrow lands on - so half of these would
    // have asked a seven-year-old to notice that a tick was worth twenty this
    // time. Over fifty, ticks of twenty-five and twelve-and-a-half miss every
    // answer this template can produce, so the run of ten is the only one left
    // and every drawing reads the same way.
    vars: [
      { name: 'base', kind: 'int', min: '0', max: '19' },
      { name: 'start', kind: 'expr', expr: 'base * 50' },
      { name: 'k', kind: 'int', min: '1', max: '4' },
      { name: 'n', kind: 'expr', expr: 'start + k * 10' },
    ],
    answer: 'n',
    // "The small ticks", not "the tens": what a tick is worth is settled above
    // by the span rather than by this sentence, and a hint may only name what
    // the figure draws.
    hint: 'Start at the number on the left, then count along the small ticks.',
    // Both ends and the step pinned together, which is the only way to pin a
    // step at all - see `1.ts` for what happens when a step is pinned alone.
    figure: { kind: 'number-line', at: 'n', from: 'start', to: 'start + 50', step: '50' },
    tags: ['AC9M2N01', 'MA1-RWN-02'],
  },
  {
    id: 'maths.2.place-value.count-hundreds',
    subject: 'maths',
    topic: 'place value',
    level: '2',
    prompt: 'How many whole hundreds are there in {x}?',
    vars: [{ name: 'x', kind: 'int', min: '150', max: '999' }],
    answer: 'floor(x / 100)',
    tags: ['AC9M2N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.2.place-value.build',
    subject: 'maths',
    topic: 'place value',
    level: '2',
    prompt: 'What number is {h} hundreds, {t} tens and {o} ones?',
    vars: [
      { name: 'h', kind: 'int', min: '2', max: '9' },
      { name: 't', kind: 'int', min: '2', max: '9' },
      { name: 'o', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'h * 100 + t * 10 + o',
    tags: ['AC9M2N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.2.place-value.zero-digit',
    subject: 'maths',
    topic: 'place value',
    level: '2',
    prompt: 'What number is {h} hundreds and {o} ones, with no tens?',
    vars: [
      { name: 'h', kind: 'int', min: '2', max: '9' },
      { name: 'o', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'h * 100 + o',
    hint: 'A zero holds the tens place open.',
    tags: ['AC9M2N02', 'MA1-RWN-01'],
  },
  {
    id: 'maths.2.addition.two-digit',
    subject: 'maths',
    topic: 'addition',
    level: '2',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '10', max: '59' },
      { name: 'y', kind: 'int', min: '10', max: '39' },
    ],
    answer: 'x + y',
    hint: 'Add the tens, then add the ones.',
    tags: ['AC9M2N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.addition.missing-addend',
    subject: 'maths',
    topic: 'addition',
    level: '2',
    prompt: 'What goes in the box? {x} + ? = {total}',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '20' },
      { name: 'y', kind: 'int', min: '2', max: '20' },
      { name: 'total', kind: 'expr', expr: 'x + y' },
    ],
    answer: 'y',
    hint: 'How many more than {x} is {total}?',
    tags: ['AC9M2N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.addition.facts-to-twenty',
    subject: 'maths',
    topic: 'addition',
    level: '2',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '4', max: '16' },
      { name: 'y', kind: 'int', min: '4', max: '20 - x' },
    ],
    answer: 'x + y',
    tags: ['AC9M2A02', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.subtraction.two-digit',
    subject: 'maths',
    topic: 'subtraction',
    level: '2',
    prompt: 'What is {x} − {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '20', max: '99' },
      { name: 'y', kind: 'int', min: '10', max: '49' },
    ],
    constraints: ['x > y'],
    answer: 'x - y',
    tags: ['AC9M2N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.subtraction.facts-to-twenty',
    subject: 'maths',
    topic: 'subtraction',
    level: '2',
    prompt: 'What is {total} − {x}?',
    vars: [
      { name: 'total', kind: 'int', min: '11', max: '20' },
      { name: 'x', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'total - x',
    hint: 'If you know {x} + {total - x} = {total}, you know this one.',
    tags: ['AC9M2A02', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.addition-and-subtraction.mixed',
    subject: 'maths',
    topic: 'addition and subtraction',
    level: '2',
    prompt: 'What is {x} {op} {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '10', max: '30' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
      { name: 'op', kind: 'pick', from: ['+', '−'] },
    ],
    answer: "op == '+' ? x + y : x - y",
    tags: ['AC9M2N04', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.even-and-odd.next-odd',
    subject: 'maths',
    topic: 'even and odd',
    level: '2',
    prompt: '{x} is an odd number. What is the next odd number?',
    vars: [{ name: 'x', kind: 'int', min: '21', max: '97', step: 2 }],
    constraints: ['isOdd(x)'],
    answer: 'x + 2',
    tags: ['AC9M2A01', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.even-and-odd.previous-even',
    subject: 'maths',
    topic: 'even and odd',
    level: '2',
    prompt: 'What is the largest even number smaller than {x}?',
    vars: [{ name: 'x', kind: 'int', min: '21', max: '99' }],
    constraints: ['isOdd(x)'],
    answer: 'x - 1',
    tags: ['AC9M2A01', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.multiplication.doubles',
    subject: 'maths',
    topic: 'multiplication',
    level: '2',
    prompt: 'What is double {x}?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '20' }],
    answer: 'x * 2',
    hint: '{x} + {x}',
    tags: ['AC9M2A03', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.multiplication.twos',
    subject: 'maths',
    topic: 'multiplication',
    level: '2',
    prompt: 'What is {x} × 2?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '12' }],
    answer: 'x * 2',
    tags: ['AC9M2A03', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.multiplication.equal-groups',
    subject: 'maths',
    topic: 'multiplication',
    level: '2',
    prompt: 'There are {n} bags with {each} marbles in each bag. How many marbles altogether?',
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '6' },
      { name: 'each', kind: 'pick', from: [2, 5, 10] },
    ],
    answer: 'n * each',
    hint: 'Skip count by {each}s, {n} times.',
    tags: ['AC9M2N05', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.multiplication.array-total',
    subject: 'maths',
    topic: 'multiplication',
    level: '2',
    prompt: 'How many dots are there altogether?',
    // One side is a two or a five, which are the facts this year drills, and
    // the other runs to seven - the most rows an array may have.
    vars: [
      { name: 'each', kind: 'pick', from: [2, 5] },
      { name: 'groups', kind: 'int', min: '3', max: '7' },
    ],
    answer: 'each * groups',
    // Neither the hint nor the prompt names a number of rows, because
    // `orientation` is deliberately left to jitter: the obligation to pin it is
    // about what the answer *asks*, and this one asks for the total, which a
    // transpose leaves alone.
    hint: 'Count the dots in one row, then skip count.',
    figure: { kind: 'array', rows: 'groups', columns: 'each' },
    tags: ['AC9M2N05', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.division.halving',
    subject: 'maths',
    topic: 'division',
    level: '2',
    prompt: '{total} counters are shared equally between 2 children. How many does each child get?',
    vars: [{ name: 'each', kind: 'int', min: '3', max: '20' }, { name: 'total', kind: 'expr', expr: 'each * 2' }],
    answer: 'each',
    tags: ['AC9M2A03', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.division.by-twos',
    subject: 'maths',
    topic: 'division',
    level: '2',
    prompt: 'What is {total} ÷ 2?',
    vars: [{ name: 'half', kind: 'int', min: '3', max: '25' }, { name: 'total', kind: 'expr', expr: 'half * 2' }],
    answer: 'half',
    hint: 'Halving is the opposite of doubling.',
    tags: ['AC9M2A03', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.fractions.half-of',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'What is half of {x}?',
    vars: [{ name: 'half', kind: 'int', min: '2', max: '20' }, { name: 'x', kind: 'expr', expr: 'half * 2' }],
    answer: 'half',
    hint: 'Split {x} into 2 equal parts.',
    tags: ['AC9M2N03', 'MA1-GM-03'],
  },
  {
    id: 'maths.2.fractions.quarter-of',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'What is one quarter of {x}?',
    vars: [{ name: 'quarter', kind: 'int', min: '2', max: '12' }, { name: 'x', kind: 'expr', expr: 'quarter * 4' }],
    answer: 'quarter',
    hint: 'Halve {x}, then halve it again.',
    tags: ['AC9M2N03', 'MA1-GM-03'],
  },
  {
    id: 'maths.2.fractions.repeated-halving',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'Half of {x} is {x / 2}. What is half of {x / 2}?',
    vars: [{ name: 'quarter', kind: 'int', min: '2', max: '12' }, { name: 'x', kind: 'expr', expr: 'quarter * 4' }],
    answer: 'quarter',
    tags: ['AC9M2N03', 'MA1-GM-03'],
  },
  {
    id: 'maths.2.fractions.parts-of-a-whole',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'How many {name} make one whole?',
    vars: [{ name: 'name', kind: 'pick', from: ['halves', 'quarters', 'eighths'] }],
    answer: "name == 'halves' ? 2 : name == 'quarters' ? 4 : 8",
    tags: ['AC9M2N03', 'AC9M2M02', 'MA1-GM-03'],
  },
  {
    id: 'maths.2.fractions.how-much-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'How much of this shape is shaded?',
    // Seven drawings, four answers - and three of the seven are a half, drawn
    // once as one part of two, once as two of four and once as four of eight.
    // That pairing is the whole question: a fraction is never simplified here,
    // so seeing that four of eight parts is the same as one of two is
    // something the child has to do rather than something the picture has
    // already done.
    //
    // **The weights are what make the four answers equally likely**, and they
    // are arithmetic rather than taste: a flat pick over the seven drawings
    // would answer "a half" three times as often as "an eighth", and a child
    // who noticed would be right three times in seven without looking. Six
    // parts in twenty-four to each answer.
    vars: [
      { name: 'which', kind: 'pick', from: [0, 1, 2, 3, 4, 5, 6], weights: [2, 3, 2, 6, 6, 3, 2] },
      { name: 'd', kind: 'expr', expr: 'which == 0 ? 2 : which <= 3 ? 4 : 8' },
      {
        name: 'n',
        kind: 'expr',
        expr: 'which == 2 ? 2 : which == 3 ? 3 : which == 5 ? 2 : which == 6 ? 4 : 1',
      },
    ],
    // A fraction cannot be typed on a number pad, so it is tapped.
    answer:
      "n * 2 == d ? 'a half' : n * 4 == d ? 'a quarter' : n * 8 == d ? 'an eighth' : 'three quarters'",
    answerType: 'choice',
    // The same four buttons whatever was drawn, so the option set never says
    // which one it is.
    choices: {
      count: 4,
      distractors: ["'a half'", "'a quarter'", "'an eighth'", "'three quarters'"],
    },
    hint: 'Count how many equal parts there are, then how many are shaded.',
    // `shape` is left open on purpose: the prompt says "this shape" and names
    // nothing, so a circle, a strip and a rectangle are all honest drawings of
    // it - and eight parts is well inside what any of the three can carry.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['AC9M2M02', 'MA1-GM-03'],
  },
  {
    id: 'maths.2.number-patterns.additive',
    subject: 'maths',
    topic: 'number patterns',
    level: '2',
    prompt: 'What comes next? {a}, {a + d}, {a + 2 * d}, {a + 3 * d}, ?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '20' },
      { name: 'd', kind: 'int', min: '3', max: '9' },
    ],
    answer: 'a + 4 * d',
    hint: 'The numbers go up by {d} each time.',
    tags: ['AC9M2A01', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.number-patterns.missing-element',
    subject: 'maths',
    topic: 'number patterns',
    level: '2',
    prompt: 'Fill in the gap: {a}, ?, {a + 2 * d}, {a + 3 * d}',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '30' },
      { name: 'd', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'a + d',
    tags: ['AC9M2A01', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.number-patterns.decreasing',
    subject: 'maths',
    topic: 'number patterns',
    level: '2',
    prompt: 'What comes next? {a}, {a - d}, {a - 2 * d}, ?',
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '9' },
      { name: 'a', kind: 'int', min: 'd * 4', max: 'd * 10' },
    ],
    answer: 'a - 3 * d',
    tags: ['AC9M2A01', 'MA1-CSQ-01'],
  },
  {
    id: 'maths.2.money.coins-to-dollars',
    subject: 'maths',
    topic: 'money',
    level: '2',
    prompt: 'How many 50c coins make ${d}?',
    vars: [{ name: 'd', kind: 'int', min: '1', max: '6' }],
    answer: 'd * 2',
    hint: 'Two 50c coins make one dollar.',
    tags: ['AC9M2N06', 'MA1-FG-01'],
  },
  {
    id: 'maths.2.money.total-cents',
    subject: 'maths',
    topic: 'money',
    level: '2',
    prompt: 'A pencil costs {a}c and a rubber costs {b}c. How much do they cost together, in cents?',
    vars: [
      { name: 'a', kind: 'int', min: '5', max: '95', step: 5 },
      { name: 'b', kind: 'int', min: '5', max: '95', step: 5 },
    ],
    answer: 'a + b',
    tags: ['AC9M2N06', 'MA1-CSQ-01'],
  },

  // Mass, measured in a uniform informal unit - blocks on the other pan of a
  // balance - which is how Year 2 measures it in both syllabuses; grams and
  // kilograms are a year away. Year 1 asked which of three things was
  // heaviest; these two ask by how much, and how a mass grows when the thing
  // being weighed is repeated.
  {
    id: 'maths.2.measurement.mass-balance',
    subject: 'maths',
    topic: 'measurement',
    level: '2',
    prompt: 'One apple weighs the same as {n} blocks. How many blocks weigh the same as {k} apples?',
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '6' },
      { name: 'k', kind: 'int', min: '2', max: '5' },
    ],
    answer: 'n * k',
    hint: 'Each apple needs {n} blocks, so count {n} for every apple.',
    tags: ['AC9M2M01', 'MA1-NSM-01'],
  },
  {
    id: 'maths.2.measurement.mass-difference',
    subject: 'maths',
    topic: 'measurement',
    level: '2',
    prompt:
      'A tin weighs the same as {a} blocks. A jar weighs the same as {b} blocks. How many more blocks does the tin weigh?',
    vars: [
      { name: 'a', kind: 'int', min: '6', max: '20' },
      { name: 'b', kind: 'int', min: '2', max: '5' },
    ],
    answer: 'a - b',
    hint: 'Take the jar’s blocks away from the tin’s.',
    tags: ['AC9M2M01', 'MA1-NSM-01'],
  },
  {
    id: 'maths.2.time.half-hours',
    subject: 'maths',
    topic: 'time',
    level: '2',
    prompt: 'How many minutes are there in {n} half-hours?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '6' }],
    answer: 'n * 30',
    hint: 'Half an hour is 30 minutes.',
    tags: ['AC9M2M04', 'MA1-NSM-02'],
  },
  {
    id: 'maths.2.time.calendar-days',
    subject: 'maths',
    topic: 'time',
    level: '2',
    prompt: 'Today is the {d}th of the month. What date will it be in {k} days?',
    vars: [
      { name: 'd', kind: 'int', min: '1', max: '20' },
      { name: 'k', kind: 'int', min: '2', max: '7' },
    ],
    answer: 'd + k',
    tags: ['AC9M2M03', 'MA1-NSM-02'],
  },

  // Reading a dial, and the first year that cites both syllabuses for it.
  // Years K and 1 cite NSW alone, because NSW puts o'clock at Early Stage 1
  // and half past at Stage 1 while ACARA's read-a-clock-face description,
  // AC9M2M04, waits until this year - which is checkable in this file rather
  // than taken on trust: AC9M2M04 is already cited by `time.half-hours` above,
  // its neighbours AC9M2M03 and AC9M2M05 are spoken for by the calendar and
  // the turns questions, and the two earlier years' duration templates keep
  // AC9M1M03 and AC9MFM02, neither of which is about a dial. So the quarter
  // hour is where ACARA picks the clock face up, and Stage 1's MA1-NSM-02
  // covers it from the other side.
  {
    id: 'maths.2.time.quarter-time',
    subject: 'maths',
    topic: 'time',
    level: '2',
    prompt: 'What time is this?',
    vars: [
      // **`a` is the hour the *words* say, not the hour the short hand sits
      // nearest.** Quarter to 6 is drawn at 5:45, so the two part company for
      // half of these, and building the options out of the spoken hour is what
      // keeps the arithmetic below the same in both forms.
      { name: 'a', kind: 'int', min: '1', max: '12' },
      { name: 'past', kind: 'pick', from: [1, 0] },
      // Signed offsets, so the answer is never the middle of a run of
      // consecutive hours - `1.ts`'s `time.half-past` has the analysis, and it
      // is not re-derived here.
      { name: 'near', kind: 'pick', from: [-2, -1, 1, 2] },
      { name: 'far', kind: 'pick', from: [-5, -4, -3, 3, 4, 5] },
      { name: 'an', kind: 'expr', expr: 'mod(a + near - 1, 12) + 1' },
      { name: 'af', kind: 'expr', expr: 'mod(a + far - 1, 12) + 1' },
      // Four options over three hours means one hour is written twice; `flip`
      // is what stops the doubled one always being the answer's. Same fix,
      // same reason, same fifty per cent left over - see `1.ts`.
      { name: 'flip', kind: 'pick', from: [1, 0] },
      { name: 'ad', kind: 'expr', expr: 'flip == 1 ? a : an' },
      // The hour the hands are drawn at: quarter past A is A:15, and quarter
      // to A is the quarter before A, so an hour earlier at :45.
      { name: 'h', kind: 'expr', expr: 'past == 1 ? a : mod(a + 10, 12) + 1' },
    ],
    // A time is not something the number pad can type, so the options are
    // written out and tapped.
    answer: "past == 1 ? 'quarter past ' + a : 'quarter to ' + a",
    answerType: 'choice',
    // Two options in each form, always, so "the odd one out is the answer"
    // never works - and so that reading the minute hand narrows four to two
    // rather than to one, which is what leaves the hour hand a question to
    // answer.
    choices: {
      count: 4,
      distractors: [
        "past == 1 ? 'quarter to ' + ad : 'quarter past ' + ad",
        "past == 1 ? 'quarter past ' + an : 'quarter to ' + an",
        "past == 1 ? 'quarter to ' + af : 'quarter past ' + af",
      ],
    },
    hint: 'The long hand points to 3 for quarter past and to 9 for quarter to.',
    // **`numerals` is pinned, and leaving it out would be a bug rather than a
    // missing flourish**: an omitted field is a coin toss, so half of these
    // would draw a dial with no numbers on it - and the hint above names two
    // of them. The minute track and the two hand lengths still jitter.
    figure: { kind: 'clock', hour: 'h', minute: 'past == 1 ? 15 : 45', numerals: 'true' },
    tags: ['AC9M2M04', 'MA1-NSM-02'],
  },
  {
    id: 'maths.2.time.quarter-claim',
    subject: 'maths',
    topic: 'time',
    level: '2',
    prompt: 'True or false: this clock shows {claim}.',
    // Right half the time by construction rather than by a constraint asking
    // for balance, which rejection sampling does not give - and the false half
    // is wrong in one of two ways: the right hour at the wrong minute, or the
    // right quarter of the wrong hour. A false case that only ever moved the
    // hour would let a child answer by glancing at the long hand.
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '12' },
      { name: 'past', kind: 'pick', from: [1, 0] },
      { name: 'm', kind: 'expr', expr: 'past == 1 ? 15 : 45' },
      { name: 'trueHour', kind: 'expr', expr: 'past == 1 ? a : mod(a + 10, 12) + 1' },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'slip', kind: 'pick', from: [0, 1] },
      // From 1 to 11, so a moved hour is never accidentally the one claimed.
      { name: 'off', kind: 'int', min: '1', max: '11' },
      // The three near misses a wrong minute can be: the hour, the half, and
      // the other quarter - which is the mistake this question is really about.
      { name: 'wm', kind: 'int', min: '0', max: '2' },
      {
        name: 'wrongMinute',
        kind: 'expr',
        expr: 'wm == 0 ? 0 : wm == 1 ? 30 : (past == 1 ? 45 : 15)',
      },
      {
        name: 'shownHour',
        kind: 'expr',
        expr: 'right == 1 || slip == 0 ? trueHour : mod(trueHour + off - 1, 12) + 1',
      },
      { name: 'shownMinute', kind: 'expr', expr: 'right == 1 || slip == 1 ? m : wrongMinute' },
      { name: 'claim', kind: 'expr', expr: "past == 1 ? 'quarter past ' + a : 'quarter to ' + a" },
    ],
    answer: 'shownHour == trueHour && shownMinute == m',
    // Pinned for the reason above, and it matters more here: an unnumbered
    // dial turns a true/false into a coin toss.
    figure: { kind: 'clock', hour: 'shownHour', minute: 'shownMinute', numerals: 'true' },
    tags: ['AC9M2M04', 'MA1-NSM-02'],
  },
  {
    id: 'maths.2.turns.quarter-turns',
    subject: 'maths',
    topic: 'turns',
    level: '2',
    prompt: 'How many quarter turns are there in {n} full turns?',
    vars: [{ name: 'n', kind: 'int', min: '1', max: '5' }],
    answer: 'n * 4',
    hint: 'One full turn is 4 quarter turns.',
    tags: ['AC9M2M05', 'MA1-GM-01'],
  },
  {
    id: 'maths.2.shapes.sides',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    prompt: 'How many sides does {article} {shape} have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['triangle', 'quadrilateral', 'pentagon', 'hexagon', 'heptagon', 'octagon'],
      },
      { name: 'article', kind: 'expr', expr: "shape == 'octagon' ? 'an' : 'a'" },
    ],
    answer:
      "shape == 'triangle' ? 3 : shape == 'quadrilateral' ? 4 : shape == 'pentagon' ? 5 : shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : 8",
    tags: ['AC9M2SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.2.shapes.name-picture',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    // The four names a child has to count sides to tell apart - a pentagon and
    // a hexagon are not told apart at a glance the way a square and a triangle
    // are, which is the step up from Year 1.
    prompt: 'What shape is this?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['pentagon', 'hexagon', 'heptagon', 'octagon'] },
    ],
    answer: 'shape',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ["'pentagon'", "'hexagon'", "'heptagon'", "'octagon'"],
    },
    hint: 'Count the sides: 5 pentagon, 6 hexagon, 7 heptagon, 8 octagon.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M2SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.2.shapes.sides-picture',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    prompt: 'How many sides does this shape have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['pentagon', 'hexagon', 'heptagon', 'octagon'] },
    ],
    answer: sideCount('shape'),
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M2SP01', 'MA1-2DS-01'],
  },
  {
    id: 'maths.2.shapes.more-sides-than',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    prompt: 'True or false: this shape has more than {n} sides.',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'scalene',
          'isosceles',
          'square',
          'trapezium',
          'parallelogram',
          'pentagon',
          'hexagon',
          'heptagon',
          'octagon',
        ],
      },
      { name: 'sides', kind: 'expr', expr: sideCount('shape') },
      { name: 'n', kind: 'int', min: '3', max: '7' },
    ],
    answer: 'sides > n',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M2SP01', 'MA1-2DS-01'],
  },

  // Three dimensions, counted rather than named. Year K named four solids and
  // Year 1 added the pyramid, asked which of them curve and counted the flat
  // faces; this year takes the three words ACARA asks Year 2 to classify a
  // solid by - faces, edges and corners - and asks for each of them.
  //
  // **All three draw from the same four solids, and that is deliberate.** A
  // sphere, a cone and a cylinder have no edges or corners worth counting -
  // whether a cone has one vertex is a conversation with a teacher rather than
  // a button to be marked wrong on - so the set is the solids made entirely of
  // flat faces. The curved ones are Year 1's, where they are asked the
  // question that suits them.
  //
  // A count is only honest because an object view draws **every** edge, the
  // hidden ones dashed; that is what lets a child count all twelve of a cube's
  // edges from a picture showing nine of them.
  {
    id: 'maths.2.shapes.solid-faces-claim',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    prompt: 'True or false: this shape has {claim} flat faces.',
    // Right half the time by construction, and the false case is a near miss
    // rather than an obviously wrong number, or the picture stops being looked
    // at. Claims run from 4 to 7, all of them numbers a child would weigh up.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'square-pyramid', 'triangular-prism'],
      },
      { name: 'faces', kind: 'expr', expr: "shape == 'cube' || shape == 'cuboid' ? 6 : 5" },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'nudge', kind: 'pick', from: [1, -1] },
      { name: 'claim', kind: 'expr', expr: 'right == 1 ? faces : faces + nudge' },
    ],
    answer: 'faces == claim',
    hint: 'Do not forget the faces at the back.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M2SP01', 'MA1-3DS-01'],
  },
  {
    id: 'maths.2.shapes.solid-edges',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    prompt: 'How many edges does this shape have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'square-pyramid', 'triangular-prism'],
      },
    ],
    answer: "shape == 'square-pyramid' ? 8 : shape == 'triangular-prism' ? 9 : 12",
    hint: 'An edge is a line where two faces meet. The dashed ones count too.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M2SP01', 'MA1-3DS-01'],
  },
  {
    id: 'maths.2.shapes.solid-corners',
    subject: 'maths',
    topic: 'shapes',
    level: '2',
    // "Corners" rather than "vertices". The word ACARA uses is vertices and
    // the word a seven-year-old hears is corners, and this prompt is read
    // aloud - the polygon questions in Year 1 made the same call.
    prompt: 'How many corners does this shape have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'square-pyramid', 'triangular-prism'],
      },
    ],
    answer: "shape == 'square-pyramid' ? 5 : shape == 'triangular-prism' ? 6 : 8",
    hint: 'A corner is where the edges meet.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M2SP01', 'MA1-3DS-01'],
  },

  // Where something is on a map. Year 1 counted squares on an unlabelled grid,
  // because Stage 1 describes a position in relation to what is around it;
  // this year the grid carries names along its edges and a square is read off
  // them, which is what AC9M2SP02 asks for: locating a position in a
  // two-dimensional representation of a space.
  //
  // **These two cite ACARA alone, deliberately.** NSW files grid maps and grid
  // references under Stage 2 (MA2-GM-01), and the Stage 1 position outcome
  // this year would otherwise have to cite, MA1-GM-01, is about the position
  // of objects in relation to one another rather than about reading a
  // reference off an axis. A citation the curriculum page presents as
  // checkable is worse wrong than missing, so the NSW code is left off rather
  // than stretched - the Year K and Year 1 clock templates' exception, pointed
  // the other way.
  //
  // Two things are pinned here and both have to be. `axisLabels` decides the
  // *spelling of the answer* - column 2 is `B` on a lettered grid and `2` on a
  // numbered one - and `onLines` decides whether the dot is *in* B3 or *at*
  // (2,3), which is the Stage 3 reading. What is left free is the extent, and
  // it is free within a band rather than left open: the distractors name
  // squares, and a square outside the drawn grid is a wrong answer a child can
  // rule out without looking at the dot. A grid four or five wide holds every
  // square the options can name.
  //
  // **That leaves four pictures per answer, measured, and four is the ceiling
  // rather than a choice.** Six is refused - "a grid 6 by 4 labelled in
  // letters leaves 8.2px between its lines in a parent's 64px report row,
  // under the 8.9px it takes to read two names along the bottom apart" - so
  // four and five are the whole of the band, and the dot has to stay inside
  // the smaller of them. Four is enough for the thing the rule is protecting
  // against: A4 is the top-left corner of a four-row grid and one square down
  // from it on a five-row one, so the position cannot be memorised as a
  // picture. It is not enough to be comfortable, and an author widening the
  // dot's range should re-read this rather than assume the check will speak up.
  {
    id: 'maths.2.position.grid-square',
    subject: 'maths',
    topic: 'position',
    level: '2',
    prompt: 'What square is the dot in?',
    vars: [
      { name: 'c', kind: 'int', min: '1', max: '4' },
      { name: 'r', kind: 'int', min: '1', max: '4' },
      { name: 'cols', kind: 'int', min: '4', max: '5' },
      { name: 'rws', kind: 'int', min: '4', max: '5' },
      // Any other column, and any other row - stepped round rather than drawn
      // and rejected, so no draw is ever thrown away and the answer can land
      // anywhere among the four options.
      { name: 'dc', kind: 'int', min: '1', max: '3' },
      { name: 'dr', kind: 'int', min: '1', max: '3' },
      { name: 'cn', kind: 'expr', expr: 'mod(c - 1 + dc, 4) + 1' },
      { name: 'rn', kind: 'expr', expr: 'mod(r - 1 + dr, 4) + 1' },
    ],
    // A square is written B3, which the number pad cannot type - so it is
    // tapped.
    answer: `(${columnLetter('c')}) + r`,
    answerType: 'choice',
    // The three squares that share a row, a column, or neither with the answer:
    // the three mistakes there are to make.
    choices: {
      count: 4,
      distractors: [
        `(${columnLetter('cn')}) + r`,
        `(${columnLetter('c')}) + rn`,
        `(${columnLetter('cn')}) + rn`,
      ],
    },
    hint: 'Read the letter along the bottom first, then the number up the side.',
    figure: {
      kind: 'grid',
      at: "c + ',' + r",
      columns: 'cols',
      rows: 'rws',
      axisLabels: "'letters'",
      onLines: 'false',
    },
    tags: ['AC9M2SP02'],
  },
  {
    id: 'maths.2.position.grid-square-claim',
    subject: 'maths',
    topic: 'position',
    level: '2',
    prompt: 'True or false: the dot is in square {claim}.',
    // Right half the time by construction, and a false claim is always one
    // step out in exactly one direction - the wrong column of the right row,
    // or the right column of the wrong row. A claim wrong in both would be
    // refused at a glance and would never make the child read the other axis.
    vars: [
      { name: 'c', kind: 'int', min: '1', max: '4' },
      { name: 'r', kind: 'int', min: '1', max: '4' },
      { name: 'cols', kind: 'int', min: '4', max: '5' },
      { name: 'rws', kind: 'int', min: '4', max: '5' },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'slip', kind: 'pick', from: [0, 1] },
      { name: 'dc', kind: 'int', min: '1', max: '3' },
      { name: 'dr', kind: 'int', min: '1', max: '3' },
      {
        name: 'claimC',
        kind: 'expr',
        expr: 'right == 1 || slip == 1 ? c : mod(c - 1 + dc, 4) + 1',
      },
      {
        name: 'claimR',
        kind: 'expr',
        expr: 'right == 1 || slip == 0 ? r : mod(r - 1 + dr, 4) + 1',
      },
      { name: 'claim', kind: 'expr', expr: `(${columnLetter('claimC')}) + claimR` },
    ],
    answer: 'claimC == c && claimR == r',
    figure: {
      kind: 'grid',
      at: "c + ',' + r",
      columns: 'cols',
      rows: 'rws',
      axisLabels: "'letters'",
      onLines: 'false',
    },
    tags: ['AC9M2SP02'],
  },

  // Data, and the year's step up is that one mark stands for more than one
  // thing: a step up the side of a column graph worth two, and a picture
  // graph whose key says one icon is two shells. Year 1 read graphs where
  // every step and every icon was one, which is as far as an early-years
  // reading goes; counting in twos off a scale is what Stage 1 ends on.
  //
  // `style` is pinned to a column on every graph here. Left open the kind
  // draws a dot plot about half the time, and NSW names the column graph at
  // Stage 1 and the dot plot at Stage 2 - and two of the hints below say
  // "column", which a hint may only do when the figure draws one.
  {
    id: 'maths.2.data.graph-total',
    subject: 'maths',
    topic: 'data',
    level: '2',
    prompt:
      'This graph shows how many books we read each day. How many books were read altogether?',
    // Four categories rather than Year 1's three, and three-character names,
    // because a four-column graph leaves each name about that much room in a
    // parent's report row. Thursday is at least 2 so the tallest column always
    // clears the bottom step - an axis of a single step is refused outright,
    // and `figureIssues` samples fifty seeds, which is not enough to catch a
    // draw that happens rarely.
    vars: [
      { name: 'mon', kind: 'int', min: '1', max: '5' },
      { name: 'tue', kind: 'int', min: '1', max: '5' },
      { name: 'wed', kind: 'int', min: '1', max: '5' },
      { name: 'thu', kind: 'int', min: '2', max: '5' },
    ],
    answer: 'mon + tue + wed + thu',
    hint: 'Read each column, then add them all up.',
    figure: {
      kind: 'bar',
      values: "mon + ',' + tue + ',' + wed + ',' + thu",
      labels: "'Mon,Tue,Wed,Thu'",
      scale: '1',
      style: "'column'",
    },
    tags: ['AC9M2ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.2.data.graph-scale-two',
    subject: 'maths',
    topic: 'data',
    level: '2',
    prompt: 'This graph shows how many stickers we have. How many stickers does {who} have?',
    // Every value is even and the scale is pinned to 2, so the numbers up the
    // side read 0, 2, 4, 6, 8, 10 and every column lands on one of them. A
    // column stopping between two rungs is a column nobody can read a number
    // off, which is the whole point of the picture.
    //
    // One child has at least 4, so the axis is never a single step - and the
    // axis reaching 10 is a two-character rung, which is what holds the names
    // to three characters here where Year 1's one-character axis allowed four.
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '5' },
      { name: 'b', kind: 'int', min: '1', max: '5' },
      { name: 'c', kind: 'int', min: '2', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
    ],
    answer: '(i == 0 ? a : i == 1 ? b : c) * 2',
    hint: 'The numbers up the side go up in 2s.',
    figure: {
      kind: 'bar',
      values: "a * 2 + ',' + b * 2 + ',' + c * 2",
      labels: "'Ada,Kai,Leo'",
      scale: '2',
      style: "'column'",
    },
    tags: ['AC9M2ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.2.data.graph-same',
    subject: 'maths',
    topic: 'data',
    level: '2',
    prompt:
      'This graph shows our favourite colours. True or false: just as many children chose {a} as chose {b}.',
    // Right half the time exactly, and with nothing rejected: `same` is drawn
    // freely and the second column is either the first over again or one of
    // the four other heights, stepped round rather than redrawn until it
    // differs.
    //
    // Which two columns are asked about moves as well as the numbers in them,
    // so the third column is never the same one twice running - and because it
    // is never one of the two named, its height can be held at 2 or more to
    // keep the axis off a single step without touching the balance.
    vars: [
      { name: 'same', kind: 'pick', from: [1, 0] },
      { name: 'p', kind: 'int', min: '1', max: '5' },
      { name: 'off', kind: 'int', min: '1', max: '4' },
      { name: 'q', kind: 'expr', expr: 'same == 1 ? p : mod(p - 1 + off, 5) + 1' },
      { name: 'r', kind: 'int', min: '2', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'k', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 3)' },
      { name: 'v1', kind: 'expr', expr: 'i == 0 ? p : j == 0 ? q : r' },
      { name: 'v2', kind: 'expr', expr: 'i == 1 ? p : j == 1 ? q : r' },
      { name: 'v3', kind: 'expr', expr: 'i == 2 ? p : j == 2 ? q : r' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Blue' : i == 1 ? 'Pink' : 'Gold'" },
      { name: 'b', kind: 'expr', expr: "j == 0 ? 'Blue' : j == 1 ? 'Pink' : 'Gold'" },
    ],
    answer: 'p == q',
    hint: 'Two columns the same height means the same number of children.',
    figure: {
      kind: 'bar',
      values: "v1 + ',' + v2 + ',' + v3",
      labels: "'Blue,Pink,Gold'",
      scale: '1',
      style: "'column'",
    },
    tags: ['AC9M2ST02', 'MA1-DATA-02'],
  },
  {
    id: 'maths.2.data.picture-key-two',
    subject: 'maths',
    topic: 'data',
    level: '2',
    // The prompt says what one picture stands for, which it must: the graph's
    // own key draws an icon and "= 2" and cannot say two *what*. This is the
    // one capability Year 2 has over Year 1 with this kind - a key above one
    // is a Stage 2 idea, and Stage 1's second year is where it arrives.
    prompt: 'Each picture stands for 2 shells. How many shells did {who} find?',
    // Four icons at most: a three-character row label leaves room for that
    // many in a parent's report row, whatever the key says they are worth.
    vars: [
      { name: 'mia', kind: 'int', min: '1', max: '4' },
      { name: 'jed', kind: 'int', min: '1', max: '4' },
      { name: 'ann', kind: 'int', min: '1', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Mia' : i == 1 ? 'Jed' : 'Ann'" },
    ],
    answer: '(i == 0 ? mia : i == 1 ? jed : ann) * 2',
    hint: 'Count the pictures in that row, then count them again in 2s.',
    figure: {
      kind: 'pictograph',
      counts: "mia * 2 + ',' + jed * 2 + ',' + ann * 2",
      labels: "'Mia,Jed,Ann'",
      key: '2',
    },
    tags: ['AC9M2ST02', 'MA1-DATA-02'],
  },

  // Chance, in the four words Stage 1 finishes on: certain, likely, unlikely
  // and impossible. Year 1 said will, might and will not about the same
  // spinners; this year the middle of that scale is split in two, which is
  // what a child needs before they can compare one chance with another.
  //
  // A spinner emits no text at all - a figure has exactly two appearances - so
  // these say "a shaded part" and "a part with no shading", never a colour,
  // and the fill names in the specs are grouping keys that never reach the
  // screen.
  {
    id: 'maths.2.chance.spinner-how-likely',
    subject: 'maths',
    topic: 'chance',
    level: '2',
    prompt: 'The arrow on this spinner is spun. How likely is it to stop on {part}?',
    // A whole disc is what makes "certain" and "impossible" drawable at all -
    // shaded all over, it is certain to stop on a shaded part and impossible
    // to stop on a plain one - and it is weighted down to a third of draws so
    // those two extremes do not crowd out the two the question is really for.
    // An *un*shaded whole disc cannot be drawn, since one fill group is the
    // shaded group, which is why `asked` turns the question over instead.
    vars: [
      { name: 'n', kind: 'pick', from: SPINNER_PARTS },
      { name: 'whole', kind: 'pick', from: [1, 0], weights: [1, 2] },
      { name: 's', kind: 'int', min: 'whole == 1 ? n : 1', max: 'whole == 1 ? n : n - 1' },
      { name: 'asked', kind: 'pick', from: [1, 0] },
      {
        name: 'part',
        kind: 'expr',
        expr: "asked == 1 ? 'a shaded part' : 'a part with no shading'",
      },
      { name: 'share', kind: 'expr', expr: 'asked == 1 ? s : n - s' },
    ],
    // Never an even split, which none of the four words describes. It costs
    // nothing on a whole disc, where the split is all or nothing.
    constraints: ['share * 2 != n'],
    answer:
      "share == n ? 'certain' : share == 0 ? 'impossible' : share * 2 > n ? 'likely' : 'unlikely'",
    answerType: 'choice',
    // The same four buttons every time, so the option set says nothing.
    choices: {
      count: 4,
      distractors: ["'certain'", "'likely'", "'unlikely'", "'impossible'"],
    },
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', SPINNER_PARTS),
      fills: shadedFills('n', 's', SPINNER_PARTS),
    },
    tags: ['AC9M2P01', 'MA1-CHAN-01'],
  },
  {
    id: 'maths.2.chance.spinner-impossible',
    subject: 'maths',
    topic: 'chance',
    level: '2',
    prompt: 'True or false: it is impossible for the arrow to stop on {part}.',
    // True in exactly one arrangement - a disc shaded all over, asked about a
    // part with no shading - so `right` picks that arrangement half the time
    // and `alt` picks between the three that are false the rest of the time.
    // Written this way round rather than as a constraint on the answer: a
    // constraint would throw away whole bindings and the branch harder to
    // satisfy would survive less often, which is how a "balanced" true/false
    // ends up 78/22.
    vars: [
      { name: 'n', kind: 'pick', from: SPINNER_PARTS },
      { name: 'right', kind: 'pick', from: [1, 0] },
      { name: 'alt', kind: 'int', min: '0', max: '2' },
      { name: 'whole', kind: 'expr', expr: 'right == 1 || alt == 2 ? 1 : 0' },
      { name: 'asked', kind: 'expr', expr: 'right == 1 ? 0 : (alt == 2 ? 1 : alt)' },
      { name: 's', kind: 'int', min: 'whole == 1 ? n : 1', max: 'whole == 1 ? n : n - 1' },
      {
        name: 'part',
        kind: 'expr',
        expr: "asked == 1 ? 'a shaded part' : 'a part with no shading'",
      },
    ],
    answer: 'whole == 1 && asked == 0',
    hint: 'Impossible means there is no part like that to stop on at all.',
    figure: {
      kind: 'spinner',
      sectors: equalSectors('n', SPINNER_PARTS),
      fills: shadedFills('n', 's', SPINNER_PARTS),
    },
    tags: ['AC9M2P01', 'MA1-CHAN-01'],
  },
  {
    id: 'maths.2.chance.bag-more-likely',
    subject: 'maths',
    topic: 'chance',
    level: '2',
    // No figure, and no need of one: a bag of counters is a chance question a
    // sentence can ask, and naming the two colours is honest here precisely
    // because nothing is drawn - the rule that a prompt may only name what the
    // figure draws is about a figure contradicting its own caption. Both
    // colours are offered in the prompt, so a narrator does not read the two
    // buttons out after it.
    prompt:
      'A bag holds {r} red counters and {b} blue counters. You take one without looking. Which colour are you more likely to take, red or blue?',
    // Two of each at least, so the sentence never reads "1 red counters", and
    // two apart at least: equal numbers leave this question no answer, and one
    // apart makes it a technicality rather than a comparison - six against five
    // is more likely and does not look it, and a seven-year-old weighing that
    // up is being marked on something other than chance. Red and blue are
    // ahead equally often, by the symmetry of the two draws.
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '10' },
      { name: 'b', kind: 'int', min: '2', max: '10' },
    ],
    constraints: ['abs(r - b) >= 2'],
    answer: "r > b ? 'red' : 'blue'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'red'", "'blue'"] },
    hint: 'More counters of one colour means more chance of taking that colour.',
    tags: ['AC9M2P01', 'MA1-CHAN-01'],
  },
];
