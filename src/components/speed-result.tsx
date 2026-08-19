'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { SpeedOutcome } from '@/lib/speed-records';
import { modeLabel, operationLabel } from '@/lib/speedrun/modes';
import { resultTone } from '@/lib/speedrun/records';
import type { RunResult } from '@/lib/speedrun/run';
import { playSound } from './sounds';

/**
 * The ninety seconds are up. This is where everything the run had no time for
 * gets said: the score, what it beat, and the ones that got away.
 *
 * Three things to say rather than two, and which one is `resultTone`'s answer -
 * the thresholds live in `lib` where they are tested, not in a chain of
 * conditionals here. A beaten best gets the loud treatment `RoundReward`
 * established, fanfare and all, because a player already knows what that screen
 * and that sound mean and this is the same kind of event, only bigger. A first
 * run gets no fanfare at all: there is genuinely nothing to have beaten, and
 * inventing a celebration for it is what would make every later one worth less.
 *
 * A fourth case has no tone, because it has nothing to compare against.
 * `outcome` is null when the run was never banked - signed out, no database, or
 * a write that failed - and then the score stands alone. Saying "that's your
 * score to beat" over a record that was never stored would be promising a child
 * something the next run cannot find.
 *
 * `fixed inset-0`, so it escapes whatever frame the run was started from - the
 * same reason `RoundReward` covers the play screen rather than sitting in it.
 */

/** How many misses are worth reading back. Beyond this it is a list, not a lesson. */
const MAX_MISSES = 12;

interface Props {
  result: RunResult;
  outcome: SpeedOutcome | null;
  homeHref: string;
  recordsHref: string;
  onAgain: () => void;
}

export function SpeedResult({ result, outcome, homeHref, recordsHref, onAgain }: Props) {
  const tone = outcome === null ? null : resultTone(outcome.previousBest, result.correct);
  const record = tone === 'record';

  // The same fanfare a round of ten gets, and only for the one event that has
  // earned it. A sound on every result would make the sound mean "finished"
  // rather than "beaten".
  useEffect(() => {
    if (record) playSound('tada');
  }, [record]);

  return (
    <div
      className={`no-select fixed inset-0 z-40 flex flex-col overflow-hidden px-4 py-5 sm:px-8 sm:py-8 ${
        record ? 'bg-(--color-star-soft)' : 'bg-(--color-paper)'
      }`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-4 sm:gap-6">
        <header className="shrink-0 animate-[reward-in_400ms_ease-out_both] text-center">
          <p className="text-sm font-semibold tracking-wide text-(--color-ink-soft) uppercase sm:text-base">
            {operationLabel(result.mode.op)} &middot; {modeLabel(result.mode)}
          </p>

          <p className={`mt-1 text-2xl font-bold sm:text-3xl ${record ? 'text-(--color-star)' : ''}`}>
            {record ? 'New personal best!' : 'Run finished'}
          </p>

          <p
            className={`mt-1 text-6xl leading-none font-bold tabular-nums sm:text-7xl ${
              record ? 'text-(--color-star)' : 'text-(--color-brand)'
            }`}
          >
            {result.correct}
            <span className="ml-2 align-middle text-2xl font-semibold text-(--color-ink-soft) sm:text-3xl">
              right
            </span>
          </p>

          <Comparison result={result} outcome={outcome} tone={tone} />
        </header>

        {/* The teaching the run itself had no room for. It is the only part of
            this screen that can outgrow the viewport, so it is the only part
            allowed to scroll - the screen behind it never does. */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-(--color-line) bg-(--color-card) p-3 sm:p-4">
          <h2 className="shrink-0 text-base font-semibold sm:text-lg">
            {result.missed.length === 0 ? 'Nothing missed' : 'The ones you missed'}
          </h2>

          {result.missed.length === 0 ? (
            <p className="mt-2 text-(--color-ink-soft)">
              {result.answered === 0
                ? 'No questions answered this time.'
                : 'Every answer was right. Go again and see how many more you can get.'}
            </p>
          ) : (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-(--color-line) overflow-y-auto">
              {result.missed.slice(0, MAX_MISSES).map((miss, index) => (
                <li
                  // Prompts repeat inside one run - a mode like `multiply.2` has
                  // only twelve questions in it - so the position is the only
                  // thing that tells two identical misses apart.
                  key={`${miss.prompt}-${index}`}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  {/* Elided rather than wrapped, so the column reads down. */}
                  <span className="min-w-0 flex-1 truncate font-semibold tabular-nums">
                    {miss.prompt}
                  </span>
                  <span className="shrink-0 tabular-nums text-(--color-wrong) line-through">
                    {miss.response}
                  </span>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-(--color-right)">
                    {miss.expected}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result.missed.length > MAX_MISSES ? (
            <p className="mt-2 shrink-0 text-sm text-(--color-ink-soft)">
              and {result.missed.length - MAX_MISSES} more
            </p>
          ) : null}
        </section>

        <nav className="flex shrink-0 gap-3">
          <Link href={recordsHref} className={`${BUTTON} ${SECONDARY}`}>
            See records
          </Link>
          {/* In place, never a navigation: the whole reason the run screen is one
              component with four phases is that going again is instant. */}
          <button type="button" onClick={onAgain} className={`${BUTTON} ${PRIMARY}`}>
            Try again
          </button>
          <Link href={homeHref} className={`${BUTTON} ${SECONDARY}`}>
            Go home
          </Link>
        </nav>
      </div>
    </div>
  );
}

/**
 * What the score is measured against, which is nothing at all until there is a
 * previous best of this player's own to measure it against.
 */
function Comparison({
  result,
  outcome,
  tone,
}: {
  result: RunResult;
  outcome: SpeedOutcome | null;
  tone: ReturnType<typeof resultTone> | null;
}) {
  // Nothing was banked, so there is no best to speak of. Silence rather than a
  // number, for the same reason `readObservations` returns null rather than [].
  if (outcome === null || tone === null) return null;

  if (tone === 'first') {
    return (
      <p className="mt-2 text-lg text-(--color-ink-soft) sm:text-xl">
        That&rsquo;s your score to beat.
      </p>
    );
  }

  if (tone === 'record') {
    return (
      <p className="mt-2 text-lg text-(--color-ink-soft) sm:text-xl">
        Your old best was{' '}
        <span className="font-semibold tabular-nums line-through">{outcome.previousBest}</span>
      </p>
    );
  }

  // Short of it. The gap is written as what it would take to *beat* the best,
  // not to match it, because matching it is not what the screen is asking for.
  const toBeat = outcome.best - result.correct + 1;
  return (
    <p className="mt-2 text-lg text-(--color-ink-soft) sm:text-xl">
      {toBeat === 1 ? (
        <>
          You matched your best of{' '}
          <span className="font-semibold tabular-nums">{outcome.best}</span> - one more beats it
        </>
      ) : (
        <>
          Your best is <span className="font-semibold tabular-nums">{outcome.best}</span> -{' '}
          {toBeat} more to beat it
        </>
      )}
    </p>
  );
}

const BUTTON =
  'flex h-14 flex-1 items-center justify-center rounded-xl text-center text-base leading-tight font-semibold transition active:scale-95 sm:h-16 sm:rounded-2xl sm:text-xl';
const PRIMARY = 'bg-(--color-brand) text-white';
const SECONDARY = 'border-2 border-(--color-line) bg-(--color-card) text-(--color-ink-soft)';
