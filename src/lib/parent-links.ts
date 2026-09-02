/**
 * The parent's two report screens, and the query they share.
 *
 * Which child and which subject a parent is looking at lives in the URL rather
 * than in component state, so a refresh keeps it - and that only works if
 * everything that moves a parent between these screens carries it along. Both
 * pickers used to write `/progress` into the link whatever screen they were
 * drawn on, so changing the child on the lab bench bounced the parent back to
 * the report, and the nav dropped the child on the way to the bench.
 *
 * Pure and in `lib` rather than beside the components because it is the answer
 * to "where does this choice go", which two client components and a nav all
 * have to agree on.
 */

/** The report a parent lands on. */
export const PROGRESS_HREF = '/progress';

/**
 * The bench for analytics not on the report yet. It nests under `/progress` for
 * the reason the speed screens no longer do: a route group adds no path
 * segment, so a bare `/progress-lab` would be one hyphen from the real report.
 */
export const PROGRESS_LAB_HREF = '/progress/lab';

const PROGRESS_SCREENS: string[] = [PROGRESS_HREF, PROGRESS_LAB_HREF];

/**
 * A progress screen with the child and subject it should be looking at.
 *
 * `path` is a destination, not necessarily where the caller is: the pickers
 * hand it their own pathname to stay where they are, and the nav hands it the
 * other screen's constant. Anything that is not a progress screen falls back to
 * the report, which is what a null pathname and a picker rendered somewhere
 * unexpected both come out as - these parameters mean nothing to a screen that
 * does not read them.
 *
 * A missing child or subject is left out rather than written empty, since an
 * empty `?child=` is a value the screen would have to resolve and fail.
 */
export function progressHref(
  path: string | null | undefined,
  params: { child?: string | null; subject?: string | null } = {},
): string {
  const screen = PROGRESS_SCREENS.includes(path ?? '') ? (path as string) : PROGRESS_HREF;

  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return query ? `${screen}?${query}` : screen;
}
