'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { QuestionTemplate } from '@/lib/templates/types';
import type { YearLevel } from '@/lib/curriculum';
import { startSession, submitAnswer, type SessionState } from '@/lib/session/session';
import { gradeAnswer } from '@/lib/session/grade';
import { endRecordingAction, recordAttemptAction, startRecordingAction } from '@/app/play/actions';
import { SessionTimer } from './session-timer';
import { NumberPad } from './number-pad';

/** How long the right/wrong feedback stays up before the next question. */
const FEEDBACK_MS = { correct: 700, wrong: 1600 } as const;

type Feedback = { state: 'correct' } | { state: 'wrong'; expected: string } | null;

interface Props {
  subject: string;
  level: YearLevel;
  templates: QuestionTemplate[];
  /** Supplied by the server so the first question renders before hydration. */
  seed: string;
  startedAt: number;
  recordingEnabled: boolean;
}

export function PlaySession({
  subject,
  level,
  templates,
  seed,
  startedAt,
  recordingEnabled,
}: Props) {
  const [session, setSession] = useState<SessionState>(() =>
    startSession({ templates, seed, startedAt, subject, level }),
  );
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const recordId = useRef<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!recordingEnabled) return;
    startRecordingAction(subject, level, seed).then((id) => {
      recordId.current = id;
    });
  }, [subject, level, seed, recordingEnabled]);

  // Mark the session finished when the child leaves.
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (recordId.current) endRecordingAction(recordId.current);
    };
  }, []);

  const check = useCallback(() => {
    if (feedback || entry === '') return;

    const { correct } = gradeAnswer(session.current, entry);
    const expected = String(session.current.answer);
    const next = submitAnswer(session, entry, Date.now());

    setFeedback(correct ? { state: 'correct' } : { state: 'wrong', expected });

    if (recordId.current) {
      const attempt = next.attempts[next.attempts.length - 1];
      recordAttemptAction(recordId.current, attempt);
    }

    advanceTimer.current = setTimeout(
      () => {
        setSession(next);
        setEntry('');
        setFeedback(null);
      },
      correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong,
    );
  }, [session, entry, feedback]);

  // A physical keyboard should work as well as the on-screen pad.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (feedback) return;
      if (event.key >= '0' && event.key <= '9') setEntry((v) => (v.length < 6 ? v + event.key : v));
      else if (event.key === 'Backspace') setEntry((v) => v.slice(0, -1));
      else if (event.key === 'Enter') check();
      else if (event.key === '-') setEntry((v) => (v === '' ? '-' : v));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [check, feedback]);

  const correctCount = session.attempts.filter((a) => a.correct).length;

  return (
    // Fixed to the viewport: everything must fit an iPad screen with no scrolling,
    // so the pad is never below the fold in either orientation.
    <main className="no-select flex h-[100dvh] flex-col overflow-hidden px-6 py-5 sm:px-10">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Finish and go back"
          className="rounded-xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3 text-lg font-medium text-(--color-ink-soft) transition active:scale-95"
        >
          Done
        </Link>

        <SessionTimer startedAt={session.startedAt} />

        <p className="min-w-24 text-right text-lg font-medium text-(--color-ink-soft) tabular-nums">
          {correctCount} / {session.askedCount}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4">
        <h1
          key={session.askedCount}
          className="max-w-3xl text-center text-3xl leading-snug font-semibold text-balance sm:text-4xl lg:text-5xl"
        >
          {session.current.prompt}
        </h1>

        <AnswerDisplay entry={entry} feedback={feedback} />
      </div>

      <div className="h-[46vh] max-h-88 min-h-64 shrink-0">
        <NumberPad
          disabled={feedback !== null}
          onDigit={(d) => setEntry((v) => (v.length < 6 ? v + d : v))}
          onBackspace={() => setEntry((v) => v.slice(0, -1))}
          onCheck={check}
          canCheck={entry !== ''}
        />
      </div>
    </main>
  );
}

function AnswerDisplay({ entry, feedback }: { entry: string; feedback: Feedback }) {
  const tone =
    feedback?.state === 'correct'
      ? 'border-(--color-right) bg-(--color-right-soft) text-(--color-right)'
      : feedback?.state === 'wrong'
        ? 'border-(--color-wrong) bg-(--color-wrong-soft) text-(--color-wrong)'
        : 'border-(--color-line) bg-(--color-card) text-(--color-ink)';

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <output
        aria-live="polite"
        className={`flex h-20 w-56 items-center justify-center rounded-3xl border-2 text-5xl font-bold tabular-nums transition-colors ${tone}`}
      >
        {feedback?.state === 'correct' ? '✓' : entry || <span className="opacity-25">?</span>}
      </output>

      <p className="h-7 text-lg font-medium text-(--color-ink-soft)">
        {feedback?.state === 'wrong' ? `The answer is ${feedback.expected}` : ''}
      </p>
    </div>
  );
}
