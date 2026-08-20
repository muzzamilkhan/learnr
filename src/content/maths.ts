import type { Expr, QuestionTemplate } from '@/lib/templates/types';

/**
 * Name of the day `i` steps around the week, where `i` is an expression giving
 * 0 for Monday. Written once because the day questions need four of them each:
 * the answer plus its neighbours as distractors.
 */
const dayName = (i: Expr): Expr =>
  `${i} == 0 ? 'Monday' : ${i} == 1 ? 'Tuesday' : ${i} == 2 ? 'Wednesday' : ` +
  `${i} == 3 ? 'Thursday' : ${i} == 4 ? 'Friday' : ${i} == 5 ? 'Saturday' : 'Sunday'`;

/** Name of the polygon with `i` sides, for `i` an expression giving 3 to 6. */
const shapeName = (i: Expr): Expr =>
  `${i} == 3 ? 'triangle' : ${i} == 4 ? 'square' : ${i} == 5 ? 'pentagon' : 'hexagon'`;

/**
 * How many sides the polygon named by the expression `s` has, across the whole
 * shape vocabulary `src/lib/figures` can draw. Written once because the picture
 * questions want the same count three ways: as the answer to "how many sides",
 * as the answer to "how many corners" - a polygon has exactly one corner per
 * side - and as the number a true/false claim is checked against. Anything that
 * is not a named triangle or a 5-to-8-sided polygon is a quadrilateral, which
 * is the entire rest of that vocabulary.
 */
const sideCount = (s: Expr): Expr =>
  `${s} == 'equilateral' || ${s} == 'isosceles' || ${s} == 'scalene' || ` +
  `${s} == 'right-triangle' ? 3 : ${s} == 'pentagon' ? 5 : ${s} == 'hexagon' ? 6 : ` +
  `${s} == 'heptagon' ? 7 : ${s} == 'octagon' ? 8 : 4`;

/**
 * Maths course, Kindergarten to Year 6.
 *
 * Content is written against the Australian Curriculum v9.0 (ACARA), using the
 * official "Mathematics scope and sequence F-10" as the source. Every template
 * carries the content description code it practises in `tags` - e.g.
 * `AC9M4N02`, "explain and use the properties of odd and even numbers" - so the
 * mapping from curriculum to question is checkable rather than asserted. The
 * codes read as AC9 M <year> <strand> <number>, where the strands are N number,
 * A algebra, M measurement, SP space, ST statistics and P probability.
 *
 * Note how topics recur across years rather than belonging to one: "counting
 * numbers" runs from K into Year 1, "fractions" from Year 2 into Year 6, and so
 * on. The year says how hard; the topic says what skill.
 *
 * Two rules every template here obeys:
 *
 * - **A question may be a picture, and the picture is generated.** The shape,
 *   symmetry and angle questions carry a `figure` (see `src/lib/figures`), built
 *   from the same bound scope and the same seeded `Rng` as the prompt around it.
 *   None of them pins a rotation: an answer that always drew the same diagram
 *   would teach the diagram, and `validateTemplate` fails a template that does.
 *   What still cannot be drawn - number lines, bar and picture graphs, clock
 *   faces - is left out rather than faked.
 * - **A child is never asked to type something the screen cannot express.** The
 *   number pad has no minus key, so the Year 6 integer questions are multiple
 *   choice. Decimal answers start at Year 4, where decimals enter the curriculum.
 *   For the same reason no question below Year 4 is answered with a typed word:
 *   spelling "triangle" is not the skill being tested, so those are multiple
 *   choice.
 */
