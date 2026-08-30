'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import {
  LAUNCH_KEY,
  launchTiming,
  parseLaunchMark,
  type LaunchTiming,
} from '@/lib/speedrun/launch';

/**
 * The impure half of the launch measurement: marking the tap, and reading the
 * browser's own clocks when the run arrives.
 *
 * **The whole design is shaped by one constraint: `SpeedCards` must stay a
 * server component.** The mode picker is a `<details>` precisely so that all
 * twenty-six modes render with the page and a browser running no JavaScript can
 * still open one - so putting an `onPointerDown` on a chip would have paid for
 * this measurement with the property that screen was built around. Instead the
 * chips carry a plain `data-speed-mode` attribute, which is server-rendered
 * markup, and one small island listens on the document in the capture phase.
 * That is the same trick the tap probe uses on the pad, for the same reason:
 * it sees the finger before anything downstream has the chance not to.
 *
 * Diagnostic, and deleted with the tap funnel.
 */

/** What the chips are marked with. Written out in `speed-cards.tsx` and `speed-try.tsx`. */
export const MODE_ATTRIBUTE = 'data-speed-mode';

/**
 * Watch for a tap on any chip that starts a run, and leave a mark behind.
 *
 * Rendered once beside the cards. `pointerdown` rather than `click`, because
 * the gap between those two is the thing this codebase has learned to
 * distrust - a mark written on click could never show a click that was slow to
 * arrive. Capture phase so a chip's own handling cannot stop it first.
 *
 * The mark is best-effort in the strongest sense: Safari throws on
 * `sessionStorage` in private browsing, and a diagnostic that breaks the way
 * into a game is worse than no diagnostic.
 */
export function LaunchWatcher() {
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const mode = target.closest(`[${MODE_ATTRIBUTE}]`)?.getAttribute(MODE_ATTRIBUTE);
      if (!mode) return;

      try {
        sessionStorage.setItem(LAUNCH_KEY, JSON.stringify({ mode, at: Date.now() }));
      } catch {
        // No storage, no measurement. The run still opens.
      }
    };

    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);

  return null;
}

/**
 * What the browser will say about the request that fetched this screen.
 *
 * Two different entries answer it depending on how the run was reached. A tap
 * from the cards is a client navigation, so the RSC payload is a *resource* -
 * named for the route with `?_rsc=` on it, which is why the mode key is what it
 * is matched on. A typed URL or a reload is a *navigation*, where the document
 * itself is the request.
 *
 * The last matching resource is taken rather than the first: a child who opened
 * two runs in one sitting has two, and the one being measured is the one that
 * just happened.
 */
function fetchMs(mode: string, hardLoad: boolean): number | null {
  try {
    if (hardLoad) {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return entry ? entry.responseEnd - entry.requestStart : null;
    }

    const matching = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes(encodeURIComponent(mode)) || entry.name.includes(mode));

    const last = matching[matching.length - 1];
    return last ? last.duration : null;
  } catch {
    return null;
  }
}

function wasHardLoad(): boolean {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    // A client navigation leaves the original document's entry in place, so the
    // question is whether *this* screen is the one the document was loaded for.
    return Boolean(entry && new URL(entry.name, location.origin).pathname === location.pathname);
  } catch {
    return false;
  }
}

/**
 * Read the mark, work out what the journey cost, and clear it.
 *
 * **Cleared whether or not it was usable**, which is the point of clearing it
 * here rather than only on a hit: a mark left behind is a mark that will be
 * spent on some later run it has nothing to do with. `LAUNCH_STALE_MS` is the
 * belt to this braces.
 */
export function takeLaunchTiming(mode: string): LaunchTiming {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(LAUNCH_KEY);
    sessionStorage.removeItem(LAUNCH_KEY);
  } catch {
    // As above: no storage, no mark.
  }

  const hardLoad = wasHardLoad();

  return launchTiming({
    mark: parseLaunchMark(raw),
    mode,
    readyAt: Date.now(),
    fetchMs: fetchMs(mode, hardLoad),
    hardLoad,
  });
}

/**
 * Send one launch to Sentry.
 *
 * **Reported when the run opens rather than when it ends**, unlike the tap
 * funnel. A run that is abandoned - which is exactly what a child does to a run
 * that took too long to start - would otherwise take its own explanation with
 * it, and those are the launches most worth having.
 *
 * A span rather than a message, so "how long does it take to get into a run"
 * is an aggregation. Best-effort and silent.
 */
export function reportLaunch(timing: LaunchTiming, mode: string) {
  try {
    Sentry.startSpan(
      {
        name: 'speed run launch',
        op: 'speedrun.launch',
        attributes: {
          'launch.mode': mode,
          'launch.wait': timing.waitMs ?? -1,
          'launch.fetch': timing.fetchMs ?? -1,
          'launch.rest': timing.restMs ?? -1,
          'launch.hard_load': timing.hardLoad,
          'launch.tapped': timing.waitMs !== null,
        },
      },
      () => {},
    );
  } catch {
    // A diagnostic that throws into a child's game is worse than no diagnostic.
  }
}
