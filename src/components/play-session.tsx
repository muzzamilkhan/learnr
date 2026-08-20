'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionTemplate, Question } from '@/lib/templates/types';
import type { LearnerProfile } from '@/lib/analytics/profile';
import type { YearLevel } from '@/lib/curriculum';
import type { Avatar } from '@/lib/avatars';
import { MAX_TIME_MS, startSession, submitAnswer, type SessionState } from '@/lib/session/session';
import { gradeAnswer } from '@/lib/session/grade';
import { localDay } from '@/lib/day';
import { answerMode, answerOptions, appendNumeric, formatAnswer } from '@/lib/session/answers';
import { closedRound, type Round } from '@/lib/rewards/stars';
import { noStreak, type PlayStreak } from '@/lib/rewards/streak';
import {
  dayProgress,
  dayTotal,
  targetProgress,
  TARGET_STARS,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import {
  awardRoundAction,
  awardTargetAction,
  endRecordingAction,
  recordAttemptAction,
  startRecordingAction,
} from '@/app/play/actions';
import { localOffsetMinutes, subscribeToTheClock, today } from './clock';
import { NumberPad } from './number-pad';
import { LetterPad } from './letter-pad';
import { ChoicePad } from './choice-pad';
import { ContinueButton } from './continue-button';
import { Diagram } from './diagram';
import { ExitIcon } from './exit-icon';
import { HintIcon } from './hint-icon';
import { SpeakerIcon } from './speaker-icon';
import { questionNarration, spokenText } from '@/lib/speech/narration';
import {
  narrationOff,
  narrationOn,
  setNarration,
  speak,
  stopSpeaking,
  subscribeNarration,
} from './speech';
import { ProfileMenu } from './profile-menu';
import { RoundReward } from './round-reward';
import { StreakFlash } from './streak-flash';
import { TargetBar } from './target-bar';
import { TargetReward } from './target-reward';
import { playSound, primeSounds } from './sounds';

/**
 * How long a correct answer is celebrated before the next question. A wrong one
 * is never on a timer - the child reads the right answer and taps Continue.
 */
const CORRECT_MS = 700;

/** Enough for any answer a child is asked to type, short enough to stay legible. */
const MAX_ENTRY = { text: 16 } as const;

/**
 * The one viewport this screen's stacked layout does not fit: a landscape
 * phone. An iPad in landscape - the shortest screen this otherwise runs on -
 * is 768px tall, and every phone in portrait clears this too; what is left is
 * a phone turned sideways, down around 375-430px, where a figure stacked above
 * the prompt would leave neither any usable room. Below it the two sit side by
 * side instead - see the figure-and-prompt wrapper below - and the pad's own
 * bounds switch with it, for the same reason (see the pad's slot further down).
 *
 * `500px` is written out at every use below rather than held in a constant:
 * Tailwind's scanner reads class names as source-text literals (CLAUDE.md
 * says this outright for `OPERATION_ACCENT`, and it is exactly as true of an
 * arbitrary variant), so a class built from `` `${SOME_CONST}:flex-row` ``
 * compiles to nothing - the composed string exists at runtime, but never in
 * the source text the build ever scans. A shared constant here would be a
 * standing invitation to do that again the next time this screen changes.
 */

/**
 * `64px`, applied as a literal `min-h`/`min-w` on the figure itself further
 * down rather than held in a constant here (a class built by interpolating a
 * JS value into a Tailwind arbitrary value is the exact mistake the note
 * above is about) - the smallest a figure is ever allowed to render at, the
 * same ~64px this component is built to read at in a parent's report row
 * (see `diagram.tsx`), so a play-screen figure is never asked to be legible
 * smaller than the thumbnail it already has to work at. Below this a picture
 * stops telling a heptagon from an octagon, which is worse than the layout
 * looking a little cramped.
 *
 * It is written `min(64px,100%)`, not a bare `64px` - a floor that is hard
 * regardless of the room actually on offer claims room that is not always
 * there. On a landscape phone the figure's own row resolves to 0px tall (see
 * the wrapper below), and a bare floor would still win, painting the drawing
 * over whatever the header put at that height - found on the round this was
 * caught: the narration speaker button, which sits at the figure's own stack
 * position and loses, since the figure paints after the header in DOM order.
 * `100%` resolves against the wrapper's own definite height, so the floor is
 * a genuine 64px wherever there is 64px to give, and shrinks to nothing -
 * no figure drawn at all - exactly where there is none. That is the honest
 * trade: a figure that sometimes does not appear, rather than one that
 * sometimes appears on top of a button.
 */

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
    /** Their own face: the photo a parent cropped, then the animal they picked. */
    photo: string | null;
    avatar: Avatar | null;
    streak: PlayStreak;
    stars: number;
  } | null;
  /**
   * The daily target, if the child's parent set one. Null for a child with no
   * target and for one signed in with their own account, and the screen then
   * looks exactly as it did before this feature.
   */
  target: {
    target: DailyTarget;
    answers: TargetAnswer[];
    awardedDay: number | null;
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
  target,
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
  /** The day's goal, while its stars are on screen. Queued behind a round's. */
  const [targetReward, setTargetReward] = useState<DailyTarget | null>(null);
  /** The day streak, on the one answer of the day that extended it. */
  const [streak, setStreak] = useState<number | null>(null);
  /** The profile menu's two totals - kept live as answers land and rounds bank. */
  const [stars, setStars] = useState(account?.stars ?? 0);
  const [playStreak, setPlayStreak] = useState<PlayStreak>(account?.streak ?? noStreak());
  /**
   * What this sitting has added to today's total, in the target's own unit.
   * Ordinary state with no clock anywhere in it: these are answers given since
   * this screen opened, so they are today's whatever day it turns out to be.
   */
  const [addedToday, setAddedToday] = useState(0);
  /** Set when the goal's own celebration has been seen and dismissed. */
  const [targetCelebrated, setTargetCelebrated] = useState(false);
  const recordId = useRef<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = session.current;
  const mode = answerMode(question);
  const options = useMemo(() => answerOptions(question), [question]);

  // Load the answer sounds up front, so the first one is heard on the answer that
  // earns it rather than a round trip later.
  useEffect(primeSounds, []);

  /**
   * Whether the question is read aloud, which is this device's setting rather
   * than this child's. A child who cannot read the question today cannot read it
   * on the next sitting either, so it outlives the session - and it is kept on
   * the device rather than the child's profile because the person who needs to
   * turn it on is the one who cannot read the screen that would otherwise hold
   * it. Read as a store, like the streak and the day's total: only the browser
   * knows it, so the server renders nothing rather than guessing.
   */
  const narrating = useSyncExternalStore(subscribeNarration, narrationOn, narrationOff);

  /**
   * Read each question as it arrives. Keyed on the question itself, so the stars
   * between rounds and a revealed hint do not start it over.
   *
   * iOS will not speak without a gesture, which is why the switch that turns
   * this on is a button the child taps: that tap is the gesture, and the sticky
   * activation it leaves lasts the rest of the document. A screen reloaded with
   * the setting already on is the one case with no gesture behind it - there the
   * first question is silent until the speaker is tapped, and tapping it is what
   * a child does when the question does not come.
   */
  useEffect(() => {
    if (!narrating) return;
    speak(questionNarration(question));
  }, [narrating, question]);

  // Nothing should still be talking about a question that is no longer on screen.
  useEffect(() => stopSpeaking, []);

  const toggleNarration = useCallback(() => {
    setNarration(!narrating);
    // Turning it on is left to the effect above, which is what says the question
    // - so the button reads whatever is on screen without knowing what it is.
    if (narrating) stopSpeaking();
  }, [narrating]);

  /**
   * The question, again. A child who missed it taps the words themselves, which
   * needs no icon and no explaining - and it does nothing when nothing is being
   * read aloud, so a child who can read never finds a tappable question.
   */
  const repeatQuestion = useCallback(() => {
    if (narrating) speak(questionNarration(question));
  }, [narrating, question]);

  /** Asking for the hint is a tap, so it is also the gesture that may say it. */
  const showHint = useCallback(() => {
    setHintShown(true);
    if (narrating && question.hint) speak(spokenText(question.hint));
  }, [narrating, question]);

  /**
   * The answers the server handed over that turn out to be today's - which is a
   * question only this device can answer, since the day boundary depends on an
   * offset the server does not have. Read the way the profile menu reads the
   * streak: the server snapshot is null, so the bar does not exist at all until
   * the browser has said what day it is, and there is no hydration mismatch to
   * dodge with an effect.
   */
  const doneBefore = useSyncExternalStore(
    subscribeToTheClock,
    () => (target === null ? null : doneToday(target.target, target.answers)),
    () => null,
  );

  /** Today's total: what was already there, plus what this sitting has added. */
  const targetDone = doneBefore === null ? null : doneBefore + addedToday;

  /**
   * Whether the goal is done with for today, which is what takes the bar off
   * this screen. Two halves for the same reason as the total: whether the day
   * the server banked is *this* day is the device's question, and whether the
   * celebration has been seen is plain state. A child who hit their goal this
   * morning and came back after school has nothing left to fill, and a bar
   * sitting full all evening is a thing to look at that says nothing.
   */
  const awardedToday = useSyncExternalStore(
    subscribeToTheClock,
    () => target?.awardedDay != null && target.awardedDay === today(),
    () => false,
  );
  const targetFinished = awardedToday || targetCelebrated;

  /**
   * A minutes bar has to move while the child is thinking, or it would sit still
   * through the one thing it is measuring. So it shows the time this question has
   * taken so far - capped at exactly the cap the answer will be recorded with, so
   * what is shown can never run ahead of what is counted. It settles onto the
   * real total when the answer lands.
   */
  const elapsed = useElapsed(
    target?.target.kind === 'minutes' && feedback === null,
    session.questionShownAt,
  );

  const targetFraction =
    target === null || targetDone === null
      ? 0
      : targetProgress(target.target, targetDone + elapsed).fraction;

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
      // Optimistic, and now the only correction there is. The server still
      // decides what a round was worth by reading the stored answers, but
      // `User.stars` is *incremented* rather than recounted, so a dropped
      // `awardRoundAction` no longer heals itself on the next page load. What
      // keeps the two in step is that both value the round with `closedRound`
      // over the same answers.
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

  /**
   * Same as dismissing a round's stars: the next question has been waiting
   * behind this screen rather than in front of the child, so its clock starts
   * again here and the break never lands inside that question's recorded time.
   */
  const dismissTargetReward = useCallback(() => {
    setTargetReward(null);
    setTargetCelebrated(true);
    setSession((state) => ({ ...state, questionShownAt: Date.now() }));
  }, []);

  /**
   * Whether the day's goal may show its screen yet. Four conditions rather than
   * one, because the goal's stars are the last thing to happen on an answer and
   * each clause is one way that answer is not finished with:
   *
   * - `targetReward` - the server has actually said the goal was met just now.
   * - `reward === null` - the round's stars go first when one answer does both,
   *   and are never covered by this.
   * - `pending === null` - a wrong answer is still on screen with the right one
   *   beside it, waiting for Continue, and covering that is the one thing this
   *   screen must not do.
   * - `feedback === null` - a right answer is still showing its tick, and the
   *   round's stars have not had their chance to be set yet.
   *
   * The award is asked for as soon as the answer is written, so it can resolve
   * well before `advance` runs - it is behind a timer on a right answer and
   * behind a tap on a wrong one. Without the last two clauses the goal's screen
   * would appear first, then be torn down mid-animation when the round's stars
   * arrived, then mount again from zero. `advance` clears `feedback` and
   * `pending` and sets `reward` in one commit, so reading all four here gives
   * the one order this is meant to have, on every path.
   */
  const showTargetReward =
    targetReward !== null && reward === null && pending === null && feedback === null;

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
      const offsetMinutes = localOffsetMinutes();
      const next = submitAnswer(session, value, now, offsetMinutes);

      // The target's own view of the answer. Questions step by one; minutes take
      // the time the answer was actually recorded with, cap and all, so the bar
      // and the parent's report can never disagree.
      if (target) {
        const attempt = next.attempts[next.attempts.length - 1];
        const unit = target.target.kind === 'questions' ? 1 : attempt.timeTakenMs;
        setAddedToday((added) => added + unit);
      }

      updateEntry(value);
      setFeedback(correct ? { state: 'correct' } : { state: 'wrong', expected });
      // The question has been answered, so reading it out is over - and a voice
      // still going under the right-or-wrong sound is two things at once.
      stopSpeaking();
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

          // The day's goal, asked for after the answer is written for the same
          // reason the round's stars are: the server recounts from the stored
          // answers, and a recount that raced this answer would find one fewer
          // and award nothing. Asking on every answer is safe and is what makes
          // a dropped call repair itself - the compare-and-set on the day means
          // only one of them can ever pay out.
          if (target && !targetFinished) {
            awardTargetAction(id, offsetMinutes).then((awarded) => {
              if (!awarded) return;
              setTargetReward(target.target);
              setStars((total) => total + TARGET_STARS);
            });
          }
        });
      }

      // Right answers move on by themselves; wrong ones wait for Continue, so
      // the right answer stays on screen for as long as the child wants it.
      if (correct) advanceTimer.current = setTimeout(() => advance(next), CORRECT_MS);
      else setPending(next);
    },
    [session, question, feedback, advance, updateEntry, target, targetFinished],
  );

  // A physical keyboard should work as well as the on-screen pads.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key;

      // The stars are over everything else, so nothing behind them may be answered.
      if (reward || showTargetReward) {
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          if (reward) dismissReward();
          else dismissTargetReward();
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
  }, [
    submit,
    feedback,
    mode,
    options,
    pending,
    advance,
    reward,
    dismissReward,
    showTargetReward,
    dismissTargetReward,
    updateEntry,
  ]);

  return (
    // Fixed to the viewport: everything must fit an iPad screen with no scrolling,
    // so the pad is never below the fold in either orientation.
    <main className="no-select flex h-[100dvh] flex-col overflow-hidden px-4 py-3 sm:px-10 sm:py-5">
      {/* Nothing here counts anything. A clock and a running score are both things
          a child would watch instead of the question, and neither is theirs to
          worry about - the round's stars are the only reckoning, and they come
          between questions. What is left is the way out, whether the question is
          read aloud, and whose screen it is. */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        {/* The two controls a child reaches for, both drawn rather than written:
            the way out, and whether the question is read to them. They sit
            together on the left because they are the child's own controls, and
            opposite the profile menu that says whose screen this is. */}
        <div className="flex shrink-0 items-center gap-2">
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

          {/* The way in for a child who cannot read the question. It is on their
              screen rather than behind a parent's sign-in for two reasons: the
              person who needs it is the one who cannot read the setting, and iOS
              refuses to speak without a gesture - so the tap that turns it on is
              also what lets it talk at all. */}
          <button
            type="button"
            onClick={toggleNarration}
            aria-pressed={narrating}
            aria-label={narrating ? 'Stop reading the question aloud' : 'Read the question aloud'}
            className={`rounded-full border-2 p-2.5 transition active:scale-95 ${
              narrating
                ? 'border-(--color-brand) bg-(--color-brand-soft) text-(--color-brand)'
                : 'border-(--color-line) bg-(--color-card) text-(--color-ink-soft)'
            }`}
          >
            <SpeakerIcon off={!narrating} />
          </button>
        </div>

        {/* The only thing on this screen that keeps a running count of anything,
            and it does it as a picture rather than a number for exactly the
            reason the header does not: a figure is something to watch instead of
            the question. It rides in the header's own row, between the way out
            and the profile menu, so the top of the screen is one line rather
            than two. It goes entirely once the day's goal has been celebrated. */}
        <div className="flex min-w-0 flex-1 justify-center">
          {target !== null && targetDone !== null && !targetFinished ? (
            <TargetBar fraction={targetFraction} className="w-full max-w-sm" />
          ) : null}
        </div>

        {account ? (
          <ProfileMenu
            name={account.name}
            image={account.image}
            photo={account.photo}
            avatar={account.avatar}
            streak={playStreak}
            stars={stars}
          >
            {signOutSlot}
          </ProfileMenu>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2 sm:gap-6 sm:py-4">
        {question.figure ? (
          // A question with a figure is a picture with a caption underneath it,
          // not a sentence with a picture squeezed above it - see the design's
          // "Layout" section. `Diagram` is the *sole* flex-1 item here, capped
          // at 40/46vh as a ceiling (ample headroom on every device this app
          // targets - see the report's per-viewport table - so it is a defence
          // against an unreasonably tall window rather than the thing that
          // actually decides the figure's size) and floored at 64px (see the
          // note above) so it is never asked to draw as a sliver.
          //
          // That ceiling keeps a plain `sm:` where the pad below has moved to a
          // height query, and the difference is the point: a cap written in
          // `vh` is already a share of the viewport's own height, so it shrinks
          // on the short viewport by itself and cannot make the mistake the
          // pad's absolute `16rem` floor made - `sm:` there raised a bound
          // built for a tall device on a wide short one, while here it only
          // chooses between two shares of whatever height there actually is,
          // both of which sit well above what a landscape phone hands this box.
          //
          // `Prompt`'s
          // own slot is deliberately *not* flex-1: an earlier version gave it
          // `flex-1` too, which - both siblings then wanting equal shares of a
          // `flex: 1 1 0%` split - meant the figure's cap never bound at all,
          // since there was never a competition for it to win. Here the slot
          // instead carries a much lower `flex-grow` (`flex-[0.35]`, roughly
          // the "prompt is a caption now" quarter-share the design calls for),
          // so `Diagram` takes essentially everything up to its own cap and
          // the slot takes what is left. `Prompt` itself is unchanged - its
          // root is still `flex-1` and still fits itself to whatever box it
          // is handed, which is exactly why it can sit inside a slot with a
          // different flex-grow of its own rather than needing to know about
          // any of this.
          //
          // On a landscape phone the column becomes a row instead (the one
          // flex-direction change under a short-viewport media query, `500px`
          // - see the constant note above for why that number is not held in
          // a variable), and `items-stretch` goes with it: in the ordinary
          // column, height is the main axis and flex-grow sizes both children
          // along it, but a row's main axis is width - stretch is what gives
          // them a height at all there, and the same caps and floors still
          // hold once they have one.
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 sm:gap-4 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-stretch">
            <Diagram
              figure={question.figure}
              strokeWidth={3.5}
              labelSize={7}
              // `64px` is the floor documented above, written out rather than
              // read from a constant: a class built by interpolating a JS
              // value into the string is exactly the mistake this file
              // already made once - Tailwind's scanner needs the literal text
              // `min-h-[min(64px,100%)]` present in the source, and a composed
              // string is invisible to it however correct it looks at runtime.
              //
              // `min(64px,100%)`, not a bare `64px`: a *hard* floor claims
              // room that is not always there - on a landscape phone the row
              // is 0px tall and the floor still wins, so the drawing paints
              // over whatever the header put at that height (found on this
              // round's review: the speaker button, at the figure's own
              // stack position, since the figure comes after the header in
              // DOM order). `100%` resolves against the wrapper's own
              // definite height, so the floor is 64px wherever there is 64px
              // to give and shrinks to nothing - a figure that does not draw
              // at all - exactly where there is none. `min-w` gets the same
              // treatment for the same reason on the row axis.
              className="min-h-[min(64px,100%)] min-w-[min(64px,100%)] max-h-[40vh] max-w-[40vh] w-full flex-1 sm:max-h-[46vh] sm:max-w-[46vh]"
            />
            <div className="flex min-h-0 min-w-0 w-full flex-[0.35] flex-col items-center justify-center">
              <Prompt
                key={session.askedCount}
                prompt={question.prompt}
                onRepeat={repeatQuestion}
                repeatable={narrating}
              />
            </div>
          </div>
        ) : (
          <Prompt
            key={session.askedCount}
            prompt={question.prompt}
            onRepeat={repeatQuestion}
            repeatable={narrating}
          />
        )}

        <Hint
          hint={question.hint}
          shown={hintShown}
          answered={feedback !== null}
          onShow={showHint}
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

          The pad takes 40% of the height it is given, phone or tablet. It used
          to take ~46% everywhere and then 43% on a tablet, and both of those
          were the question's room: a landscape iPad is the shortest screen this
          runs on, and every percent the pad gives back there is a percent the
          question can be set in. The bounds are part of the same expression: a
          fixed 16rem floor would quietly take those percent back on a short
          phone.

          That reasoning was written assuming width was a good enough proxy for
          "tablet", which is what `sm:` gave it - and a landscape phone breaks
          the proxy rather than the reasoning: it is *wide* (often past the
          640px `sm:` line) and short at once, so it was taking the 16rem
          tablet floor - built for a device with height to spare - on exactly
          the device with the least height to spare, working against the very
          thing the paragraph above says the floor must not do. So the larger
          bounds now ask for height as well as width: `min-height:501px` is
          "not the short viewport" (the figure-and-prompt wrapper above uses
          the same `500px` line, in the same not-a-variable way, for the same
          reason). A landscape phone fails that second half and keeps the
          phone-sized clamp regardless of how wide it is; every tablet and
          desktop this app targets clears both and is unaffected. */}
      <div className="flex h-[clamp(12rem,40vh,20rem)] shrink-0 flex-col justify-center gap-2 [@media(min-width:640px)_and_(min-height:501px)]:h-[clamp(16rem,40vh,22rem)] [@media(min-width:640px)_and_(min-height:501px)]:gap-3">
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
      {/* Queued rather than stacked: an answer can close a round and finish the
          day at once, and two full-screen celebrations at the same moment would
          share one tap between them. The round goes first because it is about
          the ten questions just answered; the day is the bigger thing and comes
          last. */}
      {showTargetReward && targetReward !== null && (
        <TargetReward target={targetReward} onDone={dismissTargetReward} />
      )}
    </main>
  );
}

/** A tick a second, which is as often as the creep below has anything to say. */
function subscribeToSeconds(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

/** What of these answers belongs to today, in the unit the target counts in. */
function doneToday(target: DailyTarget, answers: TargetAnswer[]): number {
  const total = dayTotal(answers, { now: Date.now(), offsetMinutes: localOffsetMinutes() });
  return dayProgress(target, total).done;
}

/**
 * How long the question in hand has taken, for a minutes bar that would
 * otherwise sit still through the one thing it measures. The clock is an
 * external store rather than an interval writing state, so the value is read
 * during render and never rendered on the server - and it is read to the whole
 * second, because a snapshot that changed every millisecond would be a new
 * value on every render rather than only on the ticks that move the bar.
 */
function useElapsed(active: boolean, since: number): number {
  return useSyncExternalStore(
    active ? subscribeToSeconds : subscribeToTheClock,
    () => {
      if (!active) return 0;
      const whole = Math.floor((Date.now() - since) / 1000) * 1000;
      return Math.min(MAX_TIME_MS, Math.max(0, whole));
    },
    () => 0,
  );
}

/**
 * The question, set as large as the room it has allows. The screen is a fixed
 * height that may not scroll, so the size cannot simply be declared: the space
 * left over between the header and the pad is what the prompt has to fit in, and
 * that space differs by device, by orientation and by whether a target bar is
 * showing. So the box is measured and the size is searched for - the largest
 * whole pixel size at which the prompt still fits, and never larger than the
 * ceiling `--prompt-max` sets.
 *
 * The ceiling is where the two scales live: a phone keeps the `vh` ceiling it
 * always had, and from `sm` up it is twice the old one, because a tablet or a
 * laptop was leaving the question small in the middle of a large screen. What
 * stops that being a clipped prompt on a landscape iPad - the shortest screen
 * this runs on - is that it is a ceiling and not a size.
 */
const MIN_PROMPT_PX = 14;
const FALLBACK_PROMPT_MAX_PX = 96;

function Prompt({
  prompt,
  onRepeat,
  repeatable,
}: {
  prompt: string;
  onRepeat: () => void;
  repeatable: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const height = box.clientHeight;
      const width = box.clientWidth;
      // A viewport too short to leave the question any room at all - a phone held
      // sideways - collapses the box to nothing. There is no size that fits, so
      // the declared one is left alone and allowed to overrun, which is what it
      // did before there was a fit at all. Hiding the overrun would hide the
      // question.
      if (height <= 0 || width <= 0) return;

      const max = readPromptMax(box);
      let low = MIN_PROMPT_PX;
      let high = Math.max(MIN_PROMPT_PX, Math.round(max));
      let best = MIN_PROMPT_PX;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        text.style.fontSize = `${mid}px`;
        // A long word can overrun the line at a size whose lines still fit, so
        // width is checked as well as height.
        if (text.offsetHeight <= height && text.scrollWidth <= text.clientWidth) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      text.style.fontSize = `${best}px`;
    };

    fit();

    // The box changes height when the target bar appears or goes, and width when
    // the iPad is turned, and neither is a re-render of this component.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [prompt]);

  return (
    <div
      ref={boxRef}
      // Tapping the question repeats it, but only while it is being read aloud:
      // a child who missed it reaches for the words themselves, which needs no
      // icon and no explaining, and a child who can read never finds a button
      // where the question is. It is the box and not the text that takes the
      // tap, since the text is only as big as it needs to be and a child aiming
      // at a short question would otherwise be aiming at very little.
      onClick={repeatable ? onRepeat : undefined}
      role={repeatable ? 'button' : undefined}
      aria-label={repeatable ? 'Read the question again' : undefined}
      className="flex min-h-0 w-full flex-1 items-center justify-center [--prompt-max:clamp(1.375rem,4.5vh,3rem)] sm:[--prompt-max:6rem]"
    >
      {/* Sized by the class until the fit runs, so a prompt rendered on the
          server is already about the right size rather than snapping into
          place. Wider than a page of prose on a big screen: a short question is
          one line, and a line it can grow along is what lets it grow at all. */}
      <h1
        ref={textRef}
        className={`w-full max-w-3xl text-center leading-snug font-semibold text-balance sm:max-w-5xl ${promptSize(prompt)}`}
      >
        {prompt}
      </h1>
    </div>
  );
}

/** The ceiling in pixels, resolved from whatever `--prompt-max` came out as. */
function readPromptMax(box: HTMLElement): number {
  const declared = getComputedStyle(box).getPropertyValue('--prompt-max').trim();
  const px = declared.endsWith('px') ? Number.parseFloat(declared) : Number.NaN;
  return Number.isFinite(px) && px > 0 ? px : FALLBACK_PROMPT_MAX_PX;
}

/**
 * The size before the fit runs: what the server renders and what a browser
 * without JavaScript keeps. Longer prompts take a smaller step; length is a good
 * enough proxy for lines, as prompts are one plain sentence.
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
