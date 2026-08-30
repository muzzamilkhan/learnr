import { describe, expect, it } from 'vitest';
import {
  debugEnabled,
  DROPPED_TAPS,
  parseDebugParam,
  RUN_BUCKET_MS,
  summariseTaps,
  swallowFate,
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
    upMs: 12,
    cancelMs: null,
    upKey: '7',
    movedPx: 2,
    ...over,
  };
}

/** A tap that landed on a key and never became a click, as the fates vary it. */
function swallowed(over: Partial<TapRecord> = {}): TapRecord {
  return tap({ clickMs: null, outcome: 'swallowed', ...over });
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

  it('keeps the swallowed taps whole, in the order they were dropped', () => {
    // `worst` cannot carry these: it ranks on `paintMs`, and a tap that never
    // became a click never painted, so the taps most worth reading were the one
    // shape the summary threw away. What is wanted from them is `sinceLastMs` -
    // whether a dropped tap is the second of two fast ones, which is what a
    // two-digit answer is and a one-digit answer is not.
    const records = [
      tap({ at: 1_000, key: '4', sinceLastMs: 900 }),
      tap({ at: 1_100, key: '2', clickMs: null, outcome: 'swallowed', sinceLastMs: 100 }),
      tap({ at: 5_000, key: '7', clickMs: null, outcome: 'swallowed', sinceLastMs: 80 }),
    ];

    const summary = summariseTaps(records);

    expect(summary.dropped.map((record) => record.key)).toEqual(['2', '7']);
    expect(summary.dropped[0]?.sinceLastMs).toBe(100);
  });

  it('caps the dropped taps but keeps the earliest, since a burst has a start', () => {
    const records = Array.from({ length: DROPPED_TAPS + 3 }, (_, index) =>
      tap({ at: index * 100, clickMs: null, outcome: 'swallowed', sinceLastMs: index }),
    );

    const summary = summariseTaps(records);

    expect(summary.dropped).toHaveLength(DROPPED_TAPS);
    expect(summary.dropped[0]?.sinceLastMs).toBe(0);
  });

  it('leaves an off-pad tap out of the dropped list as well as the count', () => {
    const summary = summariseTaps([tap({ key: null, clickMs: null, outcome: 'swallowed' })]);

    expect(summary.dropped).toEqual([]);
  });

  it('blames the gesture when a swallowed tap was cancelled', () => {
    // A pointercancel is the browser saying outright that it took the touch for
    // something else. It is the one fate that needs no inference, so it is read
    // first: a cancelled pointer never gets a pointerup to disagree with.
    const summary = summariseTaps([swallowed({ cancelMs: 40, upMs: null, upKey: null })]);

    expect(summary.swallowedFates.cancelled).toBe(1);
    expect(summary.swallowedFates.lost).toBe(0);
  });

  it('blames the finger when it lifted on a different key than it landed on', () => {
    // The mechanism `upKey` exists for. WebKit dispatches a click to the nearest
    // common ancestor of the down and up elements, so a finger that slides off
    // `7` onto `8` - or into the gap between them - fires a click on the grid
    // and on no button at all. Nothing of ours runs and the tap is simply gone.
    const summary = summariseTaps([swallowed({ upKey: '8', movedPx: 61 })]);

    expect(summary.swallowedFates.drifted).toBe(1);
    expect(summary.swallowedFates.held).toBe(0);
  });

  it('counts a lift into the gap between keys as drifted too', () => {
    // Off the pad entirely at lift is the same mechanism, the common ancestor
    // being further up still. A null `upKey` on a tap that had a key is a drift,
    // not a tap that missed the pad - `key` is what decides that, and it is set.
    const summary = summariseTaps([swallowed({ upKey: null, movedPx: 24 })]);

    expect(summary.swallowedFates.drifted).toBe(1);
  });

  it('blames the browser when the finger lifted exactly where it landed', () => {
    // Up on the same key, nothing cancelled, and still no click. This is the
    // fate with no explanation of its own, which is why it is worth telling
    // apart from the other three rather than folding in with them.
    const summary = summariseTaps([swallowed({ upKey: '7', movedPx: 1 })]);

    expect(summary.swallowedFates.held).toBe(1);
    expect(summary.swallowedFates.drifted).toBe(0);
  });

  it('says a tap was lost when neither a lift nor a cancel ever arrived', () => {
    // The pointer stream itself stopped. Distinct from `held`, where the stream
    // completed and the click alone went missing, and the distinction decides
    // whether to look at the pad or at the event pipeline above it.
    const summary = summariseTaps([swallowed({ upMs: null, upKey: null, movedPx: null })]);

    expect(summary.swallowedFates.lost).toBe(1);
    expect(summary.swallowedFates.held).toBe(0);
  });

  it('gives a fate only to the taps that were swallowed', () => {
    // A tap that clicked has no fate to explain. Counting one would put every
    // healthy tap into `held` and bury the handful that matter.
    const summary = summariseTaps([tap(), tap(), swallowed({ upKey: '8' })]);

    expect(summary.swallowedFates.drifted).toBe(1);
    expect(summary.swallowedFates.held).toBe(0);
    expect(summary.swallowed).toBe(1);
  });

  it('leaves a tap that missed the pad out of the fates, as out of the count', () => {
    // `offPad` for the reason it is left out of `swallowed`: it was never the
    // pad's to answer, and a fate on it would put a floor under the numbers
    // this exists to read.
    const summary = summariseTaps([tap({ key: null, clickMs: null, outcome: 'swallowed' })]);

    expect(summary.swallowedFates.held).toBe(0);
    expect(summary.swallowedFates.drifted).toBe(0);
    expect(summary.offPad).toBe(1);
  });

  it('reports how far the fingers travelled, ignoring the taps that never lifted', () => {
    // The magnitude behind `drifted`: a two-pixel slip across a key boundary and
    // a sixty-pixel slide are the same fate and very different bugs, and only
    // one of them is answered by growing the keys.
    const summary = summariseTaps([
      tap({ movedPx: 2 }),
      tap({ movedPx: 60 }),
      tap({ movedPx: null }),
    ]);

    expect(summary.movedPx.max).toBe(60);
    expect(summary.movedPx.p50).toBe(2);
  });

  it('totals the time spent starting sounds, since that sits inside the handler', () => {
    const summary = summariseTaps([tap({ soundMs: 4 }), tap({ soundMs: 6 }), tap({ soundMs: null })]);

    expect(summary.soundMs.max).toBe(6);
  });
});

