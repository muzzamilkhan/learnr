'use client';

import * as Sentry from '@sentry/nextjs';
import {
  summariseTaps,
  type TapOutcome,
  type TapPhase,
  type TapRecord,
  type TapSummary,
} from '@/lib/speedrun/taps';

/**
 * The impure half of the tap funnel: the part that has to touch `PointerEvent`,
 * `visualViewport`, `requestAnimationFrame` and the clock.
 *
 * A browser shim, beside `sounds.ts` and `speech.ts` and never in `src/lib`,
 * for the same reason those are. `src/lib/speedrun/taps.ts` is the arithmetic
 * and the tests; this is the observation.
 *
 * **The first rule of this file is that it must not become the bug it is
 * looking for.** It is measuring whether a child's taps are being dropped or
 * arriving late, so a probe that itself costs a frame would manufacture the
 * symptom and then report it. Three things keep it honest:
 *
 * - **No React state and no re-renders.** Records go into a plain array on the
 *   instance. Nothing here can schedule a render, so the run draws exactly what
 *   it drew before.
 * - **Nothing is computed per tap.** A tap costs four `performance.now()` reads,
 *   an object, and a push. Every percentile, bucket and tally is worked out once,
 *   at the end of the run, by the pure half.
 * - **The paint measurement is two `requestAnimationFrame`s**, which is the
 *   cheapest way to ask "has the browser painted yet" and adds no work of its
 *   own to the frame it is timing.
 *
 * **It runs on every run, not only behind `?debug=`.** The overlay is the thing
 * that is opt-in; the recording is not, because the runs worth having data from
 * are the ones a child plays without being asked to type a query string. What
 * the flag buys is being able to watch the numbers on the device while it is
 * happening, which is the only console this iPad has.
 *
 * Diagnostic, and meant to be deleted whole once the cause is known.
 */

/** Beyond this a run is not being played, and the array stops growing. */
const MAX_RECORDS = 600;

/** The attribute `NumberPad` puts on each key, so a pointerdown knows what it hit. */
export const PAD_KEY_ATTRIBUTE = 'data-pad-key';

interface Pending {
  record: TapRecord;
  /** `performance.now()` at the pointerdown, to measure the click against. */
  downAt: number;
  /** Set when the click arrives, to measure the handler and the paint against. */
  clickAt: number | null;
}

export class TapProbe {
  private readonly taps: Pending[] = [];
  private startedAt: number | null = null;
  private phase: TapPhase = 'countdown';
  private lastKey: string | null = null;
  private lastAt: number | null = null;
  /**
   * The largest scale the viewport has reached since the last tap.
   *
   * Tracked continuously rather than only sampled at each tap, because a zoom
   * that begins and ends between two taps is exactly the event being looked
   * for and would otherwise leave no trace at all.
   */
  private peakScale = 1;
  private detach: (() => void) | null = null;

  /**
   * Watch the visual viewport for the whole life of the run.
   *
   * Above 1 means the iPad has zoomed, which it is free to do whatever
   * `layout.tsx` asks: Safari has ignored `user-scalable`, `min-scale` and
   * `max-scale` since iOS 10. If that is happening, the gesture that did it is
   * a double tap - two fast taps in one place, which on a number pad is just a
   * child typing `77` - and the tap it was assembled from is a tap the pad
   * never saw. One excursion above 1 is the whole proof.
   */
  watch() {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!viewport) return;

