import { readAccount } from '@/lib/accounts';
import { householdId } from '@/lib/children';
import { readFamilyRecords, readSpeedAttempts } from '@/lib/speed-records';
import type { ScoreTab } from '@/lib/speedrun/tabs';
import { FamilyLeaderboard } from './family-leaderboard';
import { ScoreTabs } from './score-tabs';
import { SpeedRecordsCabinet } from './speed-records';

/**
 * The scores, whole: the two tabs and whichever wall of cards they name.
 *
 * Three screens show this - the child's home screen, `/speed`, and a parent's
 * `/progress/speed` - and they differ in the frame around it and nothing else,
 * so the reads, the empty states and the tabs live here rather than being
 * written out three times and drifting.
 *
 * **Signed out is neither wall's state.** There is no player to have a failed
 * read about (`null`) and no row to be honestly empty (`[]`), because signed
 * out is not a player with nothing recorded - it is nowhere to record anything
 * at all: nothing is banked without a `userId` to bank it against
 * (`submitSpeedRun`). A wall of greyed cards would say "play and it'll show
 * up", which is false until this visitor signs in, so this says that instead
 * rather than asking a wall to guess a third meaning for `[]`. A player with no
 * household - a child on their own Google account - has nobody to be ranked
 * against, and a board of one is not a leaderboard.
 *
 * The household is read here rather than passed in, because only the board tab
 * needs it: on the records tab it is a query nobody would have used.
 */

const SCALES = {
  child: { gap: 'mt-5 sm:mt-7', empty: 'text-xl text-(--color-ink-soft)' },
  parent: { gap: 'mt-3', empty: 'text-sm text-(--color-ink-soft)' },
} as const;

export async function SpeedScores({
  tab,
  basePath,
  hash,
  userId,
  scale = 'child',
}: {
  tab: ScoreTab;
  /** `/` and `/speed` for a child, `/progress/speed` for a parent's own runs. */
  basePath: string;
  /** Where a tab switch should land, on a screen the tabs sit a long way down. */
  hash?: string;
  userId: string | undefined;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  return (
    <>
      <ScoreTabs basePath={basePath} tab={tab} hash={hash} scale={scale} />
      <div className={style.gap}>
        {tab === 'records' ? (
          <Records userId={userId} basePath={basePath} scale={scale} />
        ) : (
          <Board userId={userId} basePath={basePath} scale={scale} />
        )}
      </div>
    </>
  );
}

type Half = {
  userId: string | undefined;
  basePath: string;
  scale: keyof typeof SCALES;
};

async function Records({ userId, basePath, scale }: Half) {
  if (!userId) {
    return <p className={SCALES[scale].empty}>Sign in to keep records of your runs.</p>;
  }

  return (
    <SpeedRecordsCabinet
      attempts={await readSpeedAttempts(userId)}
      basePath={basePath}
      scale={scale}
    />
  );
}

async function Board({ userId, basePath, scale }: Half) {
  const account = userId ? await readAccount(userId) : null;
  const household = account ? householdId(account) : null;

  if (household === null) {
    return (
      <p className={SCALES[scale].empty}>
        {userId
          ? 'Nobody else in your family is playing yet, so there is nothing to rank.'
          : 'Sign in to see how your family is going.'}
      </p>
    );
  }

  return (
    <FamilyLeaderboard
      records={await readFamilyRecords(household)}
      basePath={basePath}
      scale={scale}
    />
  );
}