export const mathsTemplates: QuestionTemplate[] = [
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
    tags: ['AC9MFN01'],
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
    tags: ['AC9MFN01'],
  },
  {
    id: 'maths.K.counting-numbers.missing',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'Fill in the gap: {x}, {x + 1}, ?, {x + 3}',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '16' }],
    answer: 'x + 2',
    tags: ['AC9MFN01'],
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
    tags: ['AC9MFN01'],
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
    tags: ['AC9MFA01'],
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
    tags: ['AC9MFN03'],
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
    tags: ['AC9MFN03'],
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
    tags: ['AC9MFN03'],
  },
  {
    id: 'maths.K.comparing-numbers.between',
    subject: 'maths',
    topic: 'comparing numbers',
    level: 'K',
    prompt: 'Which number goes between {x} and {x + 2}?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '18' }],
    answer: 'x + 1',
    tags: ['AC9MFN01'],
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
    tags: ['AC9MFN05'],
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
    tags: ['AC9MFN05'],
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
    tags: ['AC9MFN04'],
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
    tags: ['AC9MFN05'],
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
    tags: ['AC9MFN05'],
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
    tags: ['AC9MFN06'],
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
    tags: ['AC9MFN06'],
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
    tags: ['AC9MFA01'],
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
    tags: ['AC9MFA01'],
  },
  {
    id: 'maths.K.patterns.repeating-three',
    subject: 'maths',
    topic: 'patterns',
    level: 'K',
    prompt: 'What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, ?',
    vars: [
      { name: 'a', kind: 'pick', from: ['red', 'blue'] },
      { name: 'b', kind: 'pick', from: ['yellow', 'orange'] },
      { name: 'c', kind: 'pick', from: ['green', 'purple'] },
    ],
    answer: 'b',
    answerType: 'choice',
    choices: { count: 3, distractors: ['a', 'c'] },
    hint: 'The part that repeats is {a}, {b}, {c}.',
    tags: ['AC9MFA01'],
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
    tags: ['AC9MFM01'],
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
    tags: ['AC9MFM01'],
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
    tags: ['AC9MFM02'],
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
    tags: ['AC9MFM02'],
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
    tags: ['AC9MFSP01'],
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
    tags: ['AC9MFSP01'],
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
    tags: ['AC9MFSP01'],
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
    tags: ['AC9MFSP01'],
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
    tags: ['AC9MFSP01'],
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
    tags: ['AC9MFST01'],
  },

  // ------------------------------------------------------------------
  // Year 1
  //
  // Numbers to 120, partitioning into tens and ones, skip counting, addition
  // and subtraction within 20, equal sharing and grouping, money, informal
  // units of length, and durations in days and hours.
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
    tags: ['AC9M1A01'],
  },
  {
    id: 'maths.1.counting-numbers.after-100',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What number comes after {x}?',
    vars: [{ name: 'x', kind: 'int', min: '95', max: '119' }],
    answer: 'x + 1',
    tags: ['AC9M1N01'],
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
    tags: ['AC9M1N01'],
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
    tags: ['AC9M1N01'],
  },
  {
    id: 'maths.1.counting-numbers.ten-less',
    subject: 'maths',
    topic: 'counting numbers',
    level: '1',
    prompt: 'What is 10 less than {x}?',
    vars: [{ name: 'x', kind: 'int', min: '15', max: '120' }],
    answer: 'x - 10',
    tags: ['AC9M1N01'],
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
    tags: ['AC9M1N02'],
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
    tags: ['AC9M1N02'],
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
    tags: ['AC9M1N02'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N05'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N05'],
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
    tags: ['AC9M1N04'],
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
    tags: ['AC9M1N06'],
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
    tags: ['AC9M1N06'],
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
    tags: ['AC9M1N05'],
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
    tags: ['AC9M1A01'],
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
    tags: ['AC9M1M02'],
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
    tags: ['AC9M1M03'],
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
    tags: ['AC9M1M03'],
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
    tags: ['AC9M1SP01'],
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
    tags: ['AC9M1SP01'],
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
    tags: ['AC9M1SP01'],
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
      { name: 'nudge', kind: 'pick', from: [1, -1] },
      {
        name: 'claim',
        kind: 'expr',
        // A triangle can only be missed upwards: "2 sides" is not a claim
        // anybody weighs up, and it would land back on the true case anyway.
        expr: 'right == 1 ? sides : sides + (sides == 3 ? 1 : nudge)',
      },
    ],
    answer: 'sides == claim',
    figure: { kind: 'polygon', shape: 'shape' },
    tags: ['AC9M1SP01'],
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
    tags: ['AC9M1ST02'],
  },

  // ------------------------------------------------------------------
  // Year 2
  //
  // Numbers to 1000 and three-digit place value, halves, quarters and eighths
  // through repeated halving, addition and subtraction facts to 20, the twos
  // multiplication facts, money, additive patterns, calendars, clock times to
  // the quarter hour, and quarter and half turns.
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
    tags: ['AC9M2N01'],
  },
  {
    id: 'maths.2.place-value.count-hundreds',
    subject: 'maths',
    topic: 'place value',
    level: '2',
    prompt: 'How many whole hundreds are there in {x}?',
    vars: [{ name: 'x', kind: 'int', min: '150', max: '999' }],
    answer: 'floor(x / 100)',
    tags: ['AC9M2N02'],
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
    tags: ['AC9M2N02'],
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
    tags: ['AC9M2N02'],
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
    tags: ['AC9M2N04'],
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
    tags: ['AC9M2N04'],
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
    tags: ['AC9M2A02'],
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
    tags: ['AC9M2N04'],
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
    tags: ['AC9M2A02'],
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
    tags: ['AC9M2N04'],
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
    tags: ['AC9M2A01'],
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
    tags: ['AC9M2A01'],
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
    tags: ['AC9M2A03'],
  },
  {
    id: 'maths.2.multiplication.twos',
    subject: 'maths',
    topic: 'multiplication',
    level: '2',
    prompt: 'What is {x} × 2?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '12' }],
    answer: 'x * 2',
    tags: ['AC9M2A03'],
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
    tags: ['AC9M2N05'],
  },
  {
    id: 'maths.2.division.halving',
    subject: 'maths',
    topic: 'division',
    level: '2',
    prompt: '{total} counters are shared equally between 2 children. How many does each child get?',
    vars: [{ name: 'each', kind: 'int', min: '3', max: '20' }, { name: 'total', kind: 'expr', expr: 'each * 2' }],
    answer: 'each',
    tags: ['AC9M2A03'],
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
    tags: ['AC9M2A03'],
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
    tags: ['AC9M2N03'],
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
    tags: ['AC9M2N03'],
  },
  {
    id: 'maths.2.fractions.repeated-halving',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'Half of {x} is {x / 2}. What is half of {x / 2}?',
    vars: [{ name: 'quarter', kind: 'int', min: '2', max: '12' }, { name: 'x', kind: 'expr', expr: 'quarter * 4' }],
    answer: 'quarter',
    tags: ['AC9M2N03'],
  },
  {
    id: 'maths.2.fractions.parts-of-a-whole',
    subject: 'maths',
    topic: 'fractions',
    level: '2',
    prompt: 'How many {name} make one whole?',
    vars: [{ name: 'name', kind: 'pick', from: ['halves', 'quarters', 'eighths'] }],
    answer: "name == 'halves' ? 2 : name == 'quarters' ? 4 : 8",
    tags: ['AC9M2N03', 'AC9M2M02'],
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
    tags: ['AC9M2A01'],
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
    tags: ['AC9M2A01'],
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
    tags: ['AC9M2A01'],
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
    tags: ['AC9M2N06'],
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
    tags: ['AC9M2N06'],
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
    tags: ['AC9M2M04'],
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
    tags: ['AC9M2M03'],
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
    tags: ['AC9M2M05'],
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
    tags: ['AC9M2SP01'],
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
    tags: ['AC9M2SP01'],
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
    tags: ['AC9M2SP01'],
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
    tags: ['AC9M2SP01'],
  },

  // ------------------------------------------------------------------
  // Year 3
  //
  // Numbers beyond 10 000, unit fractions and their multiples, three-digit
  // addition and subtraction, the 3, 4, 5 and 10 multiplication facts and the
  // related division facts, inverse operations, estimation, metric units,
  // time to the minute, right angles, money, and likelihood.
  // ------------------------------------------------------------------
  {
    id: 'maths.3.place-value.count-thousands',
    subject: 'maths',
    topic: 'place value',
    level: '3',
    prompt: 'How many whole thousands are there in {x}?',
    vars: [{ name: 'x', kind: 'int', min: '1200', max: '99999' }],
    answer: 'floor(x / 1000)',
    tags: ['AC9M3N01'],
  },
  {
    id: 'maths.3.place-value.digit-value',
    subject: 'maths',
    topic: 'place value',
    level: '3',
    prompt: 'In the number {x}, what is the value of the digit in the hundreds place?',
    vars: [{ name: 'x', kind: 'int', min: '1000', max: '9999' }],
    constraints: ['mod(floor(x / 100), 10) != 0'],
    answer: 'mod(floor(x / 100), 10) * 100',
    hint: 'A digit in the hundreds place is worth that many hundreds.',
    tags: ['AC9M3N01'],
  },
  {
    id: 'maths.3.counting-numbers.round-to-ten',
    subject: 'maths',
    topic: 'counting numbers',
    level: '3',
    prompt: 'Round {x} to the nearest 10.',
    vars: [{ name: 'x', kind: 'int', min: '21', max: '989' }],
    constraints: ['mod(x, 10) != 5', 'mod(x, 10) != 0'],
    answer: 'round(x / 10) * 10',
    tags: ['AC9M3N05'],
  },
  {
    id: 'maths.3.addition.three-digit',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '100', max: '699' },
      { name: 'y', kind: 'int', min: '100', max: '299' },
    ],
    answer: 'x + y',
    hint: 'Add the hundreds, then the tens, then the ones.',
    tags: ['AC9M3N03'],
  },
  {
    id: 'maths.3.addition.regrouping',
    subject: 'maths',
    topic: 'addition',
    level: '3',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '145', max: '486' },
      { name: 'y', kind: 'int', min: '117', max: '298' },
    ],
    constraints: ['mod(x, 10) + mod(y, 10) > 10'],
    answer: 'x + y',
    hint: 'The ones make more than ten, so one ten is carried over.',
    tags: ['AC9M3N03'],
  },
  {
    id: 'maths.3.subtraction.three-digit',
    subject: 'maths',
    topic: 'subtraction',
    level: '3',
    prompt: 'What is {x} − {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '300', max: '999' },
      { name: 'y', kind: 'int', min: '100', max: '299' },
    ],
    answer: 'x - y',
    tags: ['AC9M3N03'],
  },
  {
    id: 'maths.3.multiplication.tables',
    subject: 'maths',
    topic: 'multiplication',
    level: '3',
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'y', kind: 'int', min: '2', max: '10' },
    ],
    answer: 'x * y',
    hint: '{y} groups of {x}.',
    tags: ['AC9M3N04'],
  },
  {
    id: 'maths.3.multiplication.groups',
    subject: 'maths',
    topic: 'multiplication',
    level: '3',
    prompt: 'There are {x} boxes with {y} pencils in each. How many pencils altogether?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '9' },
      { name: 'y', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'x * y',
    tags: ['AC9M3N06'],
  },
  {
    id: 'maths.3.multiplication.known-facts',
    subject: 'maths',
    topic: 'multiplication',
    level: '3',
    prompt: 'What is {x} × {fact}?',
    vars: [
      { name: 'fact', kind: 'pick', from: [3, 4, 5, 10] },
      { name: 'x', kind: 'int', min: '2', max: '10' },
    ],
    answer: 'x * fact',
    tags: ['AC9M3A03'],
  },
  {
    id: 'maths.3.division.exact',
    subject: 'maths',
    topic: 'division',
    level: '3',
    prompt: 'What is {total} ÷ {y}?',
    vars: [
      { name: 'y', kind: 'int', min: '2', max: '10' },
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'total', kind: 'expr', expr: 'x * y' },
    ],
    answer: 'x',
    hint: 'How many {y}s fit into {total}?',
    tags: ['AC9M3N04'],
  },
  {
    id: 'maths.3.division.sharing',
    subject: 'maths',
    topic: 'division',
    level: '3',
    prompt: '{total} sweets are shared equally between {y} children. How many does each child get?',
    vars: [
      { name: 'y', kind: 'int', min: '2', max: '6' },
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'total', kind: 'expr', expr: 'x * y' },
    ],
    answer: 'x',
    tags: ['AC9M3N06'],
  },
  {
    id: 'maths.3.division.related-fact',
    subject: 'maths',
    topic: 'division',
    level: '3',
    prompt: 'You know {x} × {fact} = {x * fact}. What is {x * fact} ÷ {fact}?',
    vars: [
      { name: 'fact', kind: 'pick', from: [3, 4, 5, 10] },
      { name: 'x', kind: 'int', min: '2', max: '10' },
    ],
    answer: 'x',
    hint: 'Division undoes multiplication.',
    tags: ['AC9M3A03'],
  },
  {
    id: 'maths.3.fractions.unit-fraction-of',
    subject: 'maths',
    topic: 'fractions',
    level: '3',
    prompt: 'What is one {name} of {total}?',
    vars: [
      { name: 'd', kind: 'pick', from: [3, 4, 5, 10] },
      // Spelled out: "one 3th of 12" is not how anyone says it.
      {
        name: 'name',
        kind: 'expr',
        expr: "d == 3 ? 'third' : d == 4 ? 'quarter' : d == 5 ? 'fifth' : 'tenth'",
      },
      { name: 'part', kind: 'int', min: '2', max: '9' },
      { name: 'total', kind: 'expr', expr: 'd * part' },
    ],
    answer: 'part',
    hint: 'Split {total} into {d} equal parts.',
    tags: ['AC9M3N02'],
  },
  {
    id: 'maths.3.fractions.multiple-of-unit',
    subject: 'maths',
    topic: 'fractions',
    level: '3',
    prompt: 'What is {n} {plural} of {total}?',
    vars: [
      { name: 'd', kind: 'pick', from: [3, 4, 5, 10] },
      {
        name: 'name',
        kind: 'expr',
        expr: "d == 3 ? 'third' : d == 4 ? 'quarter' : d == 5 ? 'fifth' : 'tenth'",
      },
      {
        name: 'plural',
        kind: 'expr',
        expr: "d == 3 ? 'thirds' : d == 4 ? 'quarters' : d == 5 ? 'fifths' : 'tenths'",
      },
      { name: 'part', kind: 'int', min: '2', max: '8' },
      { name: 'total', kind: 'expr', expr: 'd * part' },
      { name: 'n', kind: 'int', min: '2', max: 'd - 1' },
    ],
    answer: 'n * part',
    hint: 'One {name} of {total} is {part}.',
    tags: ['AC9M3N02'],
  },
  {
    id: 'maths.3.fractions.complete-the-whole',
    subject: 'maths',
    topic: 'fractions',
    level: '3',
    prompt: 'You have {n} {plural} of a cake. How many more {plural} do you need to make a whole cake?',
    vars: [
      { name: 'd', kind: 'pick', from: [3, 4, 5, 10] },
      {
        name: 'plural',
        kind: 'expr',
        expr: "d == 3 ? 'thirds' : d == 4 ? 'quarters' : d == 5 ? 'fifths' : 'tenths'",
      },
      // From 2, so the prompt never reads "1 quarters".
      { name: 'n', kind: 'int', min: '2', max: 'd - 1' },
    ],
    answer: 'd - n',
    tags: ['AC9M3N02'],
  },
  {
    id: 'maths.3.algebra.unknown-value',
    subject: 'maths',
    topic: 'algebra',
    level: '3',
    prompt: 'What goes in the box? ? + {y} = {total}',
    vars: [
      { name: 'x', kind: 'int', min: '20', max: '180' },
      { name: 'y', kind: 'int', min: '10', max: '90' },
      { name: 'total', kind: 'expr', expr: 'x + y' },
    ],
    answer: 'x',
    hint: 'Take {y} away from {total}.',
    tags: ['AC9M3A01'],
  },
  {
    id: 'maths.3.algebra.inverse-operations',
    subject: 'maths',
    topic: 'algebra',
    level: '3',
    prompt: 'You know that {x} + {y} = {total}. What is {total} − {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '15', max: '120' },
      { name: 'y', kind: 'int', min: '5', max: '80' },
      { name: 'total', kind: 'expr', expr: 'x + y' },
    ],
    answer: 'x',
    hint: 'Adding and subtracting undo each other.',
    tags: ['AC9M3A01'],
  },
  {
    id: 'maths.3.algebra.mental-strategy',
    subject: 'maths',
    topic: 'algebra',
    level: '3',
    prompt: 'You know {x} + {y} = {x + y}. What is {x * 10} + {y * 10}?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '9' },
      { name: 'y', kind: 'int', min: '2', max: '9' },
    ],
    answer: '(x + y) * 10',
    hint: 'Ten times bigger in, ten times bigger out.',
    tags: ['AC9M3A02'],
  },
  {
    id: 'maths.3.time.minutes-in-hours',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'How many minutes are there in {n} hours?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '8' }],
    answer: 'n * 60',
    tags: ['AC9M3M03'],
  },
  {
    id: 'maths.3.time.seconds-in-minutes',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'How many seconds are there in {n} minutes?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 60',
    tags: ['AC9M3M03'],
  },
  {
    id: 'maths.3.time.until-the-hour',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'It is {m} minutes past {h} o’clock. How many minutes until {h + 1} o’clock?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '11' },
      { name: 'm', kind: 'int', min: '5', max: '55', step: 5 },
    ],
    answer: '60 - m',
    tags: ['AC9M3M04'],
  },
  {
    id: 'maths.3.measurement.centimetres',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'How many centimetres are there in {n} metres?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 100',
    hint: 'One metre is 100 centimetres.',
    tags: ['AC9M3M02'],
  },
  {
    id: 'maths.3.measurement.grams',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'How many grams are there in {n} kilograms?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 1000',
    tags: ['AC9M3M02'],
  },
  {
    id: 'maths.3.measurement.choose-unit',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'Would you measure the {thing} in metres or in centimetres?',
    vars: [
      {
        name: 'thing',
        kind: 'pick',
        from: ['length of a classroom', 'height of a door', 'length of a pencil', 'width of a stamp'],
      },
    ],
    answer:
      "thing == 'length of a classroom' || thing == 'height of a door' ? 'metres' : 'centimetres'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'metres'", "'centimetres'"] },
    tags: ['AC9M3M01'],
  },
  {
    id: 'maths.3.money.change',
    subject: 'maths',
    topic: 'money',
    level: '3',
    prompt: 'A sticker costs {c}c. You pay with a $2 coin. How much change do you get, in cents?',
    vars: [{ name: 'c', kind: 'int', min: '5', max: '195', step: 5 }],
    answer: '200 - c',
    hint: 'A $2 coin is 200 cents.',
    tags: ['AC9M3M06'],
  },
  {
    id: 'maths.3.money.cents-in-dollars',
    subject: 'maths',
    topic: 'money',
    level: '3',
    prompt: 'How many cents are there in ${d}?',
    vars: [{ name: 'd', kind: 'int', min: '2', max: '9' }],
    answer: 'd * 100',
    tags: ['AC9M3M06'],
  },
  {
    id: 'maths.3.angles.right-angles-in-a-turn',
    subject: 'maths',
    topic: 'angles',
    level: '3',
    prompt: 'How many right angles are there in a {turn} turn?',
    vars: [{ name: 'turn', kind: 'pick', from: ['half', 'three-quarter', 'full'] }],
    answer: "turn == 'half' ? 2 : turn == 'three-quarter' ? 3 : 4",
    hint: 'A quarter turn is one right angle.',
    tags: ['AC9M3M05'],
  },
  // The first two angle questions that show the angle. Neither pins a rotation
  // or an arm length, so the same angle arrives pointing anywhere and drawn
  // with a long arm and a short one - a child who reads a longer pair of arms
  // as a bigger angle is making the mistake this content description names.
  {
    id: 'maths.3.angles.against-a-right-angle',
    subject: 'maths',
    topic: 'angles',
    level: '3',
    prompt: 'Is this angle bigger or smaller than a right angle?',
    vars: [{ name: 'd', kind: 'int', min: '20', max: '160', step: 5 }],
    // Kept well clear of 90 on either side: an angle five degrees off a right
    // angle is not a child failing to compare, it is a picture with no
    // answerable difference in it.
    constraints: ['abs(d - 90) >= 25'],
    answer: "d > 90 ? 'bigger' : 'smaller'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'bigger'", "'smaller'"] },
    hint: 'A right angle is the square corner of a page.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M3M05'],
  },
  {
    id: 'maths.3.angles.is-a-right-angle',
    subject: 'maths',
    topic: 'angles',
    level: '3',
    prompt: 'True or false: this is a right angle.',
    vars: [
      { name: 'square', kind: 'pick', from: [1, 0] },
      { name: 'off', kind: 'int', min: '25', max: '70', step: 5 },
      { name: 'side', kind: 'pick', from: [1, -1] },
      { name: 'd', kind: 'expr', expr: 'square == 1 ? 90 : 90 + side * off' },
    ],
    answer: 'square == 1',
    hint: 'A right angle is a quarter turn.',
    figure: { kind: 'angle', degrees: 'd' },
    tags: ['AC9M3M05'],
  },
  {
    id: 'maths.3.chance.more-likely',
    subject: 'maths',
    topic: 'chance',
    level: '3',
    prompt:
      'A bag holds {r} red counters and {b} blue counters. True or false: you are more likely to pull out a red one.',
    // From 2, so the prompt never reads "1 blue counters".
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '12' },
      { name: 'b', kind: 'int', min: '2', max: '12' },
    ],
    constraints: ['r != b'],
    answer: 'r > b',
    tags: ['AC9M3P01'],
  },
  {
    id: 'maths.3.chance.which-colour',
    subject: 'maths',
    topic: 'chance',
    level: '3',
    prompt:
      'A bag holds {r} red counters and {b} blue counters. Which colour are you more likely to pull out?',
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '15' },
      { name: 'b', kind: 'int', min: '2', max: '15' },
    ],
    constraints: ['r != b'],
    answer: "r > b ? 'red' : 'blue'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'red'", "'blue'"] },
    tags: ['AC9M3P01'],
  },
  {
    id: 'maths.3.data.survey-total',
    subject: 'maths',
    topic: 'data',
    level: '3',
    prompt:
      'In a survey, {a} children chose apples, {b} chose bananas and {c} chose cherries. How many children were surveyed?',
    vars: [
      { name: 'a', kind: 'int', min: '3', max: '25' },
      { name: 'b', kind: 'int', min: '3', max: '25' },
      { name: 'c', kind: 'int', min: '3', max: '25' },
    ],
    answer: 'a + b + c',
    tags: ['AC9M3ST01'],
  },

  // ------------------------------------------------------------------
  // Year 4
  //
  // Tenths and hundredths as decimals, the properties of odd and even numbers,
  // equivalent fractions and mixed numerals, multiplying and dividing by
  // powers of 10, all multiplication facts to 10 × 10, rounding, perimeter and
  // area, am and pm, angle names, and lines of symmetry.
  //
  // Decimal answers start here, where decimals enter the curriculum.
  // ------------------------------------------------------------------
  {
    id: 'maths.4.decimals.tenths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'Write {n} tenths as a decimal.',
    vars: [{ name: 'n', kind: 'int', min: '1', max: '9' }],
    answer: 'n / 10',
    // Tapped, not typed: the number pad has no decimal point.
    answerType: 'choice',
    choices: { count: 4, distractors: ['n / 100', 'n', '(n + 1) / 10'] },
    hint: 'Tenths go in the first place after the decimal point.',
    tags: ['AC9M4N01'],
  },
  {
    id: 'maths.4.decimals.hundredths',
    subject: 'maths',
    topic: 'decimals',
    level: '4',
    prompt: 'Write {n} hundredths as a decimal.',
    vars: [{ name: 'n', kind: 'int', min: '11', max: '99' }],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n / 100',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n / 10', 'n', '(n + 1) / 100'] },
    tags: ['AC9M4N01'],
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
    choices: { count: 2, distractors: ['min(a, b)'] },
    hint: 'Compare the whole numbers first, then the tenths.',
    tags: ['AC9M4N01'],
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
      { name: 'a', kind: 'expr', expr: 'na / 10' },
      { name: 'b', kind: 'expr', expr: 'nb / 10' },
    ],
    answer: '(na + nb) / 10',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na + nb + 1) / 10', '(na + nb - 1) / 10', '(na + nb + 10) / 10'],
    },
    hint: 'Add the whole numbers, then add the tenths.',
    tags: ['AC9M4N01'],
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
    choices: { count: 4, distractors: ['d / 10', '(10 + d) / 100', '(100 - d) / 100'] },
    tags: ['AC9M4N03'],
  },
  {
    id: 'maths.4.even-and-odd.is-odd',
    subject: 'maths',
    topic: 'even and odd',
    level: '4',
    prompt: 'True or false: {x} is an odd number.',
    vars: [{ name: 'x', kind: 'int', min: '10', max: '199' }],
    answer: 'isOdd(x)',
    tags: ['AC9M4N02'],
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
    tags: ['AC9M4N02'],
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
    tags: ['AC9M4N02'],
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
    tags: ['AC9M4N03'],
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
    tags: ['AC9M4N03'],
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
    tags: ['AC9M4N04'],
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
    tags: ['AC9M4N04'],
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
    tags: ['AC9M4N05'],
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
    tags: ['AC9M4A02'],
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
    tags: ['AC9M4N06'],
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
    tags: ['AC9M4N05'],
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
    tags: ['AC9M4A02'],
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
    tags: ['AC9M4N07'],
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
    tags: ['AC9M4N07'],
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
    tags: ['AC9M4A01'],
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
    tags: ['AC9M4N09'],
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
    tags: ['AC9M4M02'],
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
    tags: ['AC9M4M02'],
  },
  {
    id: 'maths.4.time.am-or-pm',
    subject: 'maths',
    topic: 'time',
    level: '4',
    prompt: 'A film starts at {h} o’clock in the {part}. Is that am or pm?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '11' },
      { name: 'part', kind: 'pick', from: ['morning', 'afternoon', 'evening'] },
    ],
    answer: "part == 'morning' ? 'am' : 'pm'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'am'", "'pm'"] },
    hint: 'am runs from midnight to midday.',
    tags: ['AC9M4M03'],
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
    tags: ['AC9M4M03'],
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
    choices: { count: 2, distractors: ['ra > rb ? b : a'] },
    hint: 'Smallest to largest: acute, right, obtuse, straight.',
    tags: ['AC9M4M04'],
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
    tags: ['AC9M4M04'],
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
    tags: ['AC9M4M04'],
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
    tags: ['AC9M4M04'],
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
    tags: ['AC9M4SP03'],
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
    tags: ['AC9M4SP03'],
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
    tags: ['AC9M4SP03'],
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
    tags: ['AC9M4P01'],
  },

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
    ],
    answer: 'a - d',
    answerType: 'choice',
    choices: { count: 4, distractors: ['d - a', '-(a + d)', 'a + d'] },
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
    ],
    answer: 'a - b',
    answerType: 'choice',
    choices: { count: 4, distractors: ['b - a', '-(a + b)', 'a + b'] },
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
      { name: 'a', kind: 'expr', expr: 'na / 100' },
      { name: 'b', kind: 'expr', expr: 'nb / 100' },
    ],
    answer: '(na + nb) / 100',
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: ['(na + nb + 10) / 100', '(na + nb - 1) / 100', '(na + nb + 100) / 100'],
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
    ],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n * p / 100',
    answerType: 'choice',
    // Kept clear of each other at both p values: at p = 10, `n * p / 1000` and
    // `n / 100` would be the same number.
    choices: { count: 4, distractors: ['n * p / 1000', 'n * p / 10', 'n * p'] },
    hint: 'Every digit moves left one place for each zero.',
    tags: ['AC9M6N06'],
  },
  {
    id: 'maths.6.decimals.divide-by-powers-of-ten',
    subject: 'maths',
    topic: 'decimals',
    level: '6',
    prompt: 'What is {a} ÷ 10?',
    vars: [{ name: 'n', kind: 'int', min: '11', max: '999' }, { name: 'a', kind: 'expr', expr: 'n / 10' }],
    constraints: ['mod(n, 10) != 0'],
    answer: 'n / 100',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n / 10', 'n / 1000', 'n'] },
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
    vars: [{ name: 'n', kind: 'int', min: '3', max: '199' }, { name: 'cm', kind: 'expr', expr: 'n * 5' }],
    constraints: ['mod(n * 5, 100) != 0'],
    answer: 'n * 5 / 100',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n * 5 / 10', 'n * 5 / 1000', 'n * 5'] },
    hint: 'There are 100 centimetres in a metre.',
    tags: ['AC9M6M01'],
  },
  {
    id: 'maths.6.measurement.grams-to-kilograms',
    subject: 'maths',
    topic: 'measurement',
    level: '6',
    prompt: 'How many kilograms is {g} grams?',
    vars: [{ name: 'n', kind: 'int', min: '3', max: '199' }, { name: 'g', kind: 'expr', expr: 'n * 50' }],
    constraints: ['mod(n * 5, 100) != 0'],
    answer: 'n * 50 / 1000',
    answerType: 'choice',
    choices: { count: 4, distractors: ['n * 50 / 100', 'n * 50 / 10000', 'n * 50'] },
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
