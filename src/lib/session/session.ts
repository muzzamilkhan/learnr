import { applyObservation, emptyProfile, type LearnerProfile } from '../analytics/profile';
import type { YearLevel } from '../curriculum';
import { RECENT_MEMORY, selectTemplate, type SelectionContext } from '../reinforcement/select';
import { createRng, type Rng } from '../rng';
import { generateQuestion } from '../templates/generate';
import type { Question, QuestionTemplate } from '../templates/types';
import { gradeAnswer } from './grade';

/**
 * A session has no end. Once a subject + level has templates, it draws from them
 * for as long as the child keeps going. All state transitions are pure: the
 * caller supplies the clock, so the engine stays testable.
 *
 * Which template is drawn is the reinforcement selector's call, from the profile
 * the session carries — random until that profile says something, then weighted
 * towards what needs work. The profile is updated as the child answers, so a
 * topic that falls apart in the first ten questions is being mixed in more
 * heavily by the twentieth, without waiting for the next sitting.
 */

export interface Attempt {
  templateId: string;
  subject: string;
  topic: string;
  level: YearLevel;
  prompt: string;
  /** The expected answer, kept so a parent can review what was asked. */
  expected: string;
  response: string;
  correct: boolean;
  timeTakenMs: number;
  answeredAt: number;
}

export interface SessionState {
  subject: string;
  level: YearLevel;
  startedAt: number;
  /** When the current question was put on screen — the timer origin for this attempt. */
  questionShownAt: number;
  current: Question;
  attempts: Attempt[];
  askedCount: number;
  /** Serialised RNG position, so the next draw continues the sequence. */
  draw: number;
  seed: string;
  templates: readonly QuestionTemplate[];
  /** What the child has shown so far, this sitting and every one before it. */
  profile: LearnerProfile;
  /** Topics of the last few questions, newest first — what stops one topic clumping. */
  recentTopics: readonly string[];
}

export interface SessionConfig {
  templates: readonly QuestionTemplate[];
  seed: string;
  startedAt: number;
  subject?: string;
  level?: YearLevel;
  /**
   * History to start from. Left out — signed out, or a child's first sitting —
   * the session simply draws at random, which is what an empty profile means.
   */
  profile?: LearnerProfile;
  /** Topics from the end of the last sitting, so a session does not open on the one it closed on. */
  recentTopics?: readonly string[];
}

/**
 * Each draw gets its own RNG seeded from (seed, draw index) so state stays
 * serialisable. The seed alone no longer fixes the sequence — a replay needs the
 * profile the session started from as well, which is the price of questions that
 * respond to the child.
 */
function drawQuestion(
  templates: readonly QuestionTemplate[],
  seed: string,
  draw: number,
  context: SelectionContext,
): Question {
  const rng: Rng = createRng(`${seed}:${draw}`);
  return generateQuestion(selectTemplate(templates, context, rng), rng);
}

export function startSession(config: SessionConfig): SessionState {
  if (config.templates.length === 0) {
    throw new Error('Cannot start a session with no question templates');
  }

  const profile = config.profile ?? emptyProfile();
  const recentTopics = (config.recentTopics ?? []).slice(0, RECENT_MEMORY);

  const first = drawQuestion(config.templates, config.seed, 0, {
    profile,
    now: config.startedAt,
    recent: recentTopics,
  });

  return {
    subject: config.subject ?? first.subject,
    level: config.level ?? first.level,
    startedAt: config.startedAt,
    questionShownAt: config.startedAt,
    current: first,
    attempts: [],
    askedCount: 0,
    draw: 0,
    seed: config.seed,
    templates: config.templates,
    profile,
    recentTopics,
  };
}

export function submitAnswer(state: SessionState, response: string, now: number): SessionState {
  const { correct, response: normalised } = gradeAnswer(state.current, response);

  const attempt: Attempt = {
    templateId: state.current.templateId,
    subject: state.current.subject,
    topic: state.current.topic,
    level: state.current.level,
    prompt: state.current.prompt,
    expected: String(state.current.answer),
    response: normalised,
    correct,
    timeTakenMs: Math.max(0, now - state.questionShownAt),
    answeredAt: now,
  };

  const draw = state.draw + 1;
  // The answer counts towards what comes next: an Attempt is already everything
  // an observation is.
  const profile = applyObservation(state.profile, attempt);
  const recentTopics = [attempt.topic, ...state.recentTopics].slice(0, RECENT_MEMORY);

  return {
    ...state,
    current: drawQuestion(state.templates, state.seed, draw, { profile, now, recent: recentTopics }),
    draw,
    questionShownAt: now,
    attempts: [...state.attempts, attempt],
    askedCount: state.askedCount + 1,
    profile,
    recentTopics,
  };
}

export const elapsedMs = (state: SessionState, now: number): number =>
  Math.max(0, now - state.startedAt);

/** m:ss, counting up with no cap — sessions are open ended. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
