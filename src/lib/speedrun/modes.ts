import type { QuestionSpec } from '../templates/types';

/**
 * What can be speed-run. Twenty-six modes, enumerated here and never built at
 * runtime.
 *
 * The list is closed because a record is only worth beating if the mode is worth
 * naming. A free "from" and "to" range across the tables would give about sixty
 * modes, most differing from a neighbour by one table: two near-identical
 * numbers, each set once and never approached again. Four named bundles are
 * enough range to be useful and few enough that each accumulates a record with
 * some history behind it.
 *
 * Multiplication is the one operation with no difficulty axis, because the times
 * tables *are* how multiplication is drilled - asking for "hard multiplication"
 * when a child came to practise their sevens answers a question nobody asked.
 */

export type Difficulty = 'easy' | 'moderate' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'moderate', 'hard'];

/** A single table, a named bundle of them, or the lot. */
export type TableChoice = number | '2-5' | '6-9' | '11-12' | 'all';

export type Mode =
  | { op: 'add' | 'subtract' | 'divide' | 'mixed'; difficulty: Difficulty }
  | { op: 'multiply'; tables: TableChoice };

export type Operation = Mode['op'];

export const OPERATIONS: readonly Operation[] = ['add', 'subtract', 'multiply', 'divide', 'mixed'];

/** Every table there is, for the bundles and for a mixed run to draw from.
 * 1 is not a drill and 13 is not a table. */
export const TABLES: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * The tables offered as a mode of their own - every one of them except ten.
 *
 * Multiplying by ten is a place-value rule rather than a fact to recall: a
 * child who can write the digit and a nought has the whole table, so ninety
 * seconds of it measures how fast they can type. A mode is a thing to come
 * back to and beat, and there is nothing here to get better at.
 *
 * It is gone from the **bundles** too, which is why the top one is `11-12`
 * rather than `10-12`: a bundle is three tables' worth of ninety seconds, and
 * one of the three being free is a third of the run measuring typing speed.
 * The bundle that named it retires the way `multiply.10` did - every reader of
 * a stored key runs it through `parseMode` and skips what comes back null - so
 * a banked `multiply.10-12` simply stops appearing.
 *
 * It stays in **`all`**, which means all of them and would be lying otherwise,
 * and in what a **mixed** run draws from, where the easy question among the
 * hard ones is the point.
 */
export const SINGLE_TABLES: readonly number[] = TABLES.filter((table) => table !== 10);

export const TABLE_BUNDLES: readonly TableChoice[] = ['2-5', '6-9', '11-12', 'all'];

/** Every answer is a non-negative integer: subtraction never goes negative and
 * division is built from the quotient up, so there is nothing for the number
 * pad's missing minus key to trip over. */
const ADD: Record<Difficulty, QuestionSpec> = {
  easy: {
    prompt: '{x} + {y}',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '10' },
      { name: 'y', kind: 'int', min: '1', max: '10' },
    ],
    answer: 'x + y',
  },
  moderate: {
    prompt: '{x} + {y}',
    vars: [
      { name: 'x', kind: 'int', min: '10', max: '99' },
      { name: 'y', kind: 'int', min: '1', max: '20' },
    ],
    answer: 'x + y',
  },
  // Hard has to mean hard: without the carry, "two-digit plus two-digit" draws
  // 20 + 30 about as often as 37 + 58, and hard is moderate with more digits.
  hard: {
    prompt: '{x} + {y}',
    vars: [
      { name: 'x', kind: 'int', min: '10', max: '99' },
      { name: 'y', kind: 'int', min: '10', max: '99' },
    ],
    constraints: ['mod(x, 10) + mod(y, 10) > 9'],
    answer: 'x + y',
  },
};

/** `y`'s bounds reference `x`, which is exactly what ordered vars are for - it
 * is what keeps the difference from ever going negative. */
const SUBTRACT: Record<Difficulty, QuestionSpec> = {
  easy: {
    prompt: '{x} − {y}',
    vars: [
      { name: 'x', kind: 'int', min: '2', max: '20' },
      { name: 'y', kind: 'int', min: '1', max: 'x' },
    ],
    answer: 'x - y',
  },
  moderate: {
    prompt: '{x} − {y}',
    vars: [
      { name: 'x', kind: 'int', min: '20', max: '99' },
      { name: 'y', kind: 'int', min: '1', max: 'min(20, x)' },
    ],
    answer: 'x - y',
  },
  hard: {
    prompt: '{x} − {y}',
    vars: [
      { name: 'x', kind: 'int', min: '30', max: '99' },
      { name: 'y', kind: 'int', min: '10', max: 'x' },
    ],
    constraints: ['mod(x, 10) < mod(y, 10)'],
    answer: 'x - y',
  },
};

