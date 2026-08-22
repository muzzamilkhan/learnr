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
 * cards sit under "Speed run" below practice - so everything a child follows to
 * their speed run points here: a screen of their own showing the same two things
 * existed only to be the way back from a run, and a fragment does that without a
 * page to keep in step. The id and the href live together because the two going
 * out of step is a link that scrolls nowhere, silently.
 *
 * `/speed` is a page again, but a parent's (`PARENT_SPEED_HREF`) - a child who
 * asks for it is redirected here, so this stays the one place their speed
 * section is named.
 */
export const SPEED_SECTION = 'speed-run';

export const SCORE_TABS = ['records', 'leaderboard'] as const;

export type ScoreTab = (typeof SCORE_TABS)[number];

/**
 * **Which tab a screen opens on is a fact about who is reading it**, and it is
 * one answer driving three things: which tab sits on the left, which one the
 * bare URL means, and what a mistyped `?tab=` falls back to. Those three going
 * out of step is a screen whose first tab is not the one it is showing, so
 * `tabOrder`, `scoreTabHref` and `parseScoreTab` all take it rather than each
 * knowing a default of its own.
 *
 * A **child** opens on their own records. They came to see what they scored,
 * and the family board is the context for it.
 *
 * A **parent** opens on the leaderboard. They are not the one whose personal
 * bests this screen is mostly about - their own runs are a thing they do, where
 * how everyone in the house is going is the question the screen answers for
 * them. It is the same argument that makes the report the screen a parent lands
 * on rather than `/children`.
 */
export const CHILD_DEFAULT_TAB: ScoreTab = 'records';
export const PARENT_DEFAULT_TAB: ScoreTab = 'leaderboard';

/** Left to right: the tab this screen opens on, then the other one. */
export function tabOrder(defaultTab: ScoreTab): readonly ScoreTab[] {
  return [defaultTab, ...SCORE_TABS.filter((tab) => tab !== defaultTab)];
}

/**
 * The boundary normaliser, beside `parseMode` and `parseYearLevel` - one place
 * that decides what a tab from a URL is, so no screen has to know the two.
 *
 * Unlike its neighbours it **falls back rather than refusing**: they normalise
 * things that are stored or that name real content, where this only picks which
 * of two panels is drawn. A junk tab is somebody's mistyped URL, and the page
 * behind it is perfectly good - refusing it would be a 404 in place of a screen
 * that works. What it falls back *to* is the screen's own default above, so a
 * junk tab and a bare URL land on the same panel rather than on two.
 */
export function parseScoreTab(
  value: string | undefined | null,
  defaultTab: ScoreTab,
): ScoreTab {
  return SCORE_TABS.includes(value as ScoreTab)
    ? (value as ScoreTab)
    : defaultTab;
}

/**
 * Where a tab lives: the screen's default tab is the bare URL and the other is
 * a query on it. It has to be that way round rather than `records` always
 * taking the bare path - a bare URL that parses to one tab and is linked from
 * another is a tab that cannot be returned to.
 *
 * `hash` is for the screen where the tabs are a long way down - the child's home
 * screen, which is practice first and the speed run below it. Without it,
 * switching tabs is a navigation that lands at the top of the page and leaves
 * the child to scroll back to the wall they were looking at.
 */
export function scoreTabHref(
  basePath: string,
  tab: ScoreTab,
  defaultTab: ScoreTab,
  hash?: string,
): string {
  const fragment = hash ? `#${hash}` : '';
  return tab === defaultTab
    ? `${basePath}${fragment}`
    : `${basePath}?tab=${tab}${fragment}`;
}

/**
 * The child's speed section, and the anchor that lands on it - the door out of
 * a run, and "See records" on the result.
 *
 * Built from `scoreTabHref` rather than written out, so it cannot drift from
 * the tab bar's own idea of where the child's default tab lives: if that tab
 * ever moved, a hand-written `/#speed-run` would keep pointing at a panel the
 * screen no longer opens on.
 */
export const CHILD_SPEED_HREF = scoreTabHref(
  '/',
  CHILD_DEFAULT_TAB,
  CHILD_DEFAULT_TAB,
  SPEED_SECTION,
);

/**
 * A parent's speed screen: their scores and all twenty-six modes to start a run
 * at, and the runs themselves beneath it.
 *
 * **It is one string because it is now one screen.** The parent's speed pages
 * used to be nested under the report at `/progress/speed`, deliberately, so a
 * bare `(parent)/speed` could not sit beside the child's `/speed/...` as a
 * second top-level path told apart only by spelling. What retires that argument
 * is that there is no second path any more: `/speed` and `/speed/[mode]` are one
 * pair of routes serving whoever is signed in, branching on the viewer's role
 * rather than on the URL, so there is nothing left for a copied `href` to get
 * backwards. A child is sent on to `CHILD_SPEED_HREF`, whose speed screen is
 * still their home screen.
 *
 * It is the *bare* path rather than a tab on one, because a parent opens on the
 * leaderboard and `scoreTabHref` puts a screen's default tab on its bare URL -
 * a default tab no URL names is a panel nothing can link back to.
 */
export const PARENT_SPEED_HREF = '/speed';
