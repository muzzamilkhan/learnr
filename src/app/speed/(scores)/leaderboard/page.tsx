import { auth, isAuthConfigured } from '@/auth';
import { FamilyLeaderboard } from '@/components/family-leaderboard';
import { readAccount } from '@/lib/accounts';
import { householdId } from '@/lib/children';
import { readFamilyRecords } from '@/lib/speed-records';

// Per-household bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The family board: the right tab of the scores screen, beside the child's own
 * cabinet. The arrow, the title and the tabs come from the layout.
 *
 * Three states the board itself does not have a meaning for are answered here
 * rather than asked of it, exactly as the records tab answers signed-out:
 * nobody signed in has no records to be missing, and someone with no household
 * - a child on their own Google account - has nobody to be ranked against. A
 * board of one is not a leaderboard, so both get a sentence instead.
 */
export default async function SpeedLeaderboardPage() {
  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
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
