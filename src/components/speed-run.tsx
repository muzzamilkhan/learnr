'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitRunAction } from '@/app/speed/actions';
import { appendNumeric } from '@/lib/session/answers';
import type { SpeedOutcome } from '@/lib/speed-records';
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
  judgeEntry,
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
import { OPERATION_ACCENT } from './speed-cards';
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
 * state and never a route. `/speed/multiply` is a place; `/speed/multiply.7`
 * would be fourteen of them, each one a page load away from its neighbours.
 *
 * `startMode` is the one exception and it changes none of that: a card in the
 * cabinet or on the leaderboard already names a mode, so its Try button says
 * which one to start rather than asking the chooser to ask again. The route is
 * still the operation's, the mode rides in the query, and the moment the run
 * begins it is this component's state exactly as a chosen one would be.
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
 *
 * **There is no wrong answer here, and so no Check key either.** A run moves on
 * a right answer and on nothing else: the entry is judged as it is typed, and
 * digits that can no longer become the answer flash red and clear, leaving the
 * same question up. That is one rule where there were two, and it takes several
 * things with it - the tick, Enter, the misses read back at the end, and the
 * count of questions answered, which is now just the score. What is left is the
 * thing a speed run was always for: how many you can get right in ninety
 * seconds. A run has a score and a clock, and nothing else to say.
 */

type Phase = 'choosing' | 'countdown' | 'running' | 'result';

/** How long the entry box stays red after a dead entry. Long enough to see, short
 * enough to be gone before the next digits are typed - nothing here ever waits. */
const FLASH_MS = 320;

/** The run-up, counted in whole seconds. Never below one, whatever `COUNTDOWN_MS` says. */
const COUNT_FROM = Math.max(1, Math.round(COUNTDOWN_MS / 1000));

interface Props {
  op: Operation;
  /**
   * A mode to start on, skipping the chooser - what the Try button on a card
   * sends. Absent is the ordinary way in: the chooser first, and the mode
   * chosen there.
   */
  startMode?: Mode;
  /** Where "Go home" goes: `/` for a child, `/progress` for a parent. */
  homeHref: string;
  /**
   * Where backing out goes - the chooser one level up (`/speed`,
   * `/progress/speed`), not home. Leaving a run and leaving the app are
   * different intentions, and the arrow that undoes "I picked Multiply" should
   * undo exactly that. "Go home" on the result screen still goes home.
   */
  backHref: string;
  recordingEnabled: boolean;
  /**
   * The scale of the screen that *chooses* a run, and only that one. The run
   * itself is the same size for everybody: ninety seconds against a clock needs
   * a question readable at a glance and a pad hit without looking, and those are
   * not things an adult wants smaller either. What a parent does not need is the
   * chooser in front of it drawn at a six-year-old's scale, in the middle of a
   * report drawn at theirs.
   */
  scale?: 'child' | 'parent';
}

