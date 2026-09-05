'use client';

/**
 * An on-screen pad rather than the iPad keyboard: it keeps the question visible,
 * gives large fixed targets, and stops a child wandering into other keys.
 *
 * Laid out like a calculator, with the tick down the right-hand side. The decimal
 * point is always offered rather than shown only for questions that need one -
 * a key that appeared exactly when the answer was fractional would give the
 * answer away.
 *
 * **The tick is optional.** A speed run has nothing to check: an answer commits
 * the instant it matches, so a Check key there would be a button that could
 * only ever be pressed on an entry the pad has already refused.
 *
 * **The decimal point goes with it.** Every speed run answer is a whole number
 * by construction (`modes.ts`), and with no Check key an entry is judged as it
 * is typed - so a `.` is not a key that does nothing, it is a key that can only
 * ever kill the entry it lands in, sitting next to the `0` it would be mistaken
 * for.
 *
 * **And so does Delete.** A dead entry already clears itself on the keystroke
 * that killed it, so the only thing left for a backspace to undo is a digit the
 * player typed and thought better of - which costs less to finish typing and
 * let the pad refuse than to reach for a key on the far side of the pad. A
 * physical Backspace still works for a keyboard player, where reaching costs
 * nothing.
 *
 * **What that leaves is where `0` goes, and it is the fourth column, full
 * height** - the Check key's own slot, in an ordinary key's clothes. A speed
 * run is scored on how fast a whole number can be typed, and `0` is in about a
 * third of the answers this pad ever sees; on the bottom row it is the one
 * digit a thumb has to travel for. Given the tall column it is the biggest
 * target on the pad and the only one that can be hit without aiming. It is
 * styled like every other digit rather than like the tick, because it *is* a
 * digit: the brand-filled column says "this key ends something", which is the
 * one thing `0` does not do.
 *
 * **`instant` is the speed run's, and it is the difference between answering
 * the finger and answering the click.** An ordinary pad takes a digit from
 * `onClick`, which on a touchscreen cannot arrive until the finger has lifted
 * and the browser has decided the gesture was a tap. The tap funnel measured
 * what that costs on the target iPad, over eight runs: `pointerdown` to `click`
 * is 68ms at the median and 115-152ms at p95, against 7ms in the handler and
 * one frame to paint. It is the whole of the latency, and **a two-digit answer
 * pays it twice**.
 *
 * Worse, it is a leg a tap can die in. 11% of taps that landed on a key in
 * those runs never produced a click at all - 39 where the finger lifted on the
 * same key it landed on and the click simply never came, 17 where the browser
 * claimed the touch. Neither is `touch-manipulation`'s to fix: the viewport
 * never left scale 1 in any of those runs, so double-tap-to-zoom really is
 * dead and this is what was left underneath it. At 11% a digit, about one
 * two-digit answer in five loses a digit and has to be typed again.
 *
 * `onPointerDown` deletes the leg rather than shortening it, and with it both
 * ways a tap could go missing - nothing is waiting on a click any more. What it
 * costs is sliding off a key to think better of a digit, which the same funnel
 * says nobody does: fingers moved 0px at the median and no tap in any run
 * lifted on a different key than it landed on.
 *
 * **It is opt-in rather than the pad's behaviour**, because the lesson screen
 * is not a game: it has a Check key, no clock, and a child who rests a finger
 * on a key while reading the question. Only the run where ninety seconds is the
 * whole point trades the one for the other.
 *
 * A keyboard is unaffected either way. The click that a focused key's Enter or
 * Space produces is gone with the handler, but the speed run answers digits
 * from a window-level `keydown` and never needed the button.
 */

import { BackspaceIcon } from './backspace-icon';
import { CheckIcon } from './check-icon';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface Props {
  disabled: boolean;
  onDigit: (digit: string) => void;
  /** Whether a Delete key is drawn at all. Omitted, the pad has no bottom row. */
  onBackspace?: () => void;
  /** Whether the tick is offered at all. Omitted, the fourth column is `0`'s. */
  onCheck?: () => void;
  /** Whether the tick is pressable. Meaningless without `onCheck`. */
  canCheck?: boolean;
  /** Whether a decimal point is offered. Without it `0` takes its place too. */
  decimal?: boolean;
  /**
   * Whether a key answers the finger landing rather than the click that
   * follows it. The speed run's, and the doc block above is why.
   */
  instant?: boolean;
}

