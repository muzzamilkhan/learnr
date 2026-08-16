'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { QuestionTemplate, Question } from '@/lib/templates/types';
import type { YearLevel } from '@/lib/curriculum';
import { startSession, submitAnswer, type SessionState } from '@/lib/session/session';
import { gradeAnswer } from '@/lib/session/grade';
import { answerMode, answerOptions, appendNumeric, formatAnswer } from '@/lib/session/answers';
import { endRecordingAction, recordAttemptAction, startRecordingAction } from '@/app/play/actions';
import { SessionTimer } from './session-timer';
import { NumberPad } from './number-pad';
import { LetterPad } from './letter-pad';
import { ChoicePad } from './choice-pad';
import { ContinueButton } from './continue-button';
import { HintIcon } from './hint-icon';

/**
 * How long a correct answer is celebrated before the next question. A wrong one
 * is never on a timer — the child reads the right answer and taps Continue.
 */
const CORRECT_MS = 700;

/** Enough for any answer a child is asked to type, short enough to stay legible. */
const MAX_ENTRY = { text: 16 } as const;

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
  /** The next question, held back until the child taps Continue. */
  const [pending, setPending] = useState<SessionState | null>(null);
  /** Hints are asked for, never pushed — and only for the question in hand. */
  const [hintShown, setHintShown] = useState(false);
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
  const advance = useCallback((next: SessionState) => {
    setSession(next);
    setPending(null);
    setEntry('');
    setFeedback(null);
    setHintShown(false);
  }, []);

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

      // Right answers move on by themselves; wrong ones wait for Continue, so
      // the right answer stays on screen for as long as the child wants it.
      if (correct) advanceTimer.current = setTimeout(() => advance(next), CORRECT_MS);
      else setPending(next);
    },
    [session, question, feedback, advance],
  );

  // A physical keyboard should work as well as the on-screen pads.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;

      if (pending) {
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          advance(pending);
        }
        return;
      }

      if (feedback) return;

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

      if (key === 'Backspace') setEntry((v) => v.slice(0, -1));
      else if (key === 'Enter') submit(entry);
      else if (mode === 'number') setEntry((v) => appendNumeric(v, key));
      else if (mode === 'text' && /^[a-z]$/i.test(key))
        setEntry((v) => (v.length < MAX_ENTRY.text ? v + key.toUpperCase() : v));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, feedback, mode, options, entry, pending, advance]);

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

        <Hint
          hint={question.hint}
          shown={hintShown}
          answered={feedback !== null}
          onShow={() => setHintShown(true)}
        />

        {mode === 'tap' ? (
          // Tapped answers show their result on the buttons themselves, so all
          // that is left to say is what the answer was.
          <FeedbackLine feedback={feedback} />
        ) : (
          <AnswerDisplay entry={entry} feedback={feedback} wide={mode === 'text'} />
        )}
      </div>

      {/* The pad's slot. After a wrong answer the pad gives way to Continue —
          except for tapped questions, where the buttons themselves are showing
          which option was right, so they stay and Continue sits under them. */}
      <div className="flex h-[46vh] max-h-88 min-h-64 shrink-0 flex-col justify-center gap-3">
        {(pending === null || mode === 'tap') && (
          <div className="min-h-0 flex-1">
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
        )}

        {pending !== null && <ContinueButton onContinue={() => advance(pending)} />}
      </div>
    </main>
  );
}

/**
 * The hint is behind a lightbulb rather than on screen: a child who wants help
 * asks for it, and one who doesn't is never given the method away. Its row keeps
 * its height whether the bulb, the hint or nothing is in it, so the question
 * above never jumps.
 */
function Hint({
  hint,
  shown,
  answered,
  onShow,
}: {
  hint: string | undefined;
  shown: boolean;
  answered: boolean;
  onShow: () => void;
}) {
  return (
    <div className="flex min-h-14 shrink-0 items-center justify-center px-2">
      {hint === undefined || answered ? null : shown ? (
        <p className="max-w-2xl text-center text-xl text-balance text-(--color-ink-soft) sm:text-2xl">
          {hint}
        </p>
      ) : (
        <button
          type="button"
          onClick={onShow}
          aria-label="Show a hint"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-(--color-line) bg-(--color-card) text-(--color-ink-soft) transition active:scale-95 active:bg-(--color-brand-soft)"
        >
          <HintIcon />
        </button>
      )}
    </div>
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
      onDigit={(digit) => onEntry((v) => appendNumeric(v, digit))}
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
    <p
      aria-live="polite"
      className="h-9 text-center text-2xl font-semibold text-(--color-right) sm:text-3xl"
    >
      {feedback?.state === 'wrong' ? `The answer is ${feedback.expected}` : ''}
    </p>
  );
}
