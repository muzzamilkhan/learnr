import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { ExitIcon } from '@/components/exit-icon';
import { SpeedRecordsCabinet } from '@/components/speed-records';
import { readSpeedRecords } from '@/lib/speed-records';

// Per-player bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The cabinet, on its own screen. `/speed/records` is a static segment and
 * wins over `/speed/[op]` in Next's routing, and `parseOperation('records')`
 * returns null besides, so the two can never collide.
 *
 * Signed out is neither of `SpeedRecordsCabinet`'s two states - there is no
 * player to have a failed read about (`null`), and there is no row to be
 * honestly empty either (`[]`), because signed out is not a player with
 * nothing recorded, it is nowhere to record anything at all: nothing is ever
 * banked without a `userId` to bank it against (`submitSpeedRun`). Rendering
 * twenty-seven greyed dashes here would say "play and it'll show up", which
 * is false until this visitor signs in - so this page says that instead,
 * rather than asking the cabinet to guess a third meaning for `[]`. Reaching
 * this page signed out only happens by typing the URL: the link to it is
 * never shown until a child is signed in, same as the cards above it.
 */
export default async function SpeedRecordsPage() {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
        <Link
          href="/"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your records</h1>
      </header>

      {userId ? (
        <SpeedRecordsCabinet bests={await readSpeedRecords(userId)} scale="child" />
      ) : (
        <p className="text-xl text-(--color-ink-soft)">
          Sign in to keep records of your runs.
        </p>
      )}
    </main>
  );
}
