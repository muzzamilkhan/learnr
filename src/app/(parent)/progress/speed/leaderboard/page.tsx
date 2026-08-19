import { FamilyLeaderboard } from '@/components/family-leaderboard';
import { Well } from '@/components/well';
import { readFamilyRecords } from '@/lib/speed-records';
import { readParent } from '../../../parent';

// Per-household bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The same board at the parent's density, inside the report's shell.
 *
 * A parent is the head of their own household, so there is no `householdId`
 * call to make here: `readParent` has already refused anyone who is not a
 * parent, and their own id is the scope. Their own runs are ranked alongside
 * their children's - they play too, and a board that quietly left them out
 * would be a different board from the one the children are looking at.
 *
 * `/progress/speed/leaderboard` is a static segment and wins over
 * `/progress/speed/[op]`, matching the child's `/speed/leaderboard` and the
 * records screen beside it.
 */
export default async function ParentSpeedLeaderboardPage() {
  const { userId } = await readParent();

  return (
    <Well title="Family leaderboard" note="Everyone's best score in each mode - your runs included.">
      <FamilyLeaderboard records={await readFamilyRecords(userId)} youId={userId} scale="parent" />
    </Well>
  );
}