    const note = () => {
      this.peakScale = Math.max(this.peakScale, viewport.scale);
    };
    viewport.addEventListener('resize', note);
    viewport.addEventListener('scroll', note);
    this.detach = () => {
      viewport.removeEventListener('resize', note);
      viewport.removeEventListener('scroll', note);
    };
  }

  stop() {
    this.detach?.();
    this.detach = null;
  }

  /** The clock the run is measured by, and which phase it is in. */
  context(startedAt: number | null, phase: TapPhase) {
    this.startedAt = startedAt;
    this.phase = phase;
  }

  /**
   * A finger landed somewhere on the run.
   *
   * Capture phase on the whole screen rather than a handler on each key,
   * because the tap this is hunting is the one that never becomes a click -
   * so it has to be seen before anything downstream has the chance not to
   * happen. Taps that miss the pad are recorded too, with a null key: they are
   * not the pad's to answer, and counting them as dropped would put a floor
   * under the number that has nothing to do with the bug.
   */
  down(target: EventTarget | null) {
    if (this.taps.length >= MAX_RECORDS) return;

    const now = performance.now();
    const key =
      target instanceof Element
        ? (target.closest(`[${PAD_KEY_ATTRIBUTE}]`)?.getAttribute(PAD_KEY_ATTRIBUTE) ?? null)
        : null;

    const scale = Math.max(this.peakScale, window.visualViewport?.scale ?? 1);
    this.peakScale = window.visualViewport?.scale ?? 1;

    this.taps.push({
      downAt: now,
      clickAt: null,
      record: {
        at: this.startedAt === null ? 0 : Date.now() - this.startedAt,
        key,
        phase: this.phase,
        clickMs: null,
        handlerMs: null,
        soundMs: null,
        paintMs: null,
        // Until a click arrives this is what the tap amounted to. Everything
        // downstream overwrites it; nothing downstream running is the finding.
        outcome: 'swallowed',
        repeatKey: key !== null && key === this.lastKey,
        sinceLastMs: this.lastAt === null ? null : now - this.lastAt,
        scale,
      },
    });

    if (key !== null) {
      this.lastKey = key;
      this.lastAt = now;
    }
  }

  /**
   * The click arrived, and `press` is about to run.
   *
   * Paired to the most recent pointerdown on that key that has not been claimed,
   * searching backwards: a fast player can have two taps in flight, and the
   * click belongs to the later of them.
   *
   * **A physical keyboard finds nothing here, and that is right.** `press` is
   * shared with the keydown handler, and a key pressed on a laptop had no
   * pointerdown to pair with - so it claims nothing and is recorded as nothing.
   * A run played on a keyboard reports zero taps, which is the honest answer:
   * this measures fingers on glass, and there were none. The one shape it gets
   * wrong is a run played with *both* on one device, where a keystroke could
   * claim a genuinely swallowed tap and hide it. No window is imposed to stop
   * that, deliberately: the pathological case being hunted is a main thread
   * blocked long enough that a real click arrives very late, and a claim
   * window tight enough to exclude a keystroke would report exactly that case
   * as swallowed. A wrong reading of the number this exists for costs more
   * than a hazard that needs an iPad with a keyboard attached.
   */
  click(key: string): Pending | null {
    for (let index = this.taps.length - 1; index >= 0; index--) {
      const tap = this.taps[index];
      if (tap && tap.clickAt === null && tap.record.key === key) {
        const now = performance.now();
        tap.clickAt = now;
        tap.record.clickMs = now - tap.downAt;
        return tap;
      }
    }
    return null;
  }

  /**
   * `press` has decided. Record what it decided and how long it took, then wait
   * for the paint.
   *
   * Two frames, because one `requestAnimationFrame` runs *before* the browser
   * paints: the second is the first moment it is true to say the child can see
   * the result of their tap. That interval is the one that disguises itself as
   * a refusal - a tap accepted and not yet drawn looks exactly like a tap
   * ignored, and the child taps again.
   */
  settled(tap: Pending | null, outcome: TapOutcome, soundMs: number | null) {
    if (!tap || tap.clickAt === null) return;

    const clickAt = tap.clickAt;
    tap.record.outcome = outcome;
    tap.record.handlerMs = performance.now() - clickAt;
    tap.record.soundMs = soundMs;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tap.record.paintMs = performance.now() - clickAt;
      });
    });
  }

  /** What the run recorded, for the summary and for the overlay. */
  records(): readonly TapRecord[] {
    return this.taps.map((tap) => tap.record);
  }

  summary(): TapSummary {
    return summariseTaps(this.records());
  }

  /** A fresh run on the same screen - "go again" keeps the component. */
  reset() {
    this.taps.length = 0;
    this.lastKey = null;
    this.lastAt = null;
    this.peakScale = window.visualViewport?.scale ?? 1;
  }
}

