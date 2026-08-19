import { notFound } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { SpeedRun } from '@/components/speed-run';
import { parseOperation } from '@/lib/speedrun/modes';

// Per-player state (whether recording is enabled), so it must never be
// prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * One operation's chooser, run and result, in the one client component that
 * owns all three - see `SpeedRun` for why they are not three routes. Play
 * works signed out, the same as `/play`: `recordingEnabled` is false, but the
 * run itself is unchanged.
 */
export default async function SpeedPage({ params }: { params: Promise<{ op: string }> }) {
  const op = parseOperation((await params).op);
  if (!op) notFound();

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;

  return (
    <SpeedRun
      op={op}
      homeHref="/"
      backHref="/speed"
      recordsHref="/speed/records"
      recordingEnabled={Boolean(userId)}
    />
  );
}
