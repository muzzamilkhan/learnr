import { EXAMPLE_ANSWERS, type AnsweredQuestion } from '@/lib/analytics/report';
import type { Observation } from '@/lib/analytics/profile';
import type { TargetAnswer } from '@/lib/rewards/target';
import type { SummaryRun } from '@/lib/speedrun/summary';
import { readViewableChildren } from './sharing';
import {
  readAnsweredQuestions,
  readObservations,
  readRecentAnswers,
  readSittings,
  type Sitting,
} from './records';
import { readSpeedSummaries } from './speed-records';

/**
 * The whole of a child's history, in one read, for the parent's report screen.
 *
 * This is composition rather than a query: five reads and the ownership check
 * in front of them. It used to be a route handler - `GET /children/:id/record`,
 * whose reason for existing was that five round trips to Fly is five round trips
 * a parent waits through - and the reads are still parallel here for the reason
 * they were parallel there. In process they are cheaper; they are still five
 * round trips to Neon, and asked one at a time they are a waterfall.
 *
 * **Raw, rather than the report it could compute.** Every chart on that screen
 * folds the observations itself - the bars, the calendar, the tiles - and
 * `/progress/lab` exists precisely to try foldings that are not on the report
 * yet. Serving conclusions would leave both with nothing to work from.
 */

/**
 * How far back the calendar's read reaches: four Monday-to-Sunday weeks and a
 * margin, which is the widest window any caller has a use for.
 *
 * **A default, and no longer a cap.** It used to be both, because the window
 * arrived off a URL and the number of rows one request read had to be bounded
 * by something. Both callers are in this repository now and both pass a
 * literal, so the zod bounds went with the route rather than being restated
 * here against a caller that cannot be wrong. A caller that wanted more would
 * get it; the guard to reinstate if one ever arrives from outside is the clamp,
 * not this constant.
 */
export const CALENDAR_WINDOW_MS = 29 * 24 * 60 * 60 * 1000;

/**
 * A child's raw history, as the parent's report folds it for itself.
 *
 * **Null is not empty, and which of these may be null differs.** A failed
 * observations or sittings read is the whole screen's failure, so the whole
 * answer is null - drawing a database hiccup as "your child has never
 * practised" is the lie the null convention exists to prevent. The other three
 * are passed through as null: the report is still worth reading without its
 * examples, and the calendar falls back to plain shading rather than four weeks
 * of missed goals.
 */
export interface ChildRecordRead {
  observations: Observation[];
  sittings: Sitting[];
  /** Null is a failed read - the report is still worth showing without examples. */
  answers: AnsweredQuestion[] | null;
  /** Null is a failed read - the calendar drops the goal rather than drawing misses. */
  recentAnswers: TargetAnswer[] | null;
  /** Null when they were not asked for, and when the read failed. */
  speedRuns: SummaryRun[] | null;
}

export interface ChildRecordOptions {
  subject: string;
  /**
   * Answers *per topic*, not a row cap - the report unfolds `EXAMPLE_ANSWERS` of
   * each and the lab asks for fifty, because a pattern across a child's answers
   * cannot show in three. Bounded by nothing but its two callers, for the reason
   * `CALENDAR_WINDOW_MS` gives.
   */
  perTopic?: number;
  /** A duration, not an instant: this side keeps the clock. */
  windowMs?: number;
  /**
   * A speed run has no curriculum topic, so only the subject that draws them
   * asks for them - an English report would be paying for a query nothing
   * renders.
   */
  speedRuns?: boolean;
}

/**
 * **`readViewableChildren` is the authorization, and it is the only one.** Every
 * parent screen resolves `?child=` against that same list - own children first,
 * then shared - so a child not in it is not reachable by typing its id. There is
 * no separate ownership check here to drift out of step with it, and there must
 * not be one.
 *
 * Null covers both "no such child" and "the read broke", which is what the
 * screen already drew for either: it says it could not load rather than telling
 * a parent their child has never practised.
 */
export async function readChildRecord(
  parentId: string,
  childId: string,
  options: ChildRecordOptions,
): Promise<ChildRecordRead | null> {
  const viewable = await readViewableChildren(parentId);
  if (!viewable?.some((child) => child.id === childId)) return null;

  const {
    subject,
    perTopic = EXAMPLE_ANSWERS,
    windowMs = CALENDAR_WINDOW_MS,
    speedRuns = false,
  } = options;

  const [observations, sittings, answers, recentAnswers, runs] = await Promise.all([
    readObservations(childId, subject),
    readSittings(childId, subject),
    readAnsweredQuestions(childId, subject, perTopic),
    // Cross-subject, both of them: the calendar measures the child's whole day
    // against their goal, and a speed run has no subject to be scoped by.
    readRecentAnswers(childId, Date.now() - windowMs),
    speedRuns ? readSpeedSummaries(childId) : Promise.resolve(null),
  ]);

  if (observations === null || sittings === null) return null;

  return { observations, sittings, answers, recentAnswers, speedRuns: runs };
}
