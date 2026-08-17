import Link from 'next/link';
import type { Observation } from '@/lib/analytics/profile';
import { latestOffsetMinutes } from '@/lib/analytics/report';
import { parseYearLevel, yearLabel } from '@/lib/curriculum';
import type { Sitting } from '@/lib/records';
import { AvatarIcon } from './avatar-icon';
import { ChildPicker } from './child-picker';
import { ProgressTopics } from './progress-topics';
import { ProgressUsage } from './progress-usage';
import type { Avatar } from '@/lib/avatars';

interface ProgressChild {
  id: string;
  name: string;
  avatar: Avatar;
  level: string | null;
}

/**
 * The frame around both halves of the report, and the place that decides there
 * is nothing to report. A failed read and a child who has never played are
 * different things and must not look the same — one is our problem, the other
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
  now,
}: {
  child: ProgressChild;
  profiles: { id: string; name: string }[];
  subjects: string[];
  subject: string;
  observations: Observation[] | null;
  sittings: Sitting[] | null;
  now: number;
}) {
  const offsetMinutes = latestOffsetMinutes(observations ?? []);
  const level = parseYearLevel(child.level);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-(--color-line) bg-(--color-card) px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-brand-soft) text-(--color-brand)">
          <AvatarIcon avatar={child.avatar} className="h-6 w-6" />
        </span>
        <p className="text-sm text-(--color-ink-soft)">
          {level ? yearLabel(level) : 'No level set'}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ChildPicker profiles={profiles} selected={child.id} subject={subject} />
          {/* One subject needs no choosing; a second one turns this into tabs. */}
          {subjects.length > 1 ? (
            <nav className="flex gap-1">
              {subjects.map((option) => (
                <Link
                  key={option}
                  href={`/progress?child=${child.id}&subject=${option}`}
                  className={`no-select rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
                    option === subject
                      ? 'bg-(--color-brand) text-white'
                      : 'border border-(--color-line) hover:border-(--color-brand)'
                  }`}
                >
                  {option}
                </Link>
              ))}
            </nav>
          ) : (
            <span className="text-sm font-semibold capitalize text-(--color-ink-soft)">
              {subject}
            </span>
          )}
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
        <div className="space-y-8">
          <ProgressUsage observations={observations} now={now} offsetMinutes={offsetMinutes} />
          <ProgressTopics
            observations={observations}
            sittings={sittings}
            subject={subject}
            level={level}
            now={now}
            offsetMinutes={offsetMinutes}
          />
        </div>
      )}
    </>
  );
}
