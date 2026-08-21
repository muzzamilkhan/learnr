import { SpeedCards } from '@/components/speed-cards';
import { SpeedScores } from '@/components/speed-scores';
import { Well } from '@/components/well';
import { parseScoreTab } from '@/lib/speedrun/tabs';
import { readParent } from '../../parent';

// Per-parent scores, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * A parent's own speed screen, the child's one at the parent's density: their
 * scores, then the twenty-six modes to start a run at.
 *
 * Two wells rather than one page of headings, like every other parent screen -
 * the scores are one question and starting a run is another. The board needs no
 * sentence explaining that a parent's own runs are on it: their face is on the
 * podium, which says it better than a line of copy under a heading did.
 *
 * Without this screen the nav's "Speed run" item had nowhere honest to land: it
 * went straight to one arbitrary mode, and nothing in the `(parent)` tree
 * linked to the other twenty-five.
 *
 * `readParent` is called here rather than trusted from the layout, for the
 * same reason `/progress`, `/children` and the run beneath this one call it
 * too: the layout is a frame and not a gate, so it does not re-run on a
 * client-side hop between screens.
 */
export default async function ParentSpeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = parseScoreTab((await searchParams).tab);
  const { userId } = await readParent();

  return (
    <div className="space-y-4">
      <Well title="Scores">
        <SpeedScores tab={tab} basePath="/progress/speed" userId={userId} scale="parent" />
      </Well>

      <Well title="Start a run">
        <SpeedCards basePath="/progress/speed" scale="parent" />
      </Well>
    </div>
  );
}
