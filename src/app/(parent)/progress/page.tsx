import Link from 'next/link';
import { listSubjects } from '@/content/catalog';
import { ProgressReport } from '@/components/progress-report';
import { SpeedBanner } from '@/components/speed-banner';
import { resolveChild } from '@/lib/children';
import { compareSubjects } from '@/lib/curriculum';
import {
  readAnsweredQuestions,
  readObservations,
  readRecentAnswers,
  readSittings,
} from '@/lib/records';
import { readSpeedSummaries, readUnseenRecords } from '@/lib/speed-records';
import { SPEED_RUN_SUBJECT } from '@/lib/speedrun/modes';
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
  const { userId, viewable } = await readParent();

  // Scoped to this parent's children, never to the one `?child=` names, so it
  // shows regardless of which child's report is currently open - and never to
  // this parent's own runs, since `readUnseenRecords` only ever looks at rows
  // belonging to a child of theirs. A child shared with them is somebody else's
  // to be told about: the banner marks records seen as it shows them, and
  // spending that once-only announcement on the other family's parent is not
  // this screen's to do. Best-effort like the play path's own `readRecentAnswers`
  // fallback: a missed celebration costs nothing a parent would notice was
  // missing, unlike the report below it.
  const unseenRecords = await readUnseenRecords(userId);
  const banner = <SpeedBanner records={unseenRecords ?? []} />;

  if (viewable === null) {
    return (
      <>
        {banner}
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          Couldn&rsquo;t load your children just now. Try again in a moment.
        </p>
      </>
    );
  }

  // The child id arrives from the browser, so it is resolved against a list the
  // query already scoped - by `parentId` for their own children, by a grant for
  // one shared with them - rather than checked separately and then trusted.
  // There is no second place for the two to drift apart, which is what keeps a
  // typed id from reaching a child nobody shared.
  const child = resolveChild(viewable, childParam);
  if (child === null) {
    return (
      <>
        {banner}
        <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-6">
          <h2 className="text-lg font-semibold">Nobody to report on yet</h2>
          <p className="mt-1 max-w-prose text-sm text-(--color-ink-soft)">
            Add a profile, and their progress will show up here once they start practising. A child
            another parent shares with you turns up here too.
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

  // `listSubjects` sorts alphabetically, which puts English in front of maths
  // and so makes English the report's default. Maths is the subject a parent
  // opens this screen for - it is the one every child practises from
  // Kindergarten - so it leads here, and the first entry is what a bare
  // `/progress` resolves to. Ordering is this screen's, not the catalog's: the
  // landing page lists subjects to describe coverage, where alphabetical is
  // the honest order.
  const subjects = listSubjects()
    .map((summary) => summary.subject)
    .sort(compareSubjects);
  const subject = subjects.find((option) => option === subjectParam) ?? subjects[0] ?? 'maths';

  const now = requestNow();

  const [observations, sittings, answered, targetAnswers, speedRuns] = await Promise.all([
    readObservations(child.id, subject),
    readSittings(child.id, subject),
    readAnsweredQuestions(child.id, subject),
    readRecentAnswers(child.id, now - CALENDAR_WINDOW_MS),
    // The resolved child's own runs, not the parent's - so the well and the
    // heading above it can never disagree about who is on screen, and so the
    // numbers here survive a banner about this same child being dismissed.
    // Only asked for on the subject that shows them: every mode is arithmetic,
    // so an English report draws no speed run well and would be paying for a
    // query nothing renders.
    subject === SPEED_RUN_SUBJECT ? readSpeedSummaries(child.id) : Promise.resolve(null),
  ]);

  return (
    <>
      {banner}
      <ProgressReport
        child={{
          id: child.id,
          name: child.name,
          avatar: child.avatar,
          photo: child.photo,
          level: child.level,
        }}
        profiles={viewable.map(({ id, name, sharedBy }) => ({ id, name, sharedBy }))}
        subjects={subjects}
        subject={subject}
        observations={observations}
        sittings={sittings}
        answered={answered}
        targetAnswers={targetAnswers}
        target={child.target}
        speedRuns={speedRuns}
        now={now}
      />
    </>
  );
}
