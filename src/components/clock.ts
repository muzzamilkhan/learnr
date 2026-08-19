/**
 * The clock, as the browser sees it.
 *
 * A browser shim beside `sounds.ts` and `speech.ts`, and there for the same
 * reason: it reads `Date.now()` and the device's own UTC offset, so it could
 * never live in `src/lib`, where every day question takes its `now` and its
 * offset as arguments.
 *
 * Three screens need it - the profile menu's run of days, the home screen's
 * goal panel and the play screen's goal bar - because which day a moment falls
 * in is a question only the device can answer. The server has no timezone, so
 * each of these reads the answer through `useSyncExternalStore` rather than
 * rendering a number at UTC and correcting it a frame later.
 */

import { localDay } from '@/lib/day';

/**
 * Nothing to subscribe to: the day only turns over at midnight, and a child
 * whose screen has been open since yesterday will reload it long before the
 * stale number matters. One stable identity for every caller, so the store is
 * never resubscribed.
 */
export const subscribeToTheClock = () => () => {};

/** Minutes east of UTC on this device, the sign the rest of the app uses. */
export const localOffsetMinutes = (): number => -new Date().getTimezoneOffset();

/** The day number it is here, right now - what `localDay` means to this device. */
export const today = (): number => localDay(Date.now(), localOffsetMinutes());
