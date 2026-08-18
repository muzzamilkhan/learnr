'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionTemplate, Question } from '@/lib/templates/types';
import type { LearnerProfile } from '@/lib/analytics/profile';
import type { YearLevel } from '@/lib/curriculum';
import { startSession, submitAnswer, type SessionState } from '@/lib/session/session';
import { gradeAnswer } from '@/lib/session/grade';
import { localDay } from '@/lib/day';
import { answerMode, answerOptions, appendNumeric, formatAnswer } from '@/lib/session/answers';
import { closedRound, type Round } from '@/lib/rewards/stars';
import { noStreak, type PlayStreak } from '@/lib/rewards/streak';
import {
  awardRoundAction,
  endRecordingAction,
  recordAttemptAction,
  startRecordingAction,
} from '@/app/play/actions';
import { NumberPad } from './number-pad';
import { LetterPad } from './letter-pad';
import { ChoicePad } from './choice-pad';
import { ContinueButton } from './continue-button';
import { ExitIcon } from './exit-icon';
import { HintIcon } from './hint-icon';
import { ProfileMenu } from './profile-menu';
import { RoundReward } from './round-reward';
import { StreakFlash } from './streak-flash';
import { playSound, primeSounds } from './sounds';

/**
 * How long a correct answer is celebrated before the next question. A wrong one
 * is never on a timer - the child reads the right answer and taps Continue.
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
  /**
   * What the child has shown before. It steers which templates come up, and is
   * carried forward as they answer - so it must match on the server and the
   * client, like the seed.
   */
  profile: LearnerProfile;
  recentTopics: string[];
  recordingEnabled: boolean;
  /** Who's playing, and their totals as last read from the server. Null signed out. */
  account: {
    name: string | null;
    image: string | null;
    streak: PlayStreak;
    stars: number;
  } | null;
  /** The sign-out form, built on the server so it stays a server action. */
  signOutSlot: ReactNode;
}

