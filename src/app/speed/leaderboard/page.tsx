import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { ExitIcon } from '@/components/exit-icon';
import { FamilyLeaderboard } from '@/components/family-leaderboard';
import { readAccount } from '@/lib/accounts';
import { householdId } from '@/lib/children';
import { readFamilyRecords } from '@/lib/speed-records';

// Per-household bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The family board, on its own screen beside the cabinet.
 *
 * `/speed/leaderboard` is a static segment and wins over `/speed/[op]` in
 * Next's routing, and `parseOperation('leaderboard')` returns null besides -
 * the same pair of reasons `/speed/records` is safe to sit there.
 *
 * Three states the board itself does not have a meaning for are answered here
 * rather than asked of it, exactly as `/speed/records` answers signed-out:
 * nobody signed in has no records to be missing, and someone with no household
 * - a child on their own Google account - has nobody to be ranked against. A
 * board of one is not a leaderboard, so both get a sentence instead.
 */
export default async function SpeedLeaderboardPage() {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  const account = userId ? await readAccount(userId) : null;
  const household = account ? householdId(account) : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
        <Link
          href="/speed"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Family leaderboard</h1>
      </header>

      {household === null ? (
        <p className="text-xl text-(--color-ink-soft)">
          {userId
            ? 'Nobody else in your family is playing yet, so there is nothing to rank.'
            : 'Sign in to see how your family is going.'}
        </p>
      ) : (
        <FamilyLeaderboard
          records={await readFamilyRecords(household)}
          youId={userId}
          scale="child"
        />
      )}
    </main>
  );
}
