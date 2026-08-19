import Link from 'next/link';
import { listSubjects } from '@/content/catalog';
import { ProgressReport } from '@/components/progress-report';
import { SpeedBanner } from '@/components/speed-banner';
import { resolveChild } from '@/lib/children';
import {
  readAnsweredQuestions,
  readObservations,
  readRecentAnswers,
  readSittings,
} from '@/lib/records';
import { readSpeedRecords, readUnseenRecords } from '@/lib/speed-records';
import { readParent } from '../parent';
import { requestNow } from '@/app/now';

// Per-parent and per-child, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * Four weeks and a margin, across every subject: the calendar measures the
 * child's whole day against their goal, while everything else on this screen is
 * scoped to the subject being looked at.
 */
const CALENDAR_WINDOW_MS = 29 * 24 * 60 * 60 * 1000;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; subject?: string }>;
}) {
  const { child: childParam, subject: subjectParam } = await searchParams;
  const { userId, profiles } = await readParent();

  // Scoped to this parent's children, never to the one `?child=` names, so it
  // shows regardless of which child's report is currently open - and never to
  // this parent's own runs, since `readUnseenRecords` only ever looks at rows
  // belonging to a child of theirs. Best-effort like the play path's own
  // `readRecentAnswers` fallback: a missed celebration costs nothing a parent
  // would notice was missing, unlike the report below it.
  const unseenRecords = await readUnseenRecords(userId);
  const banner = <SpeedBanner records={unseenRecords ?? []} />;

  if (profiles === null) {
    return (
      <>
        {banner}
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          Couldn&rsquo;t load your children just now. Try again in a moment.
        </p>
      </>
    );
  }

  // The child id arrives from the browser, so it is resolved against a list
  // already scoped by parentId rather than checked separately and then trusted.
  // There is no second place for the two to drift apart.
  const child = resolveChild(profiles, childParam);
  if (child === null) {
    return (
      <>
        {banner}
        <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-6">
          <h2 className="text-lg font-semibold">No children yet</h2>
          <p className="mt-1 max-w-prose text-sm text-(--color-ink-soft)">
            Add a profile, and their progress will show up here once they start practising.
          </p>
          <Link
            href="/children"
            className="no-select mt-4 inline-block rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Add a child
          </Link>
        </div>
      </>
    );
  }

  const subjects = listSubjects().map((summary) => summary.subject);
  const subject = subjects.find((option) => option === subjectParam) ?? subjects[0] ?? 'maths';

  const now = requestNow();

  const [observations, sittings, answered, targetAnswers, speedBests] = await Promise.all([
    readObservations(child.id, subject),
    readSittings(child.id, subject),
    readAnsweredQuestions(child.id, subject),
    readRecentAnswers(child.id, now - CALENDAR_WINDOW_MS),
    // The resolved child's own bests, not the parent's - so the well and the
    // heading above it can never disagree about who is on screen, and so the
    // numbers here survive a banner about this same child being dismissed.
    readSpeedRecords(child.id),
  ]);

  return (
    <>
      {banner}
      <ProgressReport
        child={{ id: child.id, name: child.name, avatar: child.avatar, level: child.level }}
        profiles={profiles.map(({ id, name }) => ({ id, name }))}
        subjects={subjects}
        subject={subject}
        observations={observations}
        sittings={sittings}
        answered={answered}
        targetAnswers={targetAnswers}
        target={child.target}
        speedBests={speedBests}
        now={now}
      />
    </>
  );
}
