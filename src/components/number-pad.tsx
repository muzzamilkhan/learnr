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
 * **The tick is optional, and the pad narrows to three columns without it.** A
 * speed run has nothing to check: an answer commits the instant it matches, so
 * a Check key there would be a button that could only ever be pressed on an
 * entry the pad has already refused. Leaving the fourth column empty would keep
 * the keys the size they are on the play screen and put a bare stripe beside
 * them; dropping the column gives the ten keys the whole width instead, which
 * is the right trade on the one screen where a key is hit without looking.
 *
 * **The decimal point goes with it.** Every speed run answer is a whole number
 * by construction (`modes.ts`), and with no Check key an entry is judged as it
 * is typed - so a `.` is not a key that does nothing, it is a key that can only
 * ever kill the entry it lands in, sitting next to the `0` it would be mistaken
 * for. `0` takes the two columns instead, which is the widest key on the pad
 * for the digit most often typed in a hurry.
 */

import { BackspaceIcon } from './backspace-icon';
import { CheckIcon } from './check-icon';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface Props {
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Whether the tick is offered at all - omitted, the pad is three columns wide. */
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
  return (
    <div
      className={`mx-auto grid h-full w-full max-w-2xl grid-rows-4 gap-2 sm:gap-3 ${
        onCheck ? 'grid-cols-4' : 'grid-cols-3'
      }`}
    >
      {DIGITS.map((digit, index) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
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
        className={`${KEY_CLASS} row-start-4 ${decimal ? 'col-start-2' : 'col-span-2 col-start-1'}`}
      >
        0
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Delete"
        className={`${KEY_CLASS} col-start-3 row-start-4`}
      >
        <BackspaceIcon />
      </button>

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
