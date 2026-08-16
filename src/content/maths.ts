import type { QuestionTemplate } from '@/lib/templates/types';

/**
 * Starter maths course. Real courses are authored by AI outside the app and
 * validated with `validateTemplates` before import — this file is the seed set
 * and doubles as a worked reference for the template format.
 */
export const mathsTemplates: QuestionTemplate[] = [
  // ---- Level 1: counting ----
  {
    id: 'maths.counting.next',
    subject: 'maths',
    category: 'counting',
    level: 1,
    prompt: 'What number comes after {x}?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '19' }],
    answer: 'x + 1',
    hint: 'Count up one from {x}.',
  },
  {
    id: 'maths.counting.before',
    subject: 'maths',
    category: 'counting',
    level: 1,
    prompt: 'What number comes before {x}?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '20' }],
    answer: 'x - 1',
    hint: 'Count back one from {x}.',
  },
  {
    id: 'maths.counting.missing',
    subject: 'maths',
    category: 'counting',
    level: 1,
    prompt: 'Fill in the gap: {x}, {x + 1}, ?, {x + 3}',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '16' }],
    answer: 'x + 2',
  },

  // ---- Level 2: addition ----
  {
    id: 'maths.addition.small',
    subject: 'maths',
    category: 'addition',
    level: 2,
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '9' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
    ],
    answer: 'x + y',
    hint: 'Start at {x} and count on {y} more.',
  },
  {
    id: 'maths.addition.story',
    subject: 'maths',
    category: 'addition',
    level: 2,
    prompt: 'Mia has {x} stickers. She is given {y} more. How many does she have now?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '12' },
      { name: 'y', kind: 'int', min: '1', max: '8' },
    ],
    answer: 'x + y',
  },
  {
    id: 'maths.addition.missing-addend',
    subject: 'maths',
    category: 'addition',
    level: 2,
    prompt: 'What goes in the box? {x} + ? = {total}',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '9' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
      { name: 'total', kind: 'expr', expr: 'x + y' },
    ],
    answer: 'y',
    hint: 'How many more than {x} is {total}?',
  },

  // ---- Level 3: subtraction ----
  {
    id: 'maths.subtraction.difference',
    subject: 'maths',
    category: 'subtraction',
    level: 3,
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
    id: 'maths.subtraction.story',
    subject: 'maths',
    category: 'subtraction',
    level: 3,
    prompt: 'There are {x} birds on a wall. {y} fly away. How many are left?',
    vars: [
      { name: 'x', kind: 'int', min: '5', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: 'x - 1' },
    ],
    answer: 'x - y',
  },

  // ---- Level 4: mixed operations ----
  {
    id: 'maths.mixed.add-or-subtract',
    subject: 'maths',
    category: 'mixed',
    level: 4,
    prompt: 'What is {x} {op} {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '10', max: '30' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
      { name: 'op', kind: 'pick', from: ['+', '-'] },
    ],
    answer: "op == '+' ? x + y : x - y",
  },
  {
    id: 'maths.mixed.doubles',
    subject: 'maths',
    category: 'mixed',
    level: 4,
    prompt: 'What is double {x}?',
    vars: [{ name: 'x', kind: 'int', min: '2', max: '20' }],
    answer: 'x * 2',
    hint: '{x} + {x}',
  },

  // ---- Level 5: times tables ----
  {
    id: 'maths.multiplication.tables',
    subject: 'maths',
    category: 'multiplication',
    level: 5,
    prompt: 'What is {x} × {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'y', kind: 'int', min: '2', max: '10' },
    ],
    answer: 'x * y',
    hint: '{y} groups of {x}.',
  },
  {
    id: 'maths.multiplication.groups',
    subject: 'maths',
    category: 'multiplication',
    level: 5,
    prompt: 'There are {x} boxes with {y} pencils in each. How many pencils altogether?',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '9' },
      { name: 'y', kind: 'int', min: '2', max: '9' },
    ],
    answer: 'x * y',
  },

  // ---- Level 6: division (whole answers only) ----
  {
    id: 'maths.division.exact',
    subject: 'maths',
    category: 'division',
    level: 6,
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
    id: 'maths.division.sharing',
    subject: 'maths',
    category: 'division',
    level: 6,
    prompt: '{total} sweets are shared equally between {y} children. How many does each child get?',
    vars: [
      { name: 'y', kind: 'int', min: '2', max: '6' },
      { name: 'x', kind: 'int', min: '2', max: '10' },
      { name: 'total', kind: 'expr', expr: 'x * y' },
    ],
    answer: 'x',
  },
];
