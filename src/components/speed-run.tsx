'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { browserApi, uuid } from '@/browser-api';
import { appendNumeric } from '@/lib/session/answers';
import type { SpeedOutcome } from '@/lib/dto';
import { modeKey, type Mode } from '@/lib/speedrun/modes';
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
import type { TapOutcome } from '@/lib/speedrun/taps';
import { ExitIcon } from './exit-icon';
import { NumberPad } from './number-pad';
import { playSound, primeSounds } from './sounds';
import { TapReadout, useDebugCookie } from './tap-readout';
import { reportTaps, TapProbe, timed } from './tap-probe';
import { SpeedResult } from './speed-result';
import { SpeedTimer } from './speed-timer';

/**
 * A speed run, start to finish: count in, play the ninety seconds, see the
 * score.
 *
 * Three phases in one client component, because going again has to be instant.
 * A route per phase would put a navigation between a child tapping the loop and
 * the next run, and the whole appeal of this screen is that the gap between
 * runs is nothing at all.
 *
 * **It takes a mode and no longer chooses one.** There used to be a fourth
 * phase in front of these three - a grid of that operation's modes and a Start
 * button under it - and it was the second of two screens asking one question:
 * the five cards picked the operation, this picked the variation, and Start
 * confirmed what two taps had already said. Choosing now happens where the
 * cards are, in one screen with no navigation in the middle of it
 * (`SpeedCards`), so what arrives here is a decision rather than the making of
 * one, and the route is `/speed/multiply.7` rather than a place with the answer
 * in its query.
 *
 * That leaves this component with nothing to render before the count-in, which
 * is the whole point: the first paint - the server's included - is the run
 * beginning.
 *
 * The run and the result render `fixed inset-0`, escaping whatever frame they
 * were started from - the same reason `RoundReward` covers the play screen
 * rather than sitting inside it. A parent's shell is a report frame, and a
 * ninety-second game is not a report. There is nothing left in the flow at all
 * now that the choosing has gone back to the screen it came from, so `scale`
 * went with it: a run is the same size for everybody, since a question readable
 * at a glance and a pad hit without looking are not things an adult wants
 * smaller either.
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

type Phase = 'countdown' | 'running' | 'result';

/** How long the entry box stays red after a dead entry. Long enough to see, short
 * enough to be gone before the next digits are typed - nothing here ever waits. */
const FLASH_MS = 320;

/** The run-up, counted in whole seconds. Never below one, whatever `COUNTDOWN_MS` says. */
const COUNT_FROM = Math.max(1, Math.round(COUNTDOWN_MS / 1000));

interface Props {
  /**
   * The run to play. Not optional and not a starting point to be changed: the
   * mode is what the route names, so a screen arrived at is a run already
   * decided on.
   */
  mode: Mode;
  /** Where "Go home" goes: `/` for a child, `/progress` for a parent. */
  homeHref: string;
  /**
   * Where backing out goes: the screen this run was started from, with its
   * scores and its cards on it - `/#speed-run` for a child, `/speed`
   * for a parent. Leaving a run and leaving the app are different intentions,
   * and the arrow that undoes "I picked Multiply" should undo exactly that. For
   * a child the two now land on the same page and not the same place on it: the
   * door aims at the speed section, and the door in the *corner* of the result
   * screen still goes to the top of home. It is also where "See records" goes,
   * since the scores are the top of that section.
   */
  backHref: string;
  recordingEnabled: boolean;
  /**
   * DIAGNOSTIC: whether to draw the tap funnel over the run (`?debug=1`). The
   * recording happens either way - see `tap-probe.ts`. This is only whether
   * somebody is watching it on the device.
   */
  debug: boolean;
}

