/**
 * Numbers as a child reads them.
 *
 * The star total is the one number in this app with no ceiling - ten questions
 * at a time, every sitting, for as long as they keep coming back - and "1204"
 * is a number to decipher where "1,204" is one to be pleased about. Grouping is
 * the whole point of the separator here.
 *
 * The locale is pinned rather than the browser's: these counts are rendered on
 * the server and corrected on the client, and a locale that disagrees across
 * that boundary is a hydration mismatch. `en-AU` matches the date formats the
 * rest of the app already pins.
 */
const COUNT = new Intl.NumberFormat('en-AU');

export function formatCount(value: number): string {
  return COUNT.format(value);
}

/**
 * A handful of children as a sentence: "Ada, Bo and Cy".
 *
 * The sharing panel says who a person can see, and a comma-separated list reads
 * as data where a sentence reads as a fact about a family. The locale is pinned
 * for the same reason as the separator above - and because "Ada, Bo, and Cy" is
 * the other English convention, which is not the one the rest of this app writes
 * in.
 */
const NAMES = new Intl.ListFormat('en-AU', { style: 'long', type: 'conjunction' });

export function nameList(names: string[]): string {
  return NAMES.format(names);
}

/**
 * A place as a child says it: "1st", "2nd", "3rd", "4th".
 *
 * The family board is read as positions rather than numbers - who is first -
 * and "position 2" is a spreadsheet where "2nd" is a result. `Intl` has no
 * ordinal *formatter*, only a plural rule that names the suffix category, which
 * is what this reads: `en` puts "th" on the teens and on everything else that
 * is not one, two or three at the end.
 */
const ORDINAL_RULES = new Intl.PluralRules('en-AU', { type: 'ordinal' });

const ORDINAL_SUFFIXES: Record<string, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
};

export function ordinal(value: number): string {
  return `${value}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(value)] ?? 'th'}`;
}

/** A minute, in milliseconds. */
const MINUTE_MS = 60_000;

/**
 * How long a sitting lasted, said the way it would be said out loud.
 *
 * This used to be minutes and nothing else, floored at one - which drew a
 * twelve-second visit and a fifty-second one identically as "1 min", and a
 * screenful of them as an afternoon's work. The number is summed `timeTakenMs`,
 * the same "time on questions" the report's tile is careful to undersell, so
 * inflating it here was the one place the app rounded a measurement *up* into
 * something a parent could be pleased about.
 *
 * Seconds are truncated rather than rounded for that reason: 59.9 seconds is
 * not a minute, and every boundary here errs towards the smaller claim. The
 * floor of one second is the exception, and it is a different statement - a
 * recorded answer took *some* time, so "0s" would be denying it happened.
 */
export function formatDuration(ms: number): string {
  if (ms < MINUTE_MS) return `${Math.max(1, Math.floor(ms / 1000))}s`;
  return `${Math.round(ms / MINUTE_MS)} min`;
}
