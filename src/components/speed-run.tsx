'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitRunAction } from '@/app/speed/actions';
import { appendNumeric } from '@/lib/session/answers';
import type { SpeedBest, SpeedOutcome } from '@/lib/speed-records';
import {
  modeKey,
  modeLabel,
  modesFor,
  operationGlyph,
  operationLabel,
  type Mode,
  type Operation,
} from '@/lib/speedrun/modes';
import {
  answerRun,
  COUNTDOWN_MS,
  isOver,
  pulseFor,
  remainingMs,
  runResult,
  startRun,
  type Pulse,
  type RunResult,
  type RunState,
} from '@/lib/speedrun/run';
import { BoltIcon } from './bolt-icon';
import { ExitIcon } from './exit-icon';
import { NumberPad } from './number-pad';
import { playSound, primeSounds } from './sounds';
import { SpeedResult } from './speed-result';
import { SpeedTimer } from './speed-timer';

/**
 * A speed run, start to finish: choose a mode, count in, play the ninety
 * seconds, see the score.
 *
 * Four phases in one client component, because going again has to be instant.
 * A route per phase would put a navigation between a child tapping "Try again"
 * and the next run, and the whole appeal of this screen is that the gap between
 * runs is nothing at all.
 *
 * It takes the **operation**, not a mode: the chooser is the first thing it
 * shows, so which of that operation's modes is being run is this component's own
 * state and never a URL. `/speed/multiply` is a place; `/speed/multiply.7` would
 * be twenty-seven of them, each one a page load away from its neighbours.
 *
 * The run and the result render `fixed inset-0`, escaping whatever frame they
 * were started from - the same reason `RoundReward` covers the play screen
 * rather than sitting inside it. A parent's shell is a report frame, and a
 * ninety-second game is not a report. The chooser stays in the flow, since that
 * is a screen someone is deciding on rather than playing.
 *
 * Stripped further than the play screen: the only things on it are the way out
 * and the timer. No profile menu (a run moves neither total), no hint, no
 * narration, no target bar, no logo. The questions are symbolic - `7 × 4` - so a
 * child who cannot read words can still read them, and everything else would
 * only be something to look at instead of the question.
 */

type Phase = 'choosing' | 'countdown' | 'running' | 'result';

/** How long the entry box stays red after a wrong answer. Long enough to see, short
 * enough to be gone before the next answer is typed - nothing here ever waits. */
const FLASH_MS = 320;

/** The run-up, counted in whole seconds. Never below one, whatever `COUNTDOWN_MS` says. */
const COUNT_FROM = Math.max(1, Math.round(COUNTDOWN_MS / 1000));

interface Props {
  op: Operation;
  /** This player's bests, for the chooser. Null when they could not be read. */
  bests: SpeedBest[] | null;
  /** Where "Go home" goes: `/` for a child, `/progress` for a parent. */
  homeHref: string;
  recordsHref: string;
  recordingEnabled: boolean;
}

