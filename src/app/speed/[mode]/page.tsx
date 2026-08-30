import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SpeedRun } from '@/components/speed-run';
import { parseMode } from '@/lib/speedrun/modes';
import { DEBUG_COOKIE, debugEnabled, parseDebugParam } from '@/lib/speedrun/taps';
import { CHILD_SPEED_HREF, PARENT_SPEED_HREF } from '@/lib/speedrun/tabs';
import { readViewer } from '../../(parent)/parent';

// Per-player state (whether recording is enabled), so it must never be
// prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * One run, and everything after it: the count-in, the ninety seconds and the
 * result, in the one client component that owns all three - see `SpeedRun` for
 * why they are not three routes. Play works signed out, the same as `/play`:
 * `recordingEnabled` is false, but the run itself is unchanged.
 *
 * **The route is the mode.** It used to be the operation, with the mode as an
 * optional `?mode=` on top of it, because `/speed/multiply` was a screen you
 * chose the variation on. That screen has gone - choosing happens on the cards
 * now, in one place (`SpeedCards`) - so an operation is no longer anywhere a
 * player can land, and a route that only works with a query is a route that is
 * lying about what it is. `/speed/multiply.7` is a run of the seven times
 * table, and there is nothing else it could be.
 *
 * `parseMode` is the whole of the validation, which is the other thing this
 * shape buys: one boundary normaliser deciding whether a key names a mode,
 * instead of that plus a check that the mode and the path agreed about the
 * operation - a mismatch that could only ever be hand-typed and had to be
 * handled anyway.
 *
 * **A parent plays here too, and the run itself is identical.** Their runs used
 * to have a route of their own under `/progress/speed/[mode]`, rendering this
 * very component with two different hrefs on it - which is what the whole second
 * route amounted to. The ninety seconds are the same for everyone: a question
 * readable at a glance and a pad hit without looking are not things an adult
 * wants smaller, which is why `SpeedRun` takes no scale. So all that is left to
 * branch is where the two ways out lead, and that is a property of the reader
 * rather than of the URL.
 *
 * **Going back is not going home**, so both are passed. The door inside a run
 * lands on the screen the run was started from - a parent's `/speed`, a child's
 * home section - because what someone is undoing is "I picked Multiply", not "I
 * opened this app". Home differs too: a parent's home is the report.
 */
export default async function SpeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  // DIAGNOSTIC, and only `?debug=` - see `src/lib/speedrun/taps.ts`.
  searchParams: Promise<{ debug?: string }>;
}) {
  const mode = parseMode(decodeURIComponent((await params).mode));
  if (!mode) notFound();

  // Parsed here rather than beside the component: every export of a
  // `'use client'` module is a client reference, so a parser living in
  // `speed-run.tsx` could not be called on the server. The funnel is recorded
  // either way; this only decides whether it is drawn on the device.
  //
  // The URL beats the cookie both ways, and the cookie is what makes the flag
  // usable at all: a mode chip links to `/speed/multiply.7` and nothing more,
  // so `?debug=1` could not survive the tap that starts a run. Reading a cookie
  // costs this route nothing, being `force-dynamic` already.
  const debug = debugEnabled(
    parseDebugParam((await searchParams).debug),
    (await cookies()).get(DEBUG_COOKIE)?.value,
  );

  const { userId, account } = await readViewer();
  const isParent = account?.role === 'parent';

  return (
    <SpeedRun
      mode={mode}
      homeHref={isParent ? '/progress' : '/'}
      backHref={isParent ? PARENT_SPEED_HREF : CHILD_SPEED_HREF}
      recordingEnabled={Boolean(userId)}
      debug={debug}
    />
  );
}
