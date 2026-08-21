import { auth, isAuthConfigured } from '@/auth';
import { SpeedRecordsCabinet } from '@/components/speed-records';
import { readSpeedAttempts } from '@/lib/speed-records';

// Per-player runs, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The cabinet: the left tab of the scores screen, and the one it opens on.
 * The frame - the arrow, the title and the tabs - is the layout beside this
 * file, so a hop to the leaderboard replaces only the wall of cards.
 *
 * Signed out is neither of `SpeedRecordsCabinet`'s two states - there is no
 * player to have a failed read about (`null`), and there is no row to be
 * honestly empty either (`[]`), because signed out is not a player with
 * nothing recorded, it is nowhere to record anything at all: nothing is ever
 * banked without a `userId` to bank it against (`submitSpeedRun`). Rendering
 * twenty-six greyed dashes here would say "play and it'll show up", which
 * is false until this visitor signs in - so this page says that instead,
 * rather than asking the cabinet to guess a third meaning for `[]`. Reaching
 * this page signed out only happens by typing the URL: the link to it is
 * never shown until a child is signed in, same as the cards above it.
 */
export default async function SpeedRecordsPage() {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <p className="text-xl text-(--color-ink-soft)">Sign in to keep records of your runs.</p>
    );
  }

  return <SpeedRecordsCabinet attempts={await readSpeedAttempts(userId)} scale="child" />;
}