export function SpeedRun({ op, bests, homeHref, recordsHref, recordingEnabled }: Props) {
  const modes = useMemo(() => modesFor(op), [op]);
  const bestByKey = useMemo(
    () => new Map((bests ?? []).map((best) => [best.mode, best.best])),
    [bests],
  );

  const [phase, setPhase] = useState<Phase>('choosing');
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [run, setRun] = useState<RunState | null>(null);
  /**
   * `run` mirrored outside React state, for the same reason `entryRef` exists on
   * the play screen: the keyboard listener, the end-of-run timeout and the pulse
   * tick are all plain browser callbacks, and every one of them can fire between
   * an answer landing and React committing it. Reading the ref means none of them
   * can ever act on a question that has already been answered.
   */
  const runRef = useRef<RunState | null>(null);
  const [entry, setEntry] = useState('');
  const entryRef = useRef('');
  /** Red on the entry box after a wrong answer - the only thing said about it. */
  const [wrong, setWrong] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulse, setPulse] = useState<Pulse>('calm');
  const [count, setCount] = useState(COUNT_FROM);
  const [result, setResult] = useState<RunResult | null>(null);
  const [outcome, setOutcome] = useState<SpeedOutcome | null>(null);

  const updateEntry = useCallback((next: string | ((value: string) => string)) => {
    const resolved = typeof next === 'function' ? next(entryRef.current) : next;
    entryRef.current = resolved;
    setEntry(resolved);
  }, []);

  const advance = useCallback((next: RunState) => {
    runRef.current = next;
    setRun(next);
  }, []);

  // Fetched when the screen mounts, since iOS gates playback on a gesture but
  // never loading. Twenty-five sounds in ninety seconds is not the moment to be
  // waiting on a round trip.
  useEffect(primeSounds, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const start = useCallback(() => {
    // The clock starts when the count-in ends, so the first question has been on
    // screen and read by the time it is worth anything. The seed is made here
    // rather than on the server: nothing about a run is rendered before this tap,
    // so there is no hydration to keep in step.
    const startedAt = Date.now() + COUNTDOWN_MS;
    advance(startRun({ mode, seed: `${startedAt}-${Math.random()}`, startedAt }));
    updateEntry('');
    setWrong(false);
    setPulse('calm');
    setCount(COUNT_FROM);
    setResult(null);
    setOutcome(null);
    setPhase('countdown');
  }, [advance, mode, updateEntry]);

  const finish = useCallback(() => {
    const state = runRef.current;
    if (state === null) return;

    const ended = runResult(state);
    setResult(ended);
    setPhase('result');

    // Best-effort like every other write in this app: a failed submit costs a
    // record, and the result screen then says nothing about a best rather than
    // claiming one that was never stored.
    if (!recordingEnabled) return;

    // A run nobody answered leaves no row behind. This looks like a saving and
    // is not: a first-ever run banks whatever it scored, so an abandoned one
    // would bank a nought and become the baseline every later run is measured
    // against - and the first *real* run would then beat it, fire the record
    // celebration and put a personal-best banner in front of a parent. That is
    // exactly what "a first run is not a record" exists to prevent, laundered
    // through a run that never happened. The guard is on the answer count and
    // never on the score: nought out of eight is a real run and a real
    // baseline, and it is banked like any other.
    if (ended.answered === 0) return;
    submitRunAction(modeKey(state.mode), ended.correct, ended.answered)
      .then(setOutcome)
      .catch(() => {});
  }, [recordingEnabled]);

  const submit = useCallback(
    (value: string) => {
      const state = runRef.current;
      const now = Date.now();
      // An empty entry is not an abandoned answer, it is no answer - the tick is
      // disabled for it and Enter does nothing.
      if (state === null || value.trim() === '' || isOver(state, now)) return;

      const next = answerRun(state, value, now);
      // Whether it was right is read off what the fold did rather than graded
      // again here: `answerRun` owns that rule, and two copies of it would be one
      // copy too many.
      const right = next.correct > state.correct;

      playSound(right ? 'correct' : 'incorrect');

      // Nothing is shown about what it should have been. Ninety seconds is not
      // teaching time, and a correction nobody has time to read is only a delay -
      // paid most often by the child getting the most wrong. The misses are kept
      // in the run state and read back on the result screen, where there is time.
      if (!right) {
        setWrong(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setWrong(false), FLASH_MS);
      }

      // No pause either way. The play screen holds a right answer on screen so a
      // child can enjoy it; here the clock is the thing being enjoyed.
      advance(next);
      updateEntry('');
    },
    [advance, updateEntry],
  );

  const press = useCallback(
    (key: string) => {
      const state = runRef.current;
      if (state === null) return;

      const next = appendNumeric(entryRef.current, key);
      if (next === entryRef.current) return;
      updateEntry(next);

      // Commits the instant what is typed matches, so a fast player never reaches
      // for the tick at all. It is an exact *string* match while the tick grades
      // numerically, which is the whole reason the tick stays: `07` for 7 is not
      // auto-advanced, and is still right when it is checked.
      if (next === String(state.current.answer)) submit(next);
    },
    [submit, updateEntry],
  );

  // The count-in. One timeout per second is one more than needed, so it is an
  // interval to draw the numbers and a single timeout to end the phase - which
  // means the clock the run is measured by is never the sum of three ticks.
  useEffect(() => {
    if (phase !== 'countdown') return;

    const ticking = setInterval(() => setCount((n) => Math.max(1, n - 1)), 1000);
    const done = setTimeout(() => setPhase('running'), COUNTDOWN_MS);
    return () => {
      clearInterval(ticking);
      clearTimeout(done);
    };
  }, [phase]);

  /**
   * The two clocks the run needs, and neither of them draws the bar: the bar is
   * one CSS transition set at the start, and this is the moment the run ends plus
   * a once-a-second look at how urgent it has become. A second is as often as
   * `pulseFor` has anything new to say, and the whole screen re-rendering more
   * often than that under a child answering as fast as they can is exactly what
   * the transition exists to avoid.
   */
  useEffect(() => {
    if (phase !== 'running' || runRef.current === null) return;

    const over = setTimeout(finish, remainingMs(runRef.current, Date.now()));
    const beat = setInterval(() => {
      const live = runRef.current;
      if (live) setPulse(pulseFor(remainingMs(live, Date.now())));
    }, 1000);

    return () => {
      clearTimeout(over);
      clearInterval(beat);
    };
  }, [phase, finish]);

  // A physical keyboard plays as well as the pad. A parent on a laptop is a
  // keyboard player and so is an older child, and on this screen the difference
  // between the two is most of a score.
  useEffect(() => {
    if (phase !== 'running') return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Backspace') {
        // Backspace's browser default is to navigate back when focus is not in an
        // editable field, which nothing here is.
        event.preventDefault();
        updateEntry((value) => value.slice(0, -1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        // The ref, not the closure: this listener is replaced on each render, and
        // that replacement happens after React commits - typing a last digit and
        // hitting Enter in the same breath lands inside that window.
        submit(entryRef.current);
      } else if (/^[0-9.]$/.test(event.key)) {
        // Exactly the keys the pad has. No minus: nothing in a speed run has a
        // negative answer, by construction in `modes.ts`.
        press(event.key);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, press, submit, updateEntry]);

  if (phase === 'result' && result !== null) {
    return (
      <SpeedResult
        result={result}
        outcome={outcome}
        homeHref={homeHref}
        recordsHref={recordsHref}
        onAgain={start}
      />
    );
  }

  if (phase === 'choosing' || run === null) {
    return (
      <Chooser
        op={op}
        modes={modes}
        chosen={mode}
        bestByKey={bestByKey}
        homeHref={homeHref}
        onChoose={setMode}
        onStart={start}
      />
    );
  }

  return (
    <div className="no-select fixed inset-0 z-40 flex flex-col overflow-hidden bg-(--color-paper) px-4 py-3 sm:px-10 sm:py-5">
      {/* The way out and the timer, and that is the whole header. The door sits
          in the corner furthest from the pad, and leaving records nothing -
          there is no confirmation, because a modal over a running clock is worse
          than the mis-tap it prevents. */}
      <header className="flex shrink-0 items-center gap-3 sm:gap-5">
        <Link
          href={homeHref}
          aria-label="Leave the run"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>

        <SpeedTimer runningSince={phase === 'running' ? run.startedAt : null} pulse={pulse} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 py-2 sm:gap-3 sm:py-4">
        {/* The one to come, sitting above the one in hand rather than behind it.
            Reading ahead is most of what makes a fast run fast, and this is why
            `RunState` carries a lookahead of one rather than the screen faking
            it. Hidden from a screen reader: it is a preview, and announcing two
            questions at once would leave a listener with neither. */}
        <p
          key={`preview-${run.draw}`}
          aria-hidden
          className="animate-[reward-in_260ms_ease-out_both] text-center text-[clamp(1.125rem,3.2vh,2rem)] font-semibold text-(--color-ink-soft) opacity-40 tabular-nums"
        >
          {run.next.prompt}
        </p>

        {/* The live region is the wrapper and not the question, because the
            question is keyed on the draw and so is a new element every time: a
            region that arrives already holding its text is not a change, and
            several screen readers say nothing about it. The preview above stays
            hidden - announcing both would read every question twice, once as a
            guess and once as the real thing. */}
        <div aria-live="polite" className="w-full">
          {/* Dropping into place from where its preview was, so the line above
              reads as the next question rather than as a second one. */}
          <h1
            key={`current-${run.draw}`}
            className="animate-[speed-drop_200ms_ease-out_both] text-center text-[clamp(2rem,7vh,4.5rem)] leading-none font-bold tabular-nums"
          >
            {run.current.prompt}
          </h1>
        </div>

        <output
          aria-live="polite"
          className={`mt-1 flex h-14 w-40 items-center justify-center rounded-3xl border-2 text-3xl font-bold tabular-nums transition-colors sm:h-20 sm:w-56 sm:text-5xl ${
            wrong
              ? 'border-(--color-wrong) bg-(--color-wrong-soft) text-(--color-wrong)'
              : 'border-(--color-line) bg-(--color-card) text-(--color-ink)'
          }`}
        >
          {entry || <span className="opacity-25">?</span>}
        </output>
      </div>

      {/* The same fixed-height slot the play screen gives its pads, for the same
          reason: the screen may not scroll, so the pad's share of the height is
          decided once and the question takes what is left. */}
      <div className="flex h-[clamp(12rem,40vh,20rem)] shrink-0 flex-col justify-center sm:h-[clamp(16rem,40vh,22rem)]">
        <NumberPad
          disabled={phase !== 'running'}
          canCheck={entry !== ''}
          onDigit={press}
          onBackspace={() => updateEntry((value) => value.slice(0, -1))}
          onCheck={() => submit(entryRef.current)}
        />
      </div>

      {phase === 'countdown' && <Countdown count={count} />}
    </div>
  );
}

/**
 * The run-up, over the first question rather than instead of it. Without it the
 * first seconds of every run are spent working out what is being asked, which
 * makes the score partly a measure of reaction time.
 */
function Countdown({ count }: { count: number }) {
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 flex items-center justify-center bg-(--color-paper)/85 backdrop-blur-sm"
    >
      <p
        // Keyed on the number, so each one plays its own arrival rather than the
        // three of them sharing one animation that never restarts.
        key={count}
        className="animate-[speed-count_1000ms_ease-out_both] text-[clamp(5rem,22vh,12rem)] leading-none font-bold text-(--color-brand) tabular-nums"
      >
        {count}
      </p>
    </div>
  );
}

/**
 * Which variation of this operation to run, with whatever has already been
 * scored on each underneath it.
 *
 * Drawn at the child's scale even when a parent's frame is around it, because
 * this is the screen they tap: a chip sized for a laptop pointer is not a chip a
 * six-year-old hits on an iPad, and there is nothing dense enough here to be
 * worth shrinking for an adult.
 */
function Chooser({
  op,
  modes,
  chosen,
  bestByKey,
  homeHref,
  onChoose,
  onStart,
}: {
  op: Operation;
  modes: readonly Mode[];
  chosen: Mode;
  bestByKey: Map<string, number>;
  homeHref: string;
  onChoose: (mode: Mode) => void;
  onStart: () => void;
}) {
  const chosenKey = modeKey(chosen);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex items-center gap-3 sm:gap-4">
        <Link
          href={homeHref}
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--color-grape-soft) text-3xl font-bold text-(--color-grape) sm:h-16 sm:w-16 sm:text-4xl">
          {operationGlyph(op)}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{operationLabel(op)}</h1>
          <p className="flex items-center gap-1.5 text-base text-(--color-ink-soft) sm:text-lg">
            <BoltIcon className="h-4 w-4 text-(--color-sun) sm:h-5 sm:w-5" />
            90 seconds
          </p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:grid-cols-3 sm:gap-4">
        {modes.map((mode) => {
          const key = modeKey(mode);
          const best = bestByKey.get(key);
          const selected = key === chosenKey;

          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(mode)}
              className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-3 text-center transition active:scale-95 sm:min-h-24 ${
                selected
                  ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                  : 'border-(--color-line) bg-(--color-card)'
              }`}
            >
              <span className="text-lg leading-tight font-semibold sm:text-xl">
                {modeLabel(mode)}
              </span>
              {/* A row kept whether or not there is a best in it, so the labels
                  sit on one line across the grid. Nothing is drawn for a mode
                  with no best: whether that is "never run" or "could not be
                  read" is a distinction the records cabinet draws, and a dash
                  here would answer it wrongly half the time. */}
              <span className="min-h-5 text-sm text-(--color-ink-soft) tabular-nums">
                {best === undefined ? '' : `Best ${best}`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-(--color-brand) text-2xl font-bold text-white transition active:scale-95 sm:mt-8 sm:h-20 sm:text-3xl"
      >
        <BoltIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        Start
      </button>
    </section>
  );
}
