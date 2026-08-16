'use client';

/**
 * An on-screen pad rather than the iPad keyboard: it keeps the question visible,
 * gives large fixed targets, and stops a child wandering into other keys.
 *
 * Laid out like a calculator, with the tick down the right-hand side. The decimal
 * point is always offered rather than shown only for questions that need one —
 * a key that appeared exactly when the answer was fractional would give the
 * answer away.
 */

import { BackspaceIcon } from './backspace-icon';
import { CheckIcon } from './check-icon';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface Props {
  disabled: boolean;
  canCheck: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onCheck: () => void;
}

const KEY_CLASS =
  'flex h-full w-full items-center justify-center rounded-2xl border-2 border-(--color-line) bg-(--color-card) text-4xl font-semibold transition active:scale-95 active:bg-(--color-brand-soft) disabled:opacity-40';

export function NumberPad({ disabled, canCheck, onDigit, onBackspace, onCheck }: Props) {
  return (
    <div className="mx-auto grid h-full w-full max-w-2xl grid-cols-4 grid-rows-4 gap-3">
      {DIGITS.map((digit, index) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          // 1-9 fill the first three columns, leaving the fourth for Check.
          style={{ gridColumn: (index % 3) + 1, gridRow: Math.floor(index / 3) + 1 }}
          className={KEY_CLASS}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit('.')}
        aria-label="Decimal point"
        className={`${KEY_CLASS} col-start-1 row-start-4`}
      >
        .
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit('0')}
        className={`${KEY_CLASS} col-start-2 row-start-4`}
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

      <button
        type="button"
        disabled={disabled || !canCheck}
        onClick={onCheck}
        aria-label="Check"
        className="col-start-4 row-span-4 row-start-1 flex h-full w-full items-center justify-center rounded-2xl bg-(--color-brand) text-white transition active:scale-95 disabled:opacity-30"
      >
        <CheckIcon />
      </button>
    </div>
  );
}