export function PlaySession({
  subject,
  level,
  templates,
  seed,
  startedAt,
  profile,
  recentTopics,
  recordingEnabled,
  account,
  signOutSlot,
}: Props) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(() =>
    startSession({ templates, seed, startedAt, subject, level, profile, recentTopics }),
  );
  const [entry, setEntry] = useState('');
  /**
   * `entry` mirrored outside React state. The keyboard listener below is a
   * plain `addEventListener`, so between a keystroke and the effect below
   * re-running with a fresh closure, it is still holding the *previous*
   * render's `entry` - typing the last digit of an answer and hitting Enter
   * in the same breath reliably lands inside that window, on real hardware,
   * not just as a theoretical race. Reading the ref instead of the closure
   * variable when Enter is pressed means Check always sees what's on screen.
   */
  const entryRef = useRef('');
  const updateEntry = useCallback((next: string | ((value: string) => string)) => {
    const resolved = typeof next === 'function' ? next(entryRef.current) : next;
    entryRef.current = resolved;
    setEntry(resolved);
  }, []);
  const [feedback, setFeedback] = useState<Feedback>(null);
  /** The next question, held back until the child taps Continue. */
  const [pending, setPending] = useState<SessionState | null>(null);
  /** Hints are asked for, never pushed - and only for the question in hand. */
  const [hintShown, setHintShown] = useState(false);
  /** The round of ten just finished, while its stars are on screen. */
  const [reward, setReward] = useState<Round | null>(null);
  /** The day streak, on the one answer of the day that extended it. */
  const [streak, setStreak] = useState<number | null>(null);
  /** The profile menu's two totals - kept live as answers land and rounds bank. */
  const [stars, setStars] = useState(account?.stars ?? 0);
  const [playStreak, setPlayStreak] = useState<PlayStreak>(account?.streak ?? noStreak());
  const recordId = useRef<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = session.current;
  const mode = answerMode(question);
  const options = useMemo(() => answerOptions(question), [question]);

  // Load the answer sounds up front, so the first one is heard on the answer that
  // earns it rather than a round trip later.
  useEffect(primeSounds, []);

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
    updateEntry('');
    setFeedback(null);
    setHintShown(false);

    // Ten answers closes a round. Which stars it is worth is read off the answers
    // themselves, so the celebration and the server's recount cannot disagree.
    // Banking them is `submit`'s job - it has to wait for the write.
    const round = closedRound(next.attempts.map((attempt) => attempt.correct));
    if (round) {
      setReward(round);
      // Optimistic, like the round celebration itself: the server recounts from
      // the stored answers regardless, so this only has to hold until the next
      // full page load reconciles it.
      setStars((total) => total + round.stars);
    }
  }, [updateEntry]);

  /**
   * The next question has been sitting behind the stars rather than in front of
   * the child, so its clock starts again here. Otherwise the break would land in
   * that question's time, and time per topic is something a parent gets shown.
   */
  const dismissReward = useCallback(() => {
    setReward(null);
    setSession((state) => ({ ...state, questionShownAt: Date.now() }));
  }, []);

  // Stable, so answering while the flash is up does not restart its timer and
  // leave a faded-out badge mounted over the screen.
  const dismissStreak = useCallback(() => setStreak(null), []);

  const submit = useCallback(
    (value: string) => {
      if (feedback || value === '') return;

      const { correct } = gradeAnswer(question, value);
      const expected = formatAnswer(question);
      // Read the offset per answer rather than once at the top: it is the only
      // way a session that runs across a daylight saving change stays honest
      // about which day each answer belongs to.
      const now = Date.now();
      const offsetMinutes = -new Date(now).getTimezoneOffset();
      const next = submitAnswer(session, value, now, offsetMinutes);

      updateEntry(value);
      setFeedback(correct ? { state: 'correct' } : { state: 'wrong', expected });
      playSound(correct ? 'correct' : 'incorrect');

      if (recordId.current) {
        const id = recordId.current;
        const attempt = next.attempts[next.attempts.length - 1];
        const results = next.attempts.map((a) => a.correct);

        // Only the first answer of a day comes back with anything to show, and
        // a failed write simply comes back with nothing.
        recordAttemptAction(id, attempt).then((result) => {
          if (result) {
            setPlayStreak({ days: result.streak, lastDay: localDay(now, offsetMinutes) });
            if (result.streakAdvanced) setStreak(result.streak);
          }
          // Banked *after* the answer is written, never alongside it: the server
          // counts the round from the stored answers, and a recount that raced
          // the tenth of them would find nine and award nothing. A dropped call
          // repairs itself at the next round, which recounts the sitting whole.
          if (closedRound(results)) awardRoundAction(id);
        });
      }

      // Right answers move on by themselves; wrong ones wait for Continue, so
      // the right answer stays on screen for as long as the child wants it.
      if (correct) advanceTimer.current = setTimeout(() => advance(next), CORRECT_MS);
      else setPending(next);
    },
    [session, question, feedback, advance, updateEntry],
  );

  // A physical keyboard should work as well as the on-screen pads.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;

      // The stars are over everything else, so nothing behind them may be answered.
      if (reward) {
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          dismissReward();
        }
        return;
      }

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
        // and a first letter picks by name - t and f for true/false.
        const match =
          options.find((o) => o.label.toLowerCase() === typed) ??
          options[Number(key) - 1] ??
          options.find((o) => o.label.toLowerCase().startsWith(typed));
        if (match) submit(match.value);
        return;
      }

      // Backspace's browser default is to navigate back when focus isn't in an
      // editable field, which nothing here is.
      if (key === 'Backspace') {
        event.preventDefault();
        updateEntry((v) => v.slice(0, -1));
      } else if (key === 'Enter') {
        event.preventDefault();
        // Read the ref, not the closure's `entry`: this listener is replaced by
        // a fresh one each render, but that replacement happens after React
        // commits, and typing a last digit then hitting Enter can land the
        // keydown before that commit - the closure here would still be holding
        // the previous render's `entry`. The ref is updated synchronously by
        // `updateEntry`, so it is never behind a keystroke that already landed.
        submit(entryRef.current);
      } else if (mode === 'number') updateEntry((v) => appendNumeric(v, key));
      else if (mode === 'text' && /^[a-z]$/i.test(key))
        updateEntry((v) => (v.length < MAX_ENTRY.text ? v + key.toUpperCase() : v));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, feedback, mode, options, pending, advance, reward, dismissReward, updateEntry]);

  return (
    // Fixed to the viewport: everything must fit an iPad screen with no scrolling,
    // so the pad is never below the fold in either orientation.
    <main className="no-select flex h-[100dvh] flex-col overflow-hidden px-4 py-3 sm:px-10 sm:py-5">
      {/* Nothing here counts anything. A clock and a running score are both things
          a child would watch instead of the question, and neither is theirs to
          worry about - the round's stars are the only reckoning, and they come
          between questions. What is left is the way out and whose screen it is. */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        {/* A button rather than a link, and an icon rather than the word: it is
            the one control on this screen a child might reach for without being
            able to read, and it sits opposite the profile menu it now matches. */}
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Finish and go back"
          className="rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </button>

        {account ? (
          <ProfileMenu
            name={account.name}
            image={account.image}
            streak={playStreak}
            stars={stars}
          >
            {signOutSlot}
          </ProfileMenu>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2 sm:gap-6 sm:py-4">
        <h1
          key={session.askedCount}
          className={`max-w-3xl text-center leading-snug font-semibold text-balance ${promptSize(question.prompt)}`}
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

      {/* The pad's slot. After a wrong answer the pad gives way to Continue -
          except for tapped questions, where the buttons themselves are showing
          which option was right, so they stay and Continue sits under them.

          A phone has far less height to give than an iPad, so the pad takes 40%
          of it there rather than the ~46% it took everywhere before, leaving the
          question the room it was short of. The bounds are part of the same
          expression: a fixed 16rem floor would quietly take that 6% back on a
          short phone. */}
      <div className="flex h-[clamp(12rem,40vh,20rem)] shrink-0 flex-col justify-center gap-2 sm:h-[clamp(16rem,43vh,22rem)] sm:gap-3">
        {(pending === null || mode === 'tap') && (
          <div className="min-h-0 flex-1">
            <AnswerInput
              question={question}
              mode={mode}
              options={options}
              entry={entry}
              feedback={feedback}
              onEntry={updateEntry}
              onSubmit={submit}
            />
          </div>
        )}

        {pending !== null && <ContinueButton onContinue={() => advance(pending)} />}
      </div>

      {streak !== null && <StreakFlash days={streak} onDone={dismissStreak} />}
      {reward !== null && <RoundReward round={reward} onDone={dismissReward} />}
    </main>
  );
}

/**
 * How big the question is set. The screen is a fixed height that may not scroll,
 * and the height left over is what the question has to fit in - so it is sized in
 * `vh` rather than by breakpoint, which is what stopped a wordy Year 6 prompt
 * fitting a phone or a landscape iPad. Longer prompts take a smaller step again;
 * length is a good enough proxy for lines, as prompts are one plain sentence.
 */
function promptSize(prompt: string) {
  if (prompt.length > 90) return 'text-[clamp(1rem,2.8vh,1.875rem)]';
  if (prompt.length > 45) return 'text-[clamp(1.125rem,3.5vh,2.25rem)]';
  return 'text-[clamp(1.375rem,4.5vh,3rem)]';
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
    <div className="flex min-h-12 shrink-0 items-center justify-center px-2 sm:min-h-14">
      {hint === undefined || answered ? null : shown ? (
        <p className="max-w-2xl text-center text-[clamp(1rem,2.4vh,1.5rem)] text-balance text-(--color-ink-soft)">
          {hint}
        </p>
      ) : (
        <button
          type="button"
          onClick={onShow}
          aria-label="Show a hint"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-line) bg-(--color-card) text-(--color-ink-soft) transition active:scale-95 active:bg-(--color-brand-soft) sm:h-14 sm:w-14"
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
        className={`flex h-16 items-center justify-center rounded-3xl border-2 px-6 font-bold tabular-nums transition-colors sm:h-20 ${
          wide
            ? 'w-96 max-w-full text-3xl tracking-wide sm:text-4xl'
            : 'w-44 text-4xl sm:w-56 sm:text-5xl'
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
      className="h-8 text-center text-xl font-semibold text-(--color-right) sm:h-9 sm:text-3xl"
    >
      {feedback?.state === 'wrong' ? `The answer is ${feedback.expected}` : ''}
    </p>
  );
}
