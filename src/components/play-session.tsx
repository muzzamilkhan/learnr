'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { QuestionTemplate, Question } from '@/lib/templates/types';
import type { YearLevel } from '@/lib/curriculum';
import { startSession, submitAnswer, type SessionState } from '@/lib/session/session';
import { gradeAnswer } from '@/lib/session/grade';
import { answerMode, answerOptions, formatAnswer } from '@/lib/session/answers';
import { endRecordingAction, recordAttemptAction, startRecordingAction } from '@/app/play/actions';
import { SessionTimer } from './session-timer';
import { NumberPad } from './number-pad';
import { LetterPad } from './letter-pad';
import { ChoicePad } from './choice-pad';

/** How long the right/wrong feedback stays up before the next question. */
const FEEDBACK_MS = { correct: 700, wrong: 1600 } as const;

/** Enough for any answer a child is asked to type, short enough to stay legible. */
const MAX_ENTRY = { number: 6, text: 16 } as const;

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

  const question = session.current;
  const mode = answerMode(question);
  const options = useMemo(() => answerOptions(question), [question]);

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

  /**
   * The one path an answer takes, whether it was typed and checked or tapped.
   * Tapped answers pass their value in, because the tap and the submit are the
   * same gesture and `entry` has not been rendered yet.
   */
  const submit = useCallback(
    (value: string) => {
      if (feedback || value === '') return;

      const { correct } = gradeAnswer(question, value);
      const expected = formatAnswer(question);
      const next = submitAnswer(session, value, Date.now());

      setEntry(value);
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
    },
    [session, question, feedback],
  );

  // A physical keyboard should work as well as the on-screen pads.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (feedback) return;
      const key = event.key;

      if (mode === 'tap') {
        if (key.length !== 1) return;
        const typed = key.toLowerCase();
        // Typing the option itself wins over its position, so "2" picks the option
        // labelled 2 rather than the second one. Otherwise 1-4 pick by position,
        // and a first letter picks by name — t and f for true/false.
        const match =
          options.find((o) => o.label.toLowerCase() === typed) ??
          options[Number(key) - 1] ??
          options.find((o) => o.label.toLowerCase().startsWith(typed));
        if (match) submit(match.value);
        return;
      }

      const limit = MAX_ENTRY[mode];
      if (key === 'Backspace') setEntry((v) => v.slice(0, -1));
      else if (key === 'Enter') submit(entry);
      else if (mode === 'number' && key >= '0' && key <= '9')
        setEntry((v) => (v.length < limit ? v + key : v));
      else if (mode === 'number' && key === '-') setEntry((v) => (v === '' ? '-' : v));
      else if (mode === 'text' && /^[a-z]$/i.test(key))
        setEntry((v) => (v.length < limit ? v + key.toUpperCase() : v));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, feedback, mode, options, entry]);

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
          {question.prompt}
        </h1>

        {mode === 'tap' ? (
          // Tapped answers show their result on the buttons themselves, so all
          // that is left to say is what the answer was.
          <FeedbackLine feedback={feedback} />
        ) : (
          <AnswerDisplay entry={entry} feedback={feedback} wide={mode === 'text'} />
        )}
      </div>

      <div className="h-[46vh] max-h-88 min-h-64 shrink-0">
        <AnswerInput
          question={question}
          mode={mode}
          options={options}
          entry={entry}
          feedback={feedback}
          onEntry={setEntry}
          onSubmit={submit}
        />
      </div>
    </main>
  );
}

function AnswerInput({
  question,
  mode,
  options,
  entry,
  feedback,
  onEntry,
  onSubmit,
}: {
  question: Question;
  mode: ReturnType<typeof answerMode>;
  options: readonly { value: string; label: string }[];
  entry: string;
  feedback: Feedback;
  onEntry: (update: (value: string) => string) => void;
  onSubmit: (value: string) => void;
}) {
  const disabled = feedback !== null;

  if (mode === 'tap') {
    return (
      <ChoicePad
        options={options}
        disabled={disabled}
        chosen={disabled ? entry : null}
        reveal={disabled ? String(question.answer) : null}
        onChoose={onSubmit}
      />
    );
  }

  if (mode === 'text') {
    return (
      <LetterPad
        disabled={disabled}
        canCheck={entry !== ''}
        onLetter={(letter) => onEntry((v) => (v.length < MAX_ENTRY.text ? v + letter : v))}
        onBackspace={() => onEntry((v) => v.slice(0, -1))}
        onCheck={() => onSubmit(entry)}
      />
    );
  }

  return (
    <NumberPad
      disabled={disabled}
      canCheck={entry !== ''}
      onDigit={(digit) => onEntry((v) => (v.length < MAX_ENTRY.number ? v + digit : v))}
      onBackspace={() => onEntry((v) => v.slice(0, -1))}
      onCheck={() => onSubmit(entry)}
    />
  );
}

function AnswerDisplay({
  entry,
  feedback,
  wide,
}: {
  entry: string;
  feedback: Feedback;
  wide: boolean;
}) {
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
        className={`flex h-20 items-center justify-center rounded-3xl border-2 px-6 font-bold tabular-nums transition-colors ${
          wide ? 'w-96 max-w-full text-4xl tracking-wide' : 'w-56 text-5xl'
        } ${tone}`}
      >
        {feedback?.state === 'correct' ? '✓' : entry || <span className="opacity-25">?</span>}
      </output>

      <FeedbackLine feedback={feedback} />
    </div>
  );
}

/** Reserves its own height so nothing shifts when the message appears. */
function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p aria-live="polite" className="h-7 text-lg font-medium text-(--color-ink-soft)">
      {feedback?.state === 'wrong' ? `The answer is ${feedback.expected}` : ''}
    </p>
  );
}
