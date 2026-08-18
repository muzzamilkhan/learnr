import Link from 'next/link';
import type { SubjectSummary } from '@/content/catalog';
import { yearLabel, type YearLevel } from '@/lib/curriculum';

/**
 * The subjects offering one year, each listing its topics. Shared by the two ways
 * a child arrives at a level: choosing it themselves with the picker, or being
 * given it by a parent on a managed profile. The cards are the same either way -
 * only the presence of the dropdown above them differs.
 *
 * A card is the biggest thing a child taps outside the play screen, so it is
 * drawn as one: a coloured tile they can aim at, the subject in the largest type
 * on the page, and its topics as chips rather than one long run-on line. The line
 * was the plainest thing here and the least readable - a dozen topics separated
 * by dots is a wall of grey a six-year-old skips, and it is the only thing on the
 * card actually saying what is inside.
 *
 * Colour comes from the logo's palette. It is per subject and stable, so the day
 * a second subject ships the two are told apart by colour before they are read.
 */

/**
 * Tile, chip and hover-border classes per subject, with a cycle for any subject
 * that has not been given one. Written out in full rather than composed, because
 * Tailwind only ships the class names it can see in the source.
 */
const ACCENTS = [
  {
    tile: 'bg-(--color-grape-soft) text-(--color-grape)',
    chip: 'bg-(--color-grape-soft) text-(--color-grape)',
    border: 'hover:border-(--color-grape)',
    arrow: 'text-(--color-grape)',
  },
  {
    tile: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    chip: 'bg-(--color-leaf-soft) text-(--color-leaf)',
    border: 'hover:border-(--color-leaf)',
    arrow: 'text-(--color-leaf)',
  },
  {
    tile: 'bg-(--color-berry-soft) text-(--color-berry)',
    chip: 'bg-(--color-berry-soft) text-(--color-berry)',
    border: 'hover:border-(--color-berry)',
    arrow: 'text-(--color-berry)',
  },
  {
    tile: 'bg-(--color-brand-soft) text-(--color-brand)',
    chip: 'bg-(--color-brand-soft) text-(--color-brand)',
    border: 'hover:border-(--color-brand)',
    arrow: 'text-(--color-brand)',
  },
] as const;

const SUBJECT_ACCENT: Record<string, number> = { maths: 0 };

function accentFor(subject: string, index: number) {
  return ACCENTS[SUBJECT_ACCENT[subject] ?? index % ACCENTS.length]!;
}

/**
 * The subject's picture. Maths gets its four signs; anything else gets its first
 * letter, which is at least stable and is never a wrong picture.
 */
function SubjectGlyph({ subject }: { subject: string }) {
  if (subject !== 'maths') {
    return <span className="text-3xl font-bold uppercase">{subject.slice(0, 1)}</span>;
  }
  return (
    <span className="grid grid-cols-2 gap-x-1 text-2xl leading-none font-bold">
      <span>+</span>
      <span>&minus;</span>
      <span>&times;</span>
      <span>&divide;</span>
    </span>
  );
}

/** How many topics fit on a card before the rest are counted rather than named. */
const MAX_CHIPS = 6;

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
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {offered.map((subject, index) => {
        const accent = accentFor(subject.subject, index);
        const shown = subject.topics.slice(0, MAX_CHIPS);
        const rest = subject.topics.length - shown.length;

        return (
          <li key={subject.subject}>
            <Link
              href={`/play?subject=${subject.subject}&level=${level}`}
              className={`no-select block rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-7 shadow-sm transition hover:shadow-md active:scale-[0.98] ${accent.border}`}
            >
              <span className="flex items-center gap-4">
                <span
                  aria-hidden
                  className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${accent.tile}`}
                >
                  <SubjectGlyph subject={subject.subject} />
                </span>
                <span className="min-w-0">
                  <span className="block text-3xl font-semibold capitalize">
                    {subject.subject}
                  </span>
                  <span className="mt-0.5 block text-base text-(--color-ink-soft)">
                    {yearLabel(level)}
                  </span>
                </span>
                <span aria-hidden className={`ml-auto text-3xl ${accent.arrow}`}>
                  &rarr;
                </span>
              </span>

              <span className="mt-5 flex flex-wrap gap-2">
                {shown.map((topic) => (
                  <span
                    key={topic}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${accent.chip}`}
                  >
                    {topic}
                  </span>
                ))}
                {rest > 0 ? (
                  <span className="rounded-full px-3 py-1 text-sm font-medium text-(--color-ink-soft)">
                    +{rest} more
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
