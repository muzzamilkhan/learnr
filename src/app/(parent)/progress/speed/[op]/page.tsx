import { notFound } from 'next/navigation';
import { SpeedRun } from '@/components/speed-run';
import { parseOperation } from '@/lib/speedrun/modes';
import { readParent } from '../../../parent';

// Per-parent state, so it must never be prerendered and shared.
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
 * This route is `/progress/speed/[op]`, nested under the report rather than
 * a bare top-level segment sitting beside `/progress` and `/children`. A route
 * group adds no path segment, so a bare top-level name here would sit one
 * hyphen away from the child's own `/speed` - two URLs told apart only by
 * spelling, both individually valid, so a later edit that gets one backwards
 * (a redirect, a copy-pasted href, a shared link builder) would produce no
 * build error and no test failure. Nesting tells them apart by depth instead,
 * which cannot be confused the same way, and it is the truer structure
 * besides: a parent's own speed run is a facet of their report, where
 * `/children` is a genuinely separate destination.
 */
export default async function ParentSpeedPage({ params }: { params: Promise<{ op: string }> }) {
  const op = parseOperation((await params).op);
  if (!op) notFound();

  await readParent();

  return (
    <SpeedRun
      op={op}
      homeHref="/progress"
      backHref="/progress/speed"
      recordsHref="/progress/speed/records"
      recordingEnabled
      // The chooser at the parent's density; the run itself is the same size
      // for everyone. See `SpeedRun`'s `scale`.
      scale="parent"
    />
  );
}