/** Built from the quotient up, so division is exact by construction rather than
 * by rejecting the draws that are not. */
const DIVIDE: Record<Difficulty, QuestionSpec> = {
  easy: {
    prompt: '{x} ÷ {d}',
    vars: [
      { name: 'd', kind: 'pick', from: [2, 5, 10] },
      { name: 'q', kind: 'int', min: '1', max: '10' },
      { name: 'x', kind: 'expr', expr: 'd * q' },
    ],
    answer: 'q',
  },
  moderate: {
    prompt: '{x} ÷ {d}',
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '10' },
      { name: 'q', kind: 'int', min: '1', max: '10' },
      { name: 'x', kind: 'expr', expr: 'd * q' },
    ],
    answer: 'q',
  },
  hard: {
    prompt: '{x} ÷ {d}',
    vars: [
      { name: 'd', kind: 'int', min: '2', max: '12' },
      { name: 'q', kind: 'int', min: '2', max: '12' },
      { name: 'x', kind: 'expr', expr: 'd * q' },
    ],
    answer: 'q',
  },
};

/** The tables a mixed run draws multiplication from - the bands multiplication
 * has nowhere else, since it has no difficulty axis of its own. */
const MIXED_TABLES: Record<Difficulty, readonly number[]> = {
  easy: [2, 5, 10],
  moderate: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  hard: TABLES,
};

function multiplySpec(tables: readonly number[]): QuestionSpec {
  return {
    prompt: '{t} × {n}',
    vars: [
      { name: 't', kind: 'pick', from: tables },
      { name: 'n', kind: 'int', min: '1', max: '12' },
    ],
    answer: 't * n',
  };
}

/** Turn a `TableChoice` into the tables it names. */
function tableList(tables: TableChoice): readonly number[] {
  if (typeof tables === 'number') return [tables];
  switch (tables) {
    case '2-5':
      return [2, 3, 4, 5];
    case '6-9':
      return [6, 7, 8, 9];
    case '11-12':
      return [11, 12];
    case 'all':
      return TABLES;
  }
}

/**
 * The question specs a mode draws from - one for most modes, four for a mixed
 * one. Returning a list is what makes mixed fall out of the same mechanism as
 * everything else rather than needing a second path; a list of one is the
 * ordinary case.
 */
export function specsFor(mode: Mode): readonly QuestionSpec[] {
  if (mode.op === 'multiply') return [multiplySpec(tableList(mode.tables))];
  if (mode.op === 'mixed') {
    return [
      ADD[mode.difficulty],
      SUBTRACT[mode.difficulty],
      multiplySpec(MIXED_TABLES[mode.difficulty]),
      DIVIDE[mode.difficulty],
    ];
  }
  return [{ add: ADD, subtract: SUBTRACT, divide: DIVIDE }[mode.op][mode.difficulty]];
}

/**
 * Ordered for display: the operations in `OPERATIONS` order, and within
 * multiply the singles then the bundles then `all`.
 */
export const MODES: readonly Mode[] = [
  ...DIFFICULTIES.map((difficulty): Mode => ({ op: 'add', difficulty })),
  ...DIFFICULTIES.map((difficulty): Mode => ({ op: 'subtract', difficulty })),
  ...SINGLE_TABLES.map((tables): Mode => ({ op: 'multiply', tables })),
  ...TABLE_BUNDLES.map((tables): Mode => ({ op: 'multiply', tables })),
  ...DIFFICULTIES.map((difficulty): Mode => ({ op: 'divide', difficulty })),
  ...DIFFICULTIES.map((difficulty): Mode => ({ op: 'mixed', difficulty })),
];

/** The canonical key: "add.easy", "multiply.7", "multiply.2-5". */
export function modeKey(mode: Mode): string {
  return mode.op === 'multiply' ? `multiply.${mode.tables}` : `${mode.op}.${mode.difficulty}`;
}

