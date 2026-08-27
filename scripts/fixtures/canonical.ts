import { createHash } from 'node:crypto';
import type { Figure, Mark, Point } from '../../src/lib/figures/types';
import type { GeneratedQuestion } from '../../src/lib/templates/types';

/**
 * The canonical form both engines hash, and the reason it is not JSON.
 *
 * Two JSON encoders in two languages have to agree about escaping before their
 * output can be compared, and a rendered prompt carries the minus sign, times,
 * divide, degree and dollar - exactly where they differ on when to escape
 * non-ASCII. So the form is written out by hand instead, in about thirty lines
 * a Swift port can mirror.
 *
 * **Every value is its JavaScript `String(v)` form**, which is the rule that
 * earns its keep: `generateQuestion` already keys the expected answer and the
 * distractor dedup off `String(value)`, so a port yielding `"2.0"` where this
 * says `"2"` marks a correct answer wrong *and* can offer a distractor identical
 * to the answer. Hashing this form makes the digest test the thing the port had
 * to get right anyway, rather than adding a second formatting rule to keep in
 * step.
 *
 * **An absent value takes its text from which primitive is absent, not from
 * absence.** `String(null)` is `"null"` and `String(undefined)` is
 * `"undefined"` - two different strings - so a port holding an `Optional` cannot
 * decide what to write from emptiness alone; it has to know which of the two the
 * TypeScript holds at that site. Today exactly one field reaches this:
 * `lastCorrectDay` in `profile.ts`, which is `null` when unset and never
 * `undefined`, and writes `"null"` deliberately - a null day and day 0 are
 * different things. Nothing in the form emits `"undefined"`.
 */

/** Between a field's name and its value. */
export const NAME_SEP = '\u001f';
/** Between the fields of one case. */
export const FIELD_SEP = '\u001e';
/** Between cases. A rendered prompt is one line by construction. */
export const CASE_SEP = '\n';

/** Anything that would let two fields be read as one. */
const SEPARATORS = /[\u001e\u001f\n]/;

export type Field = readonly [name: string, value: string];

/** `Point` is a tuple, `readonly [number, number]` - not an object with x and y. */
const point = (p: Point): string => `${String(p[0])},${String(p[1])}`;

/**
 * A mark's kind, then its fields in declared order, joined by `|`.
 *
 * The four kinds are a closed set - it is what lets `diagram.tsx` stay a dumb
 * renderer - so this switch is exhaustive by construction. A fifth kind is a
 * decision that has escaped `lib`, and it breaks this loudly rather than
 * quietly.
 */
export function canonicalMark(mark: Mark): string {
  switch (mark.kind) {
    case 'path':
      return [
        'path',
        mark.points.map(point).join(' '),
        String(mark.closed),
        String(mark.fill),
        String(mark.dashed),
      ].join('|');
    case 'arc':
      return ['arc', point(mark.at), String(mark.radius), String(mark.from), String(mark.to)].join('|');
    case 'dot':
      return ['dot', point(mark.at)].join('|');
    case 'label':
      return ['label', point(mark.at), mark.text].join('|');
  }
}

export function canonicalFigure(figure: Figure): Field[] {
  const fields: Field[] = [
    ['figure.width', String(figure.width)],
    ['figure.height', String(figure.height)],
  ];
  figure.marks.forEach((mark, i) => fields.push([`figure.mark.${i}`, canonicalMark(mark)]));
  return fields;
}

/**
 * How anything keyed by name is ordered, wherever it is walked.
 *
 * A Swift dictionary has no insertion order to borrow, so a name-keyed
 * collection has to sort before it can be compared. Exported rather than
 * written twice: `canonicalScope` below needs it, and so does the figure walk
 * in `expr.ts`, and two comparators are two chances to disagree.
 */
export const byName = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : 1;

/**
 * A scope's entries, sorted by key and named `<prefix>.<key>`.
 *
 * The `byName` rule above, applied to `vars` here and to the scope `expr.ts`
 * evaluates expressions against.
 */
export function canonicalScope(prefix: string, scope: Record<string, unknown>): Field[] {
  return Object.entries(scope)
    .sort(byName)
    .map(([name, value]) => [`${prefix}.${name}`, String(value)] as const);
}

export function canonicalQuestion(q: GeneratedQuestion): Field[] {
  const fields: Field[] = [
    ['prompt', q.prompt],
    ['answer', String(q.answer)],
    ['answerType', q.answerType],
  ];
  if (q.choices) fields.push(['choices', q.choices.map(String).join('|')]);
  if (q.hint !== undefined) fields.push(['hint', q.hint]);
  fields.push(...canonicalScope('vars', q.vars));
  if (q.figure) fields.push(...canonicalFigure(q.figure));
  return fields;
}

