import { FamilyLeaderboard } from '@/components/family-leaderboard';
import { readFamilyRecords } from '@/lib/speed-records';
import { readParent } from '../../../../parent';

// Per-household bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The same board at the parent's density, the right tab of their scores
 * screen.
 *
 * A parent is the head of their own household, so there is no `householdId`
 * call to make here: `readParent` has already refused anyone who is not a
 * parent, and their own id is the scope. Their own runs are ranked alongside
 * their children's - they play too, and a board that quietly left them out
 * would be a different board from the one the children are looking at, which
 * is what the line above the cards says out loud.
 *
 * It is a bare heading rather than a `Well`: the tab above already names the
 * screen, and a panel titled with the word that is lit in the tab bar is the
 * same title twice.
 *
 * `/progress/speed/leaderboard` is a static segment and wins over
 * `/progress/speed/[op]`, matching the child's `/speed/leaderboard` and the
 * records tab beside it.
 */
export default async function ParentSpeedLeaderboardPage() {
  const { userId } = await readParent();

  return (
    <>
      <p className="mb-3 text-sm text-(--color-ink-soft)">
        Everyone&rsquo;s best score in each mode - your runs included.
      </p>
      <FamilyLeaderboard
        records={await readFamilyRecords(userId)}
        basePath="/progress/speed"
        scale="parent"
      />
    </>
  );
}
