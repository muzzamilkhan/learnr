'use client';

/**
 * Shown in place of the pad after a wrong answer. Nothing advances on a timer
 * then: the child reads the right answer and moves on when they are ready.
 */
export function ContinueButton({ onContinue }: { onContinue: () => void }) {
  return (
    <button
      type="button"
      autoFocus
      onClick={onContinue}
      className="mx-auto flex h-16 w-full max-w-md shrink-0 items-center justify-center gap-3 rounded-xl bg-(--color-brand) text-2xl font-semibold text-white transition active:scale-95 sm:h-20 sm:rounded-2xl sm:text-3xl"
    >
      Continue
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
