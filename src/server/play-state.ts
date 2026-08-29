import type { LearnerProfile } from '@/lib/analytics/profile';
import type { YearLevel } from '@/lib/curriculum';
import type { DailyTarget, TargetAnswer } from '@/lib/rewards/target';
import {
  TARGET_WINDOW_MS,
  readLearnerProfile,
  readPlayerState,
  readRecentAnswers,
  readRecentTopics,
  type PlayerState,
} from './records';

/**
 * What the playing screens need before they can draw anything.
 *
 * Two shapes, because two screens want different halves of the same row. The
 * home screen is where a child *picks* a subject and a year, so it has neither
 * to ask about and pays for no learner profile; the play screen has both and
 * needs the profile that weights its first question.
 *
 * These were route handlers - `GET /me/player` and `GET /play/state` - and the
 * reads inside them are still parallel here for the reason they were parallel
 * there: asked a function at a time they are a waterfall in front of the first
 * question a child sees. In process they are cheaper, but they are still round
 * trips to Neon.
 *
 * **Best-effort throughout, as the whole play path is.** Nothing here returns
 * null: a failed read costs a weighted first question or an empty progress bar,
 * never the question itself. That is the deliberate exception to the null
 * convention the parent's screens keep - an unweighted question beats no
 * question, and the child never learns there was an outage.
 */

/** The four numbers off a child's own row, and the window the goal bar folds. */
export interface PlayerRead {
  player: PlayerState;
  targetAnswers: TargetAnswer[];
}

/** Everything the play screen needs before it can render its first question. */
export interface PlayState extends PlayerRead {
  profile: LearnerProfile;
  recentTopics: string[];
}

/**
 * The window of answers the goal bar folds, read only for a child who has a
 * goal to measure them against.
 *
 * This side keeps the clock and the device keeps the calendar: which of these
 * answers is "today" is decided where the child is, because this side has no
 * timezone. A failed read costs an empty bar and never the screen, so it falls
 * back to nothing rather than propagating null.
 */
async function targetAnswersFor(
  userId: string,
  target: DailyTarget | null,
): Promise<TargetAnswer[]> {
  if (!target) return [];
  return (await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS)) ?? [];
}

/**
 * The home screen's read: `readPlayState` without the two reads that need a
 * course.
 *
 * Named apart from `readPlayerState` in `records.ts`, which is the four columns
 * off the row alone. This is that plus the goal window that goes with them - the
 * pairing the screen actually wants, and the conditional that keeps a child with
 * no goal from paying for a window nobody folds.
 */
export async function readPlayer(userId: string): Promise<PlayerRead> {
  const player = await readPlayerState(userId);
  return { player, targetAnswers: await targetAnswersFor(userId, player.target) };
}

/**
 * **`level` is optional, and the reason is the redirect.** A managed child's
 * year is their parent's decision, enforced against the one in the URL - so the
 * screen has to read `player.selectedLevel` *before* it knows whether the URL's
 * year is allowed, and the URL's year may be nonsense. Refusing a level that is
 * not a school year would refuse the very read that would have sent the child to
 * their own. Without one there is no course to draw recent topics from, so that
 * half comes back empty and the rest is unchanged.
 */
export async function readPlayState(
  userId: string,
  subject: string,
  level: YearLevel | null,
  recentTopics: number,
): Promise<PlayState> {
  const [profile, topics, player] = await Promise.all([
    readLearnerProfile(userId, subject),
    level ? readRecentTopics(userId, subject, level, recentTopics) : Promise.resolve([]),
    readPlayerState(userId),
  ]);

  // The one read that has to wait for another: there is no point fetching a
  // window of answers for a child with no goal to measure them against.
  const targetAnswers = await targetAnswersFor(userId, player.target);

  return { player, profile, recentTopics: topics, targetAnswers };
}
