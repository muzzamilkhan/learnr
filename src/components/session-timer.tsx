'use client';

import { useSyncExternalStore } from 'react';
import { formatDuration } from '@/lib/session/session';

/**
 * The wall clock is an external mutable source, so it is read through
 * useSyncExternalStore rather than state-in-an-effect. The snapshot is rounded to
 * the second so re-renders between ticks stay stable.
 *
 * Counts up with no limit — sessions are open ended for now. When parent controls
 * arrive this is where a target duration or cut-off would surface.
 */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;

export function SessionTimer({ startedAt }: { startedAt: number }) {
  // On the server there is no clock to read, so render the session's own start
  // time: elapsed is 0:00, which is what the client renders on first paint too.
  const now = useSyncExternalStore(subscribe, getSnapshot, () => startedAt);

  return (
    <p
      aria-label="Time in this session"
      className="text-2xl font-semibold text-(--color-ink-soft) tabular-nums"
    >
      {formatDuration(Math.max(0, now - startedAt))}
    </p>
  );
}