describe('swallowFate', () => {
  it('reads a cancel ahead of a lift, since a cancel is the browser saying so', () => {
    // Defensive rather than observed: the spec says a cancelled pointer fires no
    // pointerup, so the two should never both be set. If they ever are, the
    // explicit statement beats the inference drawn from coordinates.
    expect(swallowFate(swallowed({ cancelMs: 30, upMs: 40, upKey: '8' }))).toBe('cancelled');
  });

  it('tells the four fates apart on the one field each turns on', () => {
    expect(swallowFate(swallowed({ cancelMs: 30 }))).toBe('cancelled');
    expect(swallowFate(swallowed({ upMs: null, upKey: null }))).toBe('lost');
    expect(swallowFate(swallowed({ upKey: '8' }))).toBe('drifted');
    expect(swallowFate(swallowed({ upKey: '7' }))).toBe('held');
  });
});

describe('parseDebugParam', () => {
  it('reads the two spellings that turn it on', () => {
    expect(parseDebugParam('1')).toBe('on');
    expect(parseDebugParam('taps')).toBe('on');
  });

  it('reads the two that turn it off, which a cookie made necessary', () => {
    // Before the flag persisted there was nothing to turn off: leaving the
    // query string off was the whole of it. A cookie outlives the URL that set
    // it, so switching it off has to be sayable.
    expect(parseDebugParam('0')).toBe('off');
    expect(parseDebugParam('off')).toBe('off');
  });

  it('says nothing at all for everything else', () => {
    // Null is not "off": a URL with no `?debug=` is a URL with no opinion, and
    // it must leave a cookie already set alone rather than clearing it on the
    // next run the child taps into.
    for (const junk of [undefined, '', 'true', 'false', 'yes', '__proto__']) {
      expect(parseDebugParam(junk)).toBeNull();
    }
  });
});

describe('debugEnabled', () => {
  it('lets the URL beat the cookie, both ways', () => {
    expect(debugEnabled('on', undefined)).toBe(true);
    expect(debugEnabled('off', '1')).toBe(false);
  });

  it('falls back to the cookie when the URL says nothing', () => {
    // The reason the cookie exists: a mode chip links to `/speed/multiply.7`
    // with no query on it, so the flag cannot survive the one tap that starts
    // a run. Every run after the first would have lost it.
    expect(debugEnabled(null, '1')).toBe(true);
    expect(debugEnabled(null, undefined)).toBe(false);
  });

  it('trusts only the one cookie value it writes', () => {
    for (const junk of ['', '0', 'true', 'on']) {
      expect(debugEnabled(null, junk)).toBe(false);
    }
  });
});
