import { notFound } from 'next/navigation';
import { SpeedRun } from '@/components/speed-run';
import { readSpeedRecords } from '@/lib/speed-records';
import { parseOperation } from '@/lib/speedrun/modes';
import { readParent } from '../../parent';

// Per-player bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * A parent's own run. It lives inside the `(parent)` route group so
 * `ParentShell` stays a layout rather than something this page draws by hand -
 * see `parent-shell.tsx`. `SpeedRun` itself is unchanged from the child's copy:
 * once a run starts it renders `fixed inset-0` and escapes that frame the same
 * way `RoundReward` escapes the play screen, because a ninety-second timed game
 * is not a report.
 *
 * `readParent` is called here rather than trusted from the layout, for the same
 * reason `/progress` calls it too: a layout does not re-run on a client-side
 * hop between screens, so it is a frame and not a gate.
 *
 * This route is `/speed-run/[op]`, not `/speed/[op]` - the path the design doc
 * sketched collides with the child's own `src/app/speed/[op]/page.tsx`. A route
 * group adds no path segment, so both would resolve to the identical URL and
 * `next build` refuses it outright ("You cannot have two parallel pages that
 * resolve to the same path"). `/speed-run` keeps the nav's own wording and
 * stays a peer of `/progress` and `/children` rather than nesting under either.
 */
export default async function ParentSpeedPage({ params }: { params: Promise<{ op: string }> }) {
  const op = parseOperation((await params).op);
  if (!op) notFound();

  const { userId } = await readParent();
  const bests = await readSpeedRecords(userId);

  return (
    <SpeedRun
      op={op}
      bests={bests}
      homeHref="/progress"
      recordsHref="/speed-run/records"
      recordingEnabled
    />
  );
}
