'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { redeemLoginCodeAction } from '@/app/actions';
import { CODE_LENGTH } from '@/lib/login-code';

/**
 * Where the code box is standing. The redemption is the same either way, which is
 * why this is a variant rather than a second component - two copies of "spend the
 * code, then refresh" is how the two drift.
 *
 * `hero` is the child's own screen: one thing to do, drawn at the scale the rest
 * of the app is. `bar` is the landing page's top bar, where it sits beside the
 * Google button as a peer.
 */
export type CodeSignInVariant = 'hero' | 'bar';

/**
 * The child's way in, beside the Google button. Four characters read off a
 * parent's screen - no email, no password, nothing a child has to remember
 * between one day and the next.
 *
 * A wrong code is answered inline rather than by navigating: getting it wrong is
 * the ordinary case, and losing the screen for it would make a small mistake feel
 * like a big one.
 */
export function CodeSignIn({ variant = 'hero' }: { variant?: CodeSignInVariant }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < CODE_LENGTH) return;

    setError(null);
    startTransition(async () => {
      const result = await redeemLoginCodeAction(code);
      if (result) {
        setError(result.error);
        setCode('');
        return;
      }
      router.refresh();
    });
  };

  const field = (
    <input
      id={id}
      value={code}
      onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, CODE_LENGTH))}
      maxLength={CODE_LENGTH}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      aria-invalid={error !== null}
      className={
        variant === 'bar'
          ? // Fills the row it is given inside the phone's "Get started" panel,
            // and goes back to its own width once it is in the bar itself.
            'w-full min-w-0 flex-1 rounded-lg border border-(--color-line) bg-(--color-card) px-2 py-1.5 text-center text-lg font-bold tracking-[0.25em] uppercase sm:w-[6.5rem] sm:flex-none'
          : 'w-full rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-6 py-5 text-center text-5xl font-bold tracking-[0.4em] uppercase'
      }
    />
  );

  if (variant === 'bar') {
    // The error sits out of flow so a wrong code doesn't change the bar's height
    // and shove the page down under it.
    return (
      <form onSubmit={submit} className="relative flex w-full items-center gap-2 sm:w-auto">
        <label htmlFor={id} className="sr-only">
          Login code
        </label>
        {field}
        <button
          type="submit"
          disabled={pending || code.length < CODE_LENGTH}
          className="no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
        >
          Go
        </button>
        {error ? (
          <p
            role="alert"
            className="absolute top-full right-0 mt-1 text-sm whitespace-nowrap text-(--color-wrong)"
          >
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col items-center gap-4">
      <label htmlFor={id} className="text-xl text-(--color-ink-soft)">
        Got a code from your grown-up?
      </label>
      {field}
      <button
        type="submit"
        disabled={pending || code.length < CODE_LENGTH}
        className="no-select w-full rounded-2xl bg-(--color-brand) px-6 py-4 text-2xl font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        Let&rsquo;s go
      </button>
      {error ? <p className="text-center text-lg text-(--color-wrong)">{error}</p> : null}
    </form>
  );
}
