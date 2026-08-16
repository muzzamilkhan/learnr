import type { QuestionTemplate } from '@/lib/templates/types';

/**
 * Starter maths course, Kindergarten to Year 3. Real courses are authored by AI
 * outside the app and validated with `validateTemplates` before import — this file
 * is the seed set and doubles as a worked reference for the template format.
 *
 * Note how topics recur across years rather than belonging to one: "counting
 * numbers" runs from K into Year 1, "even and odd" from K into Year 2, and so on.
 * The year says how hard; the topic says what skill.
 *
 * Every answer here is a whole number, because the play screen currently offers a
 * number pad only. Templates may declare text or multiple-choice answers, but
 * nothing renders them yet.
 */
export const mathsTemplates: QuestionTemplate[] = [
  // ---------------- Kindergarten ----------------
  {
    id: 'maths.K.counting-numbers.next',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'What number comes after {x}?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '19' }],
    answer: 'x + 1',
    hint: 'Count up one from {x}.',
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
  },
  {
    id: 'maths.K.counting-numbers.missing',
    subject: 'maths',
    topic: 'counting numbers',
    level: 'K',
    prompt: 'Fill in the gap: {x}, {x + 1}, ?, {x + 3}',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '16' }],
    answer: 'x + 2',
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
  },

  // ---------------- Year 1 ----------------
  // "counting numbers" again, a step harder: counting in steps rather than ones.
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
  },
  {
    id: 'maths.1.subtraction.story',
    subject: 'maths',
    topic: 'subtraction',
    level: '1',
    // "{y} of them" rather than "{y} fly away", which reads wrong when y is 1.
    prompt: 'There are {x} birds on a wall. {y} of them fly away. How many are left?',
    vars: [
      { name: 'x', kind: 'int', min: '5', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: 'x - 1' },
    ],
    answer: 'x - y',
  },

  // ---------------- Year 2 ----------------
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
  },
  // "even and odd" again, now beyond 20 and in both directions.
  {
    id: 'maths.2.even-and-odd.next-odd',
    subject: 'maths',
    topic: 'even and odd',
    level: '2',
    prompt: '{x} is an odd number. What is the next odd number?',
    vars: [{ name: 'x', kind: 'int', min: '21', max: '97', step: 2 }],
    constraints: ['isOdd(x)'],
    answer: 'x + 2',
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
  },

  // ---------------- Year 3 ----------------
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
  },
];
