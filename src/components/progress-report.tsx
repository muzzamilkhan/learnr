import Link from 'next/link';
import type { Observation } from '@/lib/analytics/profile';
import { latestOffsetMinutes } from '@/lib/analytics/report';
import { parseYearLevel } from '@/lib/curriculum';
import type { Sitting } from '@/lib/records';
import { AvatarIcon } from './avatar-icon';
import { ChildPicker } from './child-picker';
import { ProgressTopics } from './progress-topics';
import { ProgressUsage } from './progress-usage';
import type { Avatar } from '@/lib/avatars';

export interface ProgressChild {
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
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--color-brand-soft) text-(--color-brand)">
            <AvatarIcon avatar={child.avatar} className="h-10 w-10" />
          </span>
          <h1 className="text-4xl font-bold tracking-tight">{child.name}&rsquo;s progress</h1>
        </div>
        <div className="flex items-center gap-4">
          <ChildPicker profiles={profiles} selected={child.id} subject={subject} />
          <Link href="/" className="text-lg text-(--color-brand) underline">
            Dashboard
          </Link>
        </div>
      </header>

      {/* One subject reads as a heading; a second one turns the row into tabs. */}
      {subjects.length > 1 ? (
        <nav className="mb-8 flex gap-2">
          {subjects.map((option) => (
            <Link
              key={option}
              href={`/progress?child=${child.id}&subject=${option}`}
              className={`no-select rounded-2xl px-5 py-3 text-xl font-semibold capitalize transition ${
                option === subject
                  ? 'bg-(--color-brand) text-white'
                  : 'border-2 border-(--color-line) hover:border-(--color-brand)'
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mb-8 text-2xl font-semibold capitalize text-(--color-ink-soft)">{subject}</p>
      )}

      {observations === null || sittings === null ? (
        <p className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6 text-xl text-(--color-ink-soft)">
          Couldn&rsquo;t load progress just now. Try again in a moment.
        </p>
      ) : observations.length === 0 ? (
        <p className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6 text-xl text-(--color-ink-soft)">
          {child.name} hasn&rsquo;t answered any {subject} questions yet. Once they have, this is
          where you&rsquo;ll see how it&rsquo;s going.
        </p>
      ) : (
        <div className="space-y-12">
          <ProgressUsage observations={observations} now={now} offsetMinutes={offsetMinutes} />
          <ProgressTopics
            observations={observations}
            sittings={sittings}
            subject={subject}
            level={level}
            now={now}
          />
        </div>
      )}
    </>
  );
}
