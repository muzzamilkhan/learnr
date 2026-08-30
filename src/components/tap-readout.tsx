'use client';

import { useEffect, useState } from 'react';
import {
  DEBUG_COOKIE,
  DEBUG_COOKIE_ON,
  RUN_BUCKET_MS,
  type TapSummary,
} from '@/lib/speedrun/taps';
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

/**
 * Keep the cookie in step with what this run resolved to.
 *
 * **Written from the browser rather than by the server, because a page cannot
 * set a cookie.** Only an action or a route handler can, and neither is worth
 * introducing for a flag that decides whether a readout is drawn - this is a
 * diagnostic switch, not a boundary, and nothing is trusted on the strength of
 * it. `SameSite=Lax` and `path=/` so it rides along with every run the child
 * taps into; no `Max-Age`, so it is a session cookie and dies with the browser.
 *
 * It syncs rather than only setting, so `?debug=0` genuinely turns the thing
 * off. Called unconditionally - a hook cannot be conditional, and the run must
 * be able to clear a cookie as well as write one.
 */
export function useDebugCookie(debug: boolean) {
  useEffect(() => {
    document.cookie = debug
      ? `${DEBUG_COOKIE}=${DEBUG_COOKIE_ON}; path=/; SameSite=Lax`
      : `${DEBUG_COOKIE}=; path=/; SameSite=Lax; Max-Age=0`;
  }, [debug]);
}

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

  const launch = probe.launchTiming();

  // The three numbers the whole exercise is about, in the order the funnel
  // reaches them: what the browser dropped, what we refused, what was slow.
  const rows: [string, string][] = [
    // What getting here cost, which is a different question from what a tap
    // inside the run costs - and the one reported as "a second before clicking
    // does anything". `wait` is the whole of it, `fetch` the request's share.
    ['LAUNCH wait', launch ? `${ms(launch.waitMs)}${launch.hardLoad ? ' (load)' : ''}` : '-'],
    ['  of it, fetch', launch ? ms(launch.fetchMs) : '-'],
    ['taps', `${summary.taps} (${summary.offPad} off-pad)`],
    ['SWALLOWED', `${summary.swallowed} (${summary.swallowedRepeats} repeat)`],
    // Why each of those died, which is the question the count alone could never
    // answer: cancelled by the browser, drifted onto another key, held back with
    // the pointer complete, or lost with no lift and no cancel. Abbreviated
    // because this box is thirteen rems wide - see `SwallowFate`.
    [
      '  cnl/drf/hld/lst',
      `${summary.swallowedFates.cancelled}/${summary.swallowedFates.drifted}/${summary.swallowedFates.held}/${summary.swallowedFates.lost}`,
    ],
    // How far the fingers went, which tells a slip across a key's edge from a
    // hand moving across the pad. In pixels, unlike every row around it.
    ['moved p95/max', `${ms(summary.movedPx.p95)}/${ms(summary.movedPx.max)}`],
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
