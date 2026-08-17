'use client';

/**
 * An on-screen letter keyboard for free-text answers, for the same reason the
 * number pad exists: opening the iPad system keyboard would cover half the screen
 * and push the question out of sight. This keeps the play screen a fixed height.
 */

import { BackspaceIcon } from './backspace-icon';
import { CheckIcon } from './check-icon';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

interface Props {
  disabled: boolean;
  canCheck: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  onCheck: () => void;
}

const KEY_CLASS =
  'flex h-full min-w-0 flex-1 items-center justify-center rounded-lg border-2 border-(--color-line) bg-(--color-card) text-xl font-semibold transition active:scale-95 active:bg-(--color-brand-soft) disabled:opacity-40 sm:rounded-xl sm:text-3xl';

export function LetterPad({ disabled, canCheck, onLetter, onBackspace, onCheck }: Props) {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-1.5 sm:gap-2">
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-0 flex-1 justify-center gap-1.5 sm:gap-2">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onClick={() => onLetter(letter)}
              className={`${KEY_CLASS} max-w-20`}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}

      <div className="flex min-h-0 flex-1 justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label="Delete"
          className={`${KEY_CLASS} max-w-32`}
        >
          <BackspaceIcon />
        </button>
        <button
          type="button"
          disabled={disabled || !canCheck}
          onClick={onCheck}
          aria-label="Check"
          className="flex h-full min-w-0 max-w-96 flex-[2] items-center justify-center rounded-lg bg-(--color-brand) text-white transition active:scale-95 disabled:opacity-30 sm:rounded-xl"
        >
          <CheckIcon />
        </button>
      </div>
    </div>
  );
}
