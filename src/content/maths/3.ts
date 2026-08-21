import type { QuestionTemplate } from '@/lib/templates/types';
import { columnLetter } from './helpers';

/** Year 3 - NSW Stage 2. Which of Part A or B a concept sits in is a teacher's call, not the content's. */
export const year3: QuestionTemplate[] = [
  // ------------------------------------------------------------------
  // Year 3
  //
  // Numbers beyond 10 000, unit fractions and their multiples, three-digit
  // addition and subtraction, the 3, 4, 5 and 10 multiplication facts and the
  // related division facts, inverse operations, estimation, metric units,
  // time to the minute, right angles, money, and likelihood - and then the
  // picture questions: a number line a hundred wide read in tens, an array read
  // for one of its sides rather than its total, thirds and fifths of a shape,
  // a clock face read to the five minutes, grams towards a kilogram and the
  // first litres and millilitres, the nets of solids, a grid map read as a
  // square reference and used to step one square from it, a spinner whose parts
  // are no longer all the same size, and graphs drawn two ways.
  //
  // **This is the year that had no Space content at all.** Counting the content
  // descriptions cited across the shipped catalog before this pass, Space
  // carried one apiece in K, 1, 2, 4 and 6 and nothing whatever in Year 3 - not
  // because nobody got round to it, but because the questions Space asks are
  // pictures and an app that can only render a sentence cannot ask them. The
  // `shapes` and `position` topics below are that hole filled.
  //
  // Each is filed with the topic it practises rather than in a block of its own
  // - the ruling Year K made and every year since has followed.
  // ------------------------------------------------------------------
  {
    id: 'maths.3.place-value.count-thousands',
    subject: 'maths',
    topic: 'place value',
    level: '3',
    prompt: 'How many whole thousands are there in {x}?',
    vars: [{ name: 'x', kind: 'int', min: '1200', max: '99999' }],
    answer: 'floor(x / 1000)',
    tags: ['AC9M3N01', 'MA2-RN-01'],
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
    tags: ['AC9M3N01', 'MA2-RN-01'],
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
    tags: ['AC9M3N05', 'MA2-RN-01'],
  },
  {
    id: 'maths.3.counting-numbers.number-line',
    subject: 'maths',
    topic: 'counting numbers',
    level: '3',
    prompt: 'What number is the arrow pointing to?',
    // Year 2 read tens off a line fifty wide, anywhere below a thousand. This
    // reads tens off a line a **hundred** wide, anywhere below ten thousand -
    // twice as far to count and four-digit numbers at either end of it.
    //
    // **The window is what varies, because the arrow cannot.** Its position is
    // the answer, so the stretch of line under it is the only thing free to
    // move, exactly as in `2.ts`.
    //
    // **`base` stops at 98 because of a label, not a number.** The line's
    // right-hand end is `base * 100 + 100`, and a tick reading 10000 wants five
    // characters where the line has room for four - measured, not guessed. 9900
    // is the last end that fits.
    //
    // **`k` is 1, 3, 7 or 9 so a small tick is always worth ten.** The kind
    // takes the *coarsest* legible division the arrow lands on, so an arrow at
    // an offset of 20 or 50 would cut the same line into fives or twos and ask
    // a different question of a child counting along. Ten, thirty, seventy and
    // ninety divide by nothing coarser than ten, so every drawing reads the
    // same way - which is what lets the hint below say "the small ticks" at
    // all.
    vars: [
      { name: 'base', kind: 'int', min: '0', max: '98' },
      { name: 'start', kind: 'expr', expr: 'base * 100' },
      { name: 'k', kind: 'pick', from: [1, 3, 7, 9] },
      { name: 'n', kind: 'expr', expr: 'start + k * 10' },
    ],
    answer: 'n',
    hint: 'Start at the number on the left, then count along the small ticks.',
    figure: { kind: 'number-line', at: 'n', from: 'start', to: 'start + 100', step: '100' },
    tags: ['AC9M3N01', 'MA2-RN-01'],
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
    tags: ['AC9M3N03', 'MA2-AR-01'],
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
    tags: ['AC9M3N03', 'MA2-AR-01'],
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
    tags: ['AC9M3N03', 'MA2-AR-01'],
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
    tags: ['AC9M3N04', 'MA2-MR-01'],
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
    tags: ['AC9M3N06', 'MA2-MR-01'],
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
    tags: ['AC9M3A03', 'MA2-MR-01'],
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
    tags: ['AC9M3N04', 'MA2-MR-01'],
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
    tags: ['AC9M3N06', 'MA2-MR-01'],
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
    tags: ['AC9M3A03', 'MA2-MR-02'],
  },
  {
    id: 'maths.3.division.array-in-each-row',
    subject: 'maths',
    topic: 'division',
    level: '3',
    // Year 2's array was read for its total. This one is read the other way
    // round - the total is given and one of the sides is wanted - which is the
    // array's real job at Stage 2: the same picture answers a multiplication
    // and a division, and seeing that is what makes the two one fact.
    prompt: 'These {total} dots are set out in {r} equal rows. How many dots are in each row?',
    vars: [
      { name: 'r', kind: 'int', min: '3', max: '6' },
      { name: 'c', kind: 'int', min: '3', max: '7' },
      { name: 'total', kind: 'expr', expr: 'r * c' },
    ],
    answer: 'c',
    hint: 'Count the dots along one row, or work out {total} ÷ {r}.',
    // **`orientation` is pinned because the answer means "how many in a row".**
    // Left to jitter it transposes, and the transpose is a different answer to
    // the question actually asked - the obligation is about what the answer
    // *asks*, not about how it is spelled. Year 2's array leaves it open, and
    // rightly: that one asks for the total, which a transpose does not touch.
    figure: { kind: 'array', rows: 'r', columns: 'c', orientation: "'rows'" },
    tags: ['AC9M3N04', 'MA2-MR-01'],
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
    tags: ['AC9M3N02', 'MA2-PF-01'],
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
    tags: ['AC9M3N02', 'MA2-PF-01'],
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
    tags: ['AC9M3N02', 'MA2-PF-01'],
  },
  {
    id: 'maths.3.fractions.how-much-shaded',
    subject: 'maths',
    topic: 'fractions',
    level: '3',
    prompt: 'How much of this shape is shaded?',
    // Thirds and fifths, one part shaded or two: the four drawings are a two by
    // two, so **both** counts have to be made. One third and one fifth have the
    // same number shaded and differ only in how many parts there are; one third
    // and two thirds have the same parts and differ only in how many are
    // shaded. Neither can be read off without counting, and 2/5 and 1/3 are
    // close enough by eye - 0.4 against 0.33 - that eyeing it does not work
    // either.
    //
    // Years 1 and 2 did halves, quarters and eighths, which is where their
    // syllabuses stop. Thirds and fifths are what Year 3 adds, and the flat
    // pick makes each of the four answers equally likely without any weighting
    // to work out.
    vars: [
      { name: 'which', kind: 'pick', from: [0, 1, 2, 3] },
      { name: 'd', kind: 'expr', expr: 'which <= 1 ? 3 : 5' },
      { name: 'n', kind: 'expr', expr: 'which == 0 || which == 2 ? 1 : 2' },
    ],
    // A fraction cannot be typed on a number pad, so it is tapped.
    answer: "d == 3 ? (n == 1 ? 'one third' : 'two thirds') : (n == 1 ? 'one fifth' : 'two fifths')",
    answerType: 'choice',
    // The same four buttons whatever was drawn, so the option set never says
    // which one it is.
    choices: {
      count: 4,
      distractors: ["'one third'", "'two thirds'", "'one fifth'", "'two fifths'"],
    },
    hint: 'Count how many equal parts there are, then how many are shaded.',
    // `shape` is left open: the prompt says "this shape" and names nothing, so
    // whichever the builder reaches for is an honest drawing of it.
    //
    // **What it reaches for is a circle or a strip, and never a rectangle** -
    // measured at roughly 63% circles and 37% strips over 600 draws of each
    // denominator. A rectangle is a grid, so it needs a factor pair with both
    // sides at least 2, and three and five are prime: `gridFactorPairs` comes
    // back empty for both, `shapeSupports` refuses the rectangle, and
    // `resolvedShape` substitutes a circle without saying so - a pinned
    // `shape: 'rectangle'` here would draw a circle too. The template is
    // unaffected, since it names no shape and both of the two it does get can
    // carry three or five parts easily; it is worth writing down because
    // thirds and fifths are the year's denominators and the substitution is
    // silent.
    figure: { kind: 'fraction-shape', numerator: 'n', denominator: 'd' },
    tags: ['AC9M3N02', 'MA2-PF-01'],
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
    tags: ['AC9M3A01', 'MA2-AR-02'],
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
    tags: ['AC9M3A01', 'MA2-AR-02'],
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
    tags: ['AC9M3A02', 'MA2-AR-01'],
  },
  {
    id: 'maths.3.time.minutes-in-hours',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'How many minutes are there in {n} hours?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '8' }],
    answer: 'n * 60',
    tags: ['AC9M3M03', 'MA2-NSM-02'],
  },
  {
    id: 'maths.3.time.seconds-in-minutes',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'How many seconds are there in {n} minutes?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 60',
    tags: ['AC9M3M03', 'MA2-NSM-02'],
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
    tags: ['AC9M3M04', 'MA2-NSM-02'],
  },

  // The dial, read to the five minutes. Year 2 read it to the quarter hour;
  // this is every mark round the face, which is where both syllabuses have
  // Stage 2 land.
  //
  // **To the *minute* cannot be drawn and is not attempted.** Sixty minute
  // ticks measure under 3px apart in a parent's report row, so the face cannot
  // carry them and a question asking for 3:37 off one would be asking a child
  // to read something that is not there. AC9M3M04 says "to the nearest minute";
  // what is here is the five-minute half of it, and the missing half wants a
  // form that is not a clock face - a digital time as a choice, or elapsed
  // minutes, which `time.until-the-hour` above already does.
  //
  // **Both pin `numerals` and `minuteTicks`, and both pins are load-bearing.**
  // An omitted field is a coin toss, not a default: half of these would
  // otherwise draw a dial with no numbers, and half a dial with no minute
  // track - and twenty-five past is between the 4 and the 5, neither of which
  // is ever numbered. Without the track there is nothing on the face to count
  // in fives along. The two hand lengths still jitter, which is where these
  // vary; the hands *are* the answer, so nothing else can.
  {
    id: 'maths.3.time.clock-five-minutes',
    subject: 'maths',
    topic: 'time',
    level: '3',
    prompt: 'What time does this clock show?',
    // The answer is a digital time, which is the pairing MA2-NSM-02 is about:
    // the same moment written the two ways a child meets it. It is also not
    // something the number pad can type, so it is tapped.
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'mi', kind: 'int', min: '1', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
      // Any other hour, and any other five-minute mark - stepped round rather
      // than drawn and rejected, so no draw is thrown away.
      { name: 'dh', kind: 'int', min: '1', max: '11' },
      { name: 'hn', kind: 'expr', expr: 'mod(h - 1 + dh, 12) + 1' },
      { name: 'dm', kind: 'int', min: '1', max: '10' },
      { name: 'mn', kind: 'expr', expr: '(mod(mi - 1 + dm, 11) + 1) * 5' },
      // Five past is written 4:05, and only five needs the nought.
      { name: 'ms', kind: 'expr', expr: "m == 5 ? '05' : '' + m" },
      { name: 'mns', kind: 'expr', expr: "mn == 5 ? '05' : '' + mn" },
    ],
    answer: "h + ':' + ms",
    answerType: 'choice',
    // The four options are the two hours crossed with the two minute readings,
    // so each half of the answer is shared with exactly one other option: one
    // hand read on its own narrows four to two and never to one, which is what
    // leaves the other hand a question to answer.
    choices: {
      count: 4,
      distractors: ["hn + ':' + ms", "h + ':' + mns", "hn + ':' + mns"],
    },
    hint: 'The short hand gives the hour. Count round in 5s from the 12 for the minutes.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M3M04', 'MA2-NSM-02'],
  },
  {
    id: 'maths.3.time.minutes-past',
    subject: 'maths',
    topic: 'time',
    level: '3',
    // The hour is given, so the whole question is the long hand - and the
    // answer is a plain number, which the pad can type. It is the same reading
    // as the one above with one of its two halves taken away, which is what
    // makes it the easier of the pair rather than a repeat of it.
    prompt: 'How many minutes past {h} o’clock is this clock showing?',
    vars: [
      { name: 'h', kind: 'int', min: '1', max: '12' },
      { name: 'mi', kind: 'int', min: '1', max: '11' },
      { name: 'm', kind: 'expr', expr: 'mi * 5' },
    ],
    answer: 'm',
    hint: 'Count round in 5s from the 12 to the long hand.',
    figure: { kind: 'clock', hour: 'h', minute: 'm', numerals: 'true', minuteTicks: 'true' },
    tags: ['AC9M3M04', 'MA2-NSM-02'],
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
    tags: ['AC9M3M02', 'MA2-GM-02'],
  },
  {
    id: 'maths.3.measurement.grams',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'How many grams are there in {n} kilograms?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 1000',
    tags: ['AC9M3M02', 'MA2-NSM-01'],
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
    tags: ['AC9M3M01', 'MA2-GM-02'],
  },

  // Mass in grams, past the conversion above: Year 2 weighed things in blocks
  // on a balance, Year 3 weighs them in the units a kitchen scale uses, and a
  // kilogram is the thousand a child has to hold on to.
  {
    id: 'maths.3.measurement.mass-to-a-kilogram',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'A bag of flour holds {g} grams. How many more grams would make it 1 kilogram?',
    vars: [{ name: 'g', kind: 'int', min: '50', max: '950', step: 50 }],
    answer: '1000 - g',
    hint: 'One kilogram is 1000 grams.',
    tags: ['AC9M3M01', 'MA2-NSM-01'],
  },

  // Volume and capacity, arriving for the first time.
  //
  // **Both are sentences, and that is a decision rather than an omission.**
  // Nothing in the figure vocabulary draws a volume: `solid` draws one solid in
  // an oblique projection with no unit cubes in it, no dimensions on it and no
  // labels anywhere, and the module comment there says outright that a solid's
  // *lengths* are not askable because the depth is a convention rather than a
  // measurement. So "what is the volume of this shape?" has no answer on the
  // screen, and hanging a solid beside a sentence that already carries the
  // numbers would be a picture the child has to learn to ignore - which is the
  // rule about prompts and figures pointed the other way. At Stage 2 capacity
  // is litres and millilitres poured between everyday containers anyway, and
  // that is a thing said rather than drawn.
  {
    id: 'maths.3.measurement.millilitres',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt: 'How many millilitres are there in {n} litres?',
    vars: [{ name: 'n', kind: 'int', min: '2', max: '9' }],
    answer: 'n * 1000',
    hint: 'One litre is 1000 millilitres.',
    tags: ['AC9M3M02', 'MA2-3DS-02'],
  },
  {
    id: 'maths.3.measurement.cups-from-a-jug',
    subject: 'maths',
    topic: 'measurement',
    level: '3',
    prompt:
      'A jug holds {n} litres of juice. Each cup holds {c} millilitres. How many cups can you fill?',
    // Every cup divides a whole number of litres exactly, so the answer is
    // always a whole number of cups - built that way rather than drawn and
    // checked, so there is nothing for rejection sampling to reject.
    vars: [
      { name: 'n', kind: 'int', min: '2', max: '4' },
      { name: 'c', kind: 'pick', from: [100, 200, 250, 500] },
    ],
    answer: 'n * 1000 / c',
    hint: 'The jug holds {n * 1000} millilitres altogether.',
    tags: ['AC9M3M01', 'MA2-3DS-02'],
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
    tags: ['AC9M3M06', 'MA2-AR-01'],
  },
  {
    id: 'maths.3.money.cents-in-dollars',
    subject: 'maths',
    topic: 'money',
    level: '3',
    prompt: 'How many cents are there in ${d}?',
    vars: [{ name: 'd', kind: 'int', min: '2', max: '9' }],
    answer: 'd * 100',
    tags: ['AC9M3M06', 'MA2-AR-01'],
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
    tags: ['AC9M3M05', 'MA2-GM-03'],
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
    tags: ['AC9M3M05', 'MA2-GM-03'],
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
    tags: ['AC9M3M05', 'MA2-GM-03'],
  },

  // Shapes, which this year had none of at all - see the header above for the
  // count that says so.
  //
  // The Stage 2 step is the **net**: a solid taken apart and laid flat, which
  // is the part of the Stage 2 three-dimensional outcome, MA2-3DS-01, that
  // this year leans on. Year 1 named solids and Year 2 counted
  // their faces, edges and corners off an object view; two of the three here
  // are about the flat version, and the third asks the classifying question
  // AC9M3SP01 is about - which key feature a solid has.
  //
  // Solid names are word answers, so the naming question is `choice`, which is
  // the rule for every year up to and including this one.
  {
    id: 'maths.3.shapes.net-folds-to',
    subject: 'maths',
    topic: 'shapes',
    level: '3',
    prompt: 'Which shape would this net fold up to make?',
    // Four solids whose nets are told apart by what the flat pieces *are*
    // rather than by how they are arranged: six squares, a rectangle between
    // two circles, a circle with a fan beside it, a square with four triangles
    // round it. A cuboid is deliberately left out - its net is the cube's with
    // the squares stretched, and at the size a parent's report row draws one
    // that is a question about proportion rather than about shape.
    //
    // **A sphere cannot be here at all**: it is the one solid that does not
    // unfold, and `view: 'net'` on one is an authoring mistake the builder
    // degrades rather than draws.
    vars: [{ name: 'shape', kind: 'pick', from: ['cube', 'cylinder', 'cone', 'square-pyramid'] }],
    // "Pyramid" on the button; the figure vocabulary's own name for it is
    // square-pyramid, and an eight-year-old says the short one.
    answer: "shape == 'square-pyramid' ? 'pyramid' : shape",
    answerType: 'choice',
    // The same four buttons every time, so the option set says nothing.
    choices: { count: 4, distractors: ["'cube'", "'cylinder'", "'cone'", "'pyramid'"] },
    hint: 'Look at the flat pieces: how many are there, and what shape is each one?',
    // Pinned, because the prompt says "this net" - the one field a jitter can
    // change that the sentence has already committed to.
    figure: { kind: 'solid', solid: 'shape', view: "'net'" },
    tags: ['AC9M3SP01', 'MA2-3DS-01'],
  },
  {
    id: 'maths.3.shapes.net-faces',
    subject: 'maths',
    topic: 'shapes',
    level: '3',
    // Counting faces is the one thing a net makes *easier* than an object -
    // every face is in front of you and none is hidden round the back - which
    // is a large part of why nets are taught at all. Year 2 counted the same
    // faces off an object view and had to be told not to forget the ones
    // behind.
    prompt: 'This is the net of a shape. How many faces will it have when it is folded up?',
    // The four solids made entirely of flat faces, which is the same list Year
    // 2 used and for its reason: whether a cone has one face or two is a
    // conversation with a teacher, not a button to be marked wrong on.
    //
    // **Those four have five faces or six, and that is the whole answer set.**
    // A child guessing gets one in two, which is a real weakness of this
    // question and not one the vocabulary can fix - there is no seven-faced
    // solid to draw. What earns it its place is that counting the pieces of a
    // net is the method, and the method transfers to solids nobody can draw.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'square-pyramid', 'triangular-prism'],
      },
    ],
    answer: "shape == 'cube' || shape == 'cuboid' ? 6 : 5",
    hint: 'Count the flat pieces. Each one folds up to be a face.',
    figure: { kind: 'solid', solid: 'shape', view: "'net'" },
    tags: ['AC9M3SP01', 'MA2-3DS-01'],
  },
  {
    id: 'maths.3.shapes.triangle-face',
    subject: 'maths',
    topic: 'shapes',
    level: '3',
    prompt: 'True or false: this shape has a face shaped like a triangle.',
    // **True exactly half the time, and by construction rather than by asking
    // for it**: two of the four solids have a triangular face and the pick is
    // flat, so nothing is rejected and nothing skews. There is no claim in the
    // sentence to leak either - the question is the same words every draw, and
    // the picture is the only place the answer lives.
    vars: [
      {
        name: 'shape',
        kind: 'pick',
        from: ['cube', 'cuboid', 'square-pyramid', 'triangular-prism'],
      },
    ],
    answer: "shape == 'square-pyramid' || shape == 'triangular-prism'",
    hint: 'Look at every face, including the ones at the back.',
    // **`view` is pinned to the object**, and left open it would jitter into a
    // net about half the time. "This shape has a face" is a sentence about a
    // solid: a pyramid's net *is* a flat shape with triangles in it, and asking
    // whether that has a triangular face is a different and muddier question.
    figure: { kind: 'solid', solid: 'shape', view: "'object'" },
    tags: ['AC9M3SP01', 'MA2-3DS-01'],
  },

  // Where something is on a map, and **the year both syllabuses finally agree
  // on it**. Year 2's two grid templates ship ACARA-only on purpose: NSW files
  // grid maps and grid references under MA2-GM-01, Stage 2 begins here, and a
  // Stage 1 code on a Stage 2 reading would be a citation the curriculum page
  // presents as checkable and which does not check out. So the question Year 2
  // could only half-cite is asked again in the year that owns it, with the
  // directional half of the same outcome beside it - reading a reference and
  // using one to move are the two halves of the Stage 2 geometric-measure
  // outcome MA2-GM-01, and Year 2 had only the first.
  //
  // Two things are pinned on both and both have to be. `axisLabels` decides the
  // *spelling of the answer* - column 2 is `B` on a lettered grid and `2` on a
  // numbered one - and `onLines` decides whether the dot is *in* B3 or *at*
  // (2,3), which is the Stage 3 reading. The extent is what is left free, and
  // free within a band rather than open: the options name squares, and a square
  // outside the drawn grid is a wrong answer a child can rule out without
  // looking at the dot, so **every square an option can name exists on the
  // smallest grid the band allows**. Three to five, floor as well as ceiling -
  // see `2.ts` for the measurement behind both ends of it.
  {
    id: 'maths.3.position.grid-reference',
    subject: 'maths',
    topic: 'position',
    level: '3',
    // **This is `maths.2.position.grid-square` again, deliberately and almost
    // to the character** - same prompt, same vars, same distractors, same hint,
    // same figure. Only the id, the level and the tags differ, and the tags are
    // the whole point: Year 2's carries ACARA alone because NSW files grid
    // references at Stage 2, and this is the first year that can cite both.
    // ACARA steps up here as well, from locating a position at Year 2 to a grid
    // reference *system* at Year 3, so the two syllabuses agree that this is
    // the year, and the year that teaches it should be able to ask it.
    //
    // **It is a recurrence that is not harder, which is the exception rather
    // than the rule** - CLAUDE.md's model is a topic returning harder each
    // time. The reason it cannot be harder is the picture: a labelled grid is
    // refused past 5x5, every option has to name a square that exists on the
    // smallest grid in the band, and what is left is very nearly the only
    // grid-reference question the kind permits. The step up Year 3 does get is
    // `grid-direction` below, which is new work on the same outcome rather than
    // a bigger version of this one.
    prompt: 'What square is the dot in?',
    vars: [
      { name: 'c', kind: 'int', min: '1', max: '3' },
      { name: 'r', kind: 'int', min: '1', max: '3' },
      { name: 'cols', kind: 'int', min: '3', max: '5' },
      { name: 'rws', kind: 'int', min: '3', max: '5' },
      // Any other column, and any other row - stepped round rather than drawn
      // and rejected, so the answer can land anywhere among the four options.
      { name: 'dc', kind: 'int', min: '1', max: '2' },
      { name: 'dr', kind: 'int', min: '1', max: '2' },
      { name: 'cn', kind: 'expr', expr: 'mod(c - 1 + dc, 3) + 1' },
      { name: 'rn', kind: 'expr', expr: 'mod(r - 1 + dr, 3) + 1' },
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
    tags: ['AC9M3SP02', 'MA2-GM-01'],
  },
  {
    id: 'maths.3.position.grid-direction',
    subject: 'maths',
    topic: 'position',
    level: '3',
    prompt: 'Which square is {dir} the dot?',
    // **The four options are the two-by-two block the dot sits in**, which is
    // what keeps the option set from answering the question: the dot's own
    // square, the one above or below it, the one beside it, and the one across
    // the corner. Which of those is right depends on the word in the sentence
    // *and* on where the dot is, so neither alone is enough.
    //
    // The block is built out of a pair of adjacent columns and a pair of
    // adjacent rows, with the dot at one corner of it - `across` and `up` say
    // which corner, and they are also what the direction word is read off, so
    // the answer is above the dot as often as below it and left as often as
    // right. Every square in the block lies inside three by three, so all four
    // options exist on the smallest grid the band can draw.
    vars: [
      { name: 'c0', kind: 'int', min: '1', max: '2' },
      { name: 'r0', kind: 'int', min: '1', max: '2' },
      { name: 'across', kind: 'pick', from: [1, -1] },
      { name: 'up', kind: 'pick', from: [1, -1] },
      { name: 'c', kind: 'expr', expr: 'across == 1 ? c0 : c0 + 1' },
      { name: 'cn', kind: 'expr', expr: 'c + across' },
      { name: 'r', kind: 'expr', expr: 'up == 1 ? r0 : r0 + 1' },
      { name: 'rn', kind: 'expr', expr: 'r + up' },
      { name: 'axis', kind: 'pick', from: [1, 0] },
      {
        name: 'dir',
        kind: 'expr',
        expr:
          "axis == 1 ? (up == 1 ? 'directly above' : 'directly below') : " +
          "(across == 1 ? 'directly to the right of' : 'directly to the left of')",
      },
      { name: 'cols', kind: 'int', min: '3', max: '5' },
      { name: 'rws', kind: 'int', min: '3', max: '5' },
    ],
    answer: `axis == 1 ? (${columnLetter('c')}) + rn : (${columnLetter('cn')}) + r`,
    answerType: 'choice',
    choices: {
      count: 4,
      distractors: [
        `(${columnLetter('c')}) + r`,
        `(${columnLetter('cn')}) + rn`,
        `axis == 1 ? (${columnLetter('cn')}) + r : (${columnLetter('c')}) + rn`,
      ],
    },
    hint: 'Find the square the dot is in first, then move one square from it.',
    figure: {
      kind: 'grid',
      at: "c + ',' + r",
      columns: 'cols',
      rows: 'rws',
      axisLabels: "'letters'",
      onLines: 'false',
    },
    tags: ['AC9M3SP02', 'MA2-GM-01'],
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
    tags: ['AC9M3P01', 'MA2-CHAN-01'],
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
    tags: ['AC9M3P01', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.3.chance.spinner-uneven',
    subject: 'maths',
    topic: 'chance',
    level: '3',
    // **The step up on Years 1 and 2 is that the parts are no longer equal.**
    // Every spinner shipped before this one is cut into equal slices, so
    // "which is it more likely to stop on?" is answered by counting them. Here
    // the disc is eight parts' worth cut into three sectors that are never all
    // the same size, and counting is exactly the wrong method - which is the
    // misconception Stage 2 chance is for.
    //
    // The first sentence of the prompt says so out loud rather than leaving a
    // child to be caught out by it, and it is true of every draw: three whole
    // sectors summing to eight can never all be equal.
    //
    // **The prompt does not offer its two options, and that is deliberate on a
    // figure question.** CLAUDE.md is explicit that the figure outranks the
    // prompt on the play screen - the figure claims the vertical room first and
    // the prompt fits into what is left - so a prompt that can be shorter above
    // a picture should be. Naming the alternatives cost 37 characters here, and
    // it bought nothing: the two buttons carry them either way, and narration
    // *reads them out* precisely because `alreadyOffered` no longer fires, so a
    // child who cannot read hears "Is it a shaded part or a part with no
    // shading?" spoken from the options instead of read from the prompt. Same
    // words, same audio, 70 characters instead of 107 - measured, and the
    // option words were confirmed spoken on 2000 of 2000 draws rather than
    // assumed.
    //
    // Years 1 and 2 offer their spinner options in the prompt and are left
    // alone: neither is an outlier in its own year, and this one was.
    prompt: 'The parts are different sizes. Where is the arrow more likely to stop?',
    // **Which side is bigger is a free pick, so the answer is 50/50 exactly**,
    // and **how many sectors are shaded is a second free pick**, so the number
    // of shaded parts carries no information about which side is bigger. A
    // child counting sectors is right half the time, which is what a child
    // guessing is - the picture is the only thing that helps.
    //
    // `d` runs to 2 rather than 3 so both sides are always at least two parts,
    // which is what leaves a side room to be split into two sectors.
    vars: [
      { name: 'big', kind: 'pick', from: [1, 0] },
      { name: 'd', kind: 'int', min: '1', max: '2' },
      { name: 'sh', kind: 'expr', expr: 'big == 1 ? 4 + d : 4 - d' },
      { name: 'pl', kind: 'expr', expr: '8 - sh' },
      { name: 'g', kind: 'pick', from: [1, 2] },
      { name: 'p', kind: 'int', min: '1', max: 'g == 1 ? pl - 1 : sh - 1' },
    ],
    answer: "big == 1 ? 'a shaded part' : 'a part with no shading'",
    answerType: 'choice',
    choices: { count: 2, distractors: ["'a shaded part'", "'a part with no shading'"] },
    hint: 'It is how much of the spinner is shaded that matters, not how many parts there are.',
    // A spinner emits no `label` marks at all, so it carries no text: the fill
    // names here are grouping keys that never reach the screen, and the prompt
    // says "shaded", never a colour. The first-named group is the shaded one.
    figure: {
      kind: 'spinner',
      sectors:
        "g == 1 ? (sh + ',' + p + ',' + (pl - p)) : (p + ',' + (sh - p) + ',' + pl)",
      fills: "g == 1 ? 'a,b,b' : 'a,a,b'",
    },
    tags: ['AC9M3P01', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.3.chance.experiment-rolls',
    subject: 'maths',
    topic: 'chance',
    level: '3',
    // The repeated experiment, which is the half of Stage 2 chance nothing in
    // the catalog had reached: AC9M3P02 is about conducting trials, recording
    // what happened and talking about how the results vary. No figure, because
    // what is being described is a run of results rather than a thing to look
    // at - and with nothing drawn, naming the outcomes in words is honest.
    prompt:
      'A dice was rolled {t} times. It landed on an even number {e} times. How many times did it land on an odd number?',
    vars: [
      { name: 't', kind: 'int', min: '20', max: '60', step: 10 },
      // Never all of them and never none: a run of twenty rolls with no even
      // number in it is not a chance experiment a child should be shown as
      // ordinary, and four either side keeps the two counts recognisably a
      // split rather than a sweep.
      { name: 'e', kind: 'int', min: '4', max: 't - 4' },
    ],
    answer: 't - e',
    hint: 'Every roll was either even or odd.',
    tags: ['AC9M3P02', 'MA2-CHAN-01'],
  },
  {
    id: 'maths.3.chance.most-likely-of-three',
    subject: 'maths',
    topic: 'chance',
    level: '3',
    // Three outcomes rather than the two `chance.which-colour` above compares,
    // which is the step Stage 2 asks for: ordering likelihoods rather than
    // picking between a pair. Year 4 asks the same bag for its *least* likely.
    prompt:
      'A bag holds {r} red, {b} blue and {g} green counters. You take one without looking. Which colour are you most likely to take?',
    vars: [
      { name: 'r', kind: 'int', min: '2', max: '15' },
      { name: 'b', kind: 'int', min: '2', max: '15' },
      { name: 'g', kind: 'int', min: '2', max: '15' },
    ],
    // All different, so the question has one answer. The rejection is symmetric
    // in the three colours, so each of them wins equally often.
    constraints: ['r != b', 'b != g', 'r != g'],
    answer: "r > b && r > g ? 'red' : b > g ? 'blue' : 'green'",
    answerType: 'choice',
    choices: { count: 3, distractors: ["'red'", "'blue'", "'green'"] },
    hint: 'The colour with the most counters is the one you are most likely to take.',
    tags: ['AC9M3P01', 'MA2-CHAN-01'],
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
    tags: ['AC9M3ST01', 'MA2-DATA-01'],
  },

  // Graphs, and Year 3 brings two things Years 1 and 2 did not have. The first
  // is a **second way of drawing the same data**: `style` was pinned to a
  // column on every graph before this one, because the hints said "column" and
  // a hint may only name what the figure draws, so no child had seen the other
  // thing the kind can draw. Meeting one data set drawn two ways is what
  // AC9M3ST02 is about. The second is a **scale of five** up the side,
  // where Year 2 reached two: reading a column that stops at a rung worth five
  // is the counting the year's own multiplication facts are for.
  //
  // **Every graph here keeps `key: '1'` or a one-to-one column, and the
  // many-to-one picture graph is deliberately not repeated.** Year 2 has one,
  // argued from counting in twos being core content that year; NSW places
  // many-to-one scales at Stage 3 and ACARA does not write them down at Year 3
  // either, so a Year 3 picture graph whose key said five would want a
  // MA2-DATA code for a convention NSW puts a stage later - a citation the
  // curriculum page presents as checkable, and which would not check out. Year
  // 4 already asks the many-to-one question outright. So Year 3's step is the
  // *display* and the *scale*, not the key.
  //
  // Category names are short because the budget is short, and it is the axis
  // that sets it: a graph reaching 25 prints a two-character rung, which leaves
  // three characters a name across three categories. Every one of these was
  // built and its issues read rather than counted against the table.
  {
    id: 'maths.3.data.dot-graph',
    subject: 'maths',
    topic: 'data',
    level: '3',
    // **The same reading as a column graph, drawn without the columns.** The
    // kind's `dot` style marks each value with a single point at the height a
    // column would have reached, so the child follows the dot across to the
    // numbers up the side instead of looking at how tall something is. It is
    // *not* the stacked-frequency dot plot a syllabus means by that name -
    // nothing here draws one - so neither the prompt, the hint nor the id says
    // "dot plot", and what is cited is the description about comparing
    // different representations of one data set, which this honestly is.
    prompt: 'This graph shows how many goals each child scored. How many goals did {who} score?',
    // The names on the graph and the name in the sentence are the same three
    // characters, because a prompt may only name what the figure draws - "Eve"
    // under the graph and "Evelyn" in the question is two people to a child.
    //
    // One value at 2 or more so the axis is never a single step, which is a
    // draw the kind refuses outright - impossible by construction rather than
    // merely unlikely, since `figureIssues` samples fifty seeds and a rare bad
    // draw ships past a sample that size.
    vars: [
      { name: 'eve', kind: 'int', min: '1', max: '5' },
      { name: 'kit', kind: 'int', min: '1', max: '5' },
      { name: 'rex', kind: 'int', min: '2', max: '5' },
      { name: 'zoe', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'who', kind: 'expr', expr: "i == 0 ? 'Eve' : i == 1 ? 'Kit' : i == 2 ? 'Rex' : 'Zoe'" },
    ],
    answer: 'i == 0 ? eve : i == 1 ? kit : i == 2 ? rex : zoe',
    // "The dot" is only true because the style is pinned: left open the kind
    // draws a column about half the time.
    hint: 'Find that name along the bottom, then follow its dot across to the numbers up the side.',
    figure: {
      kind: 'bar',
      values: "eve + ',' + kit + ',' + rex + ',' + zoe",
      labels: "'Eve,Kit,Rex,Zoe'",
      scale: '1',
      style: "'dot'",
    },
    tags: ['AC9M3ST02', 'MA2-DATA-02'],
  },
  {
    id: 'maths.3.data.graph-scale-five',
    subject: 'maths',
    topic: 'data',
    level: '3',
    prompt:
      'This graph shows how many stickers each child has. How many stickers do they have altogether?',
    // Every value is a multiple of five and the scale is pinned to five, so the
    // numbers up the side read 0, 5, 10, 15, 20, 25 and every column lands on
    // one of them. A column stopping between two rungs is a column nobody can
    // read a number off, which is the whole point of the picture. One child has
    // at least ten, so the axis is never a single step.
    vars: [
      { name: 'a', kind: 'int', min: '1', max: '5' },
      { name: 'b', kind: 'int', min: '1', max: '5' },
      { name: 'c', kind: 'int', min: '2', max: '5' },
    ],
    answer: '(a + b + c) * 5',
    hint: 'The numbers up the side go up in 5s. Read each column, then add them up.',
    figure: {
      kind: 'bar',
      values: "a * 5 + ',' + b * 5 + ',' + c * 5",
      labels: "'Ada,Kai,Leo'",
      scale: '5',
      style: "'column'",
    },
    tags: ['AC9M3ST02', 'MA2-DATA-02'],
  },
  {
    id: 'maths.3.data.graph-who',
    subject: 'maths',
    topic: 'data',
    level: '3',
    // The graph read backwards: given a number, find whose column reaches it.
    // Every year before this one reads a graph forwards - name a column, say
    // how tall - and scanning a display for a value is the other half of what
    // interpreting one means.
    prompt: 'This graph shows how many books each child read. Who read {v} {books}?',
    // All four different, so exactly one child answers - and four different
    // values out of five puts the tallest column at four or more, so the axis
    // is never a single step either.
    vars: [
      { name: 'amy', kind: 'int', min: '1', max: '5' },
      { name: 'ben', kind: 'int', min: '1', max: '5' },
      { name: 'joe', kind: 'int', min: '1', max: '5' },
      { name: 'sam', kind: 'int', min: '1', max: '5' },
      { name: 'i', kind: 'int', min: '0', max: '3' },
      { name: 'v', kind: 'expr', expr: 'i == 0 ? amy : i == 1 ? ben : i == 2 ? joe : sam' },
      // One child reads one book, and "1 books" is not something to say aloud.
      { name: 'books', kind: 'expr', expr: "v == 1 ? 'book' : 'books'" },
    ],
    constraints: [
      'amy != ben',
      'amy != joe',
      'amy != sam',
      'ben != joe',
      'ben != sam',
      'joe != sam',
    ],
    answer: "i == 0 ? 'Amy' : i == 1 ? 'Ben' : i == 2 ? 'Joe' : 'Sam'",
    answerType: 'choice',
    // The same four buttons every time, so the option set says nothing, and the
    // asked child is drawn flat, so the answer lands on each of them equally.
    choices: { count: 4, distractors: ["'Amy'", "'Ben'", "'Joe'", "'Sam'"] },
    hint: 'Find the column that reaches {v}, then read the name under it.',
    figure: {
      kind: 'bar',
      values: "amy + ',' + ben + ',' + joe + ',' + sam",
      labels: "'Amy,Ben,Joe,Sam'",
      scale: '1',
      style: "'column'",
    },
    tags: ['AC9M3ST02', 'MA2-DATA-02'],
  },
  {
    id: 'maths.3.data.picture-difference',
    subject: 'maths',
    topic: 'data',
    level: '3',
    // The picture graph, compared row against row. The prompt says what one
    // picture stands for because the graph's own key draws an icon and a
    // number and cannot say two *what*.
    prompt: 'Each picture stands for one shell. How many more shells did {a} find than {b}?',
    // Four icons at most: a three-character row label leaves room for that many
    // in a parent's report row.
    //
    // **The difference is picked first and the two rows built from it**, so
    // each of the three answers comes up equally often. Drawing two counts and
    // rejecting the pairs that do not differ answers 1 half the time, measured
    // - out of four icons the small gaps are simply the commonest - and a child
    // who learns to answer 1 has learned nothing about the graph. `2.ts`'s
    // `data.graph-same` builds its balance the same way and for the same
    // reason.
    vars: [
      { name: 'diff', kind: 'pick', from: [1, 2, 3] },
      { name: 'vb', kind: 'int', min: '1', max: '4 - diff' },
      { name: 'va', kind: 'expr', expr: 'vb + diff' },
      { name: 'vc', kind: 'int', min: '1', max: '4' },
      // Which two rows are compared moves as well as the counts in them, so the
      // question is never the same pair twice running - and the third row,
      // which is never named, takes whatever is left over.
      { name: 'i', kind: 'int', min: '0', max: '2' },
      { name: 'k', kind: 'int', min: '1', max: '2' },
      { name: 'j', kind: 'expr', expr: 'mod(i + k, 3)' },
      { name: 'mia', kind: 'expr', expr: 'i == 0 ? va : j == 0 ? vb : vc' },
      { name: 'zac', kind: 'expr', expr: 'i == 1 ? va : j == 1 ? vb : vc' },
      { name: 'ivy', kind: 'expr', expr: 'i == 2 ? va : j == 2 ? vb : vc' },
      { name: 'a', kind: 'expr', expr: "i == 0 ? 'Mia' : i == 1 ? 'Zac' : 'Ivy'" },
      { name: 'b', kind: 'expr', expr: "j == 0 ? 'Mia' : j == 1 ? 'Zac' : 'Ivy'" },
    ],
    answer: 'diff',
    hint: 'Count the pictures in both rows, then take the smaller away from the bigger.',
    figure: {
      kind: 'pictograph',
      counts: "mia + ',' + zac + ',' + ivy",
      labels: "'Mia,Zac,Ivy'",
      key: '1',
    },
    tags: ['AC9M3ST02', 'MA2-DATA-02'],
  },
];
