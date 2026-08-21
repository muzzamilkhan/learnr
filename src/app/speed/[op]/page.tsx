import { notFound } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { SpeedRun } from '@/components/speed-run';
import { parseMode, parseOperation } from '@/lib/speedrun/modes';
import { CHILD_SPEED_HREF } from '@/lib/speedrun/tabs';

// Per-player state (whether recording is enabled), so it must never be
// prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * One operation's chooser, run and result, in the one client component that
 * owns all three - see `SpeedRun` for why they are not three routes. Play
 * works signed out, the same as `/play`: `recordingEnabled` is false, but the
 * run itself is unchanged.
 *
 * `?mode=` is what a card's Try button adds: the mode is already chosen, so the
 * chooser is skipped and the count-in starts. It goes through `parseMode` like
 * every other stored or typed key, and it has to name a mode of *this*
 * operation - a hand-typed `/speed/add?mode=multiply.7` is a mismatch, and
 * dropping it lands on the chooser, which is where a request nobody can honour
 * belongs. A missing or unrecognised mode is simply the ordinary way in.
 */
export default async function SpeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ op: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const op = parseOperation((await params).op);
  if (!op) notFound();

  const asked = (await searchParams).mode;
  const startMode = asked ? parseMode(asked) : null;

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  return (
    <SpeedRun
      op={op}
      startMode={startMode?.op === op ? startMode : undefined}
      homeHref="/"
      backHref={CHILD_SPEED_HREF}
      recordingEnabled={Boolean(userId)}
    />
  );
}