// Built once from `MODES` rather than assembled from the parts of a key, so a
// key is only ever a mode this module actually enumerated - the same defence
// the expression language's variable tables use against `__proto__`, but a
// `Map` needs no null-prototype trick to get it: a lookup key is never a
// property access.
const MODE_BY_KEY = new Map(MODES.map((mode) => [modeKey(mode), mode]));

/**
 * The boundary normaliser, exactly like `parseYearLevel`: one place that decides
 * a key from a URL is real, so no caller has to know what the twenty-six are.
 */
export function parseMode(key: string): Mode | null {
  return MODE_BY_KEY.get(key) ?? null;
}

const OPERATION_SET = new Set(OPERATIONS);

export function parseOperation(op: string): Operation | null {
  return OPERATION_SET.has(op as Operation) ? (op as Operation) : null;
}

export function modesFor(op: Operation): readonly Mode[] {
  return MODES.filter((mode) => mode.op === op);
}

/**
 * What the chip says: "7x", "6x to 9x", "All tables", "Easy".
 *
 * A single table is written the way it is said - "7x" rather than "7 times
 * table" - because fourteen chips reading "n times table" are fourteen labels
 * differing in one character, which is the slowest possible thing to scan and
 * the widest possible thing to draw. Short labels are also what lets the picker
 * lay the singles out several to a row instead of two.
 *
 * A bundle keeps both ends in the same notation - "2x to 5x", not "Tables 2-5"
 * - so a bundle reads as a run of the chips above it rather than as a different
 * kind of thing named a different way. `all` is the one that cannot be written
 * that way and stays prose.
 *
 * `recordBanners` keeps its own prose form regardless ("the 7 times table",
 * "tables 11-12"), which is the `operationLabel`/`operationNoun` split again: a
 * chip is a control and a banner is a sentence.
 */
export function modeLabel(mode: Mode): string {
  if (mode.op === 'multiply') {
    if (mode.tables === 'all') return 'All tables';
    if (typeof mode.tables === 'number') return `${mode.tables}x`;
    const [from, to] = mode.tables.split('-');
    return `${from}x to ${to}x`;
  }
  const { difficulty } = mode;
  return difficulty[0].toUpperCase() + difficulty.slice(1);
}

/**
 * One times table, rather than a bundle of them or anything else.
 *
 * The picker's only reason for asking: a single table's label is two or three
 * characters and a bundle's is ten, so they want different grids - a dense run
 * of small targets, then a short row of wide ones. A predicate here rather than
 * `typeof mode.tables === 'number'` written out in a component, because what
 * counts as a single table is this module's business.
 */
export function isSingleTable(mode: Mode): boolean {
  return mode.op === 'multiply' && typeof mode.tables === 'number';
}

/**
 * What a card, a heading or a button says. The verb, not the noun: these label
 * a thing to *do* - press this and you are multiplying - and "Multiply" is both
 * the shorter word and the one a child reads without decoding four syllables.
 * It is also what keeps the five cards the same shape as each other, where
 * "Addition" beside "Multiplication" is a third again as wide for no more
 * meaning.
 */
const OPERATION_LABELS: Record<Operation, string> = {
  add: 'Add',
  subtract: 'Subtract',
  multiply: 'Multiply',
  divide: 'Divide',
  mixed: 'Mixed',
};

/** What the card says: "Multiply", "Mixed". */
export function operationLabel(op: Operation): string {
  return OPERATION_LABELS[op];
}

/**
 * The same operation as a *noun*, for prose rather than for a control: "a
 * personal best in easy addition" is a sentence, and "in easy add" is not.
 * Only `recordBanners` needs it, and it needs it for every operation, so the
 * two forms live side by side here rather than one being derived from the
 * other - there is no rule that turns "Divide" into "division" that is not
 * just this table written twice.
 */
const OPERATION_NOUNS: Record<Operation, string> = {
  add: 'addition',
  subtract: 'subtraction',
  multiply: 'multiplication',
  divide: 'division',
  mixed: 'mixed questions',
};

/** What a sentence says: "easy addition", "hard division". */
export function operationNoun(op: Operation): string {
  return OPERATION_NOUNS[op];
}

const OPERATION_GLYPHS: Record<Operation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  mixed: '?',
};

/** The sign on the card: "+", "−", "×", "÷", "?" for mixed. */
export function operationGlyph(op: Operation): string {
  return OPERATION_GLYPHS[op];
}
