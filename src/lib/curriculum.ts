/**
 * Levels are Australian school years: Kindergarten, then Year 1 to Year 6 —
 * primary school, which is as far as the course goes.
 *
 * A level and a topic are independent axes, related many-to-many. "Counting
 * numbers" belongs to Kindergarten *and* Year 1; Kindergarten also carries
 * "even and odd". The pairing lives on each template — a template names the one
 * year and the one topic it was written for — so the curriculum is derived from
 * content rather than declared up front. Adding a Year 1 counting template is all
 * it takes to put counting into Year 1.
 */

export const YEAR_LEVELS = ['K', '1', '2', '3', '4', '5', '6'] as const;

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

/**
 * The same level said in the width of a chip: "Year K" rather than
 * "Kindergarten". For places where the level sits in a row beside other short
 * facts and the full word is three times the length of every year above it —
 * one long label makes that row wrap for the youngest child and nobody else.
 * The child's own screens still get `yearLabel`, where there is room to say it
 * properly.
 */
export function shortYearLabel(level: YearLevel): string {
  return `Year ${level}`;
}

/** Sorts K first, then years numerically, never as text. */
export function compareYearLevels(a: YearLevel, b: YearLevel): number {
  return YEAR_LEVELS.indexOf(a) - YEAR_LEVELS.indexOf(b);
}

/**
 * The level the home screen opens on: the one the child last chose, if it is
 * still a year with content behind it. Content is the source of truth, so a
 * stored level that has since lost its templates falls back rather than landing
 * the child on an empty screen — to Kindergarten, or the earliest year offered.
 */
export function resolveInitialLevel(
  stored: string | null | undefined,
  available: YearLevel[],
): YearLevel | null {
  if (available.length === 0) return null;

  const parsed = parseYearLevel(stored);
  if (parsed && available.includes(parsed)) return parsed;

  if (available.includes('K')) return 'K';
  return [...available].sort(compareYearLevels)[0];
}