export function SpeedRun({
  op,
  startMode,
  homeHref,
  backHref,
  recordingEnabled,
  scale = 'child',
}: Props) {
  const modes = useMemo(() => modesFor(op), [op]);

  const [phase, setPhase] = useState<Phase>(startMode ? 'countdown' : 'choosing');
  const [mode, setMode] = useState<Mode>(startMode ?? modes[0]);
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
  /** Red on the entry box after digits that cannot be the answer - the only thing said. */
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

  /**
   * A run arrived at from a card's Try button: the count-in is already on
   * screen (see the render below), and this is what puts a run under it.
   *
   * It has to be an effect rather than a lazy initialiser because starting a
   * run reads the clock and makes a seed, and a render may do neither - the
   * same purity rule that sends `requestNow()` to the request boundary. The ref
   * is what keeps it to once: `start` changes identity with `mode`, and a
   * deep-linked run must never be restarted underneath a player.
   */
  const started = useRef(false);
  useEffect(() => {
    if (!startMode || started.current) return;
    started.current = true;
    start();
  }, [startMode, start]);

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

    // A run that got nothing right leaves no row behind. This looks like a
    // saving and is not: a first-ever run banks whatever it scored, so an
    // abandoned one would bank a nought and become the baseline every later run
    // is measured against - and the first *real* run would then beat it, fire
    // the record celebration and put a personal-best banner in front of a
    // parent. That is exactly what "a first run is not a record" exists to
    // prevent, laundered through a run that never happened.
    //
    // The guard used to be on the answer count, so that nought out of eight -
    // a real run with a real baseline - was still banked. There is no such run
    // any more: a run only moves on a right answer, so a score of nought and a
    // run nobody touched are the same thing, and nought is the one score with
    // nothing to say.
    if (ended.correct === 0) return;
    submitRunAction(modeKey(state.mode), ended.correct)
      .then(setOutcome)
      .catch(() => {});
  }, [recordingEnabled]);

  /**
   * One keypress, and the whole of what a speed run does with an answer.
   *
   * There is nothing to submit with, so the entry is judged on every key rather
   * than at the end: it either still could be the answer, is the answer, or can
   * no longer become it. A right answer moves on with no pause - the play
   * screen holds one on screen so a child can enjoy it, and here the clock is
   * the thing being enjoyed. A dead entry clears itself and leaves the same
   * question up, which is the whole of "there is no wrong answer here": the run
   * does not move, nothing is recorded, and the child simply types it again.
   *
   * Clearing immediately rather than waiting for a backspace is the point. At
   * this speed a stuck entry costs more than the mistake did, and it is paid
   * most by the child mistyping most.
   */
  const press = useCallback(
    (key: string) => {
      const state = runRef.current;
      const now = Date.now();
      if (state === null || isOver(state, now)) return;

      const typed = appendNumeric(entryRef.current, key);
      if (typed === entryRef.current) return;

      const verdict = judgeEntry(state, typed);

      if (verdict === 'correct') {
        playSound('correct');
        advance(answerRun(state, typed, now));
        updateEntry('');
        return;
      }

      if (verdict === 'dead') {
        playSound('incorrect');
        updateEntry('');
        setWrong(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setWrong(false), FLASH_MS);
        return;
      }

      updateEntry(typed);
    },
    [advance, updateEntry],
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
        // The pad has no Delete key any more - reaching for one costs more than
        // the mistyped digit did - but a keyboard player reaches for nothing,
        // so the physical key still works. Its browser default is to navigate
        // back when focus is not in an editable field, which nothing here is.
        event.preventDefault();
        updateEntry((value) => value.slice(0, -1));
      } else if (/^[0-9]$/.test(event.key)) {
        // Exactly the keys the pad has, which is now the digits and nothing
        // else. No Enter, because there is nothing to submit; no minus and no
        // decimal point, because every answer here is a whole number by
        // construction in `modes.ts`.
        press(event.key);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, press, updateEntry]);

  if (phase === 'result' && result !== null) {
    return (
      <SpeedResult
        result={result}
        outcome={outcome}
        homeHref={homeHref}
        // The same place the door goes, now that the scores are the top of the
        // screen this run was started from. It is passed as its own prop
        // because it is its own button - "See records" says what is up there -
        // but there is nothing left for a second URL to be.
        recordsHref={backHref}
        onAgain={start}
      />
    );
  }

  if (phase === 'choosing') {
    return (
      <Chooser
        op={op}
        modes={modes}
        chosen={mode}
        backHref={backHref}
        onChoose={setMode}
        onStart={start}
        scale={scale}
      />
    );
  }

  // The one frame of a deep-linked run: the phase is already the count-in and
  // the effect above has not built the run yet. Drawing the count-in over bare
  // paper is what it will be a moment later anyway, so the screen a Try button
  // lands on is the count-in from the very first paint - server-rendered
  // included - rather than a flash of the chooser it was pressed to skip.
  if (run === null) {
    return (
      <div className="no-select fixed inset-0 z-40 bg-(--color-paper)">
        <Countdown count={COUNT_FROM} />
      </div>
    );
  }

  return (
    <div className="no-select fixed inset-0 z-40 flex flex-col overflow-hidden bg-(--color-paper) px-4 py-3 sm:px-10 sm:py-5">
      {/* The way out and the timer, and that is the whole header. The door sits
          in the corner furthest from the pad, and leaving records nothing -
          there is no confirmation, because a modal over a running clock is worse
          than the mis-tap it prevents. It lands on the chooser, not home:
          abandoning a run is most often about picking a different one. */}
      <header className="flex shrink-0 items-center gap-3 sm:gap-5">
        <Link
          href={backHref}
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
          decided once and the question takes what is left. Including the same
          height query on the larger bounds - `sm:` alone is a width breakpoint
          standing in for "tablet", and a landscape phone is wide (often past
          640px) and short at once, so it took the 16rem tablet floor on exactly
          the device with the least height to give it. These two screens are
          siblings and must not disagree about what "tablet" means. Written out
          as a literal class name, since Tailwind reads class names as literals
          and a composed one compiles to nothing. */}
      <div className="flex h-[clamp(12rem,40vh,20rem)] shrink-0 flex-col justify-center [@media(min-width:640px)_and_(min-height:501px)]:h-[clamp(16rem,40vh,22rem)]">
        {/* No tick, no decimal point and no Delete: nothing here is checked, every
            answer is a whole number, and a dead entry already clears itself, so
            all three would be keys that could only ever refuse or undo what the
            pad has dealt with. What that buys is where `0` goes - the fourth
            column, full height, in an ordinary key's clothes - because a third
            of the answers here contain one and on the bottom row it is the only
            digit a thumb travels for. See `NumberPad`. */}
        <NumberPad disabled={phase !== 'running'} decimal={false} onDigit={press} />
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
/**
 * The chooser at both scales. `'child'` is what it always was; `'parent'` is
 * the density of everything else under `ParentShell`, since a parent picking
 * their own run is doing it inside a report drawn at that size and does not
 * need the six-year-old's targets to press a mode.
 *
 * The glyph tile takes the operation's own accent rather than the grape it was
 * hard-coded to, so the chooser matches the card that led here and the result
 * that follows it.
 */
