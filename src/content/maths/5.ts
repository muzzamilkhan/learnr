import type { QuestionTemplate } from '@/lib/templates/types';

/** Year 5 - NSW Stage 3. */
export const year5: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 5
  //
  // Decimals to more than two places, factors, multiples and divisibility,
  // adding fractions with related denominators, percentages, larger
  // multiplication, division with remainders, inverse operations, metric
  // conversions, perimeter and area, 12- and 24-hour time, angles in degrees,
  // and turning a shape onto itself.
  // ------------------------------------------------------------------
  {
    id: 'maths.5.decimals.count-hundredths',
    subject: 'maths',
    topic: 'decimals',
    level: '5',
    prompt: 'How many hundredths are there in {x}?',
    vars: [{ name: 'n', kind: 'int', min: '105', max: '995' }, { name: 'x', kind: 'expr', expr: 'n / 100' }],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n',
    hint: 'Each whole is 100 hundredths.',
    tags: ['AC9M5N01'],
  },
  {
    id: 'maths.5.decimals.largest',
    subject: 'maths',
    topic: 'decimals',
    level: '5',
    prompt: 'Which of these is the largest: {a}, {b} or {c}?',
    vars: [
      { name: 'a', kind: 'number', min: '0.01', max: '9.99', decimals: 2 },
      { name: 'b', kind: 'number', min: '0.01', max: '9.99', decimals: 2 },
      { name: 'c', kind: 'number', min: '0.01', max: '9.99', decimals: 2 },
    ],
    constraints: ['a != b', 'b != c', 'a != c'],
    answer: 'max(a, b, c)',
    answerType: 'choice',
    // Listing all three is enough: the one equal to the answer is dropped.
    choices: { count: 3, distractors: ['a', 'b', 'c'] },
    tags: ['AC9M5N01'],
  },
  {
    id: 'maths.5.decimals.add',
    subject: 'maths',
    topic: 'decimals',
    level: '5',
    prompt: 'What is {a} + {b}?',
    vars: [
      { name: 'na', kind: 'int', min: '105', max: '995' },
      { name: 'nb', kind: 'int', min: '105', max: '995' },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na + nb) / 100',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na + nb + 10) / 100', '(na + nb - 1) / 100', '(na + nb + 100) / 100'],
    },
    hint: 'Line up the decimal points.',
    tags: ['AC9M5N01'],
  },
  {
    id: 'maths.5.decimals.subtract',
    subject: 'maths',
    topic: 'decimals',
    level: '5',
    prompt: 'What is {a} − {b}?',
    vars: [
      { name: 'na', kind: 'int', min: '505', max: '1995' },
      { name: 'nb', kind: 'int', min: '105', max: '495' },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na - nb) / 100',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na - nb + 10) / 100', '(na - nb - 1) / 100', '(na + nb) / 100'],
    },
    tags: ['AC9M5N01'],
  },
  {
    id: 'maths.5.factors-and-multiples.is-a-factor',
    subject: 'maths',
    topic: 'factors and multiples',
    level: '5',
    prompt: 'True or false: {d} is a factor of {n}.',
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '12' },
      { name: 'n', kind: 'int', min: '20', max: '120' },
    ],
    answer: 'mod(n, d) == 0',
    hint: 'A factor divides in with nothing left over.',
    tags: ['AC9M5N02'],
  },
  {
    id: 'maths.5.factors-and-multiples.divisible',
    subject: 'maths',
    topic: 'factors and multiples',
    level: '5',
    prompt: 'True or false: {n} is divisible by {d}.',
    vars: [
      { name: 'd', kind: 'pick', from: [2, 3, 5, 9, 10] },
      { name: 'n', kind: 'int', min: '30', max: '400' },
    ],
    answer: 'mod(n, d) == 0',
    tags: ['AC9M5N02'],
  },
  {
    id: 'maths.5.factors-and-multiples.highest-common-factor',
    subject: 'maths',
    topic: 'factors and multiples',
    level: '5',
    prompt: 'What is the highest common factor of {a} and {b}?',
    vars: [
      { name: 'a', kind: 'int', min: '4', max: '48' },
      { name: 'b', kind: 'int', min: '4', max: '48' },
    ],
    constraints: ['a != b', 'gcd(a, b) > 1'],
    answer: 'gcd(a, b)',
    hint: 'The largest number that divides into both.',
    tags: ['AC9M5N02'],
  },
  {
    id: 'maths.5.factors-and-multiples.lowest-common-multiple',
    subject: 'maths',
    topic: 'factors and multiples',
    level: '5',
    prompt: 'What is the lowest common multiple of {a} and {b}?',
    vars: [
      { name: 'a', kind: 'pick', from: [2, 3, 4, 5, 6] },
      { name: 'b', kind: 'pick', from: [2, 3, 4, 5, 6] },
    ],
    constraints: ['a != b'],
    answer: 'lcm(a, b)',
    hint: 'Count in {a}s and in {b}s until the lists meet.',
    tags: ['AC9M5N02'],
  },
  {
    id: 'maths.5.fractions.add-same-denominator',
    subject: 'maths',
    topic: 'fractions',
    level: '5',
    prompt: '{a}/{d} + {b}/{d} = ?/{d}  What is the missing numerator?',
    vars: [
      { name: 'd', kind: 'int', min: '4', max: '12' },
      { name: 'a', kind: 'int', min: '1', max: 'd - 2' },
      { name: 'b', kind: 'int', min: '1', max: 'd - 1 - a' },
    ],
    answer: 'a + b',
    hint: 'The denominators match, so just add the numerators.',
    tags: ['AC9M5N05'],
  },
  {
    id: 'maths.5.fractions.add-related-denominator',
    subject: 'maths',
    topic: 'fractions',
    level: '5',
    prompt: '{a}/{d} + {b}/{d * 2} = ?/{d * 2}  What is the missing numerator?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '8' },
      { name: 'a', kind: 'int', min: '1', max: 'd - 2' },
      { name: 'b', kind: 'int', min: '1', max: 'd - 1' },
    ],
    // Keeps the total at or under one whole, so the answer is never top-heavy.
    constraints: ['a * 2 + b <= d * 2'],
    answer: 'a * 2 + b',
    hint: '{a}/{d} is the same as {a * 2}/{d * 2}.',
    tags: ['AC9M5N05'],
  },
  {
    id: 'maths.5.fractions.of-a-quantity',
    subject: 'maths',
    topic: 'fractions',
    level: '5',
    prompt: 'What is {n}/{d} of {total}?',
    vars: [
      { name: 'd', kind: 'pick', from: [3, 4, 5, 6, 8] },
      { name: 'part', kind: 'int', min: '5', max: '20' },
      { name: 'total', kind: 'expr', expr: 'd * part' },
      { name: 'n', kind: 'int', min: '2', max: 'd - 1' },
    ],
    answer: 'n * part',
    tags: ['AC9M5N03'],
  },
  {
    id: 'maths.5.percentages.of-a-quantity',
    subject: 'maths',
    topic: 'percentages',
    level: '5',
    prompt: 'What is {p}% of {total}?',
    vars: [
      { name: 'p', kind: 'pick', from: [10, 25, 50, 75] },
      { name: 'k', kind: 'int', min: '1', max: '15' },
      { name: 'total', kind: 'expr', expr: 'k * 20' },
    ],
    answer: 'total * p / 100',
    hint: '10% is one tenth; 25% is one quarter.',
    tags: ['AC9M5N04'],
  },
  {
    id: 'maths.5.percentages.fraction-equivalent',
    subject: 'maths',
    topic: 'percentages',
    level: '5',
    prompt: 'What percentage is the same as 1/{d}?',
    vars: [{ name: 'd', kind: 'pick', from: [2, 4, 5, 10] }],
    answer: '100 / d',
    tags: ['AC9M5N04'],
  },
  {
    id: 'maths.5.percentages.whole',
    subject: 'maths',
    topic: 'percentages',
    level: '5',
    prompt: '{p}% of a class has arrived. What percentage is still to come?',
    vars: [{ name: 'p', kind: 'int', min: '5', max: '95', step: 5 }],
    answer: '100 - p',
    hint: '100% is the whole class.',
    tags: ['AC9M5N04'],
  },
  {
    id: 'maths.5.multiplication.large-by-one-digit',
    subject: 'maths',
    topic: 'multiplication',
    level: '5',
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '101', max: '899' },
      { name: 'y', kind: 'int', min: '3', max: '9' },
    ],
    answer: 'x * y',
    tags: ['AC9M5N06'],
  },
  {
    id: 'maths.5.multiplication.two-by-two-digit',
    subject: 'maths',
    topic: 'multiplication',
    level: '5',
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '12', max: '49' },
      { name: 'y', kind: 'int', min: '11', max: '29' },
    ],
    answer: 'x * y',
    hint: 'Split both numbers into tens and ones.',
    tags: ['AC9M5N06'],
  },
  {
    id: 'maths.5.division.exact',
    subject: 'maths',
    topic: 'division',
    level: '5',
    prompt: 'What is {total} ÷ {d}?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '12' },
      { name: 'x', kind: 'int', min: '11', max: '60' },
      { name: 'total', kind: 'expr', expr: 'd * x' },
    ],
    answer: 'x',
    tags: ['AC9M5N07'],
  },
  {
    id: 'maths.5.division.remainder',
    subject: 'maths',
    topic: 'division',
    level: '5',
    prompt: 'What is the remainder when {total} is divided by {d}?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '9' },
      { name: 'total', kind: 'int', min: '20', max: '200' },
    ],
    constraints: ['mod(total, d) != 0'],
    answer: 'mod(total, d)',
    hint: 'How much is left over after the last whole group?',
    tags: ['AC9M5N07'],
  },
  {
    id: 'maths.5.division.how-many-groups',
    subject: 'maths',
    topic: 'division',
    level: '5',
    prompt:
      '{total} students are put into teams of {d}. How many full teams are there?',
    vars: [
      { name: 'd', kind: 'int', min: '3', max: '8' },
      { name: 'total', kind: 'int', min: '30', max: '160' },
    ],
    constraints: ['mod(total, d) != 0'],
    answer: 'floor(total / d)',
    hint: 'The leftover students do not make a full team.',
    tags: ['AC9M5N07'],
  },
  {
    id: 'maths.5.algebra.inverse-operations',
    subject: 'maths',
    topic: 'algebra',
    level: '5',
    prompt: 'You know that {a} × {b} = {a * b}. What is {a * b} ÷ {b}?',
    vars: [
      { name: 'a', kind: 'int', min: '6', max: '30' },
      { name: 'b', kind: 'int', min: '3', max: '12' },
    ],
    answer: 'a',
    hint: 'Multiplying and dividing undo each other.',
    tags: ['AC9M5A01'],
  },
  {
    id: 'maths.5.algebra.unknown-value',
    subject: 'maths',
    topic: 'algebra',
    level: '5',
    prompt: 'What goes in the box? {a} × ? = {product}',
    vars: [
      { name: 'a', kind: 'int', min: '3', max: '12' },
      { name: 'b', kind: 'int', min: '3', max: '12' },
      { name: 'product', kind: 'expr', expr: 'a * b' },
    ],
    answer: 'b',
    tags: ['AC9M5A02'],
  },
  {
    id: 'maths.5.number-patterns.multiply-rule',
    subject: 'maths',
    topic: 'number patterns',
    level: '5',
    prompt: 'The rule is: multiply by {k}. Starting at {a}, what is the 4th number in the pattern?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '9' },
      { name: 'k', kind: 'pick', from: [2, 3] },
    ],
    answer: 'a * pow(k, 3)',
    hint: '{a} is the 1st number, so multiply by {k} three more times.',
    tags: ['AC9M5N10'],
  },
  {
    id: 'maths.5.measurement.millimetres',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    prompt: 'How many millimetres are there in {n} centimetres?',
    vars: [{ name: 'n', kind: 'int', min: '3', max: '40' }],
    answer: 'n * 10',
    tags: ['AC9M5M01'],
  },
  {
    id: 'maths.5.measurement.millilitres',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    prompt: 'How many millilitres are there in {n} litres?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '12' }],
    answer: 'n * 1000',
    tags: ['AC9M5M01'],
  },
  {
    id: 'maths.5.perimeter-and-area.rectangle-area',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '5',
    prompt: 'A rectangle is {l} cm long and {w} cm wide. What is its area, in square centimetres?',
    vars: [
      { name: 'l', kind: 'int', min: '4', max: '25' },
      { name: 'w', kind: 'int', min: '3', max: '18' },
    ],
    answer: 'l * w',
    tags: ['AC9M5M02'],
  },
  {
    id: 'maths.5.perimeter-and-area.missing-side',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '5',
    prompt:
      'A rectangle has an area of {area} square centimetres and is {w} cm wide. How long is it, in centimetres?',
    vars: [
      { name: 'w', kind: 'int', min: '3', max: '12' },
      { name: 'l', kind: 'int', min: '4', max: '20' },
      { name: 'area', kind: 'expr', expr: 'l * w' },
    ],
    answer: 'l',
    tags: ['AC9M5M02'],
  },
  {
    id: 'maths.5.time.24-hour',
    subject: 'maths',
    topic: 'time',
    level: '5',
    prompt: 'A train leaves at {h}:00 in 24-hour time. What is that hour on a 12-hour clock?',
    vars: [{ name: 'h', kind: 'int', min: '13', max: '23' }],
    answer: 'h - 12',
    hint: 'After midday, take 12 off the 24-hour time.',
    tags: ['AC9M5M03'],
  },
  {
    id: 'maths.5.angles.right-angles-in-degrees',
    subject: 'maths',
    topic: 'angles',
    level: '5',
    prompt: 'How many degrees are there in {n} right angles?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '4' }],
    answer: 'n * 90',
    hint: 'A right angle is 90 degrees.',
    tags: ['AC9M5M04'],
  },
  {
    id: 'maths.5.angles.name-from-degrees',
    subject: 'maths',
    topic: 'angles',
    level: '5',
    prompt: 'Is an angle of {d} degrees acute, obtuse or reflex?',
    vars: [{ name: 'd', kind: 'int', min: '5', max: '355', step: 5 }],
    constraints: ['d != 90', 'd != 180'],
    answer: "d < 90 ? 'acute' : d < 180 ? 'obtuse' : 'reflex'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'acute'", "'obtuse'", "'reflex'"] },
    hint: 'Under 90 is acute, between 90 and 180 is obtuse, over 180 is reflex.',
    tags: ['AC9M5M04'],
  },
  {
    id: 'maths.5.angles.name-picture',
    subject: 'maths',
    topic: 'angles',
    level: '5',
    // The same three names as the question above, asked of a drawing rather
    // than of a number. Naming an angle you are told the size of is arithmetic;
    // naming one you are shown is the estimating half of this description.
    prompt: 'Is this angle acute, obtuse or reflex?',
    vars: [
      { name: 'kind', kind: 'pick', from: ['acute', 'obtuse', 'reflex'] },
      // Clear of the right angle by 25 degrees either side, as above, and of
      // the straight angle by 20 - the same clearance Year 4 takes, so there
      // is one standard here rather than one standard with an exception.
      //
      // The sweep is drawn, so 170 degrees and 190 are not quite the same
      // picture, and an earlier version of this leaned on that. It leans on it
      // too hard: the arc's ends sit on the arms, so it says which side of them
      // the angle is on and not how big it is, and at 170 against 190 the far
      // arm's tip is about six to nine units off the straight continuation -
      // eight to twelve pixels on an iPad held sideways. That is a cue, not a
      // difference a child can be marked wrong for missing.
      { name: 'small', kind: 'int', min: '15', max: '65', step: 5 },
      { name: 'large', kind: 'int', min: '115', max: '160', step: 5 },
      { name: 'round', kind: 'int', min: '200', max: '340', step: 5 },
      {
        name: 'd',
        kind: 'expr',
        expr: "kind == 'acute' ? small : kind == 'obtuse' ? large : round",
      },
    ],
    answer: 'kind',
    answerType: 'choice',
    choices: { count: 3, distractors: ["'acute'", "'obtuse'", "'reflex'"] },
    hint: 'The marked sweep is the angle - a reflex one goes more than half way round.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M5M04'],
  },
  {
    id: 'maths.5.angles.estimate-degrees',
    subject: 'maths',
    topic: 'angles',
    level: '5',
    prompt: 'About how many degrees is this angle?',
    vars: [
      // The four sizes are the four buttons, always, and the drawn angle is
      // one of them. Stepping the distractors round a ring of five instead -
      // the answer, then the next two along - gave every answer an option set
      // of its own: {30, 60, 90} could only ever be 30, {60, 90, 120} could
      // only ever be 60, and a child who never looked at the drawing scored
      // 100%. A set that moves with the answer names it, however well the
      // drawing itself varies.
      { name: 'd', kind: 'pick', from: [30, 60, 90, 120] },
    ],
    answer: 'd',
    answerType: 'choice',
    choices: { count: 4, distractors: ['30', '60', '90', '120'] },
    hint: 'A right angle is 90 degrees. Is this one bigger or smaller than that?',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M5M04'],
  },
  // Year 5 turns the shape instead of flipping it. Year 4 already asks both
  // halves of the line-symmetry question, and asking it again in a different
  // sentence would be one question wearing two years - a topic is supposed to
  // recur *harder*, not reworded. A turn is the harder half: a line of
  // symmetry is there to be seen on the page, and whether a shape comes back
  // to itself part way round has to be done in the head. It is what puts the
  // parallelogram - no line of symmetry at all, but perfectly unchanged by a
  // half turn - in front of a child. Neither draws a mirror line, so the
  // heptagon and the octagon are allowed back in.
  //
  // **Both cite two content descriptions, which nothing else in this file
  // does.** `AC9M4SP03` is "recognise line *and rotational* symmetry of
  // shapes", and that is what these two questions ask, near enough word for
  // word. `AC9M5SP03` is where they sit and what makes them Year 5 work - but
  // its head is *describe and perform* translations, reflections and
  // rotations, which neither question asks for, and the fit rests on its
  // trailing "identify any symmetries". Citing only the Year 5 code would
  // claim the harder half of that description; citing only the Year 4 one
  // would file Year 5 questions under Year 4. Both is what is honestly
  // practised, and a topic recurring across years is the thing this course is
  // built out of, so a year citing its predecessor's description is the
  // recurrence showing rather than a mistake.
  {
    id: 'maths.5.symmetry.half-turn',
    subject: 'maths',
    topic: 'symmetry',
    level: '5',
    prompt: 'True or false: turning this shape half way round would leave it looking exactly the same.',
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
          'rhombus',
          'parallelogram',
          'trapezium',
          'kite',
          'pentagon',
          'hexagon',
          'heptagon',
          'octagon',
        ],
      },
    ],
    // The shapes that come back to themselves after 180 degrees: the four
    // quadrilaterals with opposite sides in pairs, and the polygons with an
    // even number of sides.
    answer:
      "shape == 'square' || shape == 'rectangle' || shape == 'rhombus' || " +
      "shape == 'parallelogram' || shape == 'hexagon' || shape == 'octagon'",
    hint: 'Half a turn is the same as looking at it upside down.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M4SP03', 'AC9M5SP03'],
  },
  {
    id: 'maths.5.symmetry.turn-matches',
    subject: 'maths',
    topic: 'symmetry',
    level: '5',
    prompt: 'In one full turn, how many times does this shape look exactly the same as it does now?',
    vars: [
      // Every shape here matches at least twice. A shape that matches only on
      // the way back to where it started is the answer "1", which reads as a
      // trick rather than a count, so none is offered.
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'rectangle',
          'rhombus',
          'parallelogram',
          'equilateral',
          'square',
          'pentagon',
          'hexagon',
          'heptagon',
          'octagon',
        ],
      },
    ],
    answer:
      "shape == 'rectangle' || shape == 'rhombus' || shape == 'parallelogram' ? 2 : " +
      "shape == 'equilateral' ? 3 : shape == 'square' ? 4 : shape == 'pentagon' ? 5 : " +
      "shape == 'hexagon' ? 6 : shape == 'heptagon' ? 7 : 8",
    // The three shapes that are not regular are the three the hint has to
    // name: for the other six the answer is the side count, which the first
    // sentence gives away outright, and these are the only draws where the
    // turning has to actually be done.
    hint: 'A regular shape matches once for every side. A rectangle, a rhombus and a parallelogram match twice.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M4SP03', 'AC9M5SP03'],
  },
];
