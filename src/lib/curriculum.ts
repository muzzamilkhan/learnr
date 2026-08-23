/**
 * Levels are Australian school years: Kindergarten, then Year 1 to Year 6 -
 * primary school, which is as far as the course goes.
 *
 * A level and a topic are independent axes, related many-to-many. "Counting
 * numbers" belongs to Kindergarten *and* Year 1; Kindergarten also carries
 * "even and odd". The pairing lives on each template - a template names the one
 * year and the one topic it was written for - so the curriculum is derived from
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
 * "Kindergarten". The parent screens use this throughout - the level sits in a
 * row of short facts there, and a word three times the length of every year
 * above it makes that row wrap for the youngest child and nobody else. It is
 * also what keeps a level dropdown from being sized by its one long option.
 * The child's own screens still get `yearLabel`, where there is room to say it
 * properly and it is their year being named.
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
 * the child on an empty screen - to Kindergarten, or the earliest year offered.
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

/**
 * The NSW Mathematics K-10 Syllabus (2022) organises content by stage, where a
 * stage spans two school years. LearnR's level is a single year, so the mapping
 * is total in this direction and lossy in the other - which is why a stage is
 * *derived* here and never stored on a template. A stored stage is a second
 * truth that can disagree with the level sitting beside it, the same objection
 * `TopicSkill` answers by being a cache rather than a second history.
 */
export const STAGES = ['ES1', 'S1', 'S2', 'S3'] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_BY_LEVEL: Record<YearLevel, Stage> = {
  K: 'ES1',
  '1': 'S1',
  '2': 'S1',
  '3': 'S2',
  '4': 'S2',
  '5': 'S3',
  '6': 'S3',
};

export function stageForLevel(level: YearLevel): Stage {
  return STAGE_BY_LEVEL[level];
}

/**
 * The years a stage spans, in school order - the same mapping read the other
 * way. Inverted from `STAGE_BY_LEVEL` rather than written out beside it: a
 * second table is a second thing to get wrong, and *this* mapping is the one
 * this app has already got wrong more than once. Stage 2 is Years 3 and 4, not
 * Year 2, and the way to stop that being a thing to remember is to have exactly
 * one place where it is said.
 *
 * `/curriculum` is the caller, where the mapping is the point rather than a
 * detail - it is teaching a parent to read a NSW code - so the page that
 * explains it must not be a copy of it. The years come back as levels; how to
 * *say* them ("Years 1 and 2") is the page's business, not this module's.
 */
export function levelsForStage(stage: Stage): YearLevel[] {
  return YEAR_LEVELS.filter((level) => STAGE_BY_LEVEL[level] === stage);
}

const STAGE_LABELS: Record<Stage, string> = {
  ES1: 'Early Stage 1',
  S1: 'Stage 1',
  S2: 'Stage 2',
  S3: 'Stage 3',
};

export function stageLabel(stage: Stage): string {
  return STAGE_LABELS[stage];
}

/**
 * The order subjects are offered in where one of them has to be picked first.
 *
 * Alphabetical puts English in front of maths, which would make English the
 * subject a parent's report opens on - and maths is the one every child
 * practises from Kindergarten, so it leads. A subject not named here sorts
 * after the ones that are, alphabetically among themselves, so a third subject
 * shipping is a line to add rather than a screen that breaks.
 */
export const SUBJECT_ORDER: readonly string[] = ['maths', 'english'];

export function compareSubjects(a: string, b: string): number {
  const ranked = (subject: string) => {
    const index = SUBJECT_ORDER.indexOf(subject);
    return index === -1 ? SUBJECT_ORDER.length : index;
  };
  return ranked(a) - ranked(b) || a.localeCompare(b);
}
