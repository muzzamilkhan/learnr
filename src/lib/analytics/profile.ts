import type { YearLevel } from '../curriculum';
import { DAY_MS, localDay } from '../day';

/**
 * What a child has shown they can do, folded down from the questions they have
 * answered.
 *
 * One profile serves both halves of this work: the report reads it to say which
 * topics need a hand, and the reinforcement selector reads it to decide what to
 * ask next. It is built by folding attempts in order, so the same profile comes
 * out of a season of stored history or out of the six questions answered so far
 * this sitting, and it stays plain JSON so the server can hand it to the play
 * screen and the client can carry it forward.
 *
 * Pure, like everything in `lib`: the caller passes `now`, never the clock.
 */

/** The part of an attempt that says something about a skill. */
export interface Observation {
  topic: string;
  level: YearLevel;
  correct: boolean;
  timeTakenMs: number;
  answeredAt: number;
  /**
   * Minutes east of UTC where the answer was given, e.g. 600 for Sydney in
   * winter. Only "which day was this?" depends on it, and left out it is UTC —
   * the same default the report takes. Carried per observation rather than per
   * fold so a family that crosses daylight saving keeps honest days.
   */
  offsetMinutes?: number;
}

/** One topic at one year level — the grain everything here is measured at. */
export interface TopicSkill {
  topic: string;
  level: YearLevel;
  attempts: number;
  correct: number;
  /**
   * Recency-weighted accuracy in [0, 1]: what the child can do *now*. Lifetime
   * accuracy would let a bad first week outvote a good month, and hide the
   * opposite too — a topic that has quietly slipped.
   */
  strength: number;
  /** Correct answers in a row. One right answer is luck; a run is the signal. */
  streak: number;
  /**
   * Distinct local days with at least one right answer. This is the count that
   * says a topic is *known* rather than merely warm: four in a row in one
   * sitting is short-term memory, the same thing a week later is not.
   */
  correctDays: number;
  /** The last day counted, so the fold can tell a new day from the same one again. */
  lastCorrectDay: number | null;
  totalTimeMs: number;
  lastAnsweredAt: number;
}

export interface LearnerProfile {
  skills: readonly TopicSkill[];
}

/**
 * Weight given to the newest answer when folding it into `strength`. High enough
 * that a run of mistakes shows up inside one sitting, low enough that a single
 * slip does not undo a fortnight of getting it right.
 */
export const RECENCY = 0.4;

/** Under this many answers a topic is still being sized up, and is never called weak. */
export const MIN_OBSERVATIONS = 4;

/** Strength below this is a topic the child is finding hard. */
export const STRUGGLING_BELOW = 0.6;

/** Strength at or above this, with a run behind it, is a topic they have. */
export const SECURE_AT = 0.85;
export const SECURE_STREAK = 3;

/**
 * Mastery is not the same question as "are they struggling?", and it needs more
 * than the bare minimum to answer. `MIN_OBSERVATIONS` is the point at which we
 * will say a topic is *hard* — the cost of being wrong there is a few extra
 * questions on something they can do. Calling a topic *known* is the expensive
 * mistake: it steps the topic down to a fraction of the questions and puts it
 * away for days.
 */
export const SECURE_OBSERVATIONS = 8;

/**
 * And on more than one day. Four right in a row in one sitting is the same
 * memory answering four times; the point of spaced practice is the answer that
 * survives a night's sleep, so that is what is allowed to count as known.
 */
export const SECURE_DAYS = 2;

// Re-exported because a skill row's `lastCorrectDay` is one of these, and callers
// reading that column should not have to know where the arithmetic lives.
export { localDay };

/**
 * How long a secure topic is left alone before it is worth asking again. The
 * gap grows with the number of separate days it has been got right on: known
 * on two days needs confirming within a couple more, known on five keeps for a
 * month. Coming back to it *after* it has started to fade is the point — that
 * is what makes the recall stick rather than just filling the screen with
 * things they can already do.
 *
 * Days rather than the streak, because a streak is a within-sitting run and can
 * reach any length in ten minutes: intervals should grow with the number of
 * times a child has *come back* and still known it.
 */
export const REVIEW_INTERVALS_MS: readonly number[] = [2 * DAY_MS, 5 * DAY_MS, 12 * DAY_MS, 28 * DAY_MS];

export function reviewIntervalMs(skill: TopicSkill): number {
  const step = Math.min(Math.max(skill.correctDays - SECURE_DAYS, 0), REVIEW_INTERVALS_MS.length - 1);
  return REVIEW_INTERVALS_MS[step];
}

/** When a secure topic is worth confirming again. */
export function reviewDueAt(skill: TopicSkill): number {
  return skill.lastAnsweredAt + reviewIntervalMs(skill);
}

