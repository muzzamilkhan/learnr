import type { QuestionTemplate } from '../../lib/templates/types';
import { equalSectors, shadedFills } from './helpers';

/**
 * How many equal parts each of the two probability spinners may be cut into.
 * Named once and handed to the `pick` and to both helpers, because a count the
 * helpers were not told about falls through their unguarded else and draws the
 * last count's spinner silently, on every seed.
 */
const DECIMAL_PARTS = [5, 10] as const;
const PERCENT_PARTS = [4, 5] as const;

/**
 * And the compound-event spinner's, which is a run rather than a pair - the
 * count is drawn as an `int` there, so the list has to name every value in the
 * range.
 */
const COMPOUND_PARTS = [3, 4, 5, 6] as const;

/** Year 6 - NSW Stage 3. */
export const year6: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 6
  //
  // Integers, prime, composite and square numbers, adding and subtracting
  // decimals and fractions, percentages of quantities and discounts, order of
  // operations with brackets, metric conversions using decimals, the area of a
  // rectangle, angles on a line and at a point, and the Cartesian plane - and
  // then the picture questions: a length read to the centimetre off a number
  // line, a clock face counted forward to an arrival and back to a departure,
  // a dot moved along a coordinate plane and traced back to where it came
  // from, solids classified rather than counted, graphs read for a range, a
  // mode and the steepest part of a line, and spinners answered as a decimal,
  // as a complement and as one half of a compound event.
  //
  // The integer questions are multiple choice: the number pad has no minus key.
  //
  // **Year 6 is Stage 3's second year, so every NSW code here is an `MA3-` one
  // Year 5 also cites.** NSW writes one outcome per focus area for the pair of
  // years; what separates the two is the ACARA description and the difficulty,
  // not the outcome.
  //
  // **The three integer templates are the one deliberate gap, and they are the
  // whole branch's only asymmetry pointing this way.** NSW places integers at
  // Stage 4 - Year 7 - where ACARA places them at Year 6, so they keep
  // AC9M6N01 and take no NSW code at all, and the curriculum page renders the
  // disagreement rather than hiding it. `catalog.test.ts` names them, and also
  // closes the list from the other end: the complete set of templates carrying
  // no NSW citation is asserted there, so one joining it by accident is a test
  // failure rather than a quiet omission.
  //
  // Each new template is filed with the topic it practises rather than in a
  // block at the end; the three topics Year 6 did not have - shapes, data and
  // chance - are new sections after the ones that were here.
  // ------------------------------------------------------------------
  {
    id: 'maths.6.integers.temperature',
    subject: 'maths',
    topic: 'integers',
    level: '6',
    prompt: 'The temperature is {a}°C. Overnight it falls {d}°C. What is the new temperature, in °C?',
    // **The run is drawn first and the question derived from it**, which is what
    // an evenly spaced set needs to be honest. Building the run around an
    // answer drawn independently leaves the members near the ends of the
    // answer's range unreachable - the set says "the answer cannot be the
    // bottom one, that would be colder than this question goes" - and that
    // narrowing was worth 11 points on its own. Drawing `lo` where all four
    // members are legal answers, then `k` for which one it is, makes the four
    // exactly equally likely. `d` follows from the answer rather than the
    // other way about.
    vars: [
      { name: 'u', kind: 'pick', from: [1, 2] },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'lo', kind: 'int', min: '-20', max: '-2 - 3 * u' },
      { name: 'a', kind: 'int', min: '1', max: '8' },
      { name: 'd', kind: 'expr', expr: 'a - (lo + k * u)' },
    ],
    answer: 'a - d',
    answerType: 'choice',
    // **An evenly spaced run with the answer at a drawn position**, for the
    // reason `maths.4.decimals.tenths` sets out. The sign errors that used to be
    // the other two buttons are what made this readable: `b - a` is the answer's
    // exact mirror, so "the negative whose size matches the positive option"
    // named the answer outright, every draw, with the question unread. A
    // misconception offered as a distractor has to be one the option set cannot
    // give away, and an exact mirror never is. What is left is the slip this
    // question is actually about - landing a step out counting past zero - at
    // one of two step sizes.
    choices: { count: 4, distractors: ['lo', 'lo + u', 'lo + 2 * u', 'lo + 3 * u'] },
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
      { name: 'u', kind: 'pick', from: [1, 2] },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'lo', kind: 'expr', expr: 'a - b - k * u' },
    ],
    answer: 'a - b',
    answerType: 'choice',
    // An evenly spaced run with the answer at a drawn position; `temperature`
    // above is the same fix and carries the reasoning.
    choices: { count: 4, distractors: ['lo', 'lo + u', 'lo + 2 * u', 'lo + 3 * u'] },
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
    tags: ['AC9M6N02', 'MA3-RN-01'],
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
    tags: ['AC9M6N02', 'MA3-RN-01'],
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
    tags: ['AC9M6N02', 'MA3-RN-01'],
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
      // The size of the slip the wrong buttons are, and where in the run of four
      // the answer sits.
      { name: 'u', kind: 'pick', from: [1, 10, 100] },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'lo', kind: 'expr', expr: 'na + nb - k * u' },
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na + nb) / 100',
    answerType: 'choice',
    // **The options are an evenly spaced run with the answer at a drawn
    // position**, for the reason `maths.4.decimals.tenths` sets out: distractors
    // built as fixed offsets from the answer make the option set a signature of
    // it, and the answer was the one with a hundredth below it and a tenth
    // above. Moving its rank left that intact. A run has no such signature -
    // every option sits the same step from its neighbours - and `u` is what
    // keeps the misconceptions: the step is a hundredth, a tenth or a whole
    // number, so a slip of each size is still what the wrong buttons are.
    choices: {
      count: 4,
      distractors: ['lo / 100', '(lo + u) / 100', '(lo + 2 * u) / 100', '(lo + 3 * u) / 100'],
    },
    tags: ['AC9M6N04', 'MA3-AR-01'],
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
      // Three multipliers rather than two, for the reason
      // `divide-by-powers-of-ten` below gives: the answer has to be able to sit
      // at more than one place in the run, or the run names it.
      { name: 'p', kind: 'pick', from: [10, 100, 1000] },
    ],
    constraints: ['mod(n, 10) != 0'],
    // **Typed, because no set of powers of ten can avoid naming its answer.**
    // The errors worth offering here are all the same digits at another place
    // value, so any option set is the answer multiplied by powers of ten - and
    // a set built as a fixed function of the answer is a signature of it,
    // whatever rank the answer is moved to. Measured, the option set alone
    // answered these without the prompt. Widening the run only widens the
    // signature. See `maths.4.decimals.tenths` for the same finding a year
    // earlier and the pad's decimal point, which is what makes typing this
    // possible at all.
    answer: 'n * p / 100',
    hint: 'Every digit moves left one place for each zero.',
    tags: ['AC9M6N06', 'MA3-MR-01'],
  },
  {
    id: 'maths.6.decimals.divide-by-powers-of-ten',
    subject: 'maths',
    topic: 'decimals',
    level: '6',
    // **The answer is drawn and the dividend follows from it**, rather than the
    // other way round. Dividing a drawn number by a drawn power of ten runs
    // past two decimal places as soon as the divisor is a hundred, and a typed
    // answer is capped at two - `catalog.test.ts`, because the display has to
    // read back. Fixing the divisor at ten instead would answer the cap and
    // give up two thirds of what AC9M6N06 asks for. So `n` is the answer's own
    // hundredths and the prompt is built backwards from it: the same three
    // digits divided by ten, a hundred or a thousand, always landing two places
    // after the point.
    prompt: 'What is {a} ÷ {p}?',
    vars: [
      { name: 'n', kind: 'int', min: '11', max: '999' },
      { name: 'p', kind: 'pick', from: [10, 100, 1000] },
      { name: 'a', kind: 'expr', expr: 'n * p / 100' },
    ],
    // No trailing nought, so the answer really does use both decimal places.
    constraints: ['mod(n, 10) != 0'],
    // **Typed, because no set of powers of ten can avoid naming its answer.**
    // The errors worth offering here are all the same digits at another place
    // value, so any option set is the answer multiplied by powers of ten - and
    // a set built as a fixed function of the answer is a signature of it,
    // whatever rank the answer is moved to. Measured, the option set alone
    // answered these without the prompt. Widening the run only widens the
    // signature. See `maths.4.decimals.tenths` for the same finding a year
    // earlier and the pad's decimal point, which is what makes typing this
    // possible at all.
    answer: 'n / 100',
    hint: 'Every digit moves one place to the right.',
    tags: ['AC9M6N06', 'MA3-MR-01'],
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
    tags: ['AC9M6N05', 'MA3-RQF-01'],
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
    tags: ['AC9M6N05', 'MA3-RQF-01'],
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
    tags: ['AC9M6N03', 'MA3-RQF-01'],
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
    tags: ['AC9M6N07', 'MA3-RN-03'],
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
    tags: ['AC9M6N07', 'MA3-RN-03'],
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
    tags: ['AC9M6N07', 'MA3-RN-03'],
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
    tags: ['AC9M6A02', 'MA3-MR-02'],
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
    tags: ['AC9M6A02', 'MA3-MR-02'],
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
    tags: ['AC9M6A02', 'MA3-MR-02'],
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
    // NSW has no patterns-and-algebra focus area at Stage 3, so the code is the
    // one naming the arithmetic the child actually does. This rule is a
    // multiplication followed by an addition and the multiplication is what
    // makes it a two-step rule, so it goes to MA3-MR-01; the growing pattern
    // below is entirely addition and goes to MA3-AR-01. Year 5's
    // `number-patterns.multiply-rule` made the same call the same way.
    tags: ['AC9M6A01', 'MA3-MR-01'],
  },
  {
    id: 'maths.6.number-patterns.growing-pattern',
    subject: 'maths',
    topic: 'number patterns',
    level: '6',
    prompt:
      'A pattern starts at {a} and adds {d}, then {2 * d}, then {3 * d}. What is the 4th number?',
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '20' },
      { name: 'd', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'a + d + 2 * d + 3 * d',
    tags: ['AC9M6A01', 'MA3-AR-01'],
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
    ],
    constraints: ['mod(n * 5, 100) != 0'],
    // Typed, and `grams-to-kilograms` below is the same question and the same
    // reasoning; read it there.
    answer: 'n * 5 / 100',
    hint: 'There are 100 centimetres in a metre.',
    tags: ['AC9M6M01', 'MA3-GM-02'],
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
    ],
    constraints: ['mod(n * 5, 100) != 0'],
    // Typed, for the reason the two `decimals` templates above give in full: a
    // conversion's wrong answers are the same digits at another place value, so
    // every option set is powers of ten of the answer and names it. This one
    // named it hardest - 96% off the option set alone against a 25% blind
    // guess - because a weight in kilograms sits in a narrow band while its
    // powers of ten do not, so "pick the one that looks like a number of
    // kilograms" was the whole of the method.
    answer: 'n * 50 / 1000',
    hint: 'There are 1000 grams in a kilogram.',
    tags: ['AC9M6M01', 'MA3-NSM-01'],
  },

  // Measuring, and the four below are the conversions used rather than
  // performed. The two above turn one unit into another and stop there; a
  // total mass has to be worked out before it can be converted, a bottle has
  // to be turned into millilitres before it can be shared out, and the length
  // on the number line is not written down anywhere at all.
  //
  // **The number line is the only figure in this group, and it is the picture
  // that makes the reading the question.** Year 4 read a tenth off a line the
  // builder chose for itself; this reads a hundredth off a **pinned
  // tenth-wide window**, which is the only way a hundredth can be drawn - the
  // ranges the builder finds for itself carry a tick under just the nine
  // tenths and 0.25 and 0.75. Two pins, not one: the window is pinned *and*
  // the answer's offset is held to 1, 3, 7 or 9 hundredths, because the tick
  // division follows where the arrow lands rather than the span, so a fifth or
  // a half of the window would otherwise be the coarsest legible division on
  // some draws and the hint below would be false there. Measured over all 160
  // reachable answers at forty seeds each: every window came out divided into
  // exactly ten, and no other division appeared anywhere.
  //
  // The window moves with the content - a different metre and a different
  // tenth every draw - which is where this question's variation lives. A
  // pinned window is otherwise one picture per answer, since the tick and
  // arrow jitter is visible but says nothing about the reading.
  {
    id: 'maths.6.measurement.number-line-centimetres',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    prompt: 'The arrow shows a length in metres. How many centimetres is that?',
    vars: [
      { name: 'w', kind: 'int', min: '1', max: '4' },
      { name: 't', kind: 'int', min: '0', max: '9' },
      { name: 'k', kind: 'pick', from: [1, 3, 7, 9] },
      // Counted in whole centimetres and divided once, so no metre value is
      // ever a float built out of two additions.
      { name: 'cm', kind: 'expr', expr: 'w * 100 + t * 10 + k' },
      { name: 'lo', kind: 'expr', expr: '(w * 100 + t * 10) / 100' },
      { name: 'hi', kind: 'expr', expr: '(w * 100 + t * 10 + 10) / 100' },
      { name: 'm', kind: 'expr', expr: 'cm / 100' },
    ],
    answer: 'cm',
    hint: 'Each small tick is a hundredth of a metre, which is one centimetre.',
    figure: { kind: 'number-line', at: 'm', from: 'lo', to: 'hi', step: '0.1' },
    tags: ['AC9M6M01', 'MA3-GM-02'],
  },
  {
    id: 'maths.6.measurement.total-mass',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    // Multiply, then convert. The conversion questions above hand a child the
    // number to convert; here the number has to be made first, which is what
    // AC9M6M01 means by using a conversion to solve a problem.
    prompt: '{n} tins each weigh {g} grams. What is the total mass, in kilograms?',
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '9' },
      { name: 'j', kind: 'int', min: '1', max: '8' },
      { name: 'g', kind: 'expr', expr: 'j * 50' },
    ],
    // Every total is a multiple of 50 grams, so every answer is a multiple of
    // 0.05 kilograms and stops at two decimal places.
    answer: 'n * g / 1000',
    hint: 'Work out the total in grams first. There are 1000 grams in a kilogram.',
    tags: ['AC9M6M01', 'MA3-NSM-01'],
  },
  {
    id: 'maths.6.measurement.litres-to-millilitres',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    // The conversion the other way round from the two above, and the one that
    // needs the decimal read rather than written: 1.45 litres is 1450
    // millilitres, and the hundredths place is where the mistake is made.
    prompt: 'A jug holds {l} litres. How many millilitres is that?',
    vars: [
      { name: 'n', kind: 'int', min: '105', max: '995' },
      { name: 'l', kind: 'expr', expr: 'n / 100' },
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n * 10',
    hint: 'There are 1000 millilitres in a litre.',
    tags: ['AC9M6M01', 'MA3-3DS-02'],
  },
  {
    id: 'maths.6.measurement.full-glasses',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    // Capacity divided rather than converted, which is the practical half of
    // MA3-3DS-02. Year 5 filled a bottle by subtracting; sharing it out is the
    // step past that.
    prompt: 'A {l} litre bottle is poured into glasses holding {ml} millilitres each. How many glasses does it fill?',
    vars: [
      { name: 'l', kind: 'int', min: '2', max: '6' },
      // Every one of these divides 1000, so the division is exact by
      // construction and there is nothing for rejection sampling to reject.
      { name: 'ml', kind: 'pick', from: [100, 125, 200, 250, 500] },
    ],
    answer: 'l * 1000 / ml',
    hint: 'The bottle holds {l * 1000} millilitres.',
    tags: ['AC9M6M01', 'MA3-3DS-02'],
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
    tags: ['AC9M6M02', 'MA3-2DS-02'],
  },
  {
    id: 'maths.6.perimeter-and-area.square-area',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '6',
    prompt: 'A square has sides of {s} m. What is its area, in square metres?',
    vars: [{ name: 's', kind: 'int', min: '3', max: '20' }],
    answer: 's * s',
    tags: ['AC9M6M02', 'MA3-2DS-02'],
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
    tags: ['AC9M6M04', 'MA3-GM-03'],
  },
  {
    id: 'maths.6.angles.at-a-point',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    prompt:
      'Three angles meet at a point. Two are {a} and {b} degrees. What is the third, in degrees?',
    vars: [
      { name: 'a', kind: 'int', min: '20', max: '170', step: 5 },
      { name: 'b', kind: 'int', min: '20', max: '170', step: 5 },
    ],
    constraints: ['a + b < 350'],
    answer: '360 - a - b',
    hint: 'Angles at a point add to 360 degrees.',
    tags: ['AC9M6M04', 'MA3-GM-03'],
  },
  {
    id: 'maths.6.angles.vertically-opposite',
    subject: 'maths',
    topic: 'angles',
    level: '6',
    prompt:
      'Two lines cross. One angle is {a} degrees. What is the angle opposite it, in degrees?',
    vars: [{ name: 'a', kind: 'int', min: '15', max: '165', step: 5 }],
    answer: 'a',
    hint: 'Vertically opposite angles are equal.',
    tags: ['AC9M6M04', 'MA3-GM-03'],
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
    tags: ['AC9M6M04', 'MA3-GM-03'],
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
      'Another angle beside this one would make a straight line. Is it bigger or smaller than this one?',
    vars: [{ name: 'd', kind: 'int', min: '20', max: '160', step: 5 }],
    constraints: ['abs(d - 90) >= 25'],
    answer: "d < 90 ? 'bigger' : 'smaller'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'bigger'", "'smaller'"] },
    hint: 'The two add to 180 degrees, so compare this one with 90.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M6M04', 'MA3-GM-03'],
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
    tags: ['AC9M6M03', 'MA3-NSM-02'],
  },

  // The dial, and **at Year 6 the question is the itinerary rather than the
  // reading.** Year 3 read a face to the five minutes, Year 4 counted on from
  // one, Year 5 converted one into 24-hour time and counted minutes to a
  // departure. AC9M6M03 is about planning with a timetable, so both of these
  // give a duration and ask for a *time*: one forward to an arrival, one
  // backward to when you have to set off. Counting back round a face is the
  // one of the two nothing in the catalog has asked, and it is the harder.
  //
  // The template above works the same journey in words with both times given,
  // which is what makes these two picture questions rather than repeats: the
  // time you start from is only in the drawing.
  //
  // **Four options, two hours crossed with two minute readings**, which is
  // Year 3's arrangement and Year 5's for its reason: one hand read on its own
  // narrows four to two and never to one, and both hours and both minutes are
  // on the buttons every draw, so the option set never points at one of them.
  // The wrong hour is an hour out either way, drawn at random rather than
  // derived from whether the journey crossed the hour - deriving it measured
  // as a leak, and the comment at it says how big and why.
  //
  // Both pin `numerals` and `minuteTicks`, because an omitted optional field
  // is a coin toss rather than a default and half of these would otherwise
  // draw a dial with no numbers on it. The hands are the answer, so the hand
  // lengths are the only thing left free to jitter.
  {
    id: 'maths.6.time.clock-arrival',
    subject: 'maths',
    topic: 'time',
    level: '6',
    prompt: 'This clock shows when the bus leaves. The trip takes {n} minutes. What time does it arrive?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'mi', kind: 'int', min: '0', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      // The trip is a whole number of five-minute marks round the face, and at
      // most eleven of them, so the hour rolls over at most once.
      { name: 'g', kind: 'int', min: '1', max: '11' },
      { name: 'n', kind: 'expr', expr: 'g * 5' },
      { name: 'tot', kind: 'expr', expr: 'mi + g' },
      { name: 'ah', kind: 'expr', expr: 'tot >= 12 ? mod(h, 12) + 1 : h' },
      { name: 'am', kind: 'expr', expr: 'mod(tot, 12) * 5' },
      // **The hour either side of the answer, picked at random - not the
      // rollover mistake, which measured as a leak.** Offering `h` and `h + 1`
      // and letting the roll decide which is right puts the answer on the
      // later of the two exactly when the minutes went past the twelve - and
      // the answer's own minute says when that was, since `mod(mi + g, 12)`
      // falls below `g` if and only if it rolled. So the trip length in the
      // prompt and the four buttons between them ruled two options out with
      // the clock unread.
      //
      // **Read the seen-keys column, not the held-out one.** This template
      // makes 5931 keys over 10,000 draws, so only 68% of scored draws land on
      // a key the learn half saw and the held-out figure is deflated by the
      // third that do not. Both versions, one run of 10,000 draws a half:
      // derived from the roll, 34.1% held-out and **50.4% over seen keys**,
      // which is exactly the ceiling that rule gives; drawn either side,
      // 17.2% held-out and **25.3% over seen keys**, against a 25% blind
      // baseline. The distractor is still an hour out - which is the rollover
      // mistake half the time - and no longer says which way.
      { name: 'hs', kind: 'pick', from: [1, -1] },
      { name: 'oh', kind: 'expr', expr: 'mod(ah - 1 + hs + 12, 12) + 1' },
      // Any other five-minute mark, stepped round rather than drawn and
      // rejected, so no draw is thrown away.
      { name: 'dm', kind: 'int', min: '1', max: '11' },
      { name: 'om', kind: 'expr', expr: 'mod(mod(tot, 12) + dm, 12) * 5' },
      // O'clock is written 4:00 and five past 4:05; only those two need the
      // nought written in.
      { name: 'ams', kind: 'expr', expr: "am == 0 ? '00' : am == 5 ? '05' : '' + am" },
      { name: 'oms', kind: 'expr', expr: "om == 0 ? '00' : om == 5 ? '05' : '' + om" },
    ],
    // A time is written 4:05, which the number pad cannot type - so it is
    // tapped.
    answer: "ah + ':' + ams",
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ["oh + ':' + ams", "ah + ':' + oms", "oh + ':' + oms"],
    },
    hint: 'Read the clock first, then count on round the face in 5s.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M6M03', 'MA3-NSM-02'],
  },
  {
    id: 'maths.6.time.clock-leave-by',
    subject: 'maths',
    topic: 'time',
    level: '6',
    // The same journey run backwards, which is the half of planning a trip
    // that a timetable actually asks for: the train's time is fixed and what
    // has to be worked out is when to leave the house.
    prompt: 'This clock shows when the train leaves. The walk takes {n} minutes. What time should you set off?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'mi', kind: 'int', min: '0', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      { name: 'g', kind: 'int', min: '1', max: '11' },
      { name: 'n', kind: 'expr', expr: 'g * 5' },
      // Counted in five-minute marks and lifted clear of zero before the
      // remainder is taken, so the walk crossing the hour backwards is the
      // ordinary case rather than a negative number to be handled.
      { name: 'back', kind: 'expr', expr: 'mi - g < 0 ? 1 : 0' },
      { name: 'ah', kind: 'expr', expr: 'back == 1 ? (h == 1 ? 12 : h - 1) : h' },
      { name: 'am', kind: 'expr', expr: 'mod(mi - g + 12, 12) * 5' },
      // The hour either side, at random, for the reason the arrival question
      // above spells out: the hour that would be right if the walk had not
      // crossed the hour is the later one exactly when it did cross, and the
      // answer's own minute says which happened.
      { name: 'hs', kind: 'pick', from: [1, -1] },
      { name: 'oh', kind: 'expr', expr: 'mod(ah - 1 + hs + 12, 12) + 1' },
      { name: 'dm', kind: 'int', min: '1', max: '11' },
      { name: 'om', kind: 'expr', expr: 'mod(mod(mi - g + 12, 12) + dm, 12) * 5' },
      { name: 'ams', kind: 'expr', expr: "am == 0 ? '00' : am == 5 ? '05' : '' + am" },
      { name: 'oms', kind: 'expr', expr: "om == 0 ? '00' : om == 5 ? '05' : '' + om" },
    ],
    answer: "ah + ':' + ams",
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ["oh + ':' + ams", "ah + ':' + oms", "oh + ':' + oms"],
    },
    hint: 'Read the clock first, then count back round the face in 5s.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M6M03', 'MA3-NSM-02'],
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
    tags: ['AC9M6SP02', 'MA3-GM-01'],
  },

  // The same move drawn, and **the point of drawing it is that the starting
  // coordinate is nowhere in the sentence.** The template above hands a child
  // both the point and the distance, so the picture would be decoration; below
  // it the distance is all the prompt says and the point has to be read off
  // the plane. AC9M6SP02 is about describing what happens to a coordinate when
  // a point moves, which is what both of these do - one forwards, one back to
  // where the dot came from, which is the harder of the two and which nothing
  // in the catalog has asked.
  //
  // Both are first quadrant. MA3-GM-01 is the first quadrant only, NSW places
  // negative coordinates at Stage 4, and the number pad has no minus key to
  // answer one with.
  //
  // **Both answers are typed rather than tapped, and that is what keeps them
  // clear of the leak Year 4 and Year 5 both had to fix.** A coordinate pair
  // on a button carries an order - `(2,3)` sorts - and a prompt naming a
  // direction then reads the answer straight off the option set with the
  // picture unread; neither enforced check can see it. A number typed on the
  // pad has no option set at all.
  //
  // **The destination stays on the drawn grid**, which is why the extent is
  // bound below the move rather than beside it: a prompt saying the dot moves
  // three squares right, on a grid that ends one square along, describes
  // something the picture cannot show. That costs the extent some of its
  // range, and there is enough left - a labelled plane draws clean at 3, 4 or
  // 5 columns by 3 or 4 rows, six extents, all measured.
  {
    id: 'maths.6.position.move-right',
    subject: 'maths',
    topic: 'position',
    level: '6',
    prompt: 'The dot moves {d} {sq} right. What is its new x-coordinate?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '3' },
      { name: 'd', kind: 'int', min: '1', max: '2' },
      { name: 'sq', kind: 'expr', expr: "d == 1 ? 'square' : 'squares'" },
      // Wide enough to hold where the dot lands, and free to vary above that.
      { name: 'cols', kind: 'int', min: 'max(3, x + d)', max: '5' },
      { name: 'y', kind: 'int', min: '1', max: '3' },
      { name: 'rws', kind: 'int', min: '3', max: '4' },
    ],
    answer: 'x + d',
    hint: 'Read the number along the bottom the dot is standing on, then count on {d}.',
    figure: { kind: 'grid', at: "x + ',' + y", columns: 'cols', rows: 'rws', onLines: 'true' },
    tags: ['AC9M6SP02', 'MA3-GM-01'],
  },
  {
    id: 'maths.6.position.move-back',
    subject: 'maths',
    topic: 'position',
    level: '6',
    // The move undone. The dot is where it ended up, and what is asked for is
    // where it started - the same relationship read in the direction a child
    // has not practised, and the one a coordinate has to be understood rather
    // than counted to answer.
    prompt: 'The dot has just moved {d} {sq} up. What was its y-coordinate before?',
    vars: [
      // Far enough up that the dot came from somewhere on the grid, which is
      // what makes the question about a move rather than about a subtraction.
      { name: 'y', kind: 'int', min: '2', max: '4' },
      { name: 'd', kind: 'int', min: '1', max: '2' },
      { name: 'sq', kind: 'expr', expr: "d == 1 ? 'square' : 'squares'" },
      { name: 'x', kind: 'int', min: '1', max: '3' },
      { name: 'cols', kind: 'int', min: 'max(3, x)', max: '5' },
      { name: 'rws', kind: 'int', min: 'max(3, y)', max: '4' },
    ],
    answer: 'y - d',
    hint: 'Read the number up the side the dot is standing on, then count back {d}.',
    figure: { kind: 'grid', at: "x + ',' + y", columns: 'cols', rows: 'rws', onLines: 'true' },
    tags: ['AC9M6SP02', 'MA3-GM-01'],
  },

  // Solids, and **Year 6 is where a solid stops being counted and starts being
  // classified.** Year 3 counted a net's faces and looked for a triangular
  // one, Year 4 counted a net's edges and corners, Year 5 counted the same two
  // off the object and asked whether a face was square. Every one of those is
  // answered by counting something on the screen. AC9M6SP01 is about the
  // parallel cross-sections of an object and how they relate to a right prism,
  // which is a question about what kind of thing the solid *is* - and it
  // cannot be counted. All three below cite MA3-3DS-01, which is the code
  // Year 5's three solids already carry: NSW writes one outcome per focus area
  // across the pair of years, so what separates Year 6 from Year 5 here is the
  // ACARA description and the difficulty, not the outcome.
  //
  // **Nothing here turns on a length**, which is the trap `solid-kind.ts`
  // names outright: an oblique projection foreshortens depth by a convention
  // rather than by a measurement, and `MIN_CUBOID_RATIO` is the one guarantee
  // in the file. A prism is told from a pyramid by whether it has two matching
  // ends, and a cross-section by what shape those ends are, neither of which
  // is a proportion.
  {
    id: 'maths.6.shapes.is-a-prism',
    subject: 'maths',
    topic: 'shapes',
    level: '6',
    // **True exactly half the time, by construction**: the flag is picked
    // first and the solid derived from it, so nothing is rejected and nothing
    // skews. Three solids on each side rather than one, so no answer is a
    // single picture. The sentence is the same words every draw, so there is
    // no claim in it to leak - the picture is the only place the answer lives.
    //
    // A cylinder is in neither list. It has two matching ends and a curved
    // side, so "is it a prism?" is an argument about whether a prism has to be
    // a polyhedron rather than a question about the drawing, and a child
    // marked wrong for it has learned nothing.
    prompt: 'True or false: this shape is a prism.',
    vars: [
      { name: 'prism', kind: 'pick', from: [1, 0] },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      {
        name: 'shape',
        kind: 'expr',
        expr:
          "prism == 1 ? (i == 0 ? 'cube' : i == 1 ? 'cuboid' : 'triangular-prism') : " +
          "(i == 0 ? 'square-pyramid' : i == 1 ? 'cone' : 'sphere')",
      },
    ],
    answer: 'prism == 1',
    hint: 'A prism has two matching ends joined by flat faces.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M6SP01', 'MA3-3DS-01'],
  },
  {
    id: 'maths.6.shapes.cross-section',
    subject: 'maths',
    topic: 'shapes',
    level: '6',
    // AC9M6SP01 itself: the slice straight across a prism is the same shape as
    // its end, all the way along. The three solids are the three answers, and
    // each of them is a shape a child has named since Year 1 - what is new is
    // that the shape being named is not on the screen.
    prompt: 'This shape is cut straight across, parallel to its ends. What shape is the cut face?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'triangular-prism', 'cylinder'] },
    ],
    answer: "shape == 'cube' ? 'square' : shape == 'triangular-prism' ? 'triangle' : 'circle'",
    // A shape name is a small closed set, so it is tapped at any level. The
    // same three buttons are offered every draw, so the option set never says
    // which one it is.
    answerType: 'choice',
    choices: { count: 3, distractors: ["'square'", "'triangle'", "'circle'"] },
    hint: 'The cut face is the same shape as the end you would look straight at.',
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M6SP01', 'MA3-3DS-01'],
  },
  {
    id: 'maths.6.shapes.net-is-a-prism',
    subject: 'maths',
    topic: 'shapes',
    level: '6',
    // **The same classification off the net, which is declared rather than
    // left to look like an oversight.** The object and the net are a real
    // difficulty step in this catalog and not a duplicate: Year 4 counted a
    // net's edges and Year 5 counted the object's, on the grounds that an
    // object hides three edges behind it. This runs the other way - a net lays
    // every face flat and apart, so the two matching ends have to be picked
    // out of a row of loose shapes where the object shows them joined.
    //
    // The cuboid is in the list here, where Years 3 and 4 kept it out of their
    // net questions. Their reason was that telling a cuboid's net from a
    // cube's is a question about proportion rather than about shape; here both
    // answer the same way, so nothing turns on telling them apart.
    //
    // The false side is two solids rather than three: a cylinder's net has two
    // matching ends and would be the argument the object question above
    // declines to have, and a sphere has no net at all.
    prompt: 'True or false: this net folds up into a prism.',
    vars: [
      { name: 'prism', kind: 'pick', from: [1, 0] },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'j', kind: 'int', min: '0', max: '1' },
      {
        name: 'shape',
        kind: 'expr',
        expr:
          "prism == 1 ? (i == 0 ? 'cube' : i == 1 ? 'cuboid' : 'triangular-prism') : " +
          "(j == 0 ? 'square-pyramid' : 'cone')",
      },
    ],
    answer: 'prism == 1',
    hint: 'A prism folds up with two matching ends joined by flat faces.',
    figure: { kind: 'solid', solid: 'shape', view: "'net'" },
    tags: ['AC9M6SP01', 'MA3-3DS-01'],
  },

  // Graphs, and **Year 6 reads a display for a property of the whole set
  // rather than for one of its readings.** Every graph question before this
  // one answers "how many for this category?" or "how much more than that
  // one?"; AC9M6ST01 names mode, range and shape, which are three things no
  // single column can say. So the range comes off a column graph, the mode off
  // another, and the steepest rise off a line - and the picture graph, which
  // is the one reading question here, adds three many-to-one rows together
  // rather than reading one of them.
  //
  // A graph carries no title, so **the prompt is the only place the quantity
  // can be named**, and it is one word rather than a sentence of scene-setting
  // - the figure claims the vertical room first.
  //
  // Every category name is three characters. A `bar`'s name budget is fed the
  // width of the widest rung the axis might print *and* the width of the
  // widest name, since a wider name narrows the plot it is then judged inside
  // - so the number in a refusal message is what the name that failed earned,
  // not what a shorter one would have been allowed. Four three-character names
  // over a ten-scale axis were built and their issues read rather than counted
  // against a table, and they are clean. Values stay at or below five steps,
  // because an axis needing more than five labelled rungs is refused outright.
  {
    id: 'maths.6.data.column-range',
    subject: 'maths',
    topic: 'data',
    level: '6',
    prompt: 'What is the range of these scores?',
    // **The range is drawn first and the four scores built round it**, so each
    // of the four answers comes up equally often. Drawing four scores and
    // taking the spread makes the middling ranges far the commonest, which
    // teaches a child to guess 20.
    vars: [
      { name: 'rr', kind: 'int', min: '1', max: '4' },
      { name: 'lo', kind: 'int', min: '1', max: '5 - rr' },
      { name: 'hi', kind: 'expr', expr: 'lo + rr' },
      // The two scores that are neither the highest nor the lowest sit
      // somewhere between them, and may tie with each other or with an end -
      // which is what a real set of scores does.
      { name: 'p', kind: 'int', min: 'lo', max: 'hi' },
      { name: 'q', kind: 'int', min: 'lo', max: 'hi' },
      // Where the highest sits, and where the lowest sits - stepped round so
      // the two are never the same column and every arrangement is reachable.
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'k', kind: 'int', min: '1', max: '3' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 4)' },
      { name: 'v0', kind: 'expr', expr: 'i == 0 ? hi : j == 0 ? lo : p' },
      { name: 'v1', kind: 'expr', expr: 'i == 1 ? hi : j == 1 ? lo : p' },
      { name: 'v2', kind: 'expr', expr: 'i == 2 ? hi : j == 2 ? lo : q' },
      { name: 'v3', kind: 'expr', expr: 'i == 3 ? hi : j == 3 ? lo : q' },
    ],
    answer: 'rr * 10',
    hint: 'The range is the highest score take away the lowest.',
    // The tallest column is at least two steps above the axis floor by
    // construction, so the axis can never come out a single step - which is
    // refused, and which `figureIssues` samples fifty seeds for rather than
    // proves.
    figure: {
      kind: 'bar',
      values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
      labels: "'Ada,Kai,Leo,Mia'",
      scale: '10',
      style: "'column'",
    },
    tags: ['AC9M6ST01', 'MA3-DATA-02'],
  },
  {
    id: 'maths.6.data.column-mode',
    subject: 'maths',
    topic: 'data',
    level: '6',
    // The mode named as the mode, which is the word AC9M6ST01 introduces. The
    // reading itself is easy on purpose - the tallest column - because what is
    // being learned is that the tallest column is what the word means.
    prompt: 'Which pet is the mode?',
    vars: [
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'top', kind: 'int', min: '3', max: '5' },
      // One filler per column, so the three that are not the mode are drawn
      // independently and every one of them is strictly below it - the mode is
      // unique by construction rather than by rejection.
      { name: 'a', kind: 'int', min: '1', max: 'top - 1' },
      { name: 'b', kind: 'int', min: '1', max: 'top - 1' },
      { name: 'c', kind: 'int', min: '1', max: 'top - 1' },
      { name: 'd', kind: 'int', min: '1', max: 'top - 1' },
      { name: 'v0', kind: 'expr', expr: 'i == 0 ? top : a' },
      { name: 'v1', kind: 'expr', expr: 'i == 1 ? top : b' },
      { name: 'v2', kind: 'expr', expr: 'i == 2 ? top : c' },
      { name: 'v3', kind: 'expr', expr: 'i == 3 ? top : d' },
    ],
    answer: "i == 0 ? 'Cat' : i == 1 ? 'Dog' : i == 2 ? 'Rat' : 'Pig'",
    // The same four buttons every draw, so the option set says nothing and the
    // answer lands on each of them equally often. All four names are listed:
    // the one equal to the answer is dropped.
    answerType: 'choice',
    choices: { count: 4, distractors: ["'Cat'", "'Dog'", "'Rat'", "'Pig'"] },
    hint: 'The mode is the one that comes up most often - the tallest column.',
    figure: {
      kind: 'bar',
      values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
      labels: "'Cat,Dog,Rat,Pig'",
      scale: '10',
      style: "'column'",
    },
    tags: ['AC9M6ST01', 'MA3-DATA-02'],
  },
  {
    id: 'maths.6.data.line-graph-steepest',
    subject: 'maths',
    topic: 'data',
    level: '6',
    // The **shape** of the line rather than a reading off it, which is the
    // third of AC9M6ST01's three words and the thing a line graph exists to
    // show. Year 5 asked for the rise between two named days; this asks which
    // rise is the biggest, so every segment has to be compared with every
    // other and no single reading answers it.
    prompt: 'Between which two days did the visitors rise the most?',
    // **The three steps are drawn and the readings built from them**, which is
    // Year 5's rule here for a reason its own question did not have to meet:
    // four readings drawn independently do *not* make the three days equally
    // likely answers. A big middle step needs a low Tuesday and a high
    // Wednesday, and both of those hold the steps either side of it down - so
    // the middle segment wins more often than the two on the ends. Measured
    // over 10,000 draws of exactly that version: 31.4 / 36.6 / 32.0.
    //
    // Drawn as steps the three are interchangeable, and the constraint below
    // is symmetric in them, so nothing prefers a position. **The range is what
    // usually breaks that** - a walk that runs off the top of the axis gets
    // thrown away, and which walks run off depends on the order the steps come
    // in. So the steps are held to -1..2, where the tallest walk any
    // surviving triple can make is four steps and every triple therefore fits
    // whatever order it is in; the line is then slid up by an offset drawn
    // from whatever room is left over. Measured after: 33.5 / 33.8 / 32.7.
    vars: [
      { name: 'g0', kind: 'int', min: '-1', max: '2' },
      { name: 'g1', kind: 'int', min: '-1', max: '2' },
      { name: 'g2', kind: 'int', min: '-1', max: '2' },
      { name: 'p1', kind: 'expr', expr: 'g0' },
      { name: 'p2', kind: 'expr', expr: 'g0 + g1' },
      { name: 'p3', kind: 'expr', expr: 'g0 + g1 + g2' },
      { name: 'lo', kind: 'expr', expr: 'min(0, p1, p2, p3)' },
      { name: 'hi', kind: 'expr', expr: 'max(0, p1, p2, p3)' },
      // Where on the five rungs the whole walk sits. A reading is 1 to 5 rungs,
      // so a walk `hi - lo` tall leaves `4 - (hi - lo)` places to start from.
      // Every triple the constraints below accept is four steps tall or less,
      // so the clamp never binds on a draw that survives - it is there because
      // variables are bound before constraints are checked, and an empty range
      // throws rather than being resampled.
      { name: 'off', kind: 'int', min: '0', max: 'max(0, 4 - hi + lo)' },
      { name: 'v0', kind: 'expr', expr: '1 - lo + off' },
      { name: 'v1', kind: 'expr', expr: 'v0 + g0' },
      { name: 'v2', kind: 'expr', expr: 'v1 + g1' },
      { name: 'v3', kind: 'expr', expr: 'v2 + g2' },
    ],
    // One segment rises further than both the others, so the question has one
    // answer - and that segment goes *up*, so "rise the most" is true of it
    // rather than being the least bad of three falls. A rise also puts the
    // taller of its two days at two steps or more, so the axis is never the
    // single step that is refused.
    constraints: [
      'max(g0, g1, g2) > 0',
      '(g0 > g1 && g0 > g2) || (g1 > g0 && g1 > g2) || (g2 > g0 && g2 > g1)',
    ],
    answer: "g0 > g1 && g0 > g2 ? 'Mon to Tue' : g1 > g2 ? 'Tue to Wed' : 'Wed to Thu'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'Mon to Tue'", "'Tue to Wed'", "'Wed to Thu'"] },
    // "The line" is only true because the style is pinned: left open the kind
    // draws a column or a dot instead.
    hint: 'The steepest climb on the line is the biggest rise.',
    figure: {
      kind: 'bar',
      values: "(v0 * 10) + ',' + (v1 * 10) + ',' + (v2 * 10) + ',' + (v3 * 10)",
      labels: "'Mon,Tue,Wed,Thu'",
      scale: '10',
      style: "'line'",
    },
    tags: ['AC9M6ST01', 'MA3-DATA-02'],
  },
  {
    id: 'maths.6.data.picture-key-total',
    subject: 'maths',
    topic: 'data',
    level: '6',
    // A many-to-one graph read for its total, so all three rows are in play
    // rather than one or two. The key says twenty and a half picture says ten,
    // which is the step past Year 5's key of ten - and the counts are drawn as
    // a number of half-pictures, so every row is a whole or a half of one and
    // the key can say all of them exactly.
    //
    // It carries MA3-DATA-01, the code Year 5's two picture graphs already
    // carry, and needs no argument for it here - Years K to 4 were held to a
    // key of one or to an ACARA-only citation, and Stage 3 is where that
    // stopped being necessary. **The prompt still says what one picture stands
    // for**, at every year: the graph's own key draws an icon and a number and
    // cannot say two *what*.
    prompt: 'Each picture stands for 20 books. How many books did the three read altogether?',
    // One to eight halves is four pictures at most, which is what a
    // three-character row label leaves room for.
    vars: [
      { name: 'ha', kind: 'int', min: '1', max: '8' },
      { name: 'hb', kind: 'int', min: '1', max: '8' },
      { name: 'hc', kind: 'int', min: '1', max: '8' },
    ],
    answer: '(ha + hb + hc) * 10',
    hint: 'A whole picture is 20 books and half a picture is 10. Add the three rows.',
    figure: {
      kind: 'pictograph',
      counts: "(ha * 10) + ',' + (hb * 10) + ',' + (hc * 10)",
      labels: "'Ada,Kai,Leo'",
      key: '20',
      halves: 'true',
    },
    tags: ['AC9M6ST01', 'MA3-DATA-01'],
  },

  // Chance, and **Year 6 is where one spinner stops being the whole event.**
  // Year 5 read a probability off a spinner as a fraction and as a percentage.
  // AC9M6P01 adds two things to that: a decimal is a third way of writing the
  // same number, and a compound event - a spin *and* a toss - has more
  // outcomes than either part on its own. The complement sits between them:
  // the chance of *not* landing on the shaded part is the one a child cannot
  // get by counting the shaded sectors and stopping.
  //
  // Every spinner emits **no `label` marks at all**, so it carries no text
  // whatsoever: the fill names below are grouping keys that never reach the
  // screen, and the prompts say "shaded", never a colour. The first-named
  // group is the shaded one.
  {
    id: 'maths.6.chance.spinner-decimal',
    subject: 'maths',
    topic: 'chance',
    level: '6',
    // Ten equal parts as well as five, so a probability comes out at one
    // decimal place either way: fifths give 0.2, 0.4, 0.6 and 0.8, tenths give
    // all nine. Ten parts is also more than a child can take in at a glance,
    // which is the difficulty step - the counting is the work.
    prompt: 'What is the chance of stopping on a shaded part, as a decimal?',
    vars: [
      { name: 'n', kind: 'pick', from: [...DECIMAL_PARTS] },
      { name: 's', kind: 'int', min: '1', max: 'n - 1' },
      { name: 'parts', kind: 'expr', expr: equalSectors('n', DECIMAL_PARTS) },
      { name: 'shading', kind: 'expr', expr: shadedFills('n', 's', DECIMAL_PARTS) },
    ],
    answer: 's / n',
    hint: 'Count the shaded parts, then all the parts, and divide.',
    figure: { kind: 'spinner', sectors: 'parts', fills: 'shading' },
    tags: ['AC9M6P01', 'MA3-CHAN-01'],
  },
  {
    id: 'maths.6.chance.spinner-not-shaded',
    subject: 'maths',
    topic: 'chance',
    level: '6',
    // The complement, which is the step Year 5's percentage question does not
    // take: counting the shaded parts gets a child to the wrong number, and
    // the picture has to be read for what is left over instead. Four parts or
    // five, which is what makes the percentages whole.
    prompt: 'What is the chance of not stopping on a shaded part, as a percentage?',
    vars: [
      { name: 'n', kind: 'pick', from: [...PERCENT_PARTS] },
      { name: 's', kind: 'int', min: '1', max: 'n - 1' },
      { name: 'parts', kind: 'expr', expr: equalSectors('n', PERCENT_PARTS) },
      { name: 'shading', kind: 'expr', expr: shadedFills('n', 's', PERCENT_PARTS) },
    ],
    answer: '(n - s) * 100 / n',
    hint: 'The whole spinner is 100%. How much of it is left unshaded?',
    figure: { kind: 'spinner', sectors: 'parts', fills: 'shading' },
    tags: ['AC9M6P01', 'MA3-CHAN-01'],
  },
  {
    id: 'maths.6.chance.spinner-and-coin',
    subject: 'maths',
    topic: 'chance',
    level: '6',
    // **A compound event**, which is AC9M6P01's own words and which nothing in
    // the catalog has asked. The spinner supplies one of the two parts and the
    // coin the other, so the number of parts has to be counted off the picture
    // before the doubling can happen.
    //
    // `fills` is left off, so the sectors alternate shaded and plain. Nothing
    // here turns on which of them are shaded - the answer is a count of parts -
    // and alternating them is what makes one part easy to tell from the next.
    prompt: 'You spin this spinner once and toss a coin. How many different results are there?',
    vars: [
      { name: 'n', kind: 'int', min: '3', max: '6' },
      { name: 'parts', kind: 'expr', expr: equalSectors('n', COMPOUND_PARTS) },
    ],
    answer: 'n * 2',
    hint: 'Every part of the spinner can come up with heads, or with tails.',
    figure: { kind: 'spinner', sectors: 'parts' },
    tags: ['AC9M6P01', 'MA3-CHAN-01'],
  },

  // ------------------------------------------------------------------
  // The mean, a many-to-one graph read in halves, and a chance as a
  // percentage.
  //
  // The strand pass (issue #12), and the last year of it. Year 6 was 20 Number
  // and algebra, 22 Measurement and space, 7 Statistics and probability - the
  // only year already over its Measurement and space share, so all three below
  // are Statistics and probability and it ends at 20/22/10.
  // ------------------------------------------------------------------

  {
    id: 'maths.6.data.column-mean',
    subject: 'maths',
    topic: 'data',
    level: '6',
    prompt: 'What is the mean of the four numbers on this graph?',
    // **The mean is picked first and the four readings are built around it**,
    // which is the only way this answer comes out evenly spread. Both of the
    // obvious constructions are badly peaked, because four readings drawn
    // independently sum the way four dice do: deriving the fourth reading to
    // make the total divide by four measured **56% on a mean of 3**, and
    // drawing all four and keeping the totals that divide is the same
    // distribution conditioned - 85 of the 157 surviving quadruples have a
    // mean of 3. A typed answer with a 56% mode is a number worth guessing.
    // Picked first, the three means come up a third each.
    //
    // Two offsets and their negatives, so the four readings sum to exactly
    // four times the mean with nothing thrown away.
    //
    // **Every reading stays at or under 5**, which is `bar`'s limit rather
    // than the arithmetic's: at `scale: '1'` a value of 6 leaves six labelled
    // rungs where five is the most whose labels stay clear of one another, and
    // the figure is refused outright. A mean of 2 to 4 with offsets of at most
    // 1 is what keeps every column inside 1..5.
    vars: [
      { name: 'mean', kind: 'int', min: '2', max: '4' },
      { name: 'p', kind: 'int', min: '-1', max: '1' },
      { name: 'q', kind: 'int', min: '-1', max: '1' },
      { name: 'a', kind: 'expr', expr: 'mean + p' },
      { name: 'b', kind: 'expr', expr: 'mean + q' },
      { name: 'c', kind: 'expr', expr: 'mean - p' },
      { name: 'd', kind: 'expr', expr: 'mean - q' },
    ],
    // Something above 1, or the axis is a single step and `bar` refuses it.
    constraints: ['max(a, b, c, d) > 1'],
    answer: 'mean',
    hint: 'Add all four numbers, then divide by 4.',
    figure: {
      kind: 'bar',
      values: "a + ',' + b + ',' + c + ',' + d",
      labels: "'Mon,Tue,Wed,Thu'",
      scale: '1',
    },
    tags: ['AC9M6ST01', 'MA3-DATA-02'],
  },
  {
    id: 'maths.6.data.picture-key-halves-total',
    subject: 'maths',
    topic: 'data',
    level: '6',
    prompt: 'Each picture stands for 10 books. How many books were borrowed altogether?',
    // **Halves are what make a many-to-one key usable rather than a scale that
    // can only graph its own multiples**: with them a row may end on half an
    // icon, so a key of 10 can say 25. The counts are therefore drawn as a
    // number of *half* icons and multiplied by five, because a count the key
    // cannot say even in halves is reported rather than quietly rounded into
    // the same picture as its neighbour.
    //
    // A key of ten needs no argument at Stage 3 - `MA3-DATA-01` is graphs with
    // many-to-one scales - where below it one has to be made. The prompt still
    // says what one picture stands for, because the graph's own key draws an
    // icon and a number and cannot say two *what*.
    vars: [
      { name: 'halvesA', kind: 'int', min: '2', max: '7' },
      { name: 'halvesB', kind: 'int', min: '2', max: '7' },
    ],
    answer: '(halvesA + halvesB) * 5',
    hint: 'Half a picture is 5 books.',
    figure: {
      kind: 'pictograph',
      counts: "(halvesA * 5) + ',' + (halvesB * 5)",
      labels: "'May,Jun'",
      key: '10',
      halves: 'true',
    },
    tags: ['AC9M6ST01', 'MA3-DATA-01'],
  },
  {
    id: 'maths.6.chance.percentage-chance',
    subject: 'maths',
    topic: 'chance',
    level: '6',
    prompt: 'A bag holds {r} red counters and {b} blue. What percentage of them are red?',
    // Quantifying a probability as a percentage, which is the Year 6 end of
    // `MA3-CHAN-01`. The total is built to divide 100 exactly - 4, 5, 10 or 20
    // counters - so the answer is a whole percentage and typeable.
    vars: [
      { name: 'total', kind: 'pick', from: [4, 5, 10, 20] },
      { name: 'r', kind: 'int', min: '1', max: 'total - 1' },
      { name: 'b', kind: 'expr', expr: 'total - r' },
    ],
    answer: 'r * 100 / total',
    hint: 'There are {total} counters altogether. What share of 100 is {r} of them?',
    tags: ['AC9M6P01', 'MA3-CHAN-01'],
  },
];