export function SpeedRun({ mode, homeHref, backHref, recordingEnabled, debug }: Props) {
  const [phase, setPhase] = useState<Phase>('countdown');
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

  /**
   * DIAGNOSTIC: what happened to every finger that landed on this run.
   *
   * Held in a lazy `useState` rather than a ref, which is how React spells "one
   * stable object for the life of this component": the initialiser runs once,
   * the setter is never called, and nothing reads a ref during render. The
   * probe itself holds no React state and can schedule no render - see
   * `tap-probe.ts` on why a probe that costs a frame would manufacture the
   * symptom it is looking for.
   */
  const [probe] = useState(() => new TapProbe());

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

  // DIAGNOSTIC: the viewport, watched for the whole life of the screen. A zoom
  // that begins and ends between two taps is exactly the event being looked for.
  useEffect(() => {
    probe.watch();
    return () => probe.stop();
  }, [probe]);

  // DIAGNOSTIC: remember the flag, because a mode chip links to a bare
  // `/speed/multiply.7` and would otherwise drop it on the one tap that starts
  // a run - which made the overlay something only a hand-typed URL ever saw.
  useDebugCookie(debug);

  const start = useCallback(() => {
    // The clock starts when the count-in ends, so the first question has been on
    // screen and read by the time it is worth anything. The seed is made here
    // rather than on the server: nothing about a run is rendered before this tap,
    // so there is no hydration to keep in step.
    const startedAt = Date.now() + COUNTDOWN_MS;
    probe.reset(); // DIAGNOSTIC: "go again" keeps the component, not the funnel.
    advance(startRun({ mode, seed: `${startedAt}-${Math.random()}`, startedAt }));
    updateEntry('');
    setWrong(false);
    setPulse('calm');
    setCount(COUNT_FROM);
    setResult(null);
    setOutcome(null);
    setPhase('countdown');
  }, [advance, mode, probe, updateEntry]);

  /**
   * The run itself, put under the count-in that is already on screen (see the
   * render below).
   *
   * It has to be an effect rather than a lazy initialiser because starting a
   * run reads the clock and makes a seed, and a render may do neither - the
   * same purity rule that sends `requestNow()` to the request boundary. The ref
   * is what keeps it to once: `start` changes identity with `mode`, and a run
   * must never be restarted underneath a player.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  const finish = useCallback(() => {
    const state = runRef.current;
    if (state === null) return;

    const ended = runResult(state);
    setResult(ended);
    setPhase('result');

    // DIAGNOSTIC: one span per run, sent whether or not the score is banked -
    // a run played signed out drops taps exactly as readily as one that counts.
    reportTaps(probe.summary(), modeKey(state.mode), ended.correct);

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
    /*
      The score is the client's word, and it always was: the questions are
      generated in the browser and answered there, so there is no server-side
      history to recount a run against. A speed run banks no stars and touches no
      learning record, so the worst a forged score can do is put a wrong number
      on the forger's own cabinet. Moving the call out of a server action changes
      nothing about that - the bounds are the endpoint's, where they have to be
      for the iOS client anyway.

      One id per submission, minted here and held for this run, because the
      endpoint dedupes `SpeedAttempt` on it.
    */
    browserApi
      .submitSpeedRun({
        id: uuid(),
        mode: modeKey(state.mode),
        correct: ended.correct,
      })
      .then(setOutcome)
      .catch(() => {});
  }, [probe, recordingEnabled]);

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
      // DIAGNOSTIC: the click half of the funnel. `apply` is this handler
      // exactly as it was, with each of its early returns given a name, so that
      // "we decided not to act on this" can be told apart from "this never
      // reached us" - which is the whole question. Nothing below changes what
      // a tap does; it only says what it did.
      const tap = probe.click(key);
      let sound: number | null = null;

      const apply = (): TapOutcome => {
        const state = runRef.current;
        const now = Date.now();
        if (state === null) return 'refused-none';
        if (isOver(state, now)) return 'refused-over';

        const typed = appendNumeric(entryRef.current, key);
        if (typed === entryRef.current) return 'refused-full';

        const verdict = judgeEntry(state, typed);

        if (verdict === 'correct') {
          sound = timed(() => playSound('correct'));
          advance(answerRun(state, typed, now));
          updateEntry('');
          return 'correct';
        }

        if (verdict === 'dead') {
          sound = timed(() => playSound('incorrect'));
          updateEntry('');
          setWrong(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setWrong(false), FLASH_MS);
          return 'dead';
        }

        updateEntry(typed);
        return 'typing';
      };

      const outcome = apply();
      probe.settled(tap, outcome, sound);
    },
    [advance, probe, updateEntry],
  );

  // DIAGNOSTIC: the clock a tap is timed against and the phase it landed in.
  // Pushed rather than read, because the pointerdown listener is a plain browser
  // callback and would otherwise close over whatever phase it was created in.
  const runningSince = run?.startedAt ?? null;
  useEffect(() => {
    probe.context(runningSince, phase);
  }, [probe, runningSince, phase]);

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

  // The first frame of every run: the phase is the count-in and the effect above
  // has not built the run yet. Drawing the count-in over bare paper is what it
  // will be a moment later anyway, so the screen a mode chip lands on is the
  // count-in from the very first paint, the server's included.
  if (run === null) {
    return (
      <div
        className="no-select fixed inset-0 z-40 bg-(--color-paper)"
        // DIAGNOSTIC: capture, and on the container rather than on each key -
        // the tap being hunted is the one that never becomes a click, so it has
        // to be seen before anything downstream has the chance not to happen.
        onPointerDownCapture={(event) => probe.down(event.target)}
      >
        <Countdown count={COUNT_FROM} />
      </div>
    );
  }

  return (
    <div
      className="no-select fixed inset-0 z-40 flex flex-col overflow-hidden bg-(--color-paper) px-4 py-3 sm:px-10 sm:py-5"
      // DIAGNOSTIC: see the count-in branch above.
      onPointerDownCapture={(event) => probe.down(event.target)}
    >
      {/* The way out and the timer, and that is the whole header. The door sits
          in the corner furthest from the pad, and leaving records nothing -
          there is no confirmation, because a modal over a running clock is worse
          than the mis-tap it prevents. It lands on the screen the run was
          started from, not home: abandoning a run is most often about picking
          a different one, and that is where the modes are. */}
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

      {/* DIAGNOSTIC: the only console this iPad has. Refreshes once a second and
          takes no pointer events - a readout that could eat a tap while looking
          for eaten taps would be its own punchline. */}
      {debug && <TapReadout probe={probe} />}
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

