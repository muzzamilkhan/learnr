/**
 * Levels are Australian school years: Kindergarten, then Year 1 to Year 12.
 *
 * A level and a topic are independent axes, related many-to-many. "Counting
 * numbers" belongs to Kindergarten *and* Year 1; Kindergarten also carries
 * "even and odd". The pairing lives on each template — a template names the one
 * year and the one topic it was written for — so the curriculum is derived from
 * content rather than declared up front. Adding a Year 1 counting template is all
 * it takes to put counting into Year 1.
 */

export const YEAR_LEVELS = [
  'K',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
] as const;

export type YearLevel = (typeof YEAR_LEVELS)[number];

const YEAR_SET: ReadonlySet<string> = new Set(YEAR_LEVELS);

export function isYearLevel(value: unknown): value is YearLevel {
  return typeof value === 'string' && YEAR_SET.has(value);
}

/** Normalise a value from a URL or an authored file. Returns null if it isn't a year. */
export function parseYearLevel(value: string | null | undefined): YearLevel | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  const upper = trimmed.toUpperCase();
  if (upper === 'K') return 'K';

  // Accept "03" for "3", but nothing that isn't purely digits.
  if (!/^\d+$/.test(trimmed)) return null;
  const normalised = String(Number(trimmed));

  return isYearLevel(normalised) ? normalised : null;
}

export function yearLabel(level: YearLevel): string {
  return level === 'K' ? 'Kindergarten' : `Year ${level}`;
}

/** Sorts K first, then years numerically — "10" must not land between "1" and "2". */
export function compareYearLevels(a: YearLevel, b: YearLevel): number {
  return YEAR_LEVELS.indexOf(a) - YEAR_LEVELS.indexOf(b);
}
