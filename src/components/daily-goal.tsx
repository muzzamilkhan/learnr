'use client';

import { useSyncExternalStore } from 'react';
import {
  dayProgress,
  dayTotal,
  targetProgress,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { localOffsetMinutes, subscribeToTheClock, today } from './clock';
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
      const total = dayTotal(answers, { now: Date.now(), offsetMinutes: localOffsetMinutes() });
      return dayProgress(target, total).done;
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
    () => awardedDay != null && awardedDay === today(),
    () => false,
  );

  // Nothing at all until the device has said what day it is.
  if (done === null) return null;

  const { fraction, complete: reached } = targetProgress(target, done);
  const complete = reached || awardedToday;

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
