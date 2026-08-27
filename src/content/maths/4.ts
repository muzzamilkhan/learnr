import type { QuestionTemplate } from '../../lib/templates/types';
import { columnLetter } from './helpers';

/** Year 4 - NSW Stage 2. Which of Part A or B a concept sits in is a teacher's call, not the content's. */
export const year4: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 4
  //
  // Tenths and hundredths as decimals, the properties of odd and even numbers,
  // equivalent fractions and mixed numerals, multiplying and dividing by
  // powers of 10, all multiplication facts to 10 × 10, rounding, perimeter and
  // area, am and pm, angle names, and lines of symmetry - and then the picture
  // questions: a tenth read off a number line one unit wide, an array read for
  // the rows it does not yet have, a shape shaded to a half in disguise,
  // kilograms beside grams and litres beside millilitres, a clock read and then
  // counted on from, nets folded up and counted for their edges and corners, a
  // grid map stepped across two ways at once, spinners named on the likelihood
  // continuum, and graphs where one picture stands for several things and a
  // column can stop between two numbers.
  //
  // Decimal answers start here, where decimals enter the curriculum.
  //
  // **Year 4 is Stage 2's second year, so every NSW code here is an `MA2-` one
  // Year 3 also cites.** What separates the two years is the ACARA description
  // and the difficulty, not the outcome: NSW writes one outcome per focus area
  // for the pair of years, and a Year 4 question that cited a Stage 1 or Stage
  // 3 code would be making a claim the curriculum page presents as checkable
  // and which would not check out.
  //
  // Each new template is filed with the topic it practises rather than in a
  // block of its own - the ruling Year K made and every year since has
  // followed. Three topics arrive with them: `shapes`, `position` and
  // `measurement`.
  // ------------------------------------------------------------------
  {
    id: 'maths.4.decimals.tenths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    // One tenth is one tenth, not "1 tenths" - the same hole `angles.is-acute`
    // uses further down, and the one draw in nine that needed it.
    prompt: "Write {n} tenth{n == 1 ? '' : 's'} as a decimal.",
    vars: [{ name: 'n', kind: 'int', min: '1', max: '9' }],
    // **Typed, and the buttons it replaces were never four.** The answer is
    // always a tenth, and the two place-value errors worth offering - the digit
    // a place too far right and the digit with the point forgotten - are a
    // hundredth and a whole number. So `0.06` and `6` beside `0.6` were ruled
    // out on shape without the prompt being read, leaving a coin toss between
    // the two tenths on screen: measured, the option set alone answered this
    // 51% of the time against a 25% blind guess. No four-option set fixes that
    // while keeping the misconception, because the misconception *is* a change
    // of shape.
    //
    // Typing it costs nothing and tests more. The pad on the play screen has a
    // decimal point - it is the *speed run's* pad that has none, which is what
    // the note that used to sit here had confused - and `gradeAnswer` compares
    // numerically within an epsilon, so `.7` and `0.70` are both right. A child
    // who writes `0.07` is now wrong in their own hand, which the parent's
    // report shows them, where a tapped distractor only ever said which button
    // was pressed.
    answer: 'n / 10',
    hint: 'Tenths go in the first place after the decimal point.',
    tags: ['AC9M4N01', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.decimals.hundredths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'Write {n} hundredths as a decimal.',
    vars: [{ name: 'n', kind: 'int', min: '11', max: '99' }],
    // Ends in no nought, so the answer is two decimal places and the question
    // is about the hundredths place rather than collapsing to a tenth.
    constraints: ['mod(n, 10) != 0'],
    // Typed, for the reason `tenths` above sets out at length: the answer is
    // always a hundredth and the errors worth offering are not, so two of the
    // four buttons were ruled out on shape and the set alone answered this 47%
    // of the time against a 25% blind guess.
    answer: 'n / 100',
    hint: 'Hundredths go in the second place after the decimal point.',
    tags: ['AC9M4N01', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.decimals.larger',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'Which is larger, {a} or {b}?',
    vars: [
      { name: 'a', kind: 'number', min: '0.1', max: '9.9', decimals: 1 },
      { name: 'b', kind: 'number', min: '0.1', max: '9.9', decimals: 1 },
    ],
    constraints: ['a != b'],
    answer: 'max(a, b)',
    answerType: 'choice',
    // The larger of two is the larger option by definition - that is the
    // question, and a child still has to compare the tenths to find it.
    choices: { count: 2, distractors: ['min(a, b)'], rankIsTheQuestion: true },
    hint: 'Compare the whole numbers first, then the tenths.',
    tags: ['AC9M4N01', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.decimals.add-tenths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    // Built from whole tenths so the arithmetic stays exact and the options read
    // cleanly - floating point noise in a distractor gives the answer away.
    prompt: 'What is {a} + {b}?',
    vars: [
      { name: 'na', kind: 'int', min: '11', max: '99' },
      { name: 'nb', kind: 'int', min: '11', max: '99' },
      // The size of the slip the wrong buttons are - a tenth or a whole number -
      // and where in the run of four the answer sits.
      { name: 'u', kind: 'pick', from: [1, 10] },
      { name: 'k', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'lo', kind: 'expr', expr: 'na + nb - k * u' },
      { name: 'a', kind: 'expr', expr: 'na / 10' },
      { name: 'b', kind: 'expr', expr: 'nb / 10' },
    ],
    answer: '(na + nb) / 10',
    answerType: 'choice',
    // An evenly spaced run with the answer at a drawn position, the shape
    // `maths.4.decimals.tenths` explains above.
    choices: {
      count: 4,
      distractors: ['lo / 10', '(lo + u) / 10', '(lo + 2 * u) / 10', '(lo + 3 * u) / 10'],
    },
    hint: 'Add the whole numbers, then add the tenths.',
    tags: ['AC9M4N01', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.decimals.unit-fraction',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'Write 1/{d} as a decimal.',
    vars: [{ name: 'd', kind: 'pick', from: [2, 4, 5, 10] }],
    answer: '1 / d',
    answerType: 'choice',
    // **The other three unit fractions, so the four buttons are the same four
    // numbers every draw.** They used to be built from `d` - `d / 10`,
    // `(10 + d) / 100`, `(100 - d) / 100` - which gave four denominators four
    // option sets, one answer apiece: the buttons named the answer without the
    // fraction being read, 100% off the option set alone against a 25% blind
    // guess over 600 draws. A set that never changes cannot say anything about
    // which button is right, which is the strongest form of the fix and the
    // one this template can have: four options and four unit fractions leaves
    // no room to drop one, so there is nothing here to vary and nothing left
    // to leak. The cost is the place-value distractor (1/4 as 0.14), and what
    // replaces it is the confusion this question is actually about - a child
    // who thinks 1/5 is 0.5 finds it on the screen.
    choices: {
      count: 4,
      distractors: ['d == 2 ? 0.25 : 0.5', 'd <= 4 ? 0.2 : 0.25', 'd == 10 ? 0.2 : 0.1'],
    },
    tags: ['AC9M4N03', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.decimals.number-line-tenths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'What number is the arrow pointing to?',
    // Year 3 read tens off a line a hundred wide. This reads **tenths** off a
    // line one unit wide, which is what the year's own decimal notation is for
    // - and it is the first template in the catalog whose answer off a picture
    // is not a whole number.
    //
    // **`from` and `to` are pinned, and there is no choice about it.** Ten
    // tenths is the coarsest division a parent's 64px report row can carry, so
    // exactly one round line contains any given tenth: leaving the range open
    // draws the same window anyway for these values, and for a half it would
    // sometimes draw a 0-5 line read in halves, which is a different question.
    // Pinning says which question is being asked rather than leaving it to the
    // seed.
    //
    // **`k` is 1, 3, 7 or 9 so a small tick is always worth a tenth** - the
    // kind takes the *coarsest* legible division the arrow lands on, so an
    // offset of 2 or 5 would cut the same line into fifths or halves and ask a
    // different question of a child counting along. That is Year 3's rule for
    // its own line, one place further right, and it is what lets the hint below
    // say "one tenth" at all. Measured rather than reasoned: over all forty
    // reachable answers and sixty seeds each, every gap between two ticks came
    // out at exactly a tenth of the line, with no other value anywhere.
    //
    // **What varies for a fixed answer is the labelling**: the line is drawn
    // `w | w+1` on some seeds and `w | w+0.5 | w+1` on others, plus the tick
    // and arrow proportions the kind jitters continuously. Exactly two label
    // sets for every one of the forty answers - fewer than a whole-number line
    // gets, which is the cost of there being one legible window. The forty
    // answers each get their own stretch of number line, which is where the
    // variety a child meets actually comes from.
    vars: [
      { name: 'w', kind: 'int', min: '0', max: '9' },
      { name: 'k', kind: 'pick', from: [1, 3, 7, 9] },
      { name: 'n', kind: 'expr', expr: 'w + k / 10' },
    ],
    answer: 'n',
    hint: 'Each small tick is one tenth. Count them on from the number on the left.',
    figure: { kind: 'number-line', at: 'n', from: 'w', to: 'w + 1' },
    tags: ['AC9M4N01', 'MA2-RN-02'],
  },
  {
    id: 'maths.4.even-and-odd.is-odd',
    subject: 'maths',
    topic: 'even and odd',
    level: '4',
    prompt: 'True or false: {x} is an odd number.',
    vars: [{ name: 'x', kind: 'int', min: '10', max: '199' }],
    answer: 'isOdd(x)',
    tags: ['AC9M4N02', 'MA2-AR-01'],
  },
  {
    id: 'maths.4.even-and-odd.sum-parity',
    subject: 'maths',
    topic: 'even and odd',
    level: '4',
    prompt: 'True or false: {x} + {y} gives an even answer.',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '60' },
      { name: 'y', kind: 'int', min: '2', max: '60' },
    ],
    answer: 'isEven(x + y)',
    hint: 'Two odds make an even; an odd and an even make an odd.',
    tags: ['AC9M4N02', 'MA2-AR-01'],
  },
  {
    id: 'maths.4.even-and-odd.product-parity',
    subject: 'maths',
    topic: 'even and odd',
    level: '4',
    prompt: 'True or false: {x} × {y} gives an odd answer.',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '20' },
      { name: 'y', kind: 'int', min: '2', max: '20' },
    ],
    answer: 'isOdd(x * y)',
    hint: 'One even number anywhere in a product makes the answer even.',
    tags: ['AC9M4N02', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.fractions.equivalent',
    subject: 'maths',
    topic: 'fractions',
    level: '4',
    prompt: 'Complete the equivalent fraction: {a}/{d} = ?/{d * k}',
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '6' },
      { name: 'a', kind: 'int', min: '1', max: 'd - 1' },
      { name: 'k', kind: 'int', min: '2', max: '4' },
    ],
    answer: 'a * k',
    hint: 'The bottom was multiplied by {k}, so the top is too.',
    tags: ['AC9M4N03', 'MA2-PF-01'],
  },
  {
    id: 'maths.4.fractions.of-a-quantity',
    subject: 'maths',
    topic: 'fractions',
    level: '4',
    prompt: 'What is {n}/{d} of {total}?',
    vars: [
      { name: 'd', kind: 'pick', from: [3, 4, 5, 8, 10] },
      { name: 'part', kind: 'int', min: '2', max: '9' },
      { name: 'total', kind: 'expr', expr: 'd * part' },
      { name: 'n', kind: 'int', min: '2', max: 'd - 1' },
    ],
    answer: 'n * part',
    tags: ['AC9M4N03', 'MA2-PF-01'],
  },
  {
    id: 'maths.4.fractions.count-in-wholes',
    subject: 'maths',
    topic: 'fractions',
    level: '4',
    prompt: 'How many {d == 2 ? \'halves\' : d == 3 ? \'thirds\' : d == 4 ? \'quarters\' : d == 5 ? \'fifths\' : \'tenths\'} are there in {n} wholes?',
    vars: [
      { name: 'd', kind: 'pick', from: [2, 3, 4, 5, 10] },
      { name: 'n', kind: 'int', min: '2', max: '6' },
    ],
    answer: 'd * n',
    tags: ['AC9M4N04', 'MA2-PF-01'],
  },
  {
    id: 'maths.4.fractions.mixed-numeral',
    subject: 'maths',
    topic: 'fractions',
    level: '4',
    prompt: 'How many quarters are there in {n} and three quarters?',
    vars: [{ name: 'n', kind: 'int', min: '1', max: '8' }],
    answer: 'n * 4 + 3',
    hint: 'Each whole is 4 quarters.',
    tags: ['AC9M4N04', 'MA2-PF-01'],
  },
  {
    id: 'maths.4.fractions.same-as-half',
    subject: 'maths',
    topic: 'fractions',
    level: '4',
    // **Equivalence, which is what the year's fractions are about, asked as a
    // picture.** Year 3's shaded shape asked *how much* is shaded and answered
    // it in the words the parts were cut in. This one asks whether what is
    // shaded is a half, over shapes cut into four, six, eight and ten - so 3/6
    // and 4/8 have to be seen as the same amount as 1/2, which is the whole of
    // AC9M4N03 and the step Year 3 does not take.
    //
    // **True exactly half the time, by construction rather than by asking.**
    // `half` is a free pick and the numerator is derived from it, so nothing is
    // rejected and nothing skews - the failure mode the notes describe, where a
    // constraint easier to satisfy one way leaves a child a safer guess.
    //
    // The prompt is the same words on every draw, so there is no claim in the
    // sentence for a child to read the answer off: the picture is the only
    // place it lives.
    prompt: 'True or false: half of this shape is shaded.',
    vars: [
      { name: 'd', kind: 'pick', from: [4, 6, 8, 10] },
      { name: 'half', kind: 'pick', from: [1, 0] },
      // One part either side of a half when it is not a half. Two parts would
      // be a quarter out at four parts, which is a shape nobody has to count.
      { name: 'off', kind: 'pick', from: [1, -1] },
      { name: 'n', kind: 'expr', expr: 'half == 1 ? d / 2 : d / 2 + off' },
    ],
    answer: 'half == 1',
    hint: 'Count the equal parts, then count the shaded ones.',
    // `shape` is left open: the prompt says "this shape" and names nothing, so
    // whichever of the circle, the strip and the rectangle the builder reaches
    // for is an honest drawing of it. Every denominator here is even and so has
    // a factor pair - unlike Year 3's thirds and fifths, which have no
    // rectangle at all - so all three shapes are genuinely reachable.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['AC9M4N03', 'MA2-PF-01'],
  },
  {
    id: 'maths.4.multiplication.by-powers-of-ten',
    subject: 'maths',
    topic: 'multiplication',
    level: '4',
    prompt: 'What is {x} × {p}?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '99' },
      { name: 'p', kind: 'pick', from: [10, 100, 1000] },
    ],
    answer: 'x * p',
    hint: 'Every digit shifts up to the next place value.',
    tags: ['AC9M4N05', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.multiplication.facts',
    subject: 'maths',
    topic: 'multiplication',
    level: '4',
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '6', max: '10' },
      { name: 'y', kind: 'int', min: '6', max: '10' },
    ],
    answer: 'x * y',
    tags: ['AC9M4A02', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.multiplication.two-digit',
    subject: 'maths',
    topic: 'multiplication',
    level: '4',
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '11', max: '49' },
      { name: 'y', kind: 'int', min: '3', max: '9' },
    ],
    answer: 'x * y',
    hint: 'Split {x} into tens and ones, multiply each, then add.',
    tags: ['AC9M4N06', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.multiplication.array-more-rows',
    subject: 'maths',
    topic: 'multiplication',
    level: '4',
    // Year 2 read an array for its total and Year 3 read it for one of its
    // sides. This one asks for an array that is **not on the screen**: the
    // drawn rows are counted for their length, and then the multiplication is
    // done for a taller array than the one drawn. That is the point at which an
    // array stops being a thing to count and starts being a picture of what
    // multiplication does, which is where Stage 2 leaves it.
    //
    // **Neither dimension is in the sentence**, so both have to be counted off
    // the picture before the multiplying starts. Naming the row count in the
    // prompt - the first draft - left a child who ignored the drawing guessing
    // one number out of five and right 23% of the time. With both counts in the
    // picture only, the best a strategy that reads the sentence and never looks
    // at the drawing can do falls to 11%, measured over 4000 draws.
    prompt: 'How many dots would there be with {n} more {rows}?',
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '5' },
      { name: 'c', kind: 'int', min: '3', max: '7' },
      { name: 'n', kind: 'int', min: '1', max: '3' },
      // One more row, not "1 more rows".
      { name: 'rows', kind: 'expr', expr: "n == 1 ? 'row' : 'rows'" },
    ],
    answer: '(r + n) * c',
    hint: 'Count the rows, then the dots along one row. There would be {n} more {rows}.',
    // **`orientation` is pinned because the question is about rows.** Left to
    // jitter it transposes, so the child would count `c` rows of `r` dots and
    // add `n` rows of `r` - a different answer from the one this template
    // committed to, on about half of all draws. `answerIssues` cannot see it:
    // the answer is not spelled as either dimension, and the heuristic only
    // catches the direct spelling. The pin is a judgement about what the
    // question asks, which is the only thing that decides it.
    figure: { kind: 'array', rows: 'r', columns: 'c', orientation: "'rows'" },
    tags: ['AC9M4A02', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.division.by-powers-of-ten',
    subject: 'maths',
    topic: 'division',
    level: '4',
    prompt: 'What is {total} ÷ {p}?',
    vars: [
      { name: 'p', kind: 'pick', from: [10, 100] },
      { name: 'x', kind: 'int', min: '2', max: '99' },
      { name: 'total', kind: 'expr', expr: 'x * p' },
    ],
    answer: 'x',
    tags: ['AC9M4N05', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.division.facts',
    subject: 'maths',
    topic: 'division',
    level: '4',
    prompt: 'What is {total} ÷ {y}?',
    vars: [
      { name: 'y', kind: 'int', min: '6', max: '10' },
      { name: 'x', kind: 'int', min: '6', max: '10' },
      { name: 'total', kind: 'expr', expr: 'x * y' },
    ],
    answer: 'x',
    tags: ['AC9M4A02', 'MA2-MR-01'],
  },
  {
    id: 'maths.4.estimation.round-to-hundred',
    subject: 'maths',
    topic: 'estimation',
    level: '4',
    prompt: 'Round {x} to the nearest 100.',
    vars: [{ name: 'x', kind: 'int', min: '210', max: '9890' }],
    constraints: ['mod(x, 100) != 50', 'mod(x, 100) != 0'],
    answer: 'round(x / 100) * 100',
    tags: ['AC9M4N07', 'MA2-RN-01'],
  },
  {
    id: 'maths.4.estimation.rounded-sum',
    subject: 'maths',
    topic: 'estimation',
    level: '4',
    prompt: 'Estimate {a} + {b} by rounding each number to the nearest 10 first.',
    vars: [
      { name: 'a', kind: 'int', min: '21', max: '289' },
      { name: 'b', kind: 'int', min: '21', max: '289' },
    ],
    constraints: ['mod(a, 10) != 5', 'mod(b, 10) != 5'],
    answer: 'round(a / 10) * 10 + round(b / 10) * 10',
    tags: ['AC9M4N07', 'MA2-AR-01'],
  },
  {
    id: 'maths.4.algebra.unknown-value',
    subject: 'maths',
    topic: 'algebra',
    level: '4',
    prompt: 'What goes in the box? {total} − ? = {x}',
    vars: [
      { name: 'x', kind: 'int', min: '30', max: '400' },
      { name: 'y', kind: 'int', min: '20', max: '300' },
      { name: 'total', kind: 'expr', expr: 'x + y' },
    ],
    answer: 'y',
    tags: ['AC9M4A01', 'MA2-AR-02'],
  },
  {
    id: 'maths.4.number-patterns.nth-term',
    subject: 'maths',
    topic: 'number patterns',
    level: '4',
    prompt: 'The rule is: add {d}. Starting at {a}, what is the 5th number in the pattern?',
    vars: [
      { name: 'a', kind: 'int', min: '2', max: '40' },
      { name: 'd', kind: 'int', min: '3', max: '12' },
    ],
    answer: 'a + 4 * d',
    hint: '{a} is the 1st number, so add {d} four more times.',
    tags: ['AC9M4N09', 'MA2-AR-01'],
  },
  {
    id: 'maths.4.perimeter-and-area.rectangle-perimeter',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '4',
    prompt: 'A rectangle is {l} cm long and {w} cm wide. What is its perimeter, in centimetres?',
    vars: [
      { name: 'l', kind: 'int', min: '3', max: '20' },
      { name: 'w', kind: 'int', min: '2', max: '15' },
    ],
    answer: '2 * (l + w)',
    hint: 'Add up all four sides.',
    tags: ['AC9M4M02', 'MA2-GM-02'],
  },
  {
    id: 'maths.4.perimeter-and-area.rectangle-area',
    subject: 'maths',
    topic: 'perimeter and area',
    level: '4',
    prompt:
      'A rectangle is {l} squares long and {w} squares wide. How many squares cover it altogether?',
    vars: [
      { name: 'l', kind: 'int', min: '3', max: '12' },
      { name: 'w', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'l * w',
    tags: ['AC9M4M02', 'MA2-2DS-03'],
  },

  // Mass and capacity, and **all three are sentences with no figure, which is
  // the same decision Year 3 recorded and for the same reason.** Nothing in the
  // figure vocabulary draws a mass or a volume: `solid` draws one solid in an
  // oblique projection with no unit cubes in it, no dimensions on it and no
  // labels anywhere, so "how much does this hold?" has no answer on the screen,
  // and a solid hung beside a sentence that already carries the numbers would
  // be a picture a child has to learn to ignore.
  //
  // Year 3 converted *within* one unit pair - grams up to a kilogram, litres
  // down to millilitres. Year 4 carries **both units at once**, which is the
  // step AC9M4M01 is about: a mass written as kilograms *and* grams, and a
  // capacity in litres compared against one in millilitres.
  {
    id: 'maths.4.measurement.kilograms-and-grams',
    subject: 'maths',
    topic: 'measurement',
    level: '4',
    prompt: 'A parcel weighs {k} kilograms and {g} grams. What is its mass in grams?',
    vars: [
      { name: 'k', kind: 'int', min: '2', max: '9' },
      { name: 'g', kind: 'int', min: '50', max: '950', step: 50 },
    ],
    answer: 'k * 1000 + g',
    hint: 'One kilogram is 1000 grams.',
    tags: ['AC9M4M01', 'MA2-NSM-01'],
  },
  {
    id: 'maths.4.measurement.which-holds-more',
    subject: 'maths',
    topic: 'measurement',
    level: '4',
    prompt: 'A bottle holds {ml} millilitres and a jug holds {l} {litres}. Which holds more?',
    // **Which one wins is a free pick, so the answer is 50/50 exactly** and the
    // gap is drawn afterwards. Comparing two capacities and rejecting the draws
    // where one unit happens to win would leave whichever comparison is easier
    // to satisfy over-represented, which is the mistake the notes name.
    vars: [
      { name: 'l', kind: 'int', min: '1', max: '3' },
      { name: 'litres', kind: 'expr', expr: "l == 1 ? 'litre' : 'litres'" },
      { name: 'bigger', kind: 'pick', from: [1, 0] },
      { name: 'd', kind: 'int', min: '100', max: '900', step: 100 },
      { name: 'ml', kind: 'expr', expr: 'l * 1000 + (bigger == 1 ? d : 0 - d)' },
    ],
    answer: "bigger == 1 ? 'the bottle' : 'the jug'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'the bottle'", "'the jug'"] },
    hint: 'One litre is 1000 millilitres.',
    tags: ['AC9M4M01', 'MA2-3DS-02'],
  },
  {
    id: 'maths.4.measurement.share-a-bottle',
    subject: 'maths',
    topic: 'measurement',
    level: '4',
    // Year 3's jug question gave the size of a cup and asked how many there
    // were. This gives the number of glasses and asks how big each one is,
    // which is the other of the two divisions and the one that lands in
    // millilitres rather than in a count. Every glass size below divides 1000
    // exactly, so the answer is always a whole number of millilitres - built
    // that way rather than drawn and checked, so there is nothing for rejection
    // sampling to reject.
    prompt:
      'A {l} litre bottle of juice is shared equally between {c} glasses. How many millilitres are in each glass?',
    vars: [
      { name: 'l', kind: 'int', min: '1', max: '4' },
      { name: 'c', kind: 'pick', from: [2, 4, 5, 8, 10] },
    ],
    answer: 'l * 1000 / c',
    hint: 'The bottle holds {l * 1000} millilitres altogether.',
    tags: ['AC9M4M01', 'MA2-3DS-02'],
  },
  {
    id: 'maths.4.time.am-or-pm',
    subject: 'maths',
    topic: 'time',
    level: '4',
    prompt: 'A film starts at {h} o’clock in the {part}. Is that am or pm?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '11' },
      // Two of the three parts of the day are pm, so drawn flat "always tap
      // pm" answered this two draws in three - on a two-button question, which
      // is as close to free as an answer gets. The morning is weighted to make
      // the two buttons equally often right; naming three parts and meaning two
      // answers is what needs the correction, and it belongs here rather than
      // in a fourth part of the day nobody says.
      { name: 'part', kind: 'pick', from: ['morning', 'afternoon', 'evening'], weights: [2, 1, 1] },
    ],
    answer: "part == 'morning' ? 'am' : 'pm'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'am'", "'pm'"] },
    hint: 'am runs from midnight to midday.',
    tags: ['AC9M4M03', 'MA2-NSM-02'],
  },
  {
    id: 'maths.4.time.convert-minutes',
    subject: 'maths',
    topic: 'time',
    level: '4',
    prompt: 'How many minutes are there in {h} hours and {m} minutes?',
    vars: [
      { name: 'h', kind: 'int', min: '2', max: '6' },
      { name: 'm', kind: 'int', min: '5', max: '55', step: 5 },
    ],
    answer: 'h * 60 + m',
    tags: ['AC9M4M03', 'MA2-NSM-02'],
  },

  // Two clock faces, and **neither of them is a reading question.** Year 3
  // reads a face to the five minutes twice over, once for the whole digital
  // time and once for the minutes alone; repeating that here would be the same
  // question with a bigger year number on it. Year 4's own time content is
  // *duration* - AC9M4M03 is about how long something lasts - so both of these
  // read the face and then do arithmetic on what they read, which is the thing
  // a child cannot do until the reading is secure.
  //
  // Both pin `numerals` and `minuteTicks`, as Year 3's five-minute faces do and
  // for their reason: twenty-five past sits between the 4 and the 5, neither of
  // which the face ever numbers, so without the minute track there is nothing
  // to count round in fives along - and both hints say to do exactly that.
  {
    id: 'maths.4.time.until-the-hour-clock',
    subject: 'maths',
    topic: 'time',
    level: '4',
    // `maths.3.time.until-the-hour` asks this arithmetic with the minutes given
    // in the sentence. Here they are only on the face, so the reading is the
    // first half of the question and the sentence carries no number at all.
    prompt: 'How many minutes until the next o’clock?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      // From 1, so the face never shows an exact hour - "how many minutes until
      // the next o'clock" would then be a whole hour, which is not what a child
      // reading a minute hand is being asked.
      { name: 'mi', kind: 'int', min: '1', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
    ],
    answer: '60 - m',
    hint: 'Read the long hand first, then count round in 5s to the 12.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M4M03', 'MA2-NSM-02'],
  },
  {
    id: 'maths.4.time.after-minutes',
    subject: 'maths',
    topic: 'time',
    level: '4',
    prompt: 'What time will it be {n} minutes after the time shown?',
    // A duration that crosses the hour on **exactly** half of the 108
    // minute-and-duration pairs the two ranges below allow, so the hour on the
    // face is the hour in the answer half the time and is not the other half,
    // and a child who reads the short hand and stops is wrong as often as they
    // are right. The answer is a digital time, which the number pad cannot
    // type, so it is tapped.
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'mi', kind: 'int', min: '0', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      // Ten minutes to fifty, in fives: long enough to be worth counting and
      // short enough that the answer never runs past the next hour.
      { name: 'ni', kind: 'int', min: '2', max: '10' },
      { name: 'n', kind: 'expr', expr: 'ni * 5' },
      { name: 'tot', kind: 'expr', expr: 'm + n' },
      { name: 'h2', kind: 'expr', expr: 'tot >= 60 ? mod(h, 12) + 1 : h' },
      { name: 'm2', kind: 'expr', expr: 'mod(tot, 60)' },
      // Any other hour, and any other five-minute mark - stepped round rather
      // than drawn and rejected, so no draw is thrown away.
      { name: 'dh', kind: 'int', min: '1', max: '11' },
      { name: 'hn', kind: 'expr', expr: 'mod(h2 - 1 + dh, 12) + 1' },
      { name: 'dm', kind: 'int', min: '1', max: '11' },
      { name: 'mn', kind: 'expr', expr: 'mod(m2 / 5 + dm, 12) * 5' },
      // O'clock is written 4:00 and five past 4:05; only those two need the
      // nought.
      { name: 'ms', kind: 'expr', expr: "m2 < 10 ? '0' + m2 : '' + m2" },
      { name: 'mns', kind: 'expr', expr: "mn < 10 ? '0' + mn : '' + mn" },
    ],
    answer: "h2 + ':' + ms",
    answerType: 'choice',
    // The two hours crossed with the two minute readings, Year 3's four
    // options and for its reason: getting one half right narrows four to two
    // and never to one, so the other half is still a question.
    choices: {
      count: 4,
      distractors: ["hn + ':' + ms", "h2 + ':' + mns", "hn + ':' + mns"],
    },
    hint: 'Read the clock first, then count on {n} minutes from it.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M4M03', 'MA2-NSM-02'],
  },
  {
    id: 'maths.4.angles.larger-angle',
    subject: 'maths',
    topic: 'angles',
    level: '4',
    prompt: 'Which is the larger angle, {a} or {b}?',
    vars: [
      { name: 'a', kind: 'pick', from: ['acute', 'right', 'obtuse', 'straight'] },
      { name: 'b', kind: 'pick', from: ['acute', 'right', 'obtuse', 'straight'] },
      {
        name: 'ra',
        kind: 'expr',
        expr: "a == 'acute' ? 1 : a == 'right' ? 2 : a == 'obtuse' ? 3 : 4",
      },
      {
        name: 'rb',
        kind: 'expr',
        expr: "b == 'acute' ? 1 : b == 'right' ? 2 : b == 'obtuse' ? 3 : 4",
      },
    ],
    constraints: ['ra != rb'],
    answer: 'ra > rb ? a : b',
    answerType: 'choice',
    // The two options are the two names the prompt just read out, and the
    // answer is the larger of them by definition - the same declaration
    // `decimals.larger` above makes, for the same reason. It is stated here
    // only because the prediction check reaches word options where the rank
    // check cannot: sorted by size the answer is always the second of two, so
    // the option set does predict it, and what predicts it is the question
    // itself. A child still has to know that a straight angle beats an obtuse
    // one.
    choices: { count: 2, distractors: ['ra > rb ? b : a'], rankIsTheQuestion: true },
    hint: 'Smallest to largest: acute, right, obtuse, straight.',
    tags: ['AC9M4M04', 'MA2-GM-03'],
  },
  {
    id: 'maths.4.angles.is-acute',
    subject: 'maths',
    topic: 'angles',
    level: '4',
    prompt: "True or false: an angle of {n} quarter turn{n == 1 ? '' : 's'} is larger than a right angle.",
    vars: [{ name: 'n', kind: 'int', min: '1', max: '4' }],
    answer: 'n > 1',
    hint: 'One quarter turn is exactly a right angle.',
    tags: ['AC9M4M04', 'MA2-GM-03'],
  },
  {
    id: 'maths.4.angles.name-picture',
    subject: 'maths',
    topic: 'angles',
    level: '4',
    prompt: 'What kind of angle is this?',
    vars: [
      { name: 'kind', kind: 'pick', from: ['acute', 'right', 'obtuse', 'straight'] },
      // Both bands are held clear of the two angles that are also *options*
      // here: 25 degrees off the right angle and 20 off the straight one, the
      // same clearances the two-way questions at Year 3 and Year 4 take. This
      // is the hardest of the angle questions - four names, no right-angle
      // tick to give the square corner away, and a rotation that leaves
      // nothing upright to judge against - so it is the one that can least
      // afford an acute angle ten degrees off square.
      { name: 'small', kind: 'int', min: '15', max: '65', step: 5 },
      { name: 'large', kind: 'int', min: '115', max: '160', step: 5 },
      {
        name: 'd',
        kind: 'expr',
        expr: "kind == 'acute' ? small : kind == 'right' ? 90 : kind == 'obtuse' ? large : 180",
      },
    ],
    answer: 'kind',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ["'acute'", "'right'", "'obtuse'", "'straight'"],
    },
    hint: 'Smallest to largest: acute, right, obtuse, straight.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M4M04', 'MA2-GM-03'],
  },
  {
    id: 'maths.4.angles.is-obtuse',
    subject: 'maths',
    topic: 'angles',
    level: '4',
    prompt: 'True or false: this angle is obtuse.',
    vars: [{ name: 'd', kind: 'int', min: '15', max: '170', step: 5 }],
    constraints: ['abs(d - 90) >= 20'],
    answer: 'd > 90',
    hint: 'An obtuse angle is bigger than a right angle and smaller than a straight one.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M4M04', 'MA2-GM-03'],
  },
  {
    id: 'maths.4.symmetry.lines',
    subject: 'maths',
    topic: 'symmetry',
    level: '4',
    prompt: 'How many lines of symmetry does {article} {shape} have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['square', 'rectangle', 'equilateral triangle', 'regular pentagon', 'regular hexagon'],
      },
      { name: 'article', kind: 'expr', expr: "shape == 'equilateral triangle' ? 'an' : 'a'" },
    ],
    answer:
      "shape == 'square' ? 4 : shape == 'rectangle' ? 2 : shape == 'equilateral triangle' ? 3 : shape == 'regular pentagon' ? 5 : 6",
    hint: 'A regular shape has as many lines of symmetry as it has sides.',
    tags: ['AC9M4SP03', 'MA2-2DS-02'],
  },
  {
    id: 'maths.4.symmetry.dashed-line',
    subject: 'maths',
    topic: 'symmetry',
    level: '4',
    prompt: 'True or false: the dashed line is a line of symmetry.',
    vars: [
      { name: 'real', kind: 'pick', from: [1, 0] },
      // Every shape here has at least one axis, so the true case is always
      // drawable, and none is rounder than a hexagon, so the false case's line
      // is far enough off a real axis to be seen - a heptagon's wrong line
      // lands eleven degrees out, which is a picture with no answer in it.
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'equilateral',
          'isosceles',
          'trapezium',
          'kite',
          'square',
          'rectangle',
          'rhombus',
          'pentagon',
          'hexagon',
        ],
      },
    ],
    answer: 'real == 1',
    hint: 'Fold along the line: would the two halves land on top of each other?',
    figure: { kind: 'polygon', shape: 'shape', mirror: 'real == 1' },
    tags: ['AC9M4SP03', 'MA2-2DS-02'],
  },
  {
    id: 'maths.4.symmetry.count-picture',
    subject: 'maths',
    topic: 'symmetry',
    level: '4',
    prompt: 'How many lines of symmetry does this shape have?',
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: [
          'scalene',
          'right-triangle',
          'parallelogram',
          'isosceles',
          'trapezium',
          'kite',
          'rectangle',
          'rhombus',
          'equilateral',
          'square',
          'pentagon',
          'hexagon',
        ],
      },
    ],
    // None, one, two, then the regular shapes, which have one per side. Zero is
    // an answer the number pad can give, and a shape with no symmetry at all is
    // the case the worded version of this question never gets to ask.
    answer:
      "shape == 'scalene' || shape == 'right-triangle' || shape == 'parallelogram' ? 0 : " +
      "shape == 'isosceles' || shape == 'trapezium' || shape == 'kite' ? 1 : " +
      "shape == 'rectangle' || shape == 'rhombus' ? 2 : shape == 'equilateral' ? 3 : " +
      "shape == 'square' ? 4 : shape == 'pentagon' ? 5 : 6",
    hint: 'A regular shape has one for every side, and some shapes have none at all.',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M4SP03', 'MA2-2DS-02'],
  },

  // Solids, and **the hard half of a net.** Year 3 counted a net's faces, which
  // is the one thing a net makes *easier* than an object - every face is laid
  // out in front of you. Its edges and its corners are the other way round:
  // two edges of the flat shape become one edge of the solid, and three or four
  // corners fold into one, so counting the pieces gets the wrong answer and the
  // child has to imagine the fold. That is the Stage 2 three-dimensional
  // outcome MA2-3DS-01 at the end of the stage rather than the start of it.
  //
  // **Three solids, not four, and the cuboid is what is left out.** Its net is
  // the cube's with the squares stretched, which at the size a parent's report
  // row draws one is a question about proportion rather than about shape - Year
  // 3's reason for leaving it out of its own net question. It would also give
  // the same answer as the cube to all three questions below, so a fourth of
  // every draw would be a picture with a duplicate answer behind it. With it
  // gone each of the three questions has three answers, one per solid, drawn
  // flat.
  //
  // **The ACARA citation is a judgement.** Nets are written down at Year 3
  // (AC9M3SP01) and Year 4's Space descriptions are composite shapes and
  // objects, grid references and symmetry; AC9M4SP01 is the one that speaks
  // about objects in two and three dimensions at all, and a net is a solid's
  // two-dimensional representation, so it is what these cite. NSW is
  // unambiguous either way: MA2-3DS-01 is one outcome covering Years 3 and 4,
  // and nets are named in it.
  {
    id: 'maths.4.shapes.net-edges',
    subject: 'maths',
    topic: 'shapes',
    level: '4',
    prompt: 'This is a net. How many edges will the folded shape have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'square-pyramid', 'triangular-prism'] },
    ],
    answer: "shape == 'cube' ? 12 : shape == 'square-pyramid' ? 8 : 9",
    hint: 'Every edge of the folded shape is where two flat pieces meet.',
    // Pinned, because the prompt says "this is a net" - the one field a jitter
    // can change that the sentence has already committed to.
    figure: { kind: 'solid', solid: 'shape', view: "'net'" },
    tags: ['AC9M4SP01', 'MA2-3DS-01'],
  },
  {
    id: 'maths.4.shapes.net-corners',
    subject: 'maths',
    topic: 'shapes',
    level: '4',
    // The same three nets read for a different count, and the two are not one
    // question twice: a cube has twelve edges and eight corners, a pyramid
    // eight and five, a prism nine and six, so nothing a child works out for
    // one of them carries over to the other.
    prompt: 'This is a net. How many corners will the folded shape have?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'square-pyramid', 'triangular-prism'] },
    ],
    answer: "shape == 'cube' ? 8 : shape == 'square-pyramid' ? 5 : 6",
    hint: 'Several corners of the flat pieces fold together into one corner.',
    figure: { kind: 'solid', solid: 'shape', view: "'net'" },
    tags: ['AC9M4SP01', 'MA2-3DS-01'],
  },
  {
    id: 'maths.4.shapes.triangular-faces',
    subject: 'maths',
    topic: 'shapes',
    level: '4',
    // Year 3 asked whether a solid has a triangular face at all. Counting them
    // is the harder version of the same classifying question, and it is the one
    // that separates a pyramid from a prism: four triangles round a square
    // against two triangles at the ends.
    prompt: 'How many of this shape’s faces are triangles?',
    vars: [
      { name: 'shape', kind: 'pick', from: ['cube', 'square-pyramid', 'triangular-prism'] },
    ],
    answer: "shape == 'cube' ? 0 : shape == 'square-pyramid' ? 4 : 2",
    hint: 'Look at every face, including the ones round the back.',
    // **`view` is pinned to the object**, and left open it would jitter into a
    // net about half the time. "This shape's faces" is a sentence about a
    // solid; a pyramid's net *is* a flat shape with triangles in it, and asking
    // how many faces that has is a different and muddier question.
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M4SP01', 'MA2-3DS-01'],
  },

  // Where something is on a map. Year 3 read a grid reference and stepped one
  // square from it along a single axis; Year 4 steps **two ways at once**, and
  // asks a question whose answer is not on the grid's labels at all.
  //
  // **These are grid maps, not the coordinate plane.** `onLines: 'true'` marks
  // an intersection and is answered `(2,3)`, which is the Stage 3 reading: NSW
  // puts the first-quadrant plane at MA3-GM-01 and ACARA does not build a
  // coordinate system until Year 5. So both of these mark a *cell*, and Years 5
  // and 6 are where the plane belongs.
  //
  // What is pinned differs between the two, and it follows from the answer.
  // `grid-diagonal` names a square, so `axisLabels` decides the spelling of its
  // answer and has to be pinned, and its extent is bound to a band rather than
  // to a literal so the picture still varies. `grid-to-the-edge` answers a
  // count, which no notation changes, so it can leave `axisLabels` and `rows`
  // open and keep both of the kind's levers.
  //
  // **A grid's option labels carry an order, and a directional prompt can pin
  // it.** `A1` to `C3` sort, and neither enforced leak check can see it: the
  // rank check wants every option to be a number, and the option-set check
  // stands down above eight distinct answers, which a three-by-three grid
  // clears by one. `grid-diagonal` below shipped broken on exactly that, and
  // the comment at it says what the fix was.
  {
    id: 'maths.4.position.grid-diagonal',
    subject: 'maths',
    topic: 'position',
    level: '4',
    prompt: 'Which square is one square {ew} and one square {ns} from the dot?',
    // **The four buttons offer the same four squares on every draw, and the
    // dot is what moves.** This is the second version of this template; the
    // first was answerable without looking at the picture at all, so the reason
    // is written down here rather than left as a shape to copy.
    //
    // That version offered the two-by-two block the dot sat in a corner of and
    // answered the opposite corner. Every option label carries an order - A
    // before B before C along the bottom, 1 below 2 below 3 up the side - and
    // the prompt names both directions, so "take the later letter when it says
    // to the right and the larger number when it says up" named the answer
    // **every single time**: 4000 of 4000 draws with the picture ignored,
    // against a 25% blind baseline. Nothing catches that. The rank check needs
    // every option to be a number and `B3` is not one; the option-set check
    // needs eight distinct answers or fewer, and the nine squares of a
    // three-by-three grid are one too many.
    //
    // So the block is fixed at the middle four squares - B2, B3, C2 and C3 -
    // and the **dot** is what varies, one diagonal step back from the answer,
    // which puts it in any of sixteen places. Given the four buttons and both
    // direction words, all four squares are still possible, because which of
    // them is one step from the dot is a fact about the picture and about
    // nothing else. The same strategy now scores what a guess scores.
    vars: [
      // The answer, drawn first, and always one of the four squares the buttons
      // offer. Columns and rows 2 and 3 rather than 1 and 2: a block touching
      // column 1 could only ever be stepped into from the right, and that
      // correlation between a direction word and the answer's place in the
      // block is the whole of what went wrong the first time.
      { name: 'ac', kind: 'int', min: '2', max: '3' },
      { name: 'ar', kind: 'int', min: '2', max: '3' },
      { name: 'across', kind: 'pick', from: [1, -1] },
      { name: 'up', kind: 'pick', from: [1, -1] },
      { name: 'c', kind: 'expr', expr: 'ac - across' },
      { name: 'r', kind: 'expr', expr: 'ar - up' },
      { name: 'ew', kind: 'expr', expr: "across == 1 ? 'to the right' : 'to the left'" },
      { name: 'ns', kind: 'expr', expr: "up == 1 ? 'up' : 'down'" },
      // Wide and tall enough for the dot, which lands outside the block on two
      // of its four sides. Every option sits inside three by three, so no
      // distractor can be ruled out for being off the grid however small the
      // drawn one is - the rule the band exists for.
      { name: 'cols', kind: 'int', min: 'max(3, c)', max: '5' },
      { name: 'rws', kind: 'int', min: 'max(3, r)', max: '5' },
    ],
    // A square is written B3, which the number pad cannot type - so it is
    // tapped. The answer is spelled through `columnLetter` so it reads in the
    // notation the grid draws; the options are written out because they are the
    // same four every time.
    answer: `(${columnLetter('ac')}) + ar`,
    answerType: 'choice',
    choices: { count: 4, distractors: ["'B2'", "'B3'", "'C2'", "'C3'"] },
    hint: 'Find the square the dot is in, then move one square across and one up or down.',
    figure: {
      kind: 'grid',
      at: "c + ',' + r",
      columns: 'cols',
      rows: 'rws',
      axisLabels: "'letters'",
      onLines: 'false',
    },
    tags: ['AC9M4SP02', 'MA2-GM-01'],
  },
  {
    id: 'maths.4.position.grid-to-the-edge',
    subject: 'maths',
    topic: 'position',
    level: '4',
    // **Nothing in the sentence narrows the answer.** How far the dot is from
    // the right-hand edge depends on the dot *and* on how wide the grid is, and
    // neither number is written anywhere but the picture - so a child who
    // ignores the drawing has nothing at all to go on, which is the strongest
    // form of what the whole figure subsystem is for.
    prompt: 'How many squares would you move right to get from the dot to the last column?',
    // The gap is picked first and the grid built round it, so all four answers
    // come up equally often. Drawing a column and a width and subtracting makes
    // the small gaps far commoner - the mistake Year 3 measured on its picture
    // graph and fixed the same way.
    vars: [
      { name: 'gap', kind: 'int', min: '1', max: '4' },
      { name: 'cols', kind: 'int', min: 'max(3, gap + 1)', max: '5' },
      { name: 'c', kind: 'expr', expr: 'cols - gap' },
      { name: 'r', kind: 'int', min: '1', max: '3' },
    ],
    answer: 'gap',
    hint: 'Count the squares from the dot along to the end of its row.',
    // `rows` and `axisLabels` are both left open. The answer is a count of
    // squares, which reads the same whether the columns are lettered or
    // numbered and however tall the grid is, so both of the kind's levers stay
    // free - which is what makes up for `columns` having to be pinned so the
    // template knows how wide the grid it is asking about will be.
    figure: { kind: 'grid', at: "c + ',' + r", columns: 'cols', onLines: 'false' },
    tags: ['AC9M4SP02', 'MA2-GM-01'],
  },
  {
    id: 'maths.4.data.many-to-one',
    subject: 'maths',
    topic: 'data',
    level: '4',
    prompt: 'On a pictograph each picture stands for {k} children. How many children do {n} pictures show?',
    vars: [
      { name: 'k', kind: 'pick', from: [2, 5, 10] },
      { name: 'n', kind: 'int', min: '3', max: '12' },
    ],
    answer: 'k * n',
    tags: ['AC9M4ST01'],
  },

  // Graphs, and Year 4 is where the **many-to-one scale** arrives - one picture
  // standing for several things, and an axis climbing in tens. It is what
  // AC9M4ST01 names outright, and the worded template above has asked it
  // without a picture since before any of this existed.
  //
  // **`data.many-to-one` above and `data.picture-key` below both cite ACARA
  // alone, deliberately.** NSW places many-to-one scales at Stage 3, which is
  // where Year 5's two picture graphs pick the convention up, so an MA2-DATA
  // code on a graph whose key says five would be a citation the curriculum page
  // presents as checkable and which would not check out. The one shipped
  // exception, `maths.2.data.picture-key-two`, earns its Stage 1 code with an
  // argument about counting in twos being core content that year; Year 3
  // declined to take it and there is no equivalent argument here, because at
  // Year 4 the convention itself is the content rather than a way of counting.
  // So both key questions stay ACARA-only, which is the route
  // the notes describe. They are the only two templates in the year without an
  // NSW code.
  //
  // **A column graph's axis scale is a different thing and keeps both codes.**
  // Year 3 shipped a scale of five up the side citing MA2-DATA-02, since
  // reading a column against a numbered axis is Stage 2 whatever the axis
  // counts in. Ten is the step past it, and the third graph reads a column that
  // lands *between* two rungs, which no year has asked before.
  //
  // Category names are three characters because the budget is: an axis reaching
  // 50 prints a two-character rung, which leaves three characters a name across
  // three categories. Every graph here was built and its issues read rather
  // than counted against a table.
  {
    id: 'maths.4.data.picture-key',
    subject: 'maths',
    topic: 'data',
    level: '4',
    // The key is stated in the prompt as well as drawn beside the icon, because
    // the graph's own key draws a picture and a number and cannot say two
    // *what*.
    prompt: 'Each picture stands for {k} books. How many books did {who} read?',
    // Four icons is the most a three-character row label leaves room for, so
    // the counts are one to four icons' worth and the key is what makes them
    // big. `halves` is left off, so every count is a whole number of icons by
    // construction and no row is drawn as a rounded-off neighbour of another.
    vars: [
      { name: 'k', kind: 'pick', from: [2, 5, 10] },
      { name: 'ia', kind: 'int', min: '1', max: '4' },
      { name: 'ib', kind: 'int', min: '1', max: '4' },
      { name: 'ic', kind: 'int', min: '1', max: '4' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
      { name: 'icons', kind: 'expr', expr: 'i == 0 ? ia : i == 1 ? ib : ic' },
    ],
    answer: 'icons * k',
    hint: 'Count the pictures in that row, then count on in {k}s.',
    figure: {
      kind: 'pictograph',
      counts: "(ia * k) + ',' + (ib * k) + ',' + (ic * k)",
      labels: "'Ada,Kai,Leo'",
      key: 'k',
    },
    tags: ['AC9M4ST01'],
  },
  {
    id: 'maths.4.data.graph-scale-ten',
    subject: 'maths',
    topic: 'data',
    level: '4',
    prompt: 'This graph shows points scored. How many more did {a} score than {b}?',
    // Every value is a multiple of ten and the scale is pinned to ten, so the
    // numbers up the side read 0, 10, 20, 30, 40, 50 and every column lands on
    // one of them. A column stopping between two rungs is a column nobody can
    // read a number off - except deliberately, which is the next template.
    //
    // **The taller of the two named columns is at least 20 by construction**,
    // since it is the smaller plus a difference of at least one ten. An axis of
    // a single step is refused outright, and `figureIssues` is sampled over
    // fifty seeds - so a template that merely made 10,10,10 *unlikely* would
    // validate by luck and ship. Every reachable combination was built and
    // read, not sampled.
    //
    // **The difference is picked first and the two columns built from it**, so
    // each of the four answers comes up equally often. Drawing two values and
    // subtracting makes the small gaps far the commonest, which teaches a child
    // to answer "10" rather than to read the graph.
    vars: [
      { name: 'diff', kind: 'int', min: '1', max: '4' },
      { name: 'lo', kind: 'int', min: '1', max: '5 - diff' },
      { name: 'hi', kind: 'expr', expr: 'lo + diff' },
      { name: 'third', kind: 'int', min: '1', max: '5' },
      // Which two of the three columns are compared moves as well as the values
      // in them, so the question is never the same pair twice running - and the
      // third column, which is never named, takes whatever is left over.
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'k', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 3)' },
      { name: 'ada', kind: 'expr', expr: '(i == 0 ? hi : j == 0 ? lo : third) * 10' },
      { name: 'kai', kind: 'expr', expr: '(i == 1 ? hi : j == 1 ? lo : third) * 10' },
      { name: 'leo', kind: 'expr', expr: '(i == 2 ? hi : j == 2 ? lo : third) * 10' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
      { name: 'b', kind: 'expr', expr: "j == 0 ? 'Ada' : j == 1 ? 'Kai' : 'Leo'" },
    ],
    answer: 'diff * 10',
    hint: 'The numbers up the side go up in 10s. Read both columns, then subtract.',
    figure: {
      kind: 'bar',
      values: "ada + ',' + kai + ',' + leo",
      labels: "'Ada,Kai,Leo'",
      scale: '10',
      style: "'column'",
    },
    tags: ['AC9M4ST01', 'MA2-DATA-02'],
  },
  {
    id: 'maths.4.data.graph-between-rungs',
    subject: 'maths',
    topic: 'data',
    level: '4',
    // **A column that stops halfway between two numbers**, which is the
    // partial-unit reading AC9M4M01 names and which every graph in the catalog
    // before this one carefully avoided. The axis climbs in twos and every
    // value is odd, so no column lands on a rung at all and a child who can
    // only read the labelled numbers has nothing to read.
    //
    // All three columns are odd rather than only the one asked about: with a
    // single odd column among even ones, "the answer is the odd one" would be a
    // pattern worth learning, and it is not one about graphs.
    prompt: 'How many goals did {who} score?',
    vars: [
      { name: 'x', kind: 'pick', from: [3, 5, 7, 9] },
      { name: 'y', kind: 'pick', from: [3, 5, 7, 9] },
      { name: 'z', kind: 'pick', from: [3, 5, 7, 9] },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'" },
    ],
    answer: 'i == 0 ? x : i == 1 ? y : z',
    hint: 'The numbers up the side go up in 2s, so a column can stop halfway between two of them.',
    figure: {
      kind: 'bar',
      values: "x + ',' + y + ',' + z",
      labels: "'Ada,Kai,Leo'",
      scale: '2',
      style: "'column'",
    },
    tags: ['AC9M4ST01', 'MA2-DATA-02'],
  },
  {
    id: 'maths.4.data.dot-graph-who',
    subject: 'maths',
    topic: 'data',
    level: '4',
    // The graph read backwards - given a number, find whose it is - on the
    // kind's other style and against a scale of five. Year 3 read a dot graph
    // forwards at a scale of one and read a column graph backwards at a scale
    // of one; this is the two halves put together, which is what makes it more
    // than either of them again.
    prompt: 'Who collected {v} shells?',
    // All three different, so exactly one child answers - and the largest is
    // then at least three fives, so the axis is never a single step.
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '5' },
      { name: 'y', kind: 'int', min: '1', max: '5' },
      { name: 'z', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'v', kind: 'expr', expr: '(i == 0 ? x : i == 1 ? y : z) * 5' },
    ],
    constraints: ['x != y', 'y != z', 'x != z'],
    answer: "i == 0 ? 'Ada' : i == 1 ? 'Kai' : 'Leo'",
    answerType: 'choice',
    // The same three buttons every draw, so the option set says nothing, and
    // the child asked about is drawn flat, so the answer lands on each of them
    // equally.
    choices: { count: 3, distractors: ["'Ada'", "'Kai'", "'Leo'"] },
    // "The dot" is only true because the style is pinned: left open the kind
    // draws a column about half the time.
    hint: 'The numbers up the side go up in 5s. Find the dot at {v}, then read the name under it.',
    figure: {
      kind: 'bar',
      values: "x * 5 + ',' + y * 5 + ',' + z * 5",
      labels: "'Ada,Kai,Leo'",
      scale: '5',
      style: "'dot'",
    },
    tags: ['AC9M4ST01', 'MA2-DATA-02'],
  },
  {
    id: 'maths.4.chance.least-likely',
    subject: 'maths',
    topic: 'chance',
    level: '4',
    prompt:
      'A bag holds {r} red, {b} blue and {g} green marbles. Which colour are you least likely to pull out?',
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '20' },
      { name: 'b', kind: 'int', min: '2', max: '20' },
      { name: 'g', kind: 'int', min: '2', max: '20' },
    ],
    constraints: ['r != b', 'b != g', 'r != g'],
    answer: "r < b && r < g ? 'red' : b < g ? 'blue' : 'green'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'red'", "'blue'", "'green'"] },
    tags: ['AC9M4P01', 'MA2-CHAN-01'],
  },

  // Chance, and Year 4 is the year with four of them - the only one that has.
  // Two are spinners and two are sentences, and between them they cover the two
  // things Year 4 chance is: naming a likelihood on the continuum from unlikely
  // to certain (AC9M4P01), and what a run of trials actually produced
  // (AC9M4P02).
  //
  // Both spinners emit **no `label` marks at all**, so they carry no text
  // whatsoever: the fill names below are grouping keys that never reach the
  // screen, and the prompts say "shaded", never a colour. The first-named group
  // is the shaded one.
  {
    id: 'maths.4.chance.spinner-how-likely',
    subject: 'maths',
    topic: 'chance',
    level: '4',
    // **The continuum, which is the Year 4 step.** Years 1 to 3 compare two
    // outcomes and say which is likelier; AC9M4P01 asks for the *word* - and
    // the four words are an order, so getting one wrong by a place is a
    // different mistake from getting it wrong by three.
    //
    // Eight equal parts, with two, four, six or all eight shaded, so counting
    // the shaded parts is a method that works here. That is deliberate and it
    // is the opposite of the spinner below it, where the parts are different
    // sizes and counting them is exactly the wrong thing to do. A child who
    // meets only one of the two learns half a rule.
    //
    // **The continuum's fifth word, "impossible", is not among the options and
    // cannot be**: an unshaded whole disc has no shaded group to name, so the
    // kind cannot draw one. Four words is what the picture supports, and
    // `MAX_CHOICES` is four in any case.
    prompt: 'How likely is the arrow to stop on a shaded part?',
    vars: [{ name: 's', kind: 'pick', from: [2, 4, 6, 8] }],
    answer: "s == 2 ? 'unlikely' : s == 4 ? 'even chance' : s == 6 ? 'likely' : 'certain'",
    answerType: 'choice',
    // The same four buttons whatever was drawn, so the option set never says
    // which one it is - and the flat pick puts the answer on each of them
    // equally often.
    choices: {
      count: 4,
      distractors: ["'unlikely'", "'even chance'", "'likely'", "'certain'"],
    },
    hint: 'Compare how much of the spinner is shaded with how much is not.',
    figure: {
      kind: 'spinner',
      sectors: "'1,1,1,1,1,1,1,1'",
      fills:
        "s == 2 ? 'a,a,b,b,b,b,b,b' : s == 4 ? 'a,a,a,a,b,b,b,b' : " +
        "s == 6 ? 'a,a,a,a,a,a,b,b' : 'a,a,a,a,a,a,a,a'",
    },
    tags: ['AC9M4P01', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.4.chance.spinner-even-chance',
    subject: 'maths',
    topic: 'chance',
    level: '4',
    // **Equally likely, judged by area rather than by counting.** Year 3's
    // uneven spinner asks which side is likelier; this asks whether the two
    // sides are the *same*, which is the harder half of the same idea and the
    // one the word "even chance" above depends on.
    prompt: 'True or false: the arrow is equally likely to stop on shading as on no shading.',
    // **True exactly half the time, by construction.** `same` is a free pick
    // and the shaded share is derived from it, so nothing is rejected and
    // nothing skews.
    //
    // One side is always drawn as a single sector and the other as two, and
    // **which side that is, is a second free pick** - so the number of shaded
    // sectors is one or two regardless of the answer, and a child counting
    // sectors is right exactly as often as a child guessing. Only the sizes
    // help.
    //
    // The gap is one part out of eight when the two sides differ: half of eight
    // parts is a straight line across the disc, and one part off it is visibly
    // not straight without being so far out that nobody has to look.
    vars: [
      { name: 'same', kind: 'pick', from: [1, 0] },
      { name: 'off', kind: 'pick', from: [1, -1] },
      { name: 'sh', kind: 'expr', expr: 'same == 1 ? 4 : 4 + off' },
      { name: 'pl', kind: 'expr', expr: '8 - sh' },
      { name: 'g', kind: 'pick', from: [1, 0] },
      { name: 'p', kind: 'int', min: '1', max: 'g == 1 ? pl - 1 : sh - 1' },
    ],
    answer: 'same == 1',
    hint: 'It is how much of the spinner is shaded that matters, not how many parts there are.',
    figure: {
      kind: 'spinner',
      sectors: "g == 1 ? (sh + ',' + p + ',' + (pl - p)) : (p + ',' + (sh - p) + ',' + pl)",
      fills: "g == 1 ? 'a,b,b' : 'a,a,b'",
    },
    tags: ['AC9M4P01', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.4.chance.after-taking-one',
    subject: 'maths',
    topic: 'chance',
    level: '4',
    // **A dependent event**, which AC9M4P01 names and which nothing in the
    // catalog had asked: every chance question before this one is about a bag
    // that has not been touched. Taking a counter out and keeping it changes
    // what is left, and which way it changes is the whole question.
    //
    // No figure. What is being described is two moments of a bag rather than a
    // thing to look at, and with nothing drawn, naming the colours in words is
    // honest - the rule about a prompt naming only what the figure draws binds
    // a template that *has* one.
    //
    // The prompt offers its two options out loud, which a sentence question may
    // and a figure question may not: with them named as alternatives inside one
    // sentence, narration reads the prompt and stops rather than following it
    // with "Is it more likely or less likely?" - the same words twice, before a
    // child who cannot read gets to the buttons.
    prompt:
      'A bag holds {r} red and {b} blue counters. You take out a {c} one and keep it. Is a red one now more likely or less likely?',
    // Which colour is taken is a free pick, so the answer is 50/50 exactly.
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '9' },
      { name: 'b', kind: 'int', min: '2', max: '9' },
      { name: 'c', kind: 'pick', from: ['red', 'blue'] },
    ],
    answer: "c == 'red' ? 'less likely' : 'more likely'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'more likely'", "'less likely'"] },
    hint: 'There is one counter fewer in the bag now. Which colour lost one?',
    tags: ['AC9M4P01', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.4.chance.experiment-three-outcomes',
    subject: 'maths',
    topic: 'chance',
    level: '4',
    // The repeated experiment at three outcomes, where Year 3's had two:
    // AC9M4P02 is about conducting trials and describing what varied, and three
    // outcomes is where "the rest" stops being a subtraction a child can do
    // without noticing.
    prompt:
      'A spinner was spun {t} times. It stopped on red {r} times and on blue {b} times. The rest were green. How many were green?',
    vars: [
      { name: 't', kind: 'int', min: '30', max: '60', step: 10 },
      // Never fewer than five of anything: a run of forty spins with one green
      // in it is not a chance experiment a child should be shown as ordinary.
      { name: 'r', kind: 'int', min: '5', max: 't - 15' },
      { name: 'b', kind: 'int', min: '5', max: 't - r - 5' },
    ],
    answer: 't - r - b',
    hint: 'Every spin was red, blue or green.',
    tags: ['AC9M4P02', 'MA2-CHAN-01'],
  },
];
