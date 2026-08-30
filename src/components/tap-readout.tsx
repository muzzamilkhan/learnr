'use client';

import { useEffect, useState } from 'react';
import { RUN_BUCKET_MS, type TapSummary } from '@/lib/speedrun/taps';
import type { TapProbe } from './tap-probe';

/**
 * The tap funnel, drawn over the corner of a run, behind `?debug=1`.
 *
 * **This exists because the device the bug happens on has no console to open.**
 * The Sentry span is the record and the thing to aggregate over; this is for
 * watching the numbers move while the child is actually playing, which is how
 * an intermittent, mid-run symptom gets caught at the moment somebody can say
 * "there, that one". Same argument the `?anim=` flag was written on: comparing
 * on one device beats a redeploy between every guess.
 *
 * **It refreshes once a second, and that is a measurement decision rather than
 * a lazy one.** Everything on this screen is a suspect, this component
 * included: a readout re-rendering on every tap would add a render to the frame
 * it is trying to time, and would report the delay it had just caused. Once a
 * second is often enough to watch and rare enough to be invisible in the
 * numbers. Nothing here reads or writes React state belonging to the run - it
 * polls the probe, which is a plain object off to one side.
 *
 * `pointer-events-none` because it sits over the question, and a diagnostic
 * that can eat a tap while looking for eaten taps would be its own punchline.
 *
 * Diagnostic, and deleted with `tap-probe.ts` and `src/lib/speedrun/taps.ts`.
 */

const REFRESH_MS = 1_000;

function ms(value: number | null): string {
  return value === null ? '-' : `${Math.round(value)}`;
}

export function TapReadout({ probe }: { probe: TapProbe }) {
  const [summary, setSummary] = useState<TapSummary | null>(null);

  useEffect(() => {
    const read = () => setSummary(probe.summary());
    read();
    const ticking = setInterval(read, REFRESH_MS);
    return () => clearInterval(ticking);
  }, [probe]);

  if (!summary) return null;

  // The three numbers the whole exercise is about, in the order the funnel
  // reaches them: what the browser dropped, what we refused, what was slow.
  const rows: [string, string][] = [
    ['taps', `${summary.taps} (${summary.offPad} off-pad)`],
    ['SWALLOWED', `${summary.swallowed} (${summary.swallowedRepeats} repeat)`],
    ['scale', summary.maxScale.toFixed(2)],
    ['refused', String(summary.outcomes['refused-full'] + summary.outcomes['refused-over'])],
    ['dead', String(summary.outcomes.dead)],
    ['click p95/max', `${ms(summary.clickMs.p95)}/${ms(summary.clickMs.max)}`],
    ['paint p95/max', `${ms(summary.paintMs.p95)}/${ms(summary.paintMs.max)}`],
    ['sound max', ms(summary.soundMs.max)],
  ];

  return (
    <div className="pointer-events-none fixed top-0 right-0 z-50 max-w-[13rem] rounded-bl-lg bg-black/80 p-2 font-mono text-[10px] leading-tight text-white tabular-nums">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <span className="opacity-60">{label}</span>
          <span className={label === 'SWALLOWED' && summary.swallowed > 0 ? 'text-red-400' : ''}>
            {value}
          </span>
        </div>
      ))}

      {/* The trend, one cell per fifteen seconds: taps over swallowed. The
          symptom is mid-run, so where in the run it happens is the thing a
          single figure over the whole ninety seconds cannot say. */}
      <div className="mt-1 flex justify-between gap-1 border-t border-white/20 pt-1">
        {summary.buckets.map((bucket) => (
          <span key={bucket.from} className="flex-1 text-center">
            {bucket.taps}
            <span className={bucket.swallowed > 0 ? 'text-red-400' : 'opacity-40'}>
              /{bucket.swallowed}
            </span>
          </span>
        ))}
      </div>
      <div className="text-center opacity-40">{RUN_BUCKET_MS / 1000}s buckets</div>
    </div>
  );
}
