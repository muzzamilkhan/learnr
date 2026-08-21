import { SpeedCards } from '@/components/speed-cards';
import { SpeedScores } from '@/components/speed-scores';
import { Well } from '@/components/well';
import { PARENT_DEFAULT_TAB } from '@/lib/speedrun/tabs';
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
 * **It opens on the leaderboard, where a child's screen opens on their own
 * records.** A parent's personal bests are the least of what this screen has to
 * tell them - they play, but they are not who the house is about - and how
 * everyone is going is the question they came with, the same reason `/`
 * redirects them to the report rather than to `/children`. Their own runs are
 * one tap away and still on the same screen.
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
  const tab = (await searchParams).tab;
  const { userId } = await readParent();

  return (
    <div className="space-y-4">
      <Well title="Scores">
        {/* The tabs and the runs share a path here, where a child's do not: a
            parent's scores and a parent's runs are both under this screen. */}
        <SpeedScores
          tab={tab}
          defaultTab={PARENT_DEFAULT_TAB}
          tabPath="/progress/speed"
          runPath="/progress/speed"
          userId={userId}
          scale="parent"
        />
      </Well>

      <Well title="Start a run">
        <SpeedCards basePath="/progress/speed" scale="parent" />
      </Well>
    </div>
  );
}