/**
 * Time a sound without changing what playing one does.
 *
 * `playSound` is called synchronously inside `press`, on every correct answer
 * and on every dead entry, and it both seeks (`currentTime = 0`) and starts a
 * media element. That is sixty-odd seeks in ninety seconds on the one thread
 * that also has to draw the next question, and it is the only call in the
 * handler that reaches outside JavaScript at all - so it is the one worth
 * having a number for rather than an opinion about.
 */
export function timed(play: () => void): number {
  const before = performance.now();
  play();
  return performance.now() - before;
}

/**
 * What the iPad is, which changes what any of the above means.
 *
 * Whether the app is running from the home screen matters most: a standalone
 * web app and a Safari tab do not share a gesture stack, and the child's copy
 * is installable (`appleWebApp.capable` in `layout.tsx`). A number gathered on
 * a laptop in a tab is not evidence about either.
 */
function device(): Record<string, string | number | boolean> {
  if (typeof window === 'undefined') return {};

  return {
    'device.ua': navigator.userAgent.slice(0, 200),
    'device.standalone': window.matchMedia('(display-mode: standalone)').matches,
    'device.dpr': window.devicePixelRatio,
    'device.width': window.innerWidth,
    'device.height': window.innerHeight,
    'device.touch_points': navigator.maxTouchPoints,
  };
}

/**
 * Send one run's funnel to Sentry.
 *
 * A **span** rather than a message, so this lands in the spans dataset where a
 * question like "how often is a tap swallowed, across every run" is an
 * aggregation rather than a read of one event at a time. `tracesSampleRate` is
 * 1.0, so nothing here is sampled away.
 *
 * Attributes are flat because span attributes are: the buckets are spread out
 * one key each rather than nested, and the worst taps ride as JSON, since they
 * are for reading rather than aggregating.
 *
 * Best-effort, like every other write this app makes from a browser. A run that
 * cannot be reported is worth strictly less than the run itself.
 */
export function reportTaps(summary: TapSummary, mode: string, correct: number) {
  try {
    const buckets = Object.fromEntries(
      summary.buckets.flatMap((bucket, index) => [
        [`taps.bucket${index}.taps`, bucket.taps],
        [`taps.bucket${index}.swallowed`, bucket.swallowed],
        [`taps.bucket${index}.paint_max`, bucket.paintMs.max ?? -1],
      ]),
    );

    Sentry.startSpan(
      {
        name: 'speed run tap funnel',
        op: 'speedrun.taps',
        attributes: {
          'run.mode': mode,
          'run.correct': correct,
          'taps.total': summary.taps,
          'taps.swallowed': summary.swallowed,
          'taps.swallowed_repeats': summary.swallowedRepeats,
          'taps.off_pad': summary.offPad,
          'taps.max_scale': summary.maxScale,
          'taps.out_correct': summary.outcomes.correct,
          'taps.out_dead': summary.outcomes.dead,
          'taps.out_typing': summary.outcomes.typing,
          'taps.out_refused_full': summary.outcomes['refused-full'],
          'taps.out_refused_over': summary.outcomes['refused-over'],
          'taps.out_refused_none': summary.outcomes['refused-none'],
          'taps.click_p50': summary.clickMs.p50 ?? -1,
          'taps.click_p95': summary.clickMs.p95 ?? -1,
          'taps.click_max': summary.clickMs.max ?? -1,
          'taps.handler_p95': summary.handlerMs.p95 ?? -1,
          'taps.handler_max': summary.handlerMs.max ?? -1,
          'taps.sound_p95': summary.soundMs.p95 ?? -1,
          'taps.sound_max': summary.soundMs.max ?? -1,
          'taps.paint_p50': summary.paintMs.p50 ?? -1,
          'taps.paint_p95': summary.paintMs.p95 ?? -1,
          'taps.paint_max': summary.paintMs.max ?? -1,
          'taps.worst': JSON.stringify(summary.worst).slice(0, 2_000),
          // The taps nothing else can describe: `worst` ranks on paint time and
          // these never painted. `sinceLastMs` is what they are here for.
          'taps.dropped': JSON.stringify(summary.dropped).slice(0, 2_000),
          ...buckets,
          ...device(),
        },
      },
      () => {},
    );
  } catch {
    // A diagnostic that throws into a child's game is worse than no diagnostic.
  }
}
