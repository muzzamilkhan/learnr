'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { SpeedOutcome } from '@/lib/speed-records';
import { modeLabel, operationGlyph, operationLabel } from '@/lib/speedrun/modes';
import { resultTone } from '@/lib/speedrun/records';
import type { RunResult } from '@/lib/speedrun/run';
import { OPERATION_ACCENT, type Accent } from './speed-cards';
import { playSound } from './sounds';

/**
 * The ninety seconds are up: the score, and what it beat.
 *
 * **It used to also read back the ones that got away, and there are none.** A
 * run only moves on a right answer, so there is no miss to show and no second
 * number to put beside the score - right, missed and answered were three tiles
 * that are now one number three times. What is left is a screen with one thing
 * on it, which is what the run itself became.
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
 *
 * **The screen wears the colour of the operation just run** - `OPERATION_ACCENT`,
 * the same table the cards are built from, so the screen that ends a run belongs
 * to the card that started it instead of being the one blue number every mode
 * shares. A record overrides it with the star tokens: the rarest state is the
 * one a player already recognises from the round rewards and the streak, and it
 * must not read as merely another operation's colour.
 *
 * The loud treatment is driven by `outcome.isRecord`, not by recomputing from
 * `previousBest` here. The two usually agree, but not on a guarded update that
 * matched no rows - a second tab, or a retry, already banked a higher score -
 * where the server correctly returns `isRecord: false` and leaves `seen: true`
 * so the parent's banner stays quiet. Recomputing from the stale
 * `previousBest` would fire the fanfare anyway, congratulating the child for a
 * record that was never stored and that their parent is never told about.
 * `resultTone` still picks the COPY - "first" vs "short" both read as calm -
 * but only the server's word on what actually got written decides the
 * celebration.
 */

/**
 * A beaten best is the one result that does not wear its operation's colour.
 * The star tokens are what a reward looks like everywhere else in this app -
 * the round's stars, the streak - so the rarest state on this screen is the one
 * a player already recognises, and the operation's own colour is what every
 * other run gets.
 */
const RECORD_ACCENT: Accent = {
  tile: 'bg-(--color-star-soft) text-(--color-star)',
  border: '',
  line: 'border-(--color-star)',
  wash: 'bg-(--color-star-soft)',
  text: 'text-(--color-star)',
  solid: 'bg-(--color-star)',
};

/**
 * The screen arrives in two beats rather than at once: the score, then the way
 * on. It is the same `reward-in` the header always used, staggered - a screen
 * that assembles reads as something that just happened, where a screen that
 * appears whole reads as a page that was always there. It used to be four,
 * because there used to be four things on it.
 */
const ENTRANCE = 'animate-[reward-in_400ms_ease-out_both]';
const DELAY = ['', '[animation-delay:120ms]'];

interface Props {
  result: RunResult;
  outcome: SpeedOutcome | null;
  homeHref: string;
  recordsHref: string;
  onAgain: () => void;
}

export function SpeedResult({ result, outcome, homeHref, recordsHref, onAgain }: Props) {
  const tone = outcome === null ? null : resultTone(outcome.previousBest, result.correct);
  const record = outcome !== null && outcome.isRecord;

  // The same fanfare a round of ten gets, and only for the one event that has
  // earned it. A sound on every result would make the sound mean "finished"
  // rather than "beaten".
  useEffect(() => {
    if (record) playSound('tada');
  }, [record]);

  // The colour of the operation just run, so the screen that ends a run belongs
  // to the same card that started it - except for a record, which belongs to the
  // stars instead.
  const accent = record ? RECORD_ACCENT : OPERATION_ACCENT[result.mode.op];

  return (
    <div
      className={`no-select fixed inset-0 z-40 flex flex-col overflow-hidden px-4 py-5 sm:px-8 sm:py-8 ${accent.wash}`}
    >
      {/* One block and a row of buttons, so the score centres itself in
          whatever the viewport gives rather than sitting under a panel that is
          no longer there. The screen still never scrolls. */}
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-center gap-8 sm:gap-10">
        <header className={`shrink-0 text-center ${ENTRANCE}`}>
          {/* The operation's own sign, in its own tile - the same pairing the
              card that started the run is built from. A record lands it rather
              than fading it in: `star-land` is what a reward does here. */}
          <span
            aria-hidden
            className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl text-2xl font-bold sm:size-14 sm:text-3xl ${accent.tile} ${
              record ? 'animate-[star-land_500ms_ease-out_both]' : ''
            }`}
          >
            {operationGlyph(result.mode.op)}
          </span>

          <p className="text-sm font-semibold tracking-wide text-(--color-ink-soft) uppercase sm:text-base">
            {operationLabel(result.mode.op)} &middot; {modeLabel(result.mode)}
          </p>

          <p className={`mt-1 text-2xl font-bold sm:text-3xl ${record ? accent.text : ''}`}>
            {record ? 'New personal best!' : 'Run finished'}
          </p>

          <p className={`mt-1 text-6xl leading-none font-bold tabular-nums sm:text-7xl ${accent.text}`}>
            {result.correct}
            <span className="ml-2 align-middle text-2xl font-semibold text-(--color-ink-soft) sm:text-3xl">
              right
            </span>
          </p>

          <Comparison result={result} outcome={outcome} tone={tone} record={record} />
        </header>

        <nav className={`flex shrink-0 gap-3 ${ENTRANCE} ${DELAY[1]}`}>
          <Link href={recordsHref} className={`${BUTTON} ${SECONDARY}`}>
            See records
          </Link>
          {/* In place, never a navigation: the whole reason the run screen is one
              component with four phases is that going again is instant. It wears
              the accent because going again is what this screen is for. */}
          <button type="button" onClick={onAgain} className={`${BUTTON} ${accent.solid} text-white`}>
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
  record,
}: {
  result: RunResult;
  outcome: SpeedOutcome | null;
  tone: ReturnType<typeof resultTone> | null;
  record: boolean;
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

  // `record` (from `outcome.isRecord`), not `tone === 'record'`: the two agree
  // except on the race where a concurrent run already banked a higher score
  // between our read and our write. There `tone` still says "record" from the
  // stale `previousBest`, but nothing was actually written - the short-run copy
  // below reads `outcome.best`, which was re-read from the row after the write
  // attempt and is the honest one.
  if (record) {
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
// No `PRIMARY` constant any more: the one filled button takes the run's accent,
// which is only known at render.
const SECONDARY = 'border-2 border-(--color-line) bg-(--color-card) text-(--color-ink-soft)';
