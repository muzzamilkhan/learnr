import { notFound } from 'next/navigation';
import { SpeedRun } from '@/components/speed-run';
import { parseMode } from '@/lib/speedrun/modes';
import { readParent } from '../../../parent';

// Per-parent state, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * A parent's own run. It lives inside the `(parent)` route group so
 * `ParentShell` stays a layout rather than something this page draws by hand -
 * see `parent-shell.tsx`. `SpeedRun` itself is unchanged from the child's copy,
 * and takes no `scale` from either: once a run starts it renders `fixed
 * inset-0` and escapes that frame the same way `RoundReward` escapes the play
 * screen, because a ninety-second timed game is not a report - and it is the
 * same size for a parent as for a child, since a question readable at a glance
 * is not a thing an adult wants smaller.
 *
 * `readParent` is called here rather than trusted from the layout, for the same
 * reason `/progress` calls it too: a layout does not re-run on a client-side
 * hop between screens, so it is a frame and not a gate.
 *
 * This route is `/progress/speed/[mode]`, nested under the report rather than
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
export default async function ParentSpeedPage({ params }: { params: Promise<{ mode: string }> }) {
  // The mode is the route here exactly as it is on the child's copy - see there
  // for why choosing an operation is no longer a place anyone can be.
  const mode = parseMode(decodeURIComponent((await params).mode));
  if (!mode) notFound();

  await readParent();

  return (
    <SpeedRun mode={mode} homeHref="/progress" backHref="/progress/speed" recordingEnabled />
  );
}
