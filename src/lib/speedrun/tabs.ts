/**
 * Which half of the scores a speed run screen is showing.
 *
 * The cabinet and the family board sit on the speed run screen itself now,
 * above the cards that start a run, so which of the two is on screen is a
 * query on that one page rather than a route of its own. That keeps both halves
 * server-rendered and each of them a URL somebody can be sent to, exactly as
 * two routes did.
 */

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

/** Where a tab lives: records is the bare screen, the board is a query on it. */
export function scoreTabHref(basePath: string, tab: ScoreTab): string {
  return tab === 'records' ? basePath : `${basePath}?tab=${tab}`;
}
