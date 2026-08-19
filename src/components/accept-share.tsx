'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { acceptShareInviteAction } from '@/app/actions';
import { nameList } from '@/lib/format';
import type { AcceptResult } from '@/lib/sharing';

/**
 * Taking a share link, once the person holding it is signed in.
 *
 * It accepts by itself when it arrives back from Google (`auto`), because signing
 * in *was* the acceptance: someone who has just followed a link, read whose
 * children it covers and handed over their account has said yes three times, and a
 * fourth button is only a way to lose them on the last step. Arriving already
 * signed in is different - they have not agreed to anything yet - so there the
 * button is the gesture.
 *
 * Firing once is a ref rather than a dependency list: an effect that runs twice
 * in development must not read as two acceptances. `acceptShareInvite` is
 * idempotent for the same person anyway, which is the real guarantee - this only
 * keeps the screen from flickering through two states.
 */
export function AcceptShare({
  token,
  auto,
  childNames,
}: {
  token: string;
  auto: boolean;
  childNames: string[];
}) {
  const [result, setResult] = useState<AcceptResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fired = useRef(false);

  const accept = () => {
    if (fired.current) return;
    fired.current = true;
    startTransition(async () => setResult(await acceptShareInviteAction(token)));
  };

  useEffect(() => {
    if (auto) accept();
    // Once, on arrival. `accept` guards itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  if (result?.ok) {
    return (
      <div className="text-center">
        <p className="text-base font-semibold">
          You can now see {nameList(childNames)}
          {childNames.length === 1 ? "'s" : "'"} progress.
        </p>
        <p className="mt-1 text-sm text-(--color-ink-soft)">
          Their reports are yours to read. Only their own parent can change anything.
        </p>
        <Link
          href="/progress"
          className="no-select mt-5 inline-block rounded-xl bg-(--color-brand) px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
        >
          See how they&rsquo;re going
        </Link>
      </div>
    );
  }

  if (result && !result.ok) {
    return (
      <div className="text-center">
        <p className="text-base font-semibold">{MESSAGES[result.reason]}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-(--color-brand)">
          Go to LearnR
        </Link>
      </div>
    );
  }

  if (auto || pending) {
    return <p className="text-center text-base text-(--color-ink-soft)">Linking you up&hellip;</p>;
  }

  return (
    <button
      type="button"
      onClick={accept}
      className="no-select w-full rounded-xl bg-(--color-brand) px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
    >
      Accept
    </button>
  );
}

/**
 * A reason rather than "that didn't work", because each of these has a different
 * next step: ask for another link, send this one on, or simply try again.
 */
const MESSAGES: Record<'unavailable' | 'own-link' | 'error', string> = {
  unavailable: 'This link has already been used, or it has run out. Ask for a new one.',
  'own-link': 'This is your own link - send it to the person you want to share with.',
  error: 'Something went wrong just then. Try that again.',
};
