import Link from 'next/link';
import { listSubjects } from '@/content/catalog';
import { ChildPicker } from '@/components/child-picker';
import { ProgressLab } from '@/components/progress-lab';
import { resolveChild } from '@/lib/children';
import { readAnsweredQuestions, readObservations } from '@/lib/records';
import { readParent } from '../../parent';

// Per-parent and per-child, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * How many answers per topic the classifier is given.
 *
 * The report's own read takes `EXAMPLE_ANSWERS` (3) because it is showing a
 * parent the last few questions of a topic going badly. This one is looking for
 * a *pattern across* a child's answers, and three per topic cannot show one -
 * the whole finding is that the same mistake recurs. The window function
 * `readAnsweredQuestions` already runs takes the limit as an argument, so this
 * costs a bigger number and no new query.
 */
const LAB_ANSWERS_PER_TOPIC = 50;

/**
 * A bench for analytics that are not on the report yet - reachable by typing
 * the URL and linked from nowhere, so no parent meets a finding still being
 * judged.
 *
 * It nests under `/progress` rather than sitting beside it as its own top-level
 * path, for the reason the report itself does: a route group adds no path
 * segment, so a bare `/progress-lab` would be one hyphen from the real report
 * and told apart only by spelling. Depth cannot be muddled that way.
 */
export default async function ProgressLabPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; subject?: string }>;
}) {
  const { child: childParam, subject: subjectParam } = await searchParams;
  const { viewable } = await readParent();

  if (viewable === null) {
    return <Note>Couldn&rsquo;t load your children just now. Try again in a moment.</Note>;
  }

  // Resolved against the list the query already scoped, never checked separately
  // and then trusted - the same rule the report itself follows.
  const child = resolveChild(viewable, childParam);
  if (child === null) {
    return (
      <Note>
        Nobody to look at yet. <Link href="/children">Add a child</Link> and come back once they
        have answered a few questions.
      </Note>
    );
  }

  const subjects = listSubjects().map((summary) => summary.subject);
  const subject = subjects.find((option) => option === subjectParam) ?? subjects[0] ?? 'maths';

  const [observations, answered] = await Promise.all([
    readObservations(child.id, subject),
    readAnsweredQuestions(child.id, subject, LAB_ANSWERS_PER_TOPIC),
  ]);

  // `null` is a failed read and `[]` is a child who has not played - the same
  // distinction the report makes, and it matters more here: every section below
  // would otherwise render a database hiccup as "no mistakes found".
  if (observations === null || answered === null) {
    return <Note>Couldn&rsquo;t read {child.name}&rsquo;s history just now.</Note>;
  }

  return (
    <div className="space-y-4">
      <ChildPicker
        profiles={viewable.map(({ id, name, sharedBy }) => ({ id, name, sharedBy }))}
        selected={child.id}
        subject={subject}
      />
      <ProgressLab observations={observations} answered={answered} childName={child.name} />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
      {children}
    </p>
  );
}
