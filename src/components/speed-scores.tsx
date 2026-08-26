import { api, type SpeedRecordsRead } from '@/api';
import { parseScoreTab, type ScoreTab } from '@/lib/speedrun/tabs';
import { FamilyLeaderboard } from './family-leaderboard';
import { ScoreTabs } from './score-tabs';
import { SpeedRecordsCabinet } from './speed-records';

/**
 * The scores, whole: the two tabs and whichever wall of cards they name.
 *
 * Two screens show this - the child's home screen and a parent's `/speed` -
 * and they differ in the frame around it and nothing else,
 * so the reads, the empty states and the tabs live here rather than being
 * written out twice and drifting.
 *
 * **`tabPath` and `runPath` are two questions, not one.** A tab is a URL on the
 * screen the scores are *on*, and a run lives under `/speed/...` however that
 * screen is reached - which are the same string for a parent and are not for a
 * child, whose scores are on `/` and whose runs are not. One `basePath` doing
 * both quietly built `//multiply` for every Try button on the home screen,
 * which a browser reads as a host called `multiply`.
 *
 * **Signed out is neither wall's state.** There is no player to have a failed
 * read about (`null`) and no row to be honestly empty (`[]`), because signed
 * out is not a player with nothing recorded - it is nowhere to record anything
 * at all: nothing is banked without a session to bank it against. A wall of
 * greyed cards would say "play and it'll show up", which is false until this
 * visitor signs in, so this says that instead rather than asking a wall to
 * guess a third meaning for `[]`. A player with no household - a child on their
 * own Google account - has nobody to be ranked against, and a board of one is
 * not a leaderboard: that is `family: null` beside a 200, which the endpoint
 * keeps distinct from the 503 that means the read broke.
 *
 * **Both walls come from one call**, `GET /speed/records`, rather than a read
 * per tab. Only one tab is ever drawn, so the other half is paid for and
 * dropped - which is the cheaper half of the trade against the round trip the
 * *household* used to cost on its own, before the endpoint learned to resolve
 * it. Whose household it is has to be settled on the far side anyway: a child's
 * is their parent's, and ranking them by their own id is a board of one.
 *
 * **`?tab=` is parsed here rather than by each page**, unlike `?child=` and the
 * rest: this is the only thing that reads it, and `defaultTab` is what it falls
 * back to - so a page naming its default *and* normalising against it would be
 * naming the same fact twice, one edit away from a screen that opens on one tab
 * and highlights the other.
 */

const SCALES = {
  child: { gap: 'mt-5 sm:mt-7', empty: 'text-xl text-(--color-ink-soft)' },
  parent: { gap: 'mt-3', empty: 'text-sm text-(--color-ink-soft)' },
} as const;

export async function SpeedScores({
  tab,
  defaultTab,
  tabPath,
  runPath,
  hash,
  signedIn,
  scale = 'child',
}: {
  /** The raw `?tab=` off the URL, normalised here against `defaultTab`. */
  tab: string | undefined;
  /**
   * Which half this screen opens on, and so also which one is the left tab and
   * which one the bare URL means - see `tabs.ts`. A child opens on their own
   * records; a parent opens on the leaderboard.
   */
  defaultTab: ScoreTab;
  /** The screen the tabs are on: `/` for a child, `/speed` for a parent. */
  tabPath: string;
  /** Where a run lives, for the Try button on every card. */
  runPath: string;
  /** Where a tab switch should land, on a screen the tabs sit a long way down. */
  hash?: string;
  /** Signed out is its own state on both walls - see above. */
  signedIn: boolean;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];
  const showing = parseScoreTab(tab, defaultTab);

  // One read for both walls, made here rather than inside whichever half is
  // drawn, so the two cannot end up reading twice on a screen that shows one.
  const scores = signedIn ? await api.speedRecords() : null;

  return (
    <>
      <ScoreTabs
        basePath={tabPath}
        tab={showing}
        defaultTab={defaultTab}
        hash={hash}
        scale={scale}
      />
      <div className={style.gap}>
        {showing === 'records' ? (
          <Records signedIn={signedIn} scores={scores} basePath={runPath} scale={scale} />
        ) : (
          <Board signedIn={signedIn} scores={scores} basePath={runPath} scale={scale} />
        )}
      </div>
    </>
  );
}

type Half = {
  signedIn: boolean;
  /** Both walls' rows, or null for a read that failed. */
  scores: SpeedRecordsRead | null;
  /** A run's path - what a card's Try button is built from. */
  basePath: string;
  scale: keyof typeof SCALES;
};

function Records({ signedIn, scores, basePath, scale }: Half) {
  if (!signedIn) {
    return <p className={SCALES[scale].empty}>Sign in to keep records of your runs.</p>;
  }

  return (
    <SpeedRecordsCabinet attempts={scores?.attempts ?? null} basePath={basePath} scale={scale} />
  );
}

function Board({ signedIn, scores, basePath, scale }: Half) {
  // Three states, not two. Signed out is nowhere to record anything; a signed-in
  // player whose household came back null has nobody to be ranked against; and a
  // failed read is `scores` itself being null, which the board draws as "try
  // again in a moment".
  if (!signedIn || (scores !== null && scores.family === null)) {
    return (
      <p className={SCALES[scale].empty}>
        {signedIn
          ? 'Nobody else in your family is playing yet, so there is nothing to rank.'
          : 'Sign in to see how your family is going.'}
      </p>
    );
  }

  return (
    <FamilyLeaderboard records={scores?.family ?? null} basePath={basePath} scale={scale} />
  );
}