/**
 * A value wrapped in quotes, with anything structural escaped.
 *
 * `grading.ts` needs this and nothing else does: a response is deliberately
 * allowed to be empty or padded, so quoting is what makes `""` and `" 4 "`
 * visible in a raw diff and what keeps a value that carried a separator from
 * being read as two fields.
 *
 * **It is written out rather than delegated to `JSON.stringify`.** The escaping
 * rules are the same ones - and the test beside this asserts that byte for byte
 * over every control character - but a port cannot reach for its platform's JSON
 * encoder to get them: `JSON.stringify` leaves the minus sign, times, divide,
 * degree and dollar unescaped where another encoder may not, which is the very
 * cross-encoder agreement problem the canonical form exists to avoid. Naming the
 * six escapes here means both engines read the rule instead of inferring it.
 *
 * Only the quotes are doing work today: over the whole grading set, 16 of 10,612
 * values are non-ASCII (the curly apostrophe in "o\u2019clock") and **none**
 * needs an escape at all.
 */
export function canonicalQuoted(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

export function canonicaliseCase(fields: readonly Field[]): string {
  return fields
    .map(([name, value]) => {
      if (SEPARATORS.test(value)) {
        throw new Error(
          `Canonical value for ${name} contains a separator: ${JSON.stringify(value)}`,
        );
      }
      return `${name}${NAME_SEP}${value}`;
    })
    .join(FIELD_SEP);
}

/** Twelve hex characters of sha256 - `content-packs.ts`'s function and truncation. */
export function digest(cases: readonly string[]): string {
  return createHash('sha256').update(cases.join(CASE_SEP), 'utf8').digest('hex').slice(0, 12);
}

/* The completeness guard ------------------------------------------------ */

/**
 * Which keys of `GeneratedQuestion` this file accounts for. Not the emitted
 * labels - `vars` becomes `vars.<name>` and `figure` becomes several fields -
 * but the account of what has been considered.
 *
 * **A field left out of the canonical form is invisible forever**, because no
 * test can miss what it never hashes. That is `Mirrored`'s problem from
 * `apps/api/src/schemas/dto.ts` one level up, and it takes the same answer: the
 * key sets are compared by the compiler, both ways. Optional fields are again
 * the invisible ones, and `choices`, `hint` and `figure` are all optional.
 */
export const QUESTION_FIELDS = [
  'prompt',
  'answer',
  'answerType',
  'choices',
  'hint',
  'vars',
  'figure',
] as const;

/** The same account, per arm of `Mark`. A new field on an existing kind is as invisible. */
export const MARK_FIELDS = {
  path: ['kind', 'points', 'closed', 'fill', 'dashed'],
  arc: ['kind', 'at', 'radius', 'from', 'to'],
  dot: ['kind', 'at'],
  label: ['kind', 'at', 'text'],
} as const;

/** The arm of `Mark` whose `kind` is `V`. */
type ArmWith<V> = Extract<Mark, { kind: V }>;

type CheckKeys<Declared extends PropertyKey, Actual> = [Exclude<keyof Actual, Declared>] extends [
  never,
]
  ? [Exclude<Declared, keyof Actual>] extends [never]
    ? true
    : { canonicalFormNamesAFieldTheTypeDoesNot: Exclude<Declared, keyof Actual> }
  : { canonicalFormIsMissing: Exclude<keyof Actual, Declared> };

type Assert<T extends true> = T;

/**
 * Exported so it is never an unused declaration, and because the list is worth
 * reading.
 *
 * **This holds the *list* against the type, not the digest against the list.**
 * The compiler forces `QUESTION_FIELDS` and `MARK_FIELDS` to name every key
 * `GeneratedQuestion` and each arm of `Mark` has - so a field added to the type
 * and forgotten here is a type error. It does not and cannot check that
 * `canonicalQuestion` or `canonicalMark` actually *emit* something for every
 * name on that list: a field named here but never written into a `Field` typechecks
 * clean and leaves every digest unchanged. That emission is checked at runtime,
 * in `canonical.test.ts`, by building a fully-populated value and asserting
 * every declared field shows up in the output.
 */
export type CanonicalCovers = {
  question: Assert<CheckKeys<(typeof QUESTION_FIELDS)[number], GeneratedQuestion>>;
  path: Assert<CheckKeys<(typeof MARK_FIELDS)['path'][number], ArmWith<'path'>>>;
  arc: Assert<CheckKeys<(typeof MARK_FIELDS)['arc'][number], ArmWith<'arc'>>>;
  dot: Assert<CheckKeys<(typeof MARK_FIELDS)['dot'][number], ArmWith<'dot'>>>;
  label: Assert<CheckKeys<(typeof MARK_FIELDS)['label'][number], ArmWith<'label'>>>;
};
