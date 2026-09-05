'use client';

import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  checkPasswordCodeAction,
  sendPasswordCodeAction,
  setPasswordAction,
  signInWithPasswordAction,
} from '@/app/actions';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';
import { VERIFICATION_CODE_LENGTH } from '@/lib/verification-code';

/**
 * The four steps of a grown-up's password, one component each. All four follow
 * `EmailStepForm`'s shape exactly: local `useState` for the field and the
 * error, `useTransition` for pending, an inline error rather than a
 * navigation, and a `router` call only once the action has said yes.
 */

/**
 * Step one of three. The answer is the same whether the address is known,
 * unknown or nonsense - so this screen always moves on, and the only thing that
 * holds it back is the mail failing to send.
 */
export function EmailStepForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.length === 0) return;

    setError(null);
    startTransition(async () => {
      const result = await sendPasswordCodeAction(email);
      if (result) {
        setError(result.error);
        return;
      }
      router.push(`/password/code?email=${encodeURIComponent(email)}`);
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-(--color-ink-soft)">
        Your email address
      </label>
      <input
        id={id}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-base"
      />
      {error ? (
        <p role="alert" className="text-sm text-(--color-wrong)">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || email.length === 0}
        className="rounded-xl bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Sending...' : 'Send me a code'}
      </button>
    </form>
  );
}

/**
 * Step two of three. `email` is a prop rather than a second field: the address
 * was already typed once, and the code is bound to it server-side regardless of
 * what this screen sends back.
 */
export function CodeStepForm({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== VERIFICATION_CODE_LENGTH) return;

    setError(null);
    startTransition(async () => {
      const result = await checkPasswordCodeAction(email, code);
      if (result) {
        setError(result.error);
        return;
      }
      router.push('/password/set');
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-(--color-ink-soft)">
        The code we sent you
      </label>
      <input
        id={id}
        value={code}
        onChange={(event) =>
          setCode(event.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={VERIFICATION_CODE_LENGTH}
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-center text-lg tracking-[0.3em]"
      />
      {error ? (
        <p role="alert" className="text-sm text-(--color-wrong)">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || code.length !== VERIFICATION_CODE_LENGTH}
        className="rounded-xl bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Checking...' : 'Continue'}
      </button>
      <Link
        href="/password/new"
        className="text-center text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
      >
        Send another code
      </Link>
    </form>
  );
}

/**
 * Step three of three. Setting a password here is also how a forgotten one is
 * replaced - there is no second flow for that, so this form is the whole of it.
 */
export function PasswordStepForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) return;

    setError(null);
    startTransition(async () => {
      const result = await setPasswordAction(password);
      if (result) {
        setError(result.error);
        return;
      }
      router.push('/');
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-(--color-ink-soft)">
        Your new password
      </label>
      <input
        id={id}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-base"
      />
      {error ? (
        <p role="alert" className="text-sm text-(--color-wrong)">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || password.length < PASSWORD_MIN_LENGTH}
        className="rounded-xl bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save password'}
      </button>
    </form>
  );
}

/**
 * The sign-in form itself, once a password exists. Carries the way back to step
 * one for a forgotten password, since that flow is also this one.
 */
export function PasswordSignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.length === 0 || password.length === 0) return;

    setError(null);
    startTransition(async () => {
      const result = await signInWithPasswordAction(email, password);
      if (result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <label htmlFor={emailId} className="text-sm font-semibold text-(--color-ink-soft)">
        Your email address
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-base"
      />
      <label htmlFor={passwordId} className="text-sm font-semibold text-(--color-ink-soft)">
        Your password
      </label>
      <input
        id={passwordId}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        aria-invalid={error !== null}
        className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-1.5 text-base"
      />
      {error ? (
        <p role="alert" className="text-sm text-(--color-wrong)">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || email.length === 0 || password.length === 0}
        className="rounded-xl bg-(--color-brand) px-3 py-1.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
      <Link
        href="/password/new"
        className="text-center text-sm text-(--color-ink-soft) underline transition hover:text-(--color-brand)"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
