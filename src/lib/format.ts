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
