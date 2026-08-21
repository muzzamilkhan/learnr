/**
 * Which half of the scores a speed run screen is showing.
 *
 * The cabinet and the family board sit on the speed run screen itself now,
 * above the cards that start a run, so which of the two is on screen is a
 * query on that one page rather than a route of its own. That keeps both halves
 * server-rendered and each of them a URL somebody can be sent to, exactly as
 * two routes did.
 */

/**
 * The child's speed section, and the anchor that lands on it.
 *
 * A child's speed run screen *is* their home screen - the scores and the five
 * cards sit under "Speed run" below practice - so everything that used to point
 * at `/speed` now points here, and there is no `/speed` page any more: a second
 * screen showing the same two things existed only to be the way back from a
 * run, and a fragment does that without a page to keep in step. The id and the
 * href live together because the two going out of step is a link that scrolls
 * nowhere, silently.
 */
export const SPEED_SECTION = 'speed-run';
export const CHILD_SPEED_HREF = `/#${SPEED_SECTION}`;

export const SCORE_TABS = ['records', 'leaderboard'] as const;

export type ScoreTab = (typeof SCORE_TABS)[number];

/**
 * The boundary normaliser, beside `parseMode` and `parseYearLevel` - one place
 * that decides what a tab from a URL is, so no screen has to know the two.
 *
 * Unlike its neighbours it **falls back rather than refusing**: they normalise
 * things that are stored or that name real content, where this only picks which
 * of two panels is drawn. A junk tab is somebody's mistyped URL, and the page
 * behind it is perfectly good - refusing it would be a 404 in place of a screen
 * that works. Records is the fallback because it is the one a player came for.
 */
export function parseScoreTab(value: string | undefined | null): ScoreTab {
  return SCORE_TABS.includes(value as ScoreTab) ? (value as ScoreTab) : 'records';
}

/**
 * Where a tab lives: records is the bare screen, the board is a query on it.
 *
 * `hash` is for the screen where the tabs are a long way down - the child's home
 * screen, which is practice first and the speed run below it. Without it,
 * switching tabs is a navigation that lands at the top of the page and leaves
 * the child to scroll back to the wall they were looking at.
 */
export function scoreTabHref(basePath: string, tab: ScoreTab, hash?: string): string {
  const fragment = hash ? `#${hash}` : '';
  return tab === 'records' ? `${basePath}${fragment}` : `${basePath}?tab=${tab}${fragment}`;
}
