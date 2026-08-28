import type { QuestionTemplate } from '../../lib/templates/types';

/** Year 5 - NSW Stage 3. */
export const year5: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 5
  //
  // Decimals to more than two places, factors, multiples and divisibility,
  // adding fractions with related denominators, percentages, larger
  // multiplication, division with remainders, inverse operations, metric
  // conversions, perimeter and area, 12- and 24-hour time, angles in degrees,
  // and turning a shape onto itself - and then the picture questions: a shaded
  // shape read for the fraction it is equal to, a percentage read off a number
  // line, a clock face turned into 24-hour time and counted on from, solids
  // counted from the outside instead of from their nets, a dot on a coordinate
  // plane, picture graphs whose key says ten and whose last icon is a half,
  // line graphs read for a day and for the rise between two, and spinners
  // answered with a fraction and with a percentage.
  //
  // **Year 5 is Stage 3's first year, so every NSW code here is an `MA3-` one
  // Year 6 also cites.** NSW writes one outcome per focus area for the pair of
  // years; what separates the two is the ACARA description and the difficulty,
  // not the outcome. The two `symmetry` templates are the only ones in the year
  // with no NSW code at all, and the comment at them says why.
  //
  // Two things this year is the first to be allowed. **A many-to-one picture
  // graph carries its NSW citation here**: Years K to 4 were held to a key of
  // one or to an ACARA-only tag because NSW places many-to-one scales at
  // Stage 3, and this is Stage 3. And **a grid marks a point rather than a
  // cell**: `MA3-GM-01` is the first-quadrant coordinate plane, which Years 2
  // to 4 could not ask.
  //
  // Each new template is filed with the topic it practises rather than in a
  // block at the end; the four topics Year 5 did not have - shapes, position,
  // data and chance - are new sections after the ones that were here.
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
    tags: ['AC9M5N01', 'MA3-RN-02'],
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
    // The largest of three is the largest option by definition - that is the
    // question, and comparing hundredths is how a child finds it.
    choices: { count: 3, distractors: ['a', 'b', 'c'], rankIsTheQuestion: true },
    tags: ['AC9M5N01', 'MA3-RN-02'],
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
      { name: 'u', kind: 'pick', from: [1, 10, 100] },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'lo', kind: 'expr', expr: 'na + nb - k * u' },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na + nb) / 100',
    answerType: 'choice',
    // An evenly spaced run with the answer at a drawn position, the shape
    // `maths.4.decimals.tenths` explains; `maths.6.decimals.add` is the same
    // template a year on.
    choices: {
      count: 4,
      distractors: ['lo / 100', '(lo + u) / 100', '(lo + 2 * u) / 100', '(lo + 3 * u) / 100'],
    },
    hint: 'Line up the decimal points.',
    tags: ['AC9M5N01', 'MA3-AR-01'],
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
      // Which side the tenth-sized slip falls on. Adding instead of subtracting
      // is always the biggest option and losing a hundredth always the smallest,
      // so without this the answer sat second-smallest every draw.
      { name: 's', kind: 'pick', from: [-10, 10] },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    // Far enough apart that the slip below the answer is still a real amount.
    constraints: ['na - nb >= 20'],
    answer: '(na - nb) / 100',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na - nb + s) / 100', '(na - nb - 1) / 100', '(na + nb) / 100'],
    },
    tags: ['AC9M5N01', 'MA3-AR-01'],
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
    tags: ['AC9M5N02', 'MA3-MR-01'],
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
    tags: ['AC9M5N02', 'MA3-MR-01'],
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
    tags: ['AC9M5N02', 'MA3-MR-01'],
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
    tags: ['AC9M5N02', 'MA3-MR-01'],
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
    tags: ['AC9M5N05', 'MA3-RQF-01'],
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
    tags: ['AC9M5N05', 'MA3-RQF-01'],
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
    tags: ['AC9M5N03', 'MA3-RQF-02'],
  },
  {
    id: 'maths.5.fractions.equivalent-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: '5',
    // **The shaded shape read for the fraction it is *equal to*, which is the
    // step past every fraction picture before it.** Year 3 counted the parts and
    // said what they were ("two fifths"); Year 4 asked whether the shading came
    // to a half. Both are answered by counting. This one is not: four parts of
    // twelve is counted the same way and then has to be recognised as a third,
    // which is what MA3-RQF-01 and AC9M5N03 both put at this year.
    //
    // The drawing is never simplified - twelve parts with four shaded is drawn
    // as twelve parts with four shaded, and that is the whole point of showing
    // it. What is simplified is the answer, and the four buttons are the four
    // simplest fractions the picture can come to.
    prompt: 'How much of this shape is shaded, in its simplest form?',
    // The answer is picked first and the picture built out from it, by a
    // multiplier of at least 2 - so the fraction on the button is never the one
    // drawn, and each of the four answers comes up equally often.
    //
    // How far the multiplier may go is what the shape can carry: a strip or a
    // rectangle takes twelve parts at most, so halves stretch to six times and
    // quarters only to three.
    vars: [
      { name: 'which', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'top', kind: 'expr', expr: 'which == 3 ? 2 : 1' },
      { name: 'bottom', kind: 'expr', expr: 'which == 0 ? 2 : which == 2 ? 4 : 3' },
      { name: 'm', kind: 'int', min: '2', max: 'which == 0 ? 6 : which == 2 ? 3 : 4' },
      { name: 'n', kind: 'expr', expr: 'top * m' },
      { name: 'd', kind: 'expr', expr: 'bottom * m' },
    ],
    // A fraction cannot be typed on a number pad, so it is tapped - and the
    // same four buttons are offered every draw, so the option set says nothing
    // about which one it is.
    answer: "top + '/' + bottom",
    answerType: 'choice',
    choices: { count: 4, distractors: ["'1/2'", "'1/3'", "'1/4'", "'2/3'"] },
    hint: 'Count the shaded parts and the parts altogether, then look for a smaller fraction that means the same.',
    // `shape` is left open. Every denominator here is composite - 4, 6, 8, 9,
    // 10 and 12 - so all three shapes can carry them and the prompt names none.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['AC9M5N03', 'MA3-RQF-01'],
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
    tags: ['AC9M5N04', 'MA3-RN-03'],
  },
  {
    id: 'maths.5.percentages.fraction-equivalent',
    subject: 'maths',
    topic: 'percentages',
    level: '5',
    prompt: 'What percentage is the same as 1/{d}?',
    vars: [{ name: 'd', kind: 'pick', from: [2, 4, 5, 10] }],
    answer: '100 / d',
    tags: ['AC9M5N04', 'MA3-RN-03'],
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
    tags: ['AC9M5N04', 'MA3-RN-03'],
  },
  {
    id: 'maths.5.percentages.number-line-percent',
    subject: 'maths',
    topic: 'percentages',
    level: '5',
    // A percentage as a **position** rather than as an amount taken off a
    // number, which is what the other three percentage templates ask and what
    // MA3-RN-03 pairs it with: the same quantity written as a decimal, a
    // fraction and a percentage. Nothing on the line says "per cent" - the ends
    // read 0 and 1 - so the reading is the conversion.
    //
    // **The range is pinned, and it has to be.** The whole is what a percentage
    // is measured against, so a line the builder had chosen for itself - 0 to
    // 2, or 0 to 5, both of which it offers for some of these values - would
    // make the question mean something else without changing a word of it. What
    // varies instead is the arrow, which is the answer, and the step: the line
    // labels its middle about half the time and only its ends the rest.
    prompt: 'What percentage is the arrow pointing to?',
    // Tenths, plus the two quarters that are not tenths. Both draw a tick under
    // the arrow on a one-unit line; nothing finer does - a hundredth has no
    // line the kind can label at all, which is why this stops where it does.
    vars: [{ name: 'k', kind: 'pick', from: [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90] }],
    answer: 'k',
    hint: 'The whole line is 100%.',
    figure: { kind: 'number-line', at: 'k / 100', from: '0', to: '1' },
    tags: ['AC9M5N04', 'MA3-RN-03'],
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
    tags: ['AC9M5N06', 'MA3-MR-01'],
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
    tags: ['AC9M5N06', 'MA3-MR-01'],
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
    tags: ['AC9M5N07', 'MA3-MR-01'],
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
    tags: ['AC9M5N07', 'MA3-MR-01'],
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
    tags: ['AC9M5N07', 'MA3-MR-01'],
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
    tags: ['AC9M5A01', 'MA3-MR-02'],
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
    tags: ['AC9M5A02', 'MA3-MR-02'],
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
    tags: ['AC9M5N10', 'MA3-MR-01'],
  },
  {
    id: 'maths.5.measurement.millimetres',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    prompt: 'How many millimetres are there in {n} centimetres?',
    vars: [{ name: 'n', kind: 'int', min: '3', max: '40' }],
    answer: 'n * 10',
    tags: ['AC9M5M01', 'MA3-GM-02'],
  },
  {
    id: 'maths.5.measurement.millilitres',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    prompt: 'How many millilitres are there in {n} litres?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '12' }],
    answer: 'n * 1000',
    tags: ['AC9M5M01', 'MA3-3DS-02'],
  },

  // Mass and capacity, converted the way Stage 3 converts them: **through a
  // decimal**. The two templates above go from the big unit to the small one
  // and multiply by a whole number, which is the Stage 2 conversion Years 3 and
  // 4 already ship. What AC9M5M01 adds is a measurement that is not a whole
  // number of the larger unit - 3.7 kilograms, 4.2 litres - and the two
  // directions are genuinely different sums: one multiplies a decimal and one
  // produces one. NSW keeps mass and capacity in separate focus areas, so the
  // first cites MA3-NSM-01 and the other two MA3-3DS-02.
  //
  // **All three are sentences, and no figure is attempted.** Year 3 wrote down
  // why, and nothing has changed: nothing in the figure vocabulary draws a mass
  // or a volume, so a solid hung beside a sentence that already carries the
  // numbers would be a picture a child has to learn to ignore.
  {
    id: 'maths.5.measurement.kilograms-to-grams',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    prompt: 'A parcel weighs {kg} kilograms. How many grams is that?',
    // Never a whole number of kilograms, so the decimal is always the work.
    vars: [
      { name: 'n', kind: 'int', min: '11', max: '99' },
      { name: 'kg', kind: 'expr', expr: 'n / 10' },
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n * 100',
    hint: 'One kilogram is 1000 grams, so a tenth of a kilogram is 100.',
    tags: ['AC9M5M01', 'MA3-NSM-01'],
  },
  {
    id: 'maths.5.measurement.millilitres-to-litres',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    // The conversion above run the other way, which is where the decimal ends
    // up in the *answer* rather than in the question.
    prompt: 'A bottle holds {ml} millilitres. How many litres is that?',
    vars: [
      { name: 'n', kind: 'int', min: '11', max: '99' },
      { name: 'ml', kind: 'expr', expr: 'n * 100' },
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n / 10',
    hint: 'One litre is 1000 millilitres.',
    tags: ['AC9M5M01', 'MA3-3DS-02'],
  },
  {
    id: 'maths.5.measurement.fill-the-bottle',
    subject: 'maths',
    topic: 'measurement',
    level: '5',
    // Capacity as a problem rather than as a conversion: the two units have to
    // be brought together before anything can be subtracted, which is the
    // practical half of MA3-3DS-02.
    prompt: 'A {l} litre bottle has {ml} millilitres in it. How many more millilitres would fill it?',
    vars: [
      { name: 'l', kind: 'int', min: '2', max: '5' },
      { name: 'n', kind: 'int', min: '1', max: 'l * 10 - 1' },
      { name: 'ml', kind: 'expr', expr: 'n * 100' },
    ],
    answer: 'l * 1000 - ml',
    hint: 'The full bottle holds {l * 1000} millilitres.',
    tags: ['AC9M5M01', 'MA3-3DS-02'],
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
    tags: ['AC9M5M02', 'MA3-2DS-02'],
  },
  {
    id: 'maths.5.perimeter-and-area.missing-side',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '5',
    prompt:
      'A rectangle has an area of {area} square cm and is {w} cm wide. How long is it, in centimetres?',
    vars: [
      { name: 'w', kind: 'int', min: '3', max: '12' },
      { name: 'l', kind: 'int', min: '4', max: '20' },
      { name: 'area', kind: 'expr', expr: 'l * w' },
    ],
    answer: 'l',
    tags: ['AC9M5M02', 'MA3-2DS-02'],
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
    tags: ['AC9M5M03', 'MA3-NSM-02'],
  },

  // The dial, and **both syllabuses put the same thing on it at Year 5: the
  // 24-hour clock beside the 12-hour one.** Year 3 read a face to the five
  // minutes and Year 4 counted on from one; the template above converts an
  // hour with no picture at all. What is missing between them is the conversion
  // done off the face, which is the one a child actually meets - a wall clock
  // says 3:35 and a timetable says 15:35.
  //
  // **Both say "pm" in the prompt, because the face cannot.** A dial has no am
  // and no pm, so which of two 24-hour times it shows is not something the
  // picture says and not something a child can be marked wrong for. The
  // sentence supplies the half of the day and the picture supplies the rest.
  //
  // It says "pm" rather than "afternoon", which is what it said first and which
  // was false on nearly half of all draws: the hour runs to 11, so the answer
  // reaches 23:55, and five of the eleven hours are evening or night. "pm" is
  // the word that is true of every one of them, it is what `maths.4.time.am-or-pm`
  // has already taught a child by this year, and it is the shorter prompt -
  // which a figure question wants anyway.
  //
  // Both pin `numerals` and `minuteTicks` for Year 3's reason: an omitted field
  // is a coin toss, not a default, so half of these would otherwise draw a dial
  // with no numbers on it. The hand lengths still jitter, which is where they
  // vary - the hands *are* the answer, so nothing else can.
  {
    id: 'maths.5.time.clock-24-hour',
    subject: 'maths',
    topic: 'time',
    level: '5',
    prompt: 'This clock shows a pm time. What is it in 24-hour time?',
    // The hour runs to 11 rather than 12: noon is 12:00 in both systems, so a
    // 12 on the face is the one draw where the conversion is not one.
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '11' },
      { name: 'mi', kind: 'int', min: '1', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      // Any other hour, and any other five-minute mark - stepped round rather
      // than drawn and rejected, so no draw is thrown away.
      { name: 'dh', kind: 'int', min: '1', max: '10' },
      { name: 'hn', kind: 'expr', expr: 'mod(h - 1 + dh, 11) + 1' },
      { name: 'dm', kind: 'int', min: '1', max: '10' },
      { name: 'mn', kind: 'expr', expr: '(mod(mi - 1 + dm, 11) + 1) * 5' },
      // Five past is written 15:05, and only five needs the nought.
      { name: 'ms', kind: 'expr', expr: "m == 5 ? '05' : '' + m" },
      { name: 'mns', kind: 'expr', expr: "mn == 5 ? '05' : '' + mn" },
    ],
    // A time is written 15:35, which the number pad cannot type - so it is
    // tapped. The four options are the two hours crossed with the two minute
    // readings, Year 3's arrangement and for its reason: one hand read on its
    // own narrows four to two and never to one. Every option is a 24-hour time
    // in the afternoon range, so the notation itself never picks one out.
    answer: "(h + 12) + ':' + ms",
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ["(hn + 12) + ':' + ms", "(h + 12) + ':' + mns", "(hn + 12) + ':' + mns"],
    },
    hint: 'Read the clock first, then add 12 to the hour.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M5M03', 'MA3-NSM-02'],
  },
  {
    id: 'maths.5.time.clock-minutes-until',
    subject: 'maths',
    topic: 'time',
    level: '5',
    // The conversion used rather than performed: the time to beat is written in
    // 24-hour time and the clock is in 12-hour time, so the two have to be put
    // into the same system before a single minute can be counted. The gap runs
    // past the hour about half the time, which is the part a child cannot do by
    // subtracting the two minute readings.
    prompt: 'This clock shows a pm time. How many minutes until {th}:{tms}?',
    // **The gap is drawn first and the target built from it**, so all eleven
    // answers come up equally often - drawing two times and subtracting makes
    // the short gaps far the commonest, which teaches a child to answer "5".
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '10' },
      { name: 'mi', kind: 'int', min: '0', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      { name: 'g', kind: 'int', min: '1', max: '11' },
      // Everything below counts in five-minute marks round the face, so the
      // hour rolls over exactly when the count passes twelve of them.
      { name: 'tot', kind: 'expr', expr: 'mi + g' },
      { name: 'th', kind: 'expr', expr: 'tot >= 12 ? h + 13 : h + 12' },
      { name: 'tm', kind: 'expr', expr: 'mod(tot, 12) * 5' },
      { name: 'tms', kind: 'expr', expr: "tm == 0 ? '00' : tm == 5 ? '05' : '' + tm" },
    ],
    answer: 'g * 5',
    hint: 'Count on round the face in 5s from the long hand.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M5M03', 'MA3-NSM-02'],
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
    tags: ['AC9M5M04', 'MA3-GM-03'],
  },
  {
    id: 'maths.5.angles.name-from-degrees',
    subject: 'maths',
    topic: 'angles',
    level: '5',
    prompt: 'Is an angle of {d} degrees acute, obtuse or reflex?',
    // **The name is drawn first and the angle inside it**, because the three
    // names are not equally wide in degrees: acute and obtuse span 85 each and
    // reflex spans 175. Drawing the angle flat across the whole turn made
    // "reflex" right half the time, so tapping it beat guessing by 17 points
    // with the number unread. Choosing the band first makes the three buttons
    // equally often right, and it retires the two constraints with it - a band
    // that starts at 95 cannot produce 90.
    vars: [
      { name: 'band', kind: 'pick', from: [0, 1, 2] },
      { name: 'lo', kind: 'expr', expr: 'band == 0 ? 5 : band == 1 ? 95 : 185' },
      { name: 'hi', kind: 'expr', expr: 'band == 0 ? 85 : band == 1 ? 175 : 355' },
      { name: 'd', kind: 'int', min: 'lo', max: 'hi', step: 5 },
    ],
    answer: "d < 90 ? 'acute' : d < 180 ? 'obtuse' : 'reflex'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'acute'", "'obtuse'", "'reflex'"] },
    hint: 'Under 90 is acute, between 90 and 180 is obtuse, over 180 is reflex.',
    tags: ['AC9M5M04', 'MA3-GM-03'],
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
    tags: ['AC9M5M04', 'MA3-GM-03'],
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
    tags: ['AC9M5M04', 'MA3-GM-03'],
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
  //
  // **They are also the only two templates in this year with no NSW code, and
  // that is deliberate.** Stage 2 files symmetry and turning under
  // MA2-2DS-02, transformations - and Stage 3 has no successor to it in the
  // assembled code list. The nearest Stage 3 candidate is MA3-2DS-01, and it
  // does not reach the shapes these two draw: pentagons, hexagons, heptagons
  // and octagons, asked about rotational symmetry. So MA3-2DS-01 would be a
  // citation the curriculum page presents as checkable and which does not check
  // out. A missing citation costs nothing here: the ACARA pair above says
  // exactly what is practised.
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

  // Solids, read off **the object rather than off the net**. Years 3 and 4 both
  // counted a net: Year 3 its faces, Year 4 the edges and corners the folding
  // makes out of them. Every piece of a net is laid out in front of the child,
  // which is most of what a net is for. An oblique drawing of the solid is the
  // other way round - three edges and one corner are round the back and drawn
  // dashed, and the count only comes out right if they are counted too. That is
  // the same two counts asked at the end of the stage rather than the start of
  // it, and it is what MA3-3DS-01 means by a two-dimensional representation of
  // a three-dimensional object.
  //
  // **The ACARA citation is the same judgement Year 4 recorded.** AC9M5SP01 is
  // about connecting objects to their nets, and Year 5's other two Space
  // descriptions are the coordinate system and transformations - so it is the
  // only Year 5 description that speaks about three-dimensional objects at all,
  // and a drawing of a solid is what a child connects a net *to*. NSW is
  // unambiguous either way: MA3-3DS-01 is one outcome covering prisms,
  // pyramids, nets and 2D representations across Years 5 and 6.
  //
  // The first two draw the same three solids, and the two questions do not
  // carry over: a cube has twelve edges and eight corners, a pyramid eight and
  // five, a prism nine and six. `view` is pinned on all three, because each
  // prompt is a sentence about a solid and an unpinned view would draw a net
  // about half the time.
  {
    id: 'maths.5.shapes.object-edges',
    subject: 'maths',
    topic: 'shapes',
    level: '5',
    prompt: 'How many edges does this shape have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'square-pyramid', 'triangular-prism'] },
    ],
    answer: "shape == 'cube' ? 12 : shape == 'square-pyramid' ? 8 : 9",
    hint: 'Count the edges you can see, then the dashed ones round the back.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M5SP01', 'MA3-3DS-01'],
  },
  {
    id: 'maths.5.shapes.object-corners',
    subject: 'maths',
    topic: 'shapes',
    level: '5',
    prompt: 'How many corners does this shape have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'square-pyramid', 'triangular-prism'] },
    ],
    answer: "shape == 'cube' ? 8 : shape == 'square-pyramid' ? 5 : 6",
    hint: 'One corner is hidden behind the shape. Count that one too.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M5SP01', 'MA3-3DS-01'],
  },
  {
    id: 'maths.5.shapes.square-face',
    subject: 'maths',
    topic: 'shapes',
    level: '5',
    // **The cuboid is what makes this a Year 5 question.** It has been drawn
    // before - Year 3 counts the faces of one - but no question has ever turned
    // on what shape those faces are. Year 3 asked whether a solid had a
    // triangular face, which is answered by looking; a rectangle that is *not*
    // a square is the harder telling-apart, and it is the one Stage 3
    // classifying is about.
    //
    // **The pick is these two solids and no others, because they are the only
    // pair the drawing can be trusted about.** `solid-kind.ts` says outright
    // that the *lengths* of a solid's edges are deliberately not askable - an
    // oblique projection foreshortens depth by a convention rather than by
    // measurement - and a question about square faces is a question about
    // lengths. The one exception it guarantees is exactly this pair:
    // `MIN_CUBOID_RATIO` holds a cuboid's edges **visibly** unequal at 1.39 or
    // worse, and a cube's are always equal, so the cube's front face measures a
    // side ratio of 1.00 and the cuboid's squarest face 1.39 to 3.33.
    //
    // A square pyramid was in this list and had to come out. Its base really is
    // a square, so the answer said true - and the base is drawn as a
    // parallelogram whose sides measure 1.82 to 3.23 apart, median 2.29, which
    // is *less* square-looking than the cuboid's rectangles. The hint below
    // instructs precisely the reading that then marks it wrong. Any solid whose
    // square face is not the face you are looking straight at is the same trap.
    //
    // **True exactly half the time, by construction**: one of the two solids
    // has a square face, the pick is flat, and nothing is rejected. The
    // sentence is the same words every draw, so there is no claim in it to
    // leak - the picture is the only place the answer lives.
    prompt: 'True or false: this shape has a face shaped like a square.',
    vars: [{ name: 'shape', kind: 'pick', from: ['cube', 'cuboid'] }],
    answer: "shape == 'cube'",
    hint: 'A rectangle is only a square when all four of its sides are the same length.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M5SP01', 'MA3-3DS-01'],
  },

  // Where something is, and **Year 5 is where the grid map becomes the
  // coordinate plane**. Years 2, 3 and 4 all mark a *cell* - the dot is in B3 -
  // because NSW files grid maps at Stage 2 and ACARA does not build a
  // coordinate system until this year. `onLines: 'true'` marks an
  // intersection instead, answered (2,3), which is exactly MA3-GM-01 and
  // AC9M5SP02. It is the second of the two Space holes this year had: before
  // this file's picture questions, the only Space description Year 5 cited at
  // all was AC9M5SP03, on the two symmetry templates above.
  //
  // Both are first quadrant, which is not a simplification: MA3-GM-01 is the
  // first quadrant only, NSW places negative coordinates at Stage 4, and the
  // number pad has no minus key to answer one with.
  //
  // **On a plane there is only one lever, so the extent is what has to move.**
  // `axisLabels` does not jitter here at all - a lettered axis has no number to
  // give a coordinate - and this kind has no cell-aspect wobble either, so a
  // figure is decided entirely by where the dot is and how big the grid is.
  // Pinned to a literal the extent would draw one byte-identical picture per
  // answer and be refused; left open the builder could choose a grid too small
  // to hold an option nobody could then pick. So it is pinned to a variable
  // drawn from a band, and **every point an option names exists on the smallest
  // grid in that band**.
  //
  // **The band is 3 to 5 columns by 3 to 4 rows, which is not square and is
  // measured rather than assumed.** A labelled plane is refused at 3x5, 4x5 and
  // 5x5 and accepted at 5x3 and 5x4, so the ceiling is a wider grid than it is
  // a taller one - six extents in all, where a square reading of the limit
  // would have found four.
  {
    id: 'maths.5.position.coordinates',
    subject: 'maths',
    topic: 'position',
    level: '5',
    prompt: 'What are the coordinates of the dot?',
    // **Six points the dot can be on, and four buttons.** How wide the answer
    // set may be is a question about the *anchoring check* rather than about
    // the maths, and it is worth writing the arithmetic down. This kind has one
    // lever on a plane - the extent, six of them here - because `axisLabels`
    // cannot jitter where the answer is a pair of numbers and there is no
    // cell-aspect wobble. The check makes **fifty draws in total, not fifty per
    // answer**, so a wide answer set leaves some answers with two or three
    // draws, and those can land on one extent together; two identical pictures
    // is all the evidence the check has, so it refuses. Measured across 300
    // distinct template ids: four answers 0 refusals, six answers about 1 in
    // 60, nine answers about 1 in 10.
    //
    // Nine points was tried first and was refused - and drawing that version
    // 3000 times shows every one of its nine answers does reach all six
    // extents, so nothing was anchored in fact; the seeds simply did not show
    // it. Six is where the answer set is worth having and the check is still
    // near-certain to be satisfied, and because the check is **deterministic
    // per template id**, a refusal is a thing the author meets once at
    // authoring time rather than a risk a child ever sees.
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '2' },
      { name: 'y', kind: 'int', min: '1', max: '3' },
      { name: 'cols', kind: 'int', min: '3', max: '5' },
      { name: 'rws', kind: 'int', min: '3', max: '4' },
      // The other column, and any other row - stepped round rather than drawn
      // and rejected, so no draw is thrown away.
      { name: 'xn', kind: 'expr', expr: '3 - x' },
      { name: 'dy', kind: 'int', min: '1', max: '2' },
      { name: 'yn', kind: 'expr', expr: 'mod(y - 1 + dy, 3) + 1' },
    ],
    // A coordinate pair is written (2,1), which the number pad cannot type - so
    // it is tapped. The four options are the two columns crossed with the two
    // rows, which is what keeps the option set from answering the question:
    // both columns are on the buttons every draw and the answer's own column is
    // either of them equally often, and the same holds of the two rows. Reading
    // the pair backwards is the mistake this is for, and (1,2) sits beside
    // (2,1) whenever both are in play.
    answer: "'(' + x + ',' + y + ')'",
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        "'(' + xn + ',' + y + ')'",
        "'(' + x + ',' + yn + ')'",
        "'(' + xn + ',' + yn + ')'",
      ],
    },
    hint: 'The first number is how far along the bottom, the second is how far up.',
    figure: { kind: 'grid', at: "x + ',' + y", columns: 'cols', rows: 'rws', onLines: 'true' },
    tags: ['AC9M5SP02', 'MA3-GM-01'],
  },
  {
    id: 'maths.5.position.coordinate-step',
    subject: 'maths',
    topic: 'position',
    level: '5',
    prompt: 'Which point is one to the {ew} and one {ns} from the dot?',
    // **The four buttons offer the same four points on every draw, and the dot
    // is what moves.** This is `maths.4.position.grid-diagonal`'s shape, and it
    // is copied deliberately rather than reinvented: Year 4 shipped the obvious
    // version of this question - the four options being the block the dot sits
    // in a corner of - and it measured 4000 of 4000 correct with the picture
    // ignored, because every option label carries an order and the prompt names
    // both directions. Neither enforced check can see that: the rank check
    // wants every option to be a number and "(2,3)" is not one, and the
    // option-set check stands down above eight distinct answers.
    //
    // So the block is fixed at (2,2), (2,3), (3,2) and (3,3), and the **dot**
    // is one diagonal step back from the answer, which puts it in any of
    // sixteen places. Given the four buttons and both direction words all four
    // points are still possible, because which of them is one step from the dot
    // is a fact about the picture and about nothing else.
    vars: [
      { name: 'ax', kind: 'int', min: '2', max: '3' },
      { name: 'ay', kind: 'int', min: '2', max: '3' },
      { name: 'across', kind: 'pick', from: [1, -1] },
      { name: 'up', kind: 'pick', from: [1, -1] },
      { name: 'x', kind: 'expr', expr: 'ax - across' },
      { name: 'y', kind: 'expr', expr: 'ay - up' },
      { name: 'ew', kind: 'expr', expr: "across == 1 ? 'right' : 'left'" },
      { name: 'ns', kind: 'expr', expr: "up == 1 ? 'up' : 'down'" },
      // Big enough for the dot, which lands outside the block on two of its
      // four sides. Every option sits inside three by three, so no distractor
      // can be ruled out for being off the grid however small the drawn one is.
      { name: 'cols', kind: 'int', min: 'max(3, x)', max: '5' },
      { name: 'rws', kind: 'int', min: 'max(3, y)', max: '4' },
    ],
    answer: "'(' + ax + ',' + ay + ')'",
    answerType: 'choice',
    choices: { count: 4, distractors: ["'(2,2)'", "'(2,3)'", "'(3,2)'", "'(3,3)'"] },
    hint: 'Find the point the dot is on, then move one line across and one line up or down.',
    figure: { kind: 'grid', at: "x + ',' + y", columns: 'cols', rows: 'rws', onLines: 'true' },
    tags: ['AC9M5SP02', 'MA3-GM-01'],
  },

  // Graphs, and **Stage 3 is where the many-to-one scale stops needing an
  // argument.** Years K to 4 were held to a key of one or to an ACARA-only
  // citation, because NSW places many-to-one scales at Stage 3 and the
  // curriculum page presents a citation as checkable. This is Stage 3, so the
  // two picture graphs below carry MA3-DATA-01 like any other citation, with no
  // carve-out to argue for it. The prompt still says what one picture stands
  // for, which is a rule at every year: the graph's own key draws an icon and a
  // number and cannot say two *what*.
  //
  // The other two are **line graphs**, which nothing in the catalog has drawn.
  // Every graph before this one is a column or a dot, and both answer "how many
  // for this category?"; a line joins the readings up and makes the shape
  // between them the thing to read, which is what AC9M5ST02 and MA3-DATA-02
  // mean by change over time. So the four days are the point of them, not
  // decoration, and the second asks about the change rather than the reading.
  //
  // A graph carries no title, so **the prompt is the only place the quantity
  // can be named** - which is why the line graphs say "visitors" and the
  // picture graphs say "books" and "goals". It is one word rather than a
  // sentence of scene-setting: the figure claims the vertical room first, and
  // "How many visitors came on Tue?" says as much as "This graph shows the
  // visitors each day" in front of it did.
  //
  // Every name here is three characters, and the two kinds want that for
  // different reasons: a picture graph's row label is what caps how many icons
  // fit beside it, and a column or line graph's category label is squeezed by
  // the width of the widest rung the axis might print. Both budgets were
  // settled by building the figure and reading its issues rather than by
  // counting characters against a table.
  {
    id: 'maths.5.data.picture-key-difference',
    subject: 'maths',
    topic: 'data',
    level: '5',
    prompt: 'Each picture stands for {k} books. How many more books did {a} read than {b}?',
    // Four icons is the most a three-character row label leaves room for, so
    // the counts are one to four icons' worth and the key is what makes them
    // big. **The difference is picked first and the two rows built from it**,
    // so each of the three gaps comes up equally often; drawing two counts and
    // subtracting makes the small gaps far the commonest, which teaches a child
    // to answer "one icon's worth" rather than to read the graph.
    vars: [
      { name: 'k', kind: 'pick', from: [2, 5, 10] },
      { name: 'diff', kind: 'pick', from: [1, 2, 3] },
      { name: 'ib', kind: 'int', min: '1', max: '4 - diff' },
      { name: 'ia', kind: 'expr', expr: 'ib + diff' },
      { name: 'ic', kind: 'int', min: '1', max: '4' },
      // Which two rows are compared moves as well as the counts in them, and
      // the third row, which is never named, takes whatever is left over.
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'skip', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + skip, 3)' },
      { name: 'ada', kind: 'expr', expr: 'i == 0 ? ia : j == 0 ? ib : ic' },
      { name: 'kai', kind: 'expr', expr: 'i == 1 ? ia : j == 1 ? ib : ic' },
      { name: 'leo', kind: 'expr', expr: 'i == 2 ? ia : j == 2 ? ib : ic' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
      { name: 'b', kind: 'expr', expr: "j == 0 ? 'Ada' : j == 1 ? 'Kai' : 'Leo'" },
    ],
    answer: 'diff * k',
    hint: 'Count the pictures in both rows, then count on in {k}s.',
    // `halves` is left off, so every count is a whole number of icons by
    // construction and no row is drawn as a rounded-off neighbour of another.
    figure: {
      kind: 'pictograph',
      counts: "(ada * k) + ',' + (kai * k) + ',' + (leo * k)",
      labels: "'Ada,Kai,Leo'",
      key: 'k',
    },
    tags: ['AC9M5ST01', 'MA3-DATA-01'],
  },
  {
    id: 'maths.5.data.picture-key-halves',
    subject: 'maths',
    topic: 'data',
    level: '5',
    // **Half an icon**, which is the convention that makes a many-to-one scale
    // usable and which no graph in the catalog has drawn. A key of ten can
    // otherwise only say multiples of ten, and a class that read twenty-five
    // books simply cannot be graphed; with halves it is two pictures and a half
    // and the reading is 10, 20, then 5.
    prompt: 'Each picture stands for 10 goals. How many goals did {who} score?',
    // Counts in half-icons, so every row is a whole or a half of one and the
    // key can say all of them exactly. One to eight halves is four icons at
    // most, which is what a three-character row label leaves room for.
    vars: [
      { name: 'ha', kind: 'int', min: '1', max: '8' },
      { name: 'hb', kind: 'int', min: '1', max: '8' },
      { name: 'hc', kind: 'int', min: '1', max: '8' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
      { name: 'halfIcons', kind: 'expr', expr: 'i == 0 ? ha : i == 1 ? hb : hc' },
    ],
    answer: 'halfIcons * 5',
    hint: 'A whole picture is 10 goals and half a picture is 5.',
    figure: {
      kind: 'pictograph',
      counts: "(ha * 5) + ',' + (hb * 5) + ',' + (hc * 5)",
      labels: "'Ada,Kai,Leo'",
      key: '10',
      halves: 'true',
    },
    tags: ['AC9M5ST01', 'MA3-DATA-01'],
  },
  {
    id: 'maths.5.data.line-graph-read',
    subject: 'maths',
    topic: 'data',
    level: '5',
    prompt: 'How many visitors came on {day}?',
    // Every value is a multiple of ten and the scale is pinned to ten, so the
    // numbers up the side read 0, 10, 20, 30, 40, 50 and every point on the
    // line sits on one of them. **One day is at least twenty by construction**:
    // an axis of a single step is refused outright, and `figureIssues` samples
    // fifty seeds, so a template that merely made 10,10,10,10 unlikely would
    // validate by luck and ship.
    vars: [
      { name: 'v0', kind: 'int', min: '1', max: '5' },
      { name: 'v1', kind: 'int', min: '2', max: '5' },
      { name: 'v2', kind: 'int', min: '1', max: '5' },
      { name: 'v3', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      {
        name: 'day',
        kind: 'expr',
        expr: "i == 0 ? 'Mon' : i == 1 ? 'Tue' : i == 2 ? 'Wed' : 'Thu'",
      },
    ],
    answer: '(i == 0 ? v0 : i == 1 ? v1 : i == 2 ? v2 : v3) * 10',
    // "The line" is only true because the style is pinned: left open the kind
    // draws a column or a dot instead.
    hint: 'The numbers up the side go up in 10s. Find the day along the bottom and follow the line up.',
    figure: {
      kind: 'bar',
      values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
      labels: "'Mon,Tue,Wed,Thu'",
      scale: '10',
      style: "'line'",
    },
    tags: ['AC9M5ST02', 'MA3-DATA-02'],
  },
  {
    id: 'maths.5.data.line-graph-rise',
    subject: 'maths',
    topic: 'data',
    level: '5',
    // The two days are always **next to each other**, which is what makes this
    // a question about the line rather than about two readings that happen to
    // be on one: the segment between them is the answer drawn as a slope, and
    // reading that is the whole of what a line graph is for.
    prompt: 'How many more visitors came on {b} than on {a}?',
    // The rise is drawn first and the two days built from it, so each of the
    // four answers comes up equally often - and it is at least one step, so the
    // taller of the two is never below twenty and the axis is never a single
    // step.
    vars: [
      { name: 'diff', kind: 'int', min: '1', max: '4' },
      { name: 'lo', kind: 'int', min: '1', max: '5 - diff' },
      { name: 'hi', kind: 'expr', expr: 'lo + diff' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'p', kind: 'int', min: '1', max: '5' },
      { name: 'q', kind: 'int', min: '1', max: '5' },
      { name: 'v0', kind: 'expr', expr: 'i == 0 ? lo : p' },
      { name: 'v1', kind: 'expr', expr: 'i == 0 ? hi : i == 1 ? lo : q' },
      { name: 'v2', kind: 'expr', expr: 'i == 1 ? hi : i == 2 ? lo : p' },
      { name: 'v3', kind: 'expr', expr: 'i == 2 ? hi : q' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Mon' : i == 1 ? 'Tue' : 'Wed'" },
      { name: 'b', kind: 'expr', expr: "i == 0 ? 'Tue' : i == 1 ? 'Wed' : 'Thu'" },
    ],
    answer: 'diff * 10',
    hint: 'The numbers up the side go up in 10s. Read both days, then subtract.',
    figure: {
      kind: 'bar',
      values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
      labels: "'Mon,Tue,Wed,Thu'",
      scale: '10',
      style: "'line'",
    },
    tags: ['AC9M5ST02', 'MA3-DATA-02'],
  },

  // Chance, and **Stage 3 is where a likelihood stops being a word and becomes
  // a number.** Years 1 to 3 compare two outcomes; Year 4 names one on the
  // continuum from unlikely to certain. MA3-CHAN-01 and AC9M5P01 ask for the
  // probability itself, as a fraction and as a percentage, which is what the
  // first two below do off the same picture.
  //
  // Every spinner emits **no `label` marks at all**, so it carries no text
  // whatsoever: the fill names are grouping keys that never reach the screen,
  // and the prompts say "shaded", never a colour. The first-named group is the
  // shaded one.
  {
    id: 'maths.5.chance.spinner-fraction',
    subject: 'maths',
    topic: 'chance',
    level: '5',
    prompt: 'What is the chance the arrow stops on a shaded part?',
    // Four spinners and four buttons: a half, a third, a quarter and three
    // quarters. Every one of them is already in its simplest form as it is
    // drawn - two parts with one shaded, three with one, four with one, four
    // with three - so counting the parts gives the fraction directly and there
    // is no second step hidden in the picture.
    vars: [
      { name: 'which', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'n', kind: 'expr', expr: 'which == 0 ? 2 : which == 1 ? 3 : 4' },
      { name: 's', kind: 'expr', expr: 'which == 3 ? 3 : 1' },
      {
        name: 'parts',
        kind: 'expr',
        expr: "n == 2 ? '1,1' : n == 3 ? '1,1,1' : '1,1,1,1'",
      },
      {
        name: 'shading',
        kind: 'expr',
        expr:
          "which == 0 ? 'a,b' : which == 1 ? 'a,b,b' : which == 2 ? 'a,b,b,b' : 'a,a,a,b'",
      },
    ],
    // A fraction cannot be typed on a number pad, so it is tapped - and the
    // same four buttons are offered every draw, so the option set never says
    // which one it is.
    answer: "s + '/' + n",
    answerType: 'choice',
    choices: { count: 4, distractors: ["'1/2'", "'1/3'", "'1/4'", "'3/4'"] },
    hint: 'Count the shaded parts, then all the parts.',
    figure: { kind: 'spinner', sectors: 'parts', fills: 'shading' },
    tags: ['AC9M5P01', 'MA3-CHAN-01'],
  },
  {
    id: 'maths.5.chance.spinner-percentage',
    subject: 'maths',
    topic: 'chance',
    level: '5',
    // The same likelihood written the other way Stage 3 writes it, and the one
    // the number pad can type - so this is the only chance question in the year
    // that is not tapped. Four parts or five, which is what makes the
    // percentages whole: quarters give 25, 50 and 75 and fifths give 20, 40, 60
    // and 80.
    prompt: 'What is the chance of stopping on a shaded part, as a percentage?',
    vars: [
      { name: 'n', kind: 'pick', from: [4, 5] },
      { name: 's', kind: 'int', min: '1', max: 'n - 1' },
      { name: 'parts', kind: 'expr', expr: "n == 4 ? '1,1,1,1' : '1,1,1,1,1'" },
      {
        name: 'shading',
        kind: 'expr',
        expr:
          "n == 4 ? (s == 1 ? 'a,b,b,b' : s == 2 ? 'a,a,b,b' : 'a,a,a,b') : " +
          "(s == 1 ? 'a,b,b,b,b' : s == 2 ? 'a,a,b,b,b' : s == 3 ? 'a,a,a,b,b' : 'a,a,a,a,b')",
      },
    ],
    answer: 's * 100 / n',
    hint: 'The whole spinner is 100%. How much of it is shaded?',
    figure: { kind: 'spinner', sectors: 'parts', fills: 'shading' },
    tags: ['AC9M5P01', 'MA3-CHAN-01'],
  },
  {
    id: 'maths.5.chance.spinner-equally-likely',
    subject: 'maths',
    topic: 'chance',
    level: '5',
    // **Equally likely outcomes told apart from ones that are not**, which is
    // the half of AC9M5P01 the two templates above depend on and never ask:
    // both of them count parts, and counting parts is only a method when the
    // parts are the same size. Year 3's uneven spinner asks which *side* the
    // arrow is likelier to stop on and Year 4's asks whether the two sides are
    // even; this asks whether the parts themselves are.
    //
    // **True exactly half the time, by construction.** `even` is a free pick
    // and the sectors are derived from it, so nothing is rejected and nothing
    // skews. The number of sectors is the same either way - one of them is
    // simply worth double - so counting them is right exactly as often as
    // guessing, and only the sizes help.
    //
    // Every sector is shaded, so the shading is the same on every draw and
    // carries no information at all. The lines between the sectors are drawn
    // regardless, which is what leaves the parts to be seen.
    prompt: 'True or false: the arrow is equally likely to stop on any part.',
    vars: [
      { name: 'even', kind: 'pick', from: [1, 0] },
      { name: 'n', kind: 'pick', from: [4, 5, 6] },
      {
        name: 'parts',
        kind: 'expr',
        expr:
          "even == 1 ? (n == 4 ? '1,1,1,1' : n == 5 ? '1,1,1,1,1' : '1,1,1,1,1,1') : " +
          "(n == 4 ? '2,1,1,1' : n == 5 ? '2,1,1,1,1' : '2,1,1,1,1,1')",
      },
      {
        name: 'shading',
        kind: 'expr',
        expr: "n == 4 ? 'a,a,a,a' : n == 5 ? 'a,a,a,a,a' : 'a,a,a,a,a,a'",
      },
    ],
    answer: 'even == 1',
    hint: 'Equally likely means every part is the same size.',
    figure: { kind: 'spinner', sectors: 'parts', fills: 'shading' },
    tags: ['AC9M5P01', 'MA3-CHAN-01'],
  },
  {
    id: 'maths.5.chance.most-likely-from-trials',
    subject: 'maths',
    topic: 'chance',
    level: '5',
    // **The probability estimated from what happened, not read off what is in
    // the bag.** Year 3's `most-likely-of-three` counts the counters and says
    // which colour is likeliest; nobody has spun anything. AC9M5P02 is about
    // conducting repeated trials and using the results to estimate a
    // probability, which is the same sentence with the evidence changed - and
    // the change is the whole point, because a run of spins is evidence rather
    // than a fact and a child has to be willing to reason from it.
    //
    // No figure. What is described is a run of results rather than a thing to
    // look at, and with nothing drawn, naming the colours in words is honest -
    // the rule about a prompt naming only what the figure draws binds a
    // template that *has* one.
    prompt:
      'A spinner stopped on red {r} times, blue {b} and green {g}. Which colour is it most likely to stop on?',
    // All three different, so the question has one answer, and the rejection is
    // symmetric in the three colours, so each of them wins equally often.
    vars: [
      { name: 'r', kind: 'int', min: '5', max: '40' },
      { name: 'b', kind: 'int', min: '5', max: '40' },
      { name: 'g', kind: 'int', min: '5', max: '40' },
    ],
    constraints: ['r != b', 'b != g', 'r != g'],
    answer: "r > b && r > g ? 'red' : b > g ? 'blue' : 'green'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'red'", "'blue'", "'green'"] },
    hint: 'The colour it stopped on most often is the one to expect next time.',
    tags: ['AC9M5P02', 'MA3-CHAN-01'],
  },
];
