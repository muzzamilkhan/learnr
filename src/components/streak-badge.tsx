'use client';

import { useSyncExternalStore } from 'react';
import { currentStreak, type PlayStreak } from '@/lib/rewards/streak';
import { FlameIcon } from './star-icon';

/**
 * How many days in a row, on the home screen.
 *
 * It lives here rather than on the play screen on purpose: a child at the home
 * screen is deciding whether to practise, which is exactly when a run of days is
 * worth seeing. Mid-question it is one more number to watch instead of the
 * question, and this app puts nothing on that screen for a child to lose.
 *
 * Nothing to subscribe to: the day only turns over at midnight, and a child
 * whose home screen has been open since yesterday will reload it long before the
 * stale number matters. Stable identity, so the store is never resubscribed.
 */
const subscribeToTheClock = () => () => {};

export function StreakBadge({ streak }: { streak: PlayStreak }) {
  /**
   * Whether the run is still alive is a question only the browser can answer —
   * the server has no idea which day it is where the child is sitting. So the
   * server renders the stored number and the client corrects it: a streak that
   * quietly ended last week must not still be claimed, and it must not be a
   * hydration mismatch either.
   *
   * The snapshot is the same number all day, so re-reading it costs nothing.
   */
  const days = useSyncExternalStore(
    subscribeToTheClock,
    () => currentStreak(streak, Date.now(), -new Date().getTimezoneOffset()),
    () => streak.days,
  );

  if (days === 0) return null;

  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-(--color-flame)/25 bg-(--color-flame-soft) px-4 py-1.5 text-xl font-bold text-(--color-flame)">
      <FlameIcon className="h-6 w-6" />
      <span className="tabular-nums">{days}</span>
      <span className="font-semibold">day{days === 1 ? '' : 's'} in a row</span>
    </p>
  );
}