const CHOOSER_SCALES = {
  child: {
    section: 'mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8',
    header: 'flex items-center gap-3 sm:gap-4',
    exit: 'rounded-full border-2 p-2.5',
    tile: 'h-14 w-14 rounded-2xl text-3xl sm:h-16 sm:w-16 sm:text-4xl',
    title: 'truncate text-2xl font-bold sm:text-3xl',
    caption: 'text-base sm:text-lg',
    bolt: 'h-4 w-4 sm:h-5 sm:w-5',
    grid: 'mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:grid-cols-3 sm:gap-4',
    mode: 'min-h-16 rounded-2xl border-2 px-2 py-2.5 sm:min-h-18',
    modeLabel: 'text-lg leading-tight font-semibold sm:text-xl',
    start: 'mt-6 h-16 gap-3 rounded-2xl text-2xl sm:mt-8 sm:h-20 sm:text-3xl',
    startBolt: 'h-7 w-7 sm:h-8 sm:w-8',
  },
  parent: {
    section: 'w-full',
    header: 'flex items-center gap-3',
    exit: 'rounded-lg border p-1.5',
    tile: 'h-10 w-10 rounded-xl text-xl',
    title: 'truncate text-lg font-semibold',
    caption: 'text-sm',
    bolt: 'h-3.5 w-3.5',
    grid: 'mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4',
    mode: 'min-h-11 rounded-xl border px-2 py-1.5',
    modeLabel: 'text-sm leading-tight font-semibold',
    start: 'mt-4 h-11 gap-2 rounded-xl text-base',
    startBolt: 'h-5 w-5',
  },
} as const;

function Chooser({
  op,
  modes,
  chosen,
  backHref,
  onChoose,
  onStart,
  scale,
}: {
  op: Operation;
  modes: readonly Mode[];
  chosen: Mode;
  backHref: string;
  onChoose: (mode: Mode) => void;
  onStart: () => void;
  scale: keyof typeof CHOOSER_SCALES;
}) {
  const chosenKey = modeKey(chosen);
  const style = CHOOSER_SCALES[scale];
  const accent = OPERATION_ACCENT[op];

  return (
    <section className={style.section}>
      <header className={style.header}>
        <Link
          href={backHref}
          aria-label="Go back"
          className={`shrink-0 border-(--color-line) bg-(--color-card) text-(--color-ink-soft) transition active:scale-95 ${style.exit}`}
        >
          <ExitIcon />
        </Link>

        <div
          className={`flex shrink-0 items-center justify-center font-bold ${style.tile} ${accent.tile}`}
        >
          {operationGlyph(op)}
        </div>

        <div className="min-w-0">
          <h1 className={style.title}>{operationLabel(op)}</h1>
          <p className={`flex items-center gap-1.5 text-(--color-ink-soft) ${style.caption}`}>
            <BoltIcon className={`text-(--color-sun) ${style.bolt}`} />
            90 seconds
          </p>
        </div>
      </header>

      <div className={style.grid}>
        {modes.map((mode) => {
          const key = modeKey(mode);
          const selected = key === chosenKey;

          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(mode)}
              className={`flex items-center justify-center text-center transition active:scale-95 ${style.mode} ${
                selected
                  ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                  : 'border-(--color-line) bg-(--color-card)'
              }`}
            >
              <span className={style.modeLabel}>{modeLabel(mode)}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onStart}
        className={`flex w-full items-center justify-center bg-(--color-brand) font-bold text-white transition active:scale-95 ${style.start}`}
      >
        <BoltIcon className={style.startBolt} />
        Start
      </button>
    </section>
  );
}
