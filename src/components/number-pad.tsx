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
}

const KEY_CLASS =
  'flex h-full w-full items-center justify-center rounded-xl border-2 border-(--color-line) bg-(--color-card) text-3xl font-semibold transition active:scale-95 active:bg-(--color-brand-soft) disabled:opacity-40 sm:rounded-2xl sm:text-4xl';

export function NumberPad({
  disabled,
  canCheck = false,
  decimal = true,
  onDigit,
  onBackspace,
  onCheck,
}: Props) {
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
          onClick={() => onDigit(digit)}
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
          onClick={() => onDigit('.')}
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
        onClick={() => onDigit('0')}
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
          onClick={onBackspace}
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
          onClick={onCheck}
          aria-label="Check"
          className="col-start-4 row-span-4 row-start-1 flex h-full w-full items-center justify-center rounded-xl bg-(--color-brand) text-white transition active:scale-95 disabled:opacity-30 sm:rounded-2xl"
        >
          <CheckIcon />
        </button>
      ) : null}
    </div>
  );
}
