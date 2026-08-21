import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { ExitIcon } from '@/components/exit-icon';
import { FamilyLeaderboard } from '@/components/family-leaderboard';
import { ScoreTabs } from '@/components/score-tabs';
import { SpeedCards } from '@/components/speed-cards';
import { SpeedRecordsCabinet } from '@/components/speed-records';
import { readAccount } from '@/lib/accounts';
import { householdId } from '@/lib/children';
import { readFamilyRecords, readSpeedAttempts } from '@/lib/speed-records';
import { parseScoreTab } from '@/lib/speedrun/tabs';

// Per-player scores, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The speed run's own screen: the scores, then the five ways to start a run.
 *
 * **The cards, the cabinet and the family board are one page.** They were three
 * - the cards here, the two walls behind links underneath them - and the links
 * were a way out of the screen a player was already on to look at cards about
 * the very modes it was offering. So the walls came up here, the links went,
 * and which wall is showing is `?tab=` on this one URL rather than a route each
 * (`parseScoreTab`).
 *
 * **The scores sit above the cards.** What a player opens this screen for after
 * their first run is how they are doing; the cards are how they answer it, and
 * they are five, so they cost a short scroll rather than a screen. The child's
 * home screen still goes straight into a run from its own copy of the cards, so
 * the shortest way to play never passes through here at all.
 *
 * Signed out is neither of the two walls' states - there is no player to have a
 * failed read about (`null`), and no row to be honestly empty either (`[]`),
 * because signed out is not a player with nothing recorded, it is nowhere to
 * record anything at all: nothing is banked without a `userId` to bank it
 * against (`submitSpeedRun`). A wall of greyed cards would say "play and it'll
 * show up", which is false until this visitor signs in, so the screen says that
 * instead rather than asking a wall to guess a third meaning for `[]`. A child
 * on their own Google account has no household either, and a board of one is
 * not a leaderboard.
 */
export default async function SpeedHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = parseScoreTab((await searchParams).tab);
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <Link
          href="/"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Speed run</h1>
      </header>

      <ScoreTabs basePath="/speed" tab={tab} />

      <div className="mt-5 sm:mt-7">
        {tab === 'records' ? <Records userId={userId} /> : <Board userId={userId} />}
      </div>

      <h2 className="mt-8 mb-4 text-2xl font-bold tracking-tight sm:mt-10 sm:text-3xl">
        Start a run
      </h2>
      {/* No links to the scores under them: the scores are the top of this very
          screen. `SpeedCards` still draws them on the home screen, which is the
          one place that offers a run without showing what it has been worth. */}
      <SpeedCards links={false} />
    </main>
  );
}

async function Records({ userId }: { userId: string | undefined }) {
  if (!userId) {
    return <p className="text-xl text-(--color-ink-soft)">Sign in to keep records of your runs.</p>;
  }
  return <SpeedRecordsCabinet attempts={await readSpeedAttempts(userId)} scale="child" />;
}

async function Board({ userId }: { userId: string | undefined }) {
  const account = userId ? await readAccount(userId) : null;
  const household = account ? householdId(account) : null;

  if (household === null) {
    return (
      <p className="text-xl text-(--color-ink-soft)">
        {userId
          ? 'Nobody else in your family is playing yet, so there is nothing to rank.'
          : 'Sign in to see how your family is going.'}
      </p>
    );
  }

  return <FamilyLeaderboard records={await readFamilyRecords(household)} scale="child" />;
}