/**
 * `new` means "not enough answers to say" — the honest answer for most topics
 * most of the time, and the reason a child who has just started gets random
 * questions rather than a diagnosis built out of two data points.
 */
export type SkillStatus = 'new' | 'struggling' | 'developing' | 'secure' | 'review-due';

/** Enough evidence to call a topic known: a strong run, over enough answers, on more than one day. */
const isMastered = (skill: TopicSkill): boolean =>
  skill.strength >= SECURE_AT &&
  skill.streak >= SECURE_STREAK &&
  skill.attempts >= SECURE_OBSERVATIONS &&
  skill.correctDays >= SECURE_DAYS;

export function skillStatus(skill: TopicSkill | undefined, now: number): SkillStatus {
  if (!skill || skill.attempts < MIN_OBSERVATIONS) return 'new';
  if (skill.strength < STRUGGLING_BELOW) return 'struggling';
  if (isMastered(skill)) return now >= reviewDueAt(skill) ? 'review-due' : 'secure';
  return 'developing';
}

export const emptyProfile = (): LearnerProfile => ({ skills: [] });

export function findSkill(
  profile: LearnerProfile,
  topic: string,
  level: YearLevel,
): TopicSkill | undefined {
  return profile.skills.find((skill) => skill.topic === topic && skill.level === level);
}

/**
 * One answer folded into one skill. Exported on its own because the database
 * keeps a running skill row per child and needs exactly this step — the stored
 * profile and the in-memory one are then the same arithmetic, not two guesses
 * that drift.
 */
export function nextSkill(previous: TopicSkill | undefined, observation: Observation): TopicSkill {
  const outcome = observation.correct ? 1 : 0;
  const day = localDay(observation.answeredAt, observation.offsetMinutes);

  if (!previous) {
    return {
      topic: observation.topic,
      level: observation.level,
      attempts: 1,
      correct: outcome,
      strength: outcome,
      streak: outcome,
      correctDays: outcome,
      lastCorrectDay: observation.correct ? day : null,
      totalTimeMs: observation.timeTakenMs,
      lastAnsweredAt: observation.answeredAt,
    };
  }

  // A day counts once, and only when something was got right on it. The test is
  // "later than the last day counted" rather than "different from" so the count
  // cannot be inflated by answers arriving out of order — two writes landing at
  // once, or a retry overtaking. `buildProfile` sorts, so a fold over a whole
  // history is exact; a live fold that is handed an older answer late will
  // undercount, which delays calling a topic known and never fakes it.
  const newDay =
    observation.correct && (previous.lastCorrectDay === null || day > previous.lastCorrectDay);

  return {
    ...previous,
    attempts: previous.attempts + 1,
    correct: previous.correct + outcome,
    strength: previous.strength + RECENCY * (outcome - previous.strength),
    streak: observation.correct ? previous.streak + 1 : 0,
    correctDays: previous.correctDays + (newDay ? 1 : 0),
    lastCorrectDay: newDay ? day : previous.lastCorrectDay,
    totalTimeMs: previous.totalTimeMs + observation.timeTakenMs,
    lastAnsweredAt: Math.max(previous.lastAnsweredAt, observation.answeredAt),
  };
}

/** Immutable, like the session state it travels with. */
export function applyObservation(profile: LearnerProfile, observation: Observation): LearnerProfile {
  const existing = findSkill(profile, observation.topic, observation.level);
  const updated = nextSkill(existing, observation);

  return {
    skills: existing
      ? profile.skills.map((skill) => (skill === existing ? updated : skill))
      : [...profile.skills, updated],
  };
}

/** Fold a history into a profile. Order matters, so the caller's order is not trusted. */
export function buildProfile(observations: readonly Observation[]): LearnerProfile {
  return [...observations]
    .sort((a, b) => a.answeredAt - b.answeredAt)
    .reduce(applyObservation, emptyProfile());
}

/**
 * Whether the answers say anything yet. Until one topic has been answered enough
 * times to be judged, there is no pattern to act on and questions stay random —
 * steering off two answers would be superstition, not teaching.
 */
export function hasPattern(profile: LearnerProfile): boolean {
  return profile.skills.some((skill) => skill.attempts >= MIN_OBSERVATIONS);
}

/** The topics of the last few questions, newest first. */
export function recentTopics(observations: readonly Observation[], count: number): string[] {
  return [...observations]
    .sort((a, b) => b.answeredAt - a.answeredAt)
    .slice(0, count)
    .map((observation) => observation.topic);
}

export const accuracy = (skill: TopicSkill): number =>
  skill.attempts === 0 ? 0 : skill.correct / skill.attempts;

export const averageTimeMs = (skill: TopicSkill): number =>
  skill.attempts === 0 ? 0 : Math.round(skill.totalTimeMs / skill.attempts);
