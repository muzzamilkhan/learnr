'use client';

/**
 * An on-screen pad rather than the iPad keyboard: it keeps the question visible,
 * gives large fixed targets, and stops a child wandering into other keys.
 */

import { BackspaceIcon } from './backspace-icon';

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
    <div className="mx-auto grid h-full w-full max-w-xl grid-cols-3 grid-rows-4 gap-3">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className={KEY_CLASS}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Delete"
        className={KEY_CLASS}
      >
        <BackspaceIcon />
      </button>

      <button type="button" disabled={disabled} onClick={() => onDigit('0')} className={KEY_CLASS}>
        0
      </button>

      <button
        type="button"
        disabled={disabled || !canCheck}
        onClick={onCheck}
        className="flex h-full w-full items-center justify-center rounded-2xl bg-(--color-brand) text-3xl font-semibold text-white transition active:scale-95 disabled:opacity-30"
      >
        Check
      </button>
    </div>
  );
}
