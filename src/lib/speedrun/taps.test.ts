import { describe, expect, it } from 'vitest';
import {
  parseDebug,
  RUN_BUCKET_MS,
  summariseTaps,
  WORST_TAPS,
  type TapRecord,
} from './taps';

/** A tap that went all the way through, as the baseline to vary from. */
function tap(over: Partial<TapRecord> = {}): TapRecord {
  return {
    at: 1_000,
    key: '7',
    phase: 'running',
    clickMs: 10,
    handlerMs: 1,
    soundMs: 0,
    paintMs: 20,
    outcome: 'typing',
    repeatKey: false,
    sinceLastMs: 400,
    scale: 1,
    ...over,
  };
}

describe('summariseTaps', () => {
  it('says nothing happened rather than dividing by nothing', () => {
    const summary = summariseTaps([]);

    expect(summary.taps).toBe(0);
    expect(summary.swallowed).toBe(0);
    // Null rather than 0: no measurement and a measurement of zero are the
    // distinction the whole app makes between `null` and `[]`, and a p95 of 0ms
    // reported for a run nobody played would read as the screen being perfect.
    expect(summary.paintMs.p95).toBeNull();
    expect(summary.maxScale).toBe(1);
  });

  it('counts a pad tap that never became a click as swallowed', () => {
    // The decisive measurement. A pointerdown landed on a key, the browser
    // never turned it into a click, and no code of ours ever heard about it -
    // which is the difference between "we refused it" and "it never arrived".
    const summary = summariseTaps([
      tap(),
      tap({ clickMs: null, outcome: 'swallowed' }),
      tap({ clickMs: null, outcome: 'swallowed' }),
    ]);

    expect(summary.taps).toBe(3);
    expect(summary.swallowed).toBe(2);
  });

  it('does not count a tap that missed the pad as swallowed', () => {
    // A tap on the door, on the question, or on the count-in overlay is a tap
    // with nothing to deliver. Counting those as swallowed would put a floor
    // under the number that has nothing to do with the bug.
    const summary = summariseTaps([tap({ key: null, clickMs: null, outcome: 'swallowed' })]);

    expect(summary.taps).toBe(1);
    expect(summary.offPad).toBe(1);
    expect(summary.swallowed).toBe(0);
  });

  it('counts separately the swallowed taps that repeated a key', () => {
    // The double-tap gesture's signature: two taps in the same place, close
    // together. If swallowed taps are overwhelmingly repeats, the recogniser is
    // eating them; if they are spread evenly over the keys, it is not.
    const summary = summariseTaps([
      tap({ clickMs: null, outcome: 'swallowed', repeatKey: true }),
      tap({ clickMs: null, outcome: 'swallowed', repeatKey: false }),
      tap({ repeatKey: true }),
    ]);

    expect(summary.swallowed).toBe(2);
    expect(summary.swallowedRepeats).toBe(1);
  });

  it('tallies what the handler decided, so a refusal is told from a drop', () => {
    const summary = summariseTaps([
      tap({ outcome: 'correct' }),
      tap({ outcome: 'correct' }),
      tap({ outcome: 'dead' }),
      tap({ outcome: 'refused-full' }),
      tap({ clickMs: null, outcome: 'swallowed' }),
    ]);

    expect(summary.outcomes.correct).toBe(2);
    expect(summary.outcomes.dead).toBe(1);
    expect(summary.outcomes['refused-full']).toBe(1);
    expect(summary.outcomes.swallowed).toBe(1);
    expect(summary.outcomes.typing).toBe(0);
  });

  it('reports latency by nearest rank, and ignores taps that have none', () => {
    const summary = summariseTaps([
      tap({ paintMs: 10 }),
      tap({ paintMs: 20 }),
      tap({ paintMs: 30 }),
      tap({ paintMs: 400 }),
      tap({ paintMs: null, clickMs: null, outcome: 'swallowed' }),
    ]);

    expect(summary.paintMs.p50).toBe(20);
    expect(summary.paintMs.p95).toBe(400);
    expect(summary.paintMs.max).toBe(400);
  });

  it('keeps the worst taps whole, because a percentile cannot be read back', () => {
    // A summary says how bad it got; only the tap itself says what else was
    // true at the time - which key, how long since the last one, what the
    // viewport was doing.
    const records = Array.from({ length: WORST_TAPS + 4 }, (_, index) =>
      tap({ paintMs: index * 10, key: String(index % 10) }),
    );

    const summary = summariseTaps(records);

    expect(summary.worst).toHaveLength(WORST_TAPS);
    expect(summary.worst[0]?.paintMs).toBe((WORST_TAPS + 3) * 10);
    expect(summary.worst.at(-1)?.paintMs).toBe(4 * 10);
  });

  it('buckets the run by time, so degradation over ninety seconds is visible', () => {
    // The reported symptom is mid-run, so a single p95 over the whole run is
    // the one shape that cannot show it: a run that is fine for a minute and
    // falls apart after it averages out to merely mediocre.
    const summary = summariseTaps([
      tap({ at: 0, paintMs: 10 }),
      tap({ at: RUN_BUCKET_MS - 1, paintMs: 20 }),
      tap({ at: RUN_BUCKET_MS, paintMs: 300 }),
      tap({ at: RUN_BUCKET_MS * 2, paintMs: 400, clickMs: null, outcome: 'swallowed' }),
    ]);

    expect(summary.buckets[0]).toMatchObject({ from: 0, taps: 2, swallowed: 0 });
    expect(summary.buckets[0]?.paintMs.max).toBe(20);
    expect(summary.buckets[1]).toMatchObject({ from: RUN_BUCKET_MS, taps: 1 });
    expect(summary.buckets[2]).toMatchObject({ taps: 1, swallowed: 1 });
  });

  it('files a tap from the count-in in the first bucket rather than before it', () => {
    // `at` is measured from the moment the clock starts, so a tap during the
    // run-up is negative. It is still a tap worth counting and there is no
    // bucket to the left of the first one.
    const summary = summariseTaps([tap({ at: -2_000, phase: 'countdown' })]);

    expect(summary.buckets[0]?.taps).toBe(1);
  });

  it('keeps the largest scale the viewport ever reached', () => {
    // Anything above 1 is the iPad having zoomed, which it is only free to do
    // because Safari ignores `user-scalable=no`. One excursion is the whole
    // proof - it need not be showing by the time the run ends.
    const summary = summariseTaps([tap({ scale: 1 }), tap({ scale: 1.8 }), tap({ scale: 1 })]);

    expect(summary.maxScale).toBe(1.8);
  });

  it('totals the time spent starting sounds, since that sits inside the handler', () => {
    const summary = summariseTaps([tap({ soundMs: 4 }), tap({ soundMs: 6 }), tap({ soundMs: null })]);

    expect(summary.soundMs.max).toBe(6);
  });
});

describe('parseDebug', () => {
  it('turns the probe on only when asked in so many words', () => {
    expect(parseDebug('1')).toBe(true);
    expect(parseDebug('taps')).toBe(true);
  });

  it('leaves it off for everything else, including a bare flag', () => {
    // Diagnostics that draw over a child's game are opt-in, and the cost of
    // guessing wrong is an overlay on a run somebody meant to play. So this
    // refuses rather than falling back, unlike `parseScoreTab`.
    for (const junk of [undefined, '', '0', 'false', 'yes', '__proto__']) {
      expect(parseDebug(junk)).toBe(false);
    }
  });
});
