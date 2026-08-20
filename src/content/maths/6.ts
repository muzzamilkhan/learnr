import type { QuestionTemplate } from '@/lib/templates/types';

/** Year 6 - NSW Stage 3. */
export const year6: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 6
  //
  // Integers, prime, composite and square numbers, adding and subtracting
  // decimals and fractions, percentages of quantities and discounts, order of
  // operations with brackets, metric conversions using decimals, the area of a
  // rectangle, angles on a line and at a point, and the Cartesian plane.
  //
  // The integer questions are multiple choice: the number pad has no minus key.
  // ------------------------------------------------------------------
  {
    id: 'maths.6.integers.temperature',
    subject: 'maths',
    topic: 'integers',
    level: '6',
    prompt: 'The temperature is {a}°C. Overnight it falls {d}°C. What is the new temperature, in °C?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '8' },
      { name: 'd', kind: 'int', min: 'a + 2', max: 'a + 12' },
      // One degree out either way - the slip a child makes counting past zero,
      // and what stops the sign errors pinning the answer to one rank.
      { name: 's', kind: 'pick', from: [-1, 1] },
    ],
    answer: 'a - d',
    answerType: 'choice',
    choices: { count: 4, distractors: ['d - a', '-(a + d)', 'a - d + s'] },
    hint: 'Count down past zero.',
    tags: ['AC9M6N01'],
  },
  {
    id: 'maths.6.integers.subtract',
    subject: 'maths',
    topic: 'integers',
    level: '6',
    prompt: 'What is {a} − {b}?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '20' },
      { name: 'b', kind: 'int', min: 'a + 2', max: 'a + 20' },
      // One out either way, counting back past zero. The two sign errors sit on
      // fixed sides of the answer, so this is what moves its rank.
      { name: 's', kind: 'pick', from: [-1, 1] },
    ],
    answer: 'a - b',
    answerType: 'choice',
    choices: { count: 4, distractors: ['b - a', '-(a + b)', 'a - b + s'] },
    tags: ['AC9M6N01'],
  },
  {
    id: 'maths.6.integers.compare',
    subject: 'maths',
    topic: 'integers',
    level: '6',
    prompt: 'True or false: −{a} is greater than −{b}.',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '30' },
      { name: 'b', kind: 'int', min: '1', max: '30' },
    ],
    constraints: ['a != b'],
    answer: '-a > -b',
    hint: 'On a number line, further left is smaller.',
    tags: ['AC9M6N01'],
  },
  {
    id: 'maths.6.primes-and-squares.is-prime',
    subject: 'maths',
    topic: 'primes and squares',
    level: '6',
    prompt: 'True or false: {n} is a prime number.',
    vars: [
      {
        name: 'n',
        kind: 'pick',
        from: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
      },
    ],
    answer: 'n == 2 || n == 3 || n == 5 || n == 7 || n == 11 || n == 13 || n == 17 || n == 19',
    hint: 'A prime has exactly two factors: 1 and itself.',
    tags: ['AC9M6N02'],
  },
  {
    id: 'maths.6.primes-and-squares.square-number',
    subject: 'maths',
    topic: 'primes and squares',
    level: '6',
    prompt: 'What is {n} squared?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '15' }],
    answer: 'n * n',
    hint: '{n} × {n}',
    tags: ['AC9M6N02'],
  },
  {
    id: 'maths.6.primes-and-squares.square-root',
    subject: 'maths',
    topic: 'primes and squares',
    level: '6',
    prompt: 'What is the square root of {square}?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '15' }, { name: 'square', kind: 'expr', expr: 'n * n' }],
    answer: 'n',
    hint: 'Which number times itself gives {square}?',
    tags: ['AC9M6N02'],
  },
  {
    id: 'maths.6.decimals.add',
    subject: 'maths',
    topic: 'decimals',
    level: '6',
    prompt: 'What is {a} + {b}?',
    vars: [
      { name: 'na', kind: 'int', min: '105', max: '4995' },
      { name: 'nb', kind: 'int', min: '105', max: '4995' },
      // Which side the whole-number slip falls on, so the answer is not for ever
      // second-smallest behind a lone hundredth below it.
      { name: 's', kind: 'pick', from: [-100, 100] },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na + nb) / 100',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na + nb + 10) / 100', '(na + nb - 1) / 100', '(na + nb + s) / 100'],
    },
    tags: ['AC9M6N04'],
  },
  {
    id: 'maths.6.decimals.multiply-by-powers-of-ten',
    subject: 'maths',
    topic: 'decimals',
    level: '6',
    prompt: 'What is {a} × {p}?',
    vars: [
      { name: 'n', kind: 'int', min: '105', max: '995' },
      { name: 'a', kind: 'expr', expr: 'n / 100' },
      { name: 'p', kind: 'pick', from: [10, 100] },
      // How far the third place-value slip goes: not shifting at all, or
      // shifting two places too far. Every distractor used to land above the
      // answer bar one, which pinned it at rank 2; alternating this one keeps
      // all three options place-value errors and lets the answer move.
      { name: 'q', kind: 'pick', from: [1, 10000] },
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n * p / 100',
    answerType: 'choice',
    // Kept clear of each other at both p values: at p = 10, `n * p / 1000` and
    // `n / 100` would be the same number.
    choices: { count: 4, distractors: ['n * p / 1000', 'n * p / 10', 'n * p / q'] },
    hint: 'Every digit moves left one place for each zero.',
    tags: ['AC9M6N06'],
  },
  {
    id: 'maths.6.decimals.divide-by-powers-of-ten',
    subject: 'maths',
    topic: 'decimals',
    level: '6',
    prompt: 'What is {a} ÷ 10?',
    vars: [
      { name: 'n', kind: 'int', min: '11', max: '999' },
      { name: 'a', kind: 'expr', expr: 'n / 10' },
      // How far the third slip goes: not dividing at all, or dividing three
      // places too far. Both are place-value errors, and alternating them is
      // what moves the answer off a fixed rank.
      { name: 'q', kind: 'pick', from: [1, 10000] },
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n / 100',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n / 10', 'n / 1000', 'n / q'] },
    hint: 'Every digit moves one place to the right.',
    tags: ['AC9M6N06'],
  },
  {
    id: 'maths.6.fractions.add-with-equivalence',
    subject: 'maths',
    topic: 'fractions',
    level: '6',
    prompt: '{a}/{d} + {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '9' },
      { name: 'a', kind: 'int', min: '1', max: 'd - 2' },
      { name: 'b', kind: 'int', min: '1', max: 'd - 1' },
    ],
    constraints: ['a * 2 + b <= d * 2'],
    answer: 'a * 2 + b',
    hint: 'Rewrite {a}/{d} with {d * 2} on the bottom first.',
    tags: ['AC9M6N05'],
  },
  {
    id: 'maths.6.fractions.subtract-with-equivalence',
    subject: 'maths',
    topic: 'fractions',
    level: '6',
    prompt: '{a}/{d} − {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '9' },
      { name: 'a', kind: 'int', min: '2', max: 'd - 1' },
      { name: 'b', kind: 'int', min: '1', max: 'a * 2 - 1' },
    ],
    answer: 'a * 2 - b',
    tags: ['AC9M6N05'],
  },
  {
    id: 'maths.6.fractions.compare',
    subject: 'maths',
    topic: 'fractions',
    level: '6',
    prompt: 'True or false: {a}/{d} is greater than {b}/{e}.',
    vars: [
      { name: 'd', kind: 'pick', from: [2, 3, 4, 6] },
      { name: 'e', kind: 'pick', from: [2, 3, 4, 6] },
      { name: 'a', kind: 'int', min: '1', max: 'd - 1' },
      { name: 'b', kind: 'int', min: '1', max: 'e - 1' },
    ],
    constraints: ['a / d != b / e'],
    answer: 'a / d > b / e',
    hint: 'Rewrite both with the same denominator.',
    tags: ['AC9M6N03'],
  },
  {
    id: 'maths.6.percentages.of-a-quantity',
    subject: 'maths',
    topic: 'percentages',
    level: '6',
    prompt: 'What is {p}% of {total}?',
    vars: [
      { name: 'p', kind: 'pick', from: [5, 10, 20, 25, 50] },
      { name: 'k', kind: 'int', min: '2', max: '25' },
      { name: 'total', kind: 'expr', expr: 'k * 20' },
    ],
    answer: 'total * p / 100',
    tags: ['AC9M6N07'],
  },
  {
    id: 'maths.6.percentages.discount-saved',
    subject: 'maths',
    topic: 'percentages',
    level: '6',
    prompt: 'A jacket costs ${cost}. It is reduced by {p}%. How many dollars do you save?',
    vars: [
      { name: 'p', kind: 'pick', from: [10, 25, 50] },
      { name: 'k', kind: 'int', min: '1', max: '10' },
      { name: 'cost', kind: 'expr', expr: 'k * 20' },
    ],
    answer: 'cost * p / 100',
    tags: ['AC9M6N07'],
  },
  {
    id: 'maths.6.percentages.sale-price',
    subject: 'maths',
    topic: 'percentages',
    level: '6',
    prompt: 'A game costs ${cost} and is {p}% off. What do you pay, in dollars?',
    vars: [
      { name: 'p', kind: 'pick', from: [10, 25, 50] },
      { name: 'k', kind: 'int', min: '1', max: '10' },
      { name: 'cost', kind: 'expr', expr: 'k * 20' },
    ],
    answer: 'cost - cost * p / 100',
    hint: 'Work out the saving, then subtract it from {cost} dollars.',
    tags: ['AC9M6N07'],
  },
  {
    id: 'maths.6.order-of-operations.multiply-first',
    subject: 'maths',
    topic: 'order of operations',
    level: '6',
    prompt: 'What is {a} + {b} × {c}?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '30' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
      { name: 'c', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'a + b * c',
    hint: 'Multiplication happens before addition.',
    tags: ['AC9M6A02'],
  },
  {
    id: 'maths.6.order-of-operations.brackets-first',
    subject: 'maths',
    topic: 'order of operations',
    level: '6',
    prompt: 'What is ({a} + {b}) × {c}?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '30' },
      { name: 'b', kind: 'int', min: '2', max: '20' },
      { name: 'c', kind: 'int', min: '2', max: '9' },
    ],
    answer: '(a + b) * c',
    hint: 'Do what is inside the brackets first.',
    tags: ['AC9M6A02'],
  },
  {
    id: 'maths.6.algebra.unknown-with-brackets',
    subject: 'maths',
    topic: 'algebra',
    level: '6',
    prompt: 'What goes in the box? ({a} + ?) × {c} = {total}',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '20' },
      { name: 'b', kind: 'int', min: '2', max: '20' },
      { name: 'c', kind: 'int', min: '2', max: '9' },
      { name: 'total', kind: 'expr', expr: '(a + b) * c' },
    ],
    answer: 'b',
    hint: 'Divide {total} by {c} first.',
    tags: ['AC9M6A02'],
  },
  {
    id: 'maths.6.number-patterns.two-step-rule',
    subject: 'maths',
    topic: 'number patterns',
    level: '6',
    prompt: 'The rule is: multiply by {k}, then add {b}. What comes after {a}?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '20' },
      { name: 'k', kind: 'pick', from: [2, 3, 4] },
      { name: 'b', kind: 'int', min: '1', max: '9' },
    ],
    answer: 'a * k + b',
    tags: ['AC9M6A01'],
  },
  {
    id: 'maths.6.number-patterns.growing-pattern',
    subject: 'maths',
    topic: 'number patterns',
    level: '6',
    prompt:
      'A growing pattern starts at {a} and the gaps grow: it adds {d}, then {2 * d}, then {3 * d}. What is the 4th number?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '20' },
      { name: 'd', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'a + d + 2 * d + 3 * d',
    tags: ['AC9M6A01'],
  },
  {
    id: 'maths.6.measurement.centimetres-to-metres',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    prompt: 'How many metres is {cm} centimetres?',
    vars: [
      { name: 'n', kind: 'int', min: '3', max: '199' },
      { name: 'cm', kind: 'expr', expr: 'n * 5' },
      // Not converting at all, or shifting two places too far. Both are mistakes
      // worth offering, and alternating them is what stops the answer being the
      // second-smallest option every time.
      { name: 'q', kind: 'pick', from: [1, 10000] },
    ],
    constraints: ['mod(n * 5, 100) != 0'],
    answer: 'n * 5 / 100',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n * 5 / 10', 'n * 5 / 1000', 'n * 5 / q'] },
    hint: 'There are 100 centimetres in a metre.',
    tags: ['AC9M6M01'],
  },
  {
    id: 'maths.6.measurement.grams-to-kilograms',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    prompt: 'How many kilograms is {g} grams?',
    vars: [
      { name: 'n', kind: 'int', min: '3', max: '199' },
      { name: 'g', kind: 'expr', expr: 'n * 50' },
      // Not converting at all, or shifting two places too far. Alternating them
      // is what stops the answer being the second-smallest option every time.
      { name: 'q', kind: 'pick', from: [1, 100000] },
    ],
    constraints: ['mod(n * 5, 100) != 0'],
    answer: 'n * 50 / 1000',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n * 50 / 100', 'n * 50 / 10000', 'n * 50 / q'] },
    hint: 'There are 1000 grams in a kilogram.',
    tags: ['AC9M6M01'],
  },
  {
    id: 'maths.6.perimeter-and-area.rectangle-formula',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '6',
    prompt: 'A rectangle is {l} m long and {w} m wide. What is its area, in square metres?',
    vars: [
      { name: 'l', kind: 'int', min: '5', max: '40' },
      { name: 'w', kind: 'int', min: '3', max: '25' },
    ],
    answer: 'l * w',
    hint: 'Area of a rectangle is length times width.',
    tags: ['AC9M6M02'],
  },
  {
    id: 'maths.6.perimeter-and-area.square-area',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '6',
    prompt: 'A square has sides of {s} m. What is its area, in square metres?',
    vars: [{ name: 's', kind: 'int', min: '3', max: '20' }],
    answer: 's * s',
    tags: ['AC9M6M02'],
  },
  {
    id: 'maths.6.angles.on-a-straight-line',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    prompt: 'Two angles sit on a straight line. One is {a} degrees. What is the other, in degrees?',
    vars: [{ name: 'a', kind: 'int', min: '10', max: '170', step: 5 }],
    answer: '180 - a',
    hint: 'Angles on a straight line add to 180 degrees.',
    tags: ['AC9M6M04'],
  },
  {
    id: 'maths.6.angles.at-a-point',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    prompt:
      'Three angles meet at a point. Two of them are {a} degrees and {b} degrees. What is the third, in degrees?',
    vars: [
      { name: 'a', kind: 'int', min: '20', max: '170', step: 5 },
      { name: 'b', kind: 'int', min: '20', max: '170', step: 5 },
    ],
    constraints: ['a + b < 350'],
    answer: '360 - a - b',
    hint: 'Angles at a point add to 360 degrees.',
    tags: ['AC9M6M04'],
  },
  {
    id: 'maths.6.angles.vertically-opposite',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    prompt:
      'Two straight lines cross. One of the angles is {a} degrees. What is the angle opposite it, in degrees?',
    vars: [{ name: 'a', kind: 'int', min: '15', max: '165', step: 5 }],
    answer: 'a',
    hint: 'Vertically opposite angles are equal.',
    tags: ['AC9M6M04'],
  },
  {
    id: 'maths.6.angles.rest-of-a-turn',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    // The picture is what says which of the two angles at the point is meant.
    // Told in words alone, "the angle on the other side" is the thing the
    // question would have to explain before it could ask anything.
    prompt: 'The marked angle is {d} degrees. How many degrees is the angle on the other side of it?',
    vars: [{ name: 'd', kind: 'int', min: '20', max: '340', step: 5 }],
    // A straight angle has no other side worth asking about.
    constraints: ['d != 180'],
    answer: '360 - d',
    hint: 'Angles at a point add to 360 degrees.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M6M04'],
  },
  {
    id: 'maths.6.angles.rest-of-a-line',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    // Nothing says how big the marked angle is, so the relationship has to be
    // read off the drawing rather than taken from the prompt and subtracted.
    //
    // Asked as a hypothetical, because the figure draws one angle and no line:
    // an earlier wording said the marked angle "sits on a straight line with
    // one more angle", which sent a child looking for a straight line and a
    // second angle that are not in the picture. Drawing them would mean a new
    // figure kind for one template. "Would be" is what the drawing can honestly
    // support - the angle is there, the line is the thing being imagined.
    prompt:
      'One more angle beside the marked one would make a straight line. Would that other angle be bigger or smaller than this one?',
    vars: [{ name: 'd', kind: 'int', min: '20', max: '160', step: 5 }],
    constraints: ['abs(d - 90) >= 25'],
    answer: "d < 90 ? 'bigger' : 'smaller'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'bigger'", "'smaller'"] },
    hint: 'The two add to 180 degrees, so compare this one with 90.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M6M04'],
  },
  {
    id: 'maths.6.time.journey-length',
    subject: 'maths',
    topic: 'time',
    level: '6',
    prompt: 'A bus leaves at 9:{a} and arrives at 10:{b}. How many minutes does the journey take?',
    vars: [
      { name: 'a', kind: 'int', min: '5', max: '55', step: 5 },
      { name: 'b', kind: 'int', min: '5', max: '55', step: 5 },
    ],
    answer: '60 - a + b',
    hint: 'Count up to 10 o’clock first.',
    tags: ['AC9M6M03'],
  },
  {
    id: 'maths.6.position.move-a-point',
    subject: 'maths',
    topic: 'position',
    level: '6',
    prompt:
      'A point sits at ({x}, {y}) on a grid. It moves {d} units to the right. What is its new x-coordinate?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '8' },
      { name: 'y', kind: 'int', min: '1', max: '8' },
      { name: 'd', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'x + d',
    tags: ['AC9M6SP02'],
  },
];
