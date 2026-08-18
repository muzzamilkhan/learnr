'use client';

import { useSyncExternalStore } from 'react';
import { localDay } from '@/lib/day';
import {
  dayTotal,
  targetUnits,
  totalFor,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { TargetBar } from './target-bar';

/**
 * Today's goal, on the screen a child checks before they start - which is
 * exactly when "how far off am I" is the question they have.
 *
 * There is room for words here, unlike the play screen, so the bar gets a line
 * saying what the goal is and how much of it is done.
 *
 * It stays once the goal is met, where the play screen's bar goes - the two are
 * protecting different things. On the play screen a bar that no longer moves is
 * only something to look at instead of the question; here a child arriving to
 * find the day already done is worth seeing, and this is the one place that
 * lasts, since the celebration itself is over in four seconds.
 *
 * Which of the server's answers count as today depends on the offset of this
 * device, which the server does not have - so the fold happens here, read the
 * way the profile menu reads the streak and the play screen reads its bar. The
 * server snapshot says nothing at all rather than a number computed at UTC,
 * because a wrong count that corrects itself a frame later is worse than one
 * that arrives a frame late.
 */
export function DailyGoal({
  target,
  answers,
  awardedDay,
}: {
  target: DailyTarget;
  answers: TargetAnswer[];
  awardedDay: number | null;
}) {
  /**
   * What today has come to, in the target's own unit. A number rather than an
   * object: `useSyncExternalStore` compares snapshots by identity, and a fresh
   * object every read is a render loop.
   */
  const done = useSyncExternalStore(
    subscribeToTheClock,
    () => {
      const now = Date.now();
      const offsetMinutes = -new Date(now).getTimezoneOffset();
      return totalFor(dayTotal(answers, { now, offsetMinutes }), target.kind);
    },
    () => null,
  );

  /**
   * Whether the day the server banked stars for is *this* day - the same
   * device-only question, and the reason the goal can read as reached on a
   * morning's practice a child has come back after school from.
   */
  const awardedToday = useSyncExternalStore(
    subscribeToTheClock,
    () => awardedDay != null && awardedDay === localDay(Date.now(), -new Date().getTimezoneOffset()),
    () => false,
  );

  // Nothing at all until the device has said what day it is.
  if (done === null) return null;

  const units = targetUnits(target);
  const fraction = Math.min(1, done / units);
  const complete = done >= units || awardedToday;

  const count =
    target.kind === 'minutes'
      ? `${Math.floor(done / 60_000)} of ${target.value} min`
      : `${done} of ${target.value}`;

  return (
    <div
      className={`mb-8 rounded-2xl border-2 px-5 py-4 ${
        complete
          ? 'border-(--color-right) bg-(--color-right-soft)'
          : 'border-(--color-line) bg-(--color-card)'
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xl font-semibold">
          {complete ? (
            <span className="text-(--color-right)">Goal reached!</span>
          ) : (
            <>
              Today&rsquo;s goal: {target.value}{' '}
              {target.kind === 'minutes' ? 'minutes' : 'questions'}
            </>
          )}
        </p>
        {/* The count stays after the goal is met, and keeps going up: carrying on
            past the goal is the thing this app would rather they did, so the
            screen has to have somewhere to show that they did. */}
        <p className="text-lg tabular-nums text-(--color-ink-soft)">{count}</p>
      </div>
      <TargetBar fraction={fraction} className="mt-3" />
    </div>
  );
}

/**
 * Nothing to subscribe to: the day turns over at midnight, and a child whose
 * screen has been open since yesterday will reload it long before the stale
 * number matters. Stable identity, so the store is never resubscribed.
 */
const subscribeToTheClock = () => () => {};
