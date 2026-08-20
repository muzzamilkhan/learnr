import type { Observation } from '@/lib/analytics/profile';
import { latestOffsetMinutes, type AnsweredQuestion } from '@/lib/analytics/report';
import { parseYearLevel, shortYearLabel } from '@/lib/curriculum';
import type { Sitting } from '@/lib/records';
import type { DailyTarget, TargetAnswer } from '@/lib/rewards/target';
import type { SummaryRun } from '@/lib/speedrun/summary';
import { ProfileFace } from './profile-face';
import { ChildPicker, type PickableChild } from './child-picker';
import { ProgressTopics } from './progress-topics';
import { ProgressUsage } from './progress-usage';
import { SpeedTable } from './speed-table';
import { SubjectPicker } from './subject-picker';
import { Well } from './well';
import type { Avatar } from '@/lib/avatars';

interface ProgressChild {
  id: string;
  name: string;
  avatar: Avatar;
  /** The photograph their parent set, which stands in front of the avatar. */
  photo: string | null;
  level: string | null;
}

/**
 * The frame around both halves of the report, and the place that decides there
 * is nothing to report. A failed read and a child who has never played are
 * different things and must not look the same - one is our problem, the other
 * is just true.
 *
 * The page title and nav come from `ParentShell`; what belongs here is the one
 * toolbar that says which child and which subject is being read.
 */
export function ProgressReport({
  child,
  profiles,
  subjects,
  subject,
  observations,
  sittings,
  answered,
  targetAnswers,
  target,
  speedRuns,
  now,
}: {
  child: ProgressChild;
  /** Everyone this parent may read about - their own children and any shared with them. */
  profiles: PickableChild[];
  subjects: string[];
  subject: string;
  observations: Observation[] | null;
  sittings: Sitting[] | null;
  /**
   * The last few answers of each topic, for the "needs a hand" section to unfold.
   * A failed read is passed through as `null` rather than folded in with the two
   * above: the report is still worth reading without the examples.
   */
  answered: AnsweredQuestion[] | null;
  /**
   * The calendar's cross-subject read, and the goal it measures each day
   * against. `null` is a failed read, and the calendar falls back to plain
   * shading rather than drawing a month of days as having missed their goal.
   */
  targetAnswers: TargetAnswer[] | null;
  target: DailyTarget | null;
  /**
   * This child's own speed runs, cross-subject like the calendar - a speed run
   * has no curriculum topic to scope it by. Shown whether or not they have
   * answered a curriculum question yet, since a speed run touches no `Attempt`
   * and so does not depend on it either.
   */
  speedRuns: SummaryRun[] | null;
  now: number;
}) {
  const offsetMinutes = latestOffsetMinutes(observations ?? []);
  const level = parseYearLevel(child.level);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-(--color-line) bg-(--color-card) px-4 py-3">
        <ProfileFace
          photo={child.photo}
          avatar={child.avatar}
          name={child.name}
          className="size-9"
          px={36}
        />
        <p className="text-sm text-(--color-ink-soft)">
          {level ? shortYearLabel(level) : 'No level set'}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ChildPicker profiles={profiles} selected={child.id} subject={subject} />
          <SubjectPicker subjects={subjects} selected={subject} child={child.id} />
        </div>
      </div>

      {observations === null || sittings === null ? (
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          Couldn&rsquo;t load progress just now. Try again in a moment.
        </p>
      ) : observations.length === 0 ? (
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          {child.name} hasn&rsquo;t answered any {subject} questions yet. Once they have, this is
          where you&rsquo;ll see how it&rsquo;s going.
        </p>
      ) : (
        <div className="space-y-4">
          <ProgressUsage
            observations={observations}
            targetAnswers={targetAnswers}
            target={target}
            now={now}
            offsetMinutes={offsetMinutes}
          />
          <ProgressTopics
            observations={observations}
            sittings={sittings}
            answered={answered}
            subject={subject}
            level={level}
            now={now}
            offsetMinutes={offsetMinutes}
          />
        </div>
      )}

      {/* Outside the block above rather than inside it: a speed run writes no
          `Attempt`, so it has bests to show even for a child who has never
          answered a curriculum question, and the well would otherwise be
          hidden behind a message that is only true of the report above it. */}
      <div className="mt-4">
        <Well
          title="Speed runs"
          note={`How ${child.name} is going at each mode, last played first.`}
        >
          <SpeedTable runs={speedRuns} />
        </Well>
      </div>
    </>
  );
}
