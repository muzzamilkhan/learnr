import { notFound } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { SpeedRun } from '@/components/speed-run';
import { parseMode } from '@/lib/speedrun/modes';
import { CHILD_SPEED_HREF } from '@/lib/speedrun/tabs';

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
 */
export default async function SpeedPage({ params }: { params: Promise<{ mode: string }> }) {
  const mode = parseMode(decodeURIComponent((await params).mode));
  if (!mode) notFound();

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  return (
    <SpeedRun
      mode={mode}
      homeHref="/"
      backHref={CHILD_SPEED_HREF}
      recordingEnabled={Boolean(userId)}
    />
  );
}
