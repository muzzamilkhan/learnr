'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * What the child actually waits for, on the screen they wait on.
 *
 * The server logs cannot see the wait that matters most on the answer path.
 * Next serialises server-action requests from one client, so the three actions
 * an answer fires - `recordAttempt`, then `awardRound` and `awardTarget` behind
 * its response - queue behind each other, and a child answering faster than the
 * queue drains stacks them up. Every one of those actions reports a healthy
 * server-side duration while doing it. The gap only exists in the browser.
 *
 * So each sample here is wall time from the call to its resolution: queue plus
 * both hops plus the work. Subtract the server's own `[timing] action ...`
 * reading for the same call and what is left is the queue and the network.
 *
 * It is an overlay rather than `console.log` because the device this is felt on
 * is an iPad, where there is no console to open. Behind `?timing=1`, so it costs
 * nothing to leave mounted and is off for every real player.
 */

export interface Sample {
  label: string;
  ms: number;
  at: number;
}

const MAX_SAMPLES = 14;

let samples: Sample[] = [];
const listeners = new Set<(s: Sample[]) => void>();

/** Record one measurement. A no-op cost when the overlay is not mounted. */
export function sample(label: string, ms: number): void {
  samples = [{ label, ms: Math.round(ms), at: Date.now() }, ...samples].slice(0, MAX_SAMPLES);
  for (const listener of listeners) listener(samples);
}

/**
 * Time a promise and record what it cost, whether it resolved or threw.
 *
 * Returns the promise untouched, so a call site reads the same with it as
 * without it and nothing about play depends on the measurement.
 */
export function measure<T>(label: string, run: Promise<T>): Promise<T> {
  const started = performance.now();
  const done = () => sample(label, performance.now() - started);
  run.then(done, done);
  return run;
}

const isOn = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('timing');

/**
 * The bus, as an external store. `sample` mutates a module-level array that
 * React knows nothing about, which is precisely the case
 * `useSyncExternalStore` exists for - and reading it through an effect instead
 * would set state during that effect and cascade a render per measurement, on
 * the one screen that must never drop a frame.
 */
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
};

// A stable reference on both sides: `sample` replaces the array rather than
// pushing into it, so identity changes exactly when the contents do.
const getSamples = () => samples;
const noSamples: Sample[] = [];
const getNoSamples = () => noSamples;

// The flag never changes within a page's life, so it needs no subscription -
// only a snapshot that differs between the server (always off) and the browser.
const neverChanges: Parameters<typeof useSyncExternalStore>[0] = () => () => {};
const getOff = () => false;

/**
 * Navigation timing for the page under the overlay. Read once, a beat after
 * load: `loadEventEnd` is zero until the load event has actually finished, so
 * reading it during render would report a nought and mean nothing by it.
 */
function useNavigation(on: boolean) {
  const [nav, setNav] = useState<PerformanceNavigationTiming | null>(null);

  useEffect(() => {
    if (!on) return;
    // Always deferred, never called in the effect body: reading it inline would
    // set state synchronously during the effect, and `loadEventEnd` is zero
    // until the load event has finished anyway.
    const read = () => {
      const [entry] = performance.getEntriesByType('navigation');
      setNav((entry as PerformanceNavigationTiming) ?? null);
    };
    if (document.readyState === 'complete') {
      const timer = setTimeout(read, 0);
      return () => clearTimeout(timer);
    }
    window.addEventListener('load', () => setTimeout(read, 0), { once: true });
  }, [on]);

  return nav;
}

export function TimingOverlay() {
  // Read from `window` rather than through `useSearchParams`, which would drag a
  // Suspense boundary onto every screen this is mounted on for a flag no real
  // player ever sets. Off on the server, so the markup matches the first paint.
  const on = useSyncExternalStore(neverChanges, isOn, getOff);
  const shown = useSyncExternalStore(subscribe, getSamples, getNoSamples);
  const nav = useNavigation(on);

  if (!on) return null;

  const ms = (value: number) => `${Math.round(value)}ms`;

  return (
    <div
      className="fixed right-2 bottom-2 z-[9999] max-h-[60vh] w-64 overflow-auto rounded-lg bg-black/85 p-2 font-mono text-[11px] leading-tight text-white"
      // Nothing behind this may become unreachable because a measurement is
      // sitting over it - the child is still playing on this screen.
      style={{ pointerEvents: 'none' }}
    >
      {nav ? (
        <div className="mb-1 border-b border-white/25 pb-1">
          <div>ttfb {ms(nav.responseStart - nav.requestStart)}</div>
          <div>html {ms(nav.responseEnd - nav.responseStart)}</div>
          <div>dcl {ms(nav.domContentLoadedEventEnd - nav.startTime)}</div>
          <div>load {ms(nav.loadEventEnd - nav.startTime)}</div>
        </div>
      ) : (
        <div className="mb-1 border-b border-white/25 pb-1">navigation pending</div>
      )}
      {shown.length === 0 ? (
        <div className="opacity-60">no calls yet</div>
      ) : (
        shown.map((entry) => (
          <div key={`${entry.at}-${entry.label}-${entry.ms}`} className="flex justify-between gap-2">
            <span className="truncate">{entry.label}</span>
            <span className={entry.ms > 400 ? 'text-red-400' : ''}>{entry.ms}ms</span>
          </div>
        ))
      )}
    </div>
  );
}
