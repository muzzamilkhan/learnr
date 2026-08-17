import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listSubjects } from '@/content/catalog';
import { SignOutButton } from '@/components/auth-buttons';
import { ParentShell } from '@/components/parent-shell';
import { ProfileMenu } from '@/components/profile-menu';
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

  // A parent doesn't play, so there is no run of days and no stars to show.
  const menu = (
    <ProfileMenu
      name={session?.user?.name ?? null}
      image={session?.user?.image ?? null}
      streak={null}
      stars={null}
    >
      <SignOutButton />
    </ProfileMenu>
  );

  const profiles = await listChildren(userId);
  if (profiles === null) {
    return (
      <ParentShell title="Progress" current="progress" menu={menu}>
        <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
          Couldn&rsquo;t load your children just now. Try again in a moment.
        </p>
      </ParentShell>
    );
  }
  if (profiles.length === 0) {
    return (
      <ParentShell title="Progress" current="progress" menu={menu}>
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
      </ParentShell>
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
    <ParentShell title={`${child.name}'s progress`} current="progress" menu={menu}>
      <ProgressReport
        child={{ id: child.id, name: child.name, avatar: child.avatar, level: child.level }}
        profiles={profiles.map(({ id, name }) => ({ id, name }))}
        subjects={subjects}
        subject={subject}
        observations={observations}
        sittings={sittings}
        now={now}
      />
    </ParentShell>
  );
}
