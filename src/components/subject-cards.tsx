import Link from 'next/link';
import type { SubjectSummary } from '@/content/catalog';
import { yearLabel, type YearLevel } from '@/lib/curriculum';

/**
 * The subjects offering one year, each listing its topics. Shared by the two ways
 * a child arrives at a level: choosing it themselves with the picker, or being
 * given it by a parent on a managed profile. The cards are the same either way —
 * only the presence of the dropdown above them differs.
 */
export function SubjectCards({
  subjects,
  level,
}: {
  subjects: SubjectSummary[];
  level: YearLevel;
}) {
  const offered = subjects
    .map((subject) => ({
      subject: subject.subject,
      topics: subject.levels.find((l) => l.level === level)?.topics ?? [],
    }))
    .filter((subject) => subject.topics.length > 0);

  if (offered.length === 0) {
    return (
      <p className="text-xl text-(--color-ink-soft)">
        Nothing to practice in {yearLabel(level)} yet.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {offered.map((subject) => (
        <li key={subject.subject}>
          <Link
            href={`/play?subject=${subject.subject}&level=${level}`}
            className="no-select block rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-7 transition active:scale-[0.98] hover:border-(--color-brand)"
          >
            <span className="block text-3xl font-semibold capitalize">{subject.subject}</span>
            <span className="mt-2 block text-lg text-(--color-ink-soft)">
              {subject.topics.join(' · ')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
