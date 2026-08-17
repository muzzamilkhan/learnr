import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listSubjects } from '@/content/catalog';
import { ProgressReport } from '@/components/progress-report';
import { listChildren, readAccount } from '@/lib/accounts';
import { readObservations, readSittings } from '@/lib/records';
import { requestNow } from './now';

// Per-parent and per-child, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; subject?: string }>;
}) {
  const { child: childParam, subject: subjectParam } = await searchParams;

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  if (!userId) redirect('/');

  // A child must not reach this screen, and neither must an account that has
  // not said what kind it is yet.
  const account = await readAccount(userId);
  if (account?.role !== 'parent') redirect('/');

  const profiles = await listChildren(userId);
  if (profiles.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
        <h1 className="text-4xl font-bold tracking-tight">No children yet</h1>
        <p className="mt-3 text-xl text-(--color-ink-soft)">
          Add a profile on the dashboard, and their progress will show up here once they start
          practising.
        </p>
        <Link href="/" className="mt-6 inline-block text-lg text-(--color-brand) underline">
          Back to the dashboard
        </Link>
      </main>
    );
  }

  // The child id arrives from the browser, so it is resolved against a list
  // already scoped by parentId rather than checked separately and then trusted.
  // There is no second place for the two to drift apart.
  const child = profiles.find((candidate) => candidate.id === childParam) ?? profiles[0];

  const subjects = listSubjects().map((summary) => summary.subject);
  const subject = subjects.find((option) => option === subjectParam) ?? subjects[0] ?? 'maths';

  const [observations, sittings] = await Promise.all([
    readObservations(child.id, subject),
    readSittings(child.id, subject),
  ]);

  const now = requestNow();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
      <ProgressReport
        child={{ id: child.id, name: child.name, avatar: child.avatar, level: child.level }}
        profiles={profiles.map(({ id, name }) => ({ id, name }))}
        subjects={subjects}
        subject={subject}
        observations={observations}
        sittings={sittings}
        now={now}
      />
    </main>
  );
}