/**
 * `touch-manipulation` is `touch-action: manipulation`, and it is the one class
 * here that is not about how a key looks.
 *
 * **iOS Safari has ignored `user-scalable=no` and `maximum-scale` since iOS
 * 10**, deliberately, so the viewport block in `layout.tsx` that says it "stops
 * the iPad zooming when a child double-taps an answer button" has not been true
 * for years. Double-tap-to-zoom is live on the target device, and a pad is
 * where it does the most damage: two taps in quick succession, close together,
 * is a child typing a two-digit answer *and* the gesture Safari is watching
 * for. While it waits to find out which, the second tap's click is held - and
 * if it decides the double tap was a gesture, that click never arrives at all.
 * The page is already at fit-width, so there is nothing to zoom to and nothing
 * visibly happens; the tap is simply gone.
 *
 * `touch-action: manipulation` is the supported way to say this element never
 * needs double-tap zoom, which is exactly true of a digit key. It is on the
 * keys rather than the whole screen so that pinch-zoom - the accessibility
 * behaviour iOS 10 was protecting - is untouched everywhere else.
 *
 * **It worked and it stays**: every run measured since carries `max_scale: 1`,
 * so the gesture is not firing. It is not what `instant` replaces - see the
 * doc block above for what was left once the zoom was gone.
 */
const KEY_CLASS =
  'flex h-full w-full touch-manipulation items-center justify-center rounded-xl border-2 border-(--color-line) bg-(--color-card) text-3xl font-semibold transition active:scale-95 active:bg-(--color-brand-soft) disabled:opacity-40 sm:rounded-2xl sm:text-4xl';

export function NumberPad({
  disabled,
  canCheck = false,
  decimal = true,
  instant = false,
  onDigit,
  onBackspace,
  onCheck,
}: Props) {
  /**
   * Which event a key is wired to, spread onto every one of them.
   *
   * A key gets one handler or the other and never both: a `pointerdown` that
   * acts is still followed by a click, and a key that answered them both would
   * type every digit twice.
   */
  const activates = (run: () => void) => (instant ? { onPointerDown: run } : { onClick: run });

  // A fourth row exists only for the keys that sit in it beside `0`. With
  // neither a decimal point nor a Delete there is nothing to put there, and an
  // empty band under the digits would be the stripe this pad has always
  // refused - so the grid loses the row and `0` moves to the fourth column.
  const bottomRow = decimal || onBackspace !== undefined;

  return (
    <div
      className={`mx-auto grid h-full w-full max-w-2xl grid-cols-4 gap-2 sm:gap-3 ${
        bottomRow ? 'grid-rows-4' : 'grid-rows-3'
      }`}
    >
      {DIGITS.map((digit, index) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          {...activates(() => onDigit(digit))}
          // DIAGNOSTIC, with `tap-probe.ts` and deleted alongside it: what a
          // pointerdown reads to know which key it landed on, before anything
          // downstream has had the chance not to happen.
          data-pad-key={digit}
          // 1-9 fill the first three columns; the fourth, where there is one,
          // is Check's.
          style={{ gridColumn: (index % 3) + 1, gridRow: Math.floor(index / 3) + 1 }}
          className={KEY_CLASS}
        >
          {digit}
        </button>
      ))}

      {decimal ? (
        <button
          type="button"
          disabled={disabled}
          {...activates(() => onDigit('.'))}
          data-pad-key="."
          aria-label="Decimal point"
          className={`${KEY_CLASS} col-start-1 row-start-4`}
        >
          .
        </button>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        {...activates(() => onDigit('0'))}
        data-pad-key="0"
        className={`${KEY_CLASS} ${
          bottomRow
            ? `row-start-4 ${decimal ? 'col-start-2' : 'col-span-2 col-start-1'}`
            : 'col-start-4 row-span-3 row-start-1'
        }`}
      >
        0
      </button>

      {onBackspace ? (
        <button
          type="button"
          disabled={disabled}
          {...activates(onBackspace)}
          aria-label="Delete"
          className={`${KEY_CLASS} col-start-3 row-start-4`}
        >
          <BackspaceIcon />
        </button>
      ) : null}

      {onCheck ? (
        <button
          type="button"
          disabled={disabled || !canCheck}
          {...activates(onCheck)}
          aria-label="Check"
          className="col-start-4 row-span-4 row-start-1 flex h-full w-full touch-manipulation items-center justify-center rounded-xl bg-(--color-brand) text-white transition active:scale-95 disabled:opacity-30 sm:rounded-2xl"
        >
          <CheckIcon />
        </button>
      ) : null}
    </div>
  );
}
