import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listLevels, listSubjects } from '@/content/catalog';
import { SignOutButton } from '@/components/auth-buttons';
import { Landing } from '@/components/landing';
import { LevelPicker } from '@/components/level-picker';
import { ParentShell } from '@/components/parent-shell';
import { ProfileMenu } from '@/components/profile-menu';
import { RoleChooser } from '@/components/role-chooser';
import { SubjectCards } from '@/components/subject-cards';
import { listChildren, readAccount } from '@/lib/accounts';
import { readPlayStreak, readSelectedLevel, readStarTotal } from '@/lib/records';
import { resolveInitialLevel } from '@/lib/curriculum';

// The screen is per-child: it opens on the level that child last chose, so it
// must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * What the questions are written against. Shown to a child as reassurance and to a
 * parent as the thing they'd actually want to check, so it sits under every
 * signed-in branch rather than only under the play cards.
 *
 * Boxed for the same reason the parent shell boxes it: a line of small print
 * under a page of cards is the shape of something nobody is meant to click. Sized
 * to the child's scale rather than reusing `Well`, which is built for a parent
 * reading a report on a laptop.
 */
function CurriculumLink() {
  return (
    <Link
      href="/curriculum"
      className="no-select mt-12 flex items-center gap-4 rounded-2xl border-2 border-(--color-line) bg-(--color-card) p-5 transition hover:border-(--color-brand) active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block text-xl font-semibold">Curriculum sources</span>
        <span className="mt-1 block text-base text-(--color-ink-soft)">
          What the questions are written against — the Australian Curriculum, year by year.
        </span>
      </span>
      <span aria-hidden className="ml-auto text-2xl text-(--color-brand)">
        &rarr;
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const session = isAuthConfigured ? await auth() : null;
  const subjects = listSubjects();
  const levels = listLevels();

  // Signed out, this is the app's public face: what it is, what it covers, and
  // the two ways in. See `Landing`.
  if (isAuthConfigured && !session?.user) return <Landing />;

  const userId = session?.user?.id;
  const account = userId ? await readAccount(userId) : null;
  const isParent = account?.role === 'parent';

  // A parent doesn't play, so there is no level to reopen on, no run of days and
  // no stars — reading them would only put numbers on their screen that are
  // counting nothing.
  const [stored, streak, stars] = userId && !isParent
    ? await Promise.all([readSelectedLevel(userId), readPlayStreak(userId), readStarTotal(userId)])
    : [null, null, null];

  const initialLevel = resolveInitialLevel(stored, levels);
  const isManagedChild = account?.role === 'child' && account.parentId !== null;

  // Signed in but hasn't said what kind of account this is. Asked once, kept
  // forever — including for every account that predates the choice existing.
  if (account && account.role === null) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
        <header className="mb-12">
          <h1 className="text-5xl font-bold tracking-tight">Welcome to LearnR</h1>
          <p className="mt-2 text-2xl text-(--color-ink-soft)">Who&rsquo;s using this account?</p>
        </header>
        <RoleChooser />
      </main>
    );
  }

  // A parent opens this app to see how their children are going, so that is what
  // their home screen is. The report lives at `/progress` and is not rebuilt here
  // — with children to report on, this screen's whole job is to get out of the
  // way. Setting the profiles up is the other screen, and only the parent with no
  // children yet is sent there.
  if (isParent && userId) {
    const profiles = await listChildren(userId);
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

    // A failed read is not "no children", so it is not redirected anywhere — it
    // says what went wrong and leaves the parent where they are.
    if (profiles === null) {
      return (
        <ParentShell title="LearnR" current="progress" menu={menu}>
          <p className="rounded-xl border border-(--color-line) bg-(--color-card) p-4 text-sm text-(--color-ink-soft)">
            Couldn&rsquo;t load your children just now. Try again in a moment.
          </p>
        </ParentShell>
      );
    }
    if (profiles.length > 0) redirect('/progress');

    return (
      <ParentShell
        title={session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}` : 'LearnR'}
        subtitle="Nothing to report on yet."
        current="progress"
        menu={menu}
      >
        <div className="rounded-xl border border-(--color-line) bg-(--color-card) p-6">
          <h2 className="text-lg font-semibold">Add your first child</h2>
          <p className="mt-1 max-w-prose text-sm text-(--color-ink-soft)">
            Give them a name and a level, and they sign in with a code rather than an account of
            their own. Once they start practising, this screen becomes their progress.
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

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
      <header className="mb-12 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}` : 'LearnR'}
          </h1>
          <p className="mt-2 text-2xl text-(--color-ink-soft)">What shall we practice?</p>
        </div>
        {session?.user ? (
          <ProfileMenu
            name={session.user.name ?? null}
            image={session.user.image ?? null}
            streak={streak}
            stars={stars}
          >
            <SignOutButton />
          </ProfileMenu>
        ) : null}
      </header>

      {/* Only a child reaches this far — a parent was routed away above. */}
      {!initialLevel ? (
        <p className="text-xl text-(--color-ink-soft)">There is no content to practice yet.</p>
      ) : isManagedChild ? (
        // The parent set this year, so it is shown rather than chosen: subjects
        // for their level, and no dropdown to wander out of it.
        <SubjectCards subjects={subjects} level={initialLevel} />
      ) : (
        <LevelPicker subjects={subjects} levels={levels} initialLevel={initialLevel} />
      )}

      <CurriculumLink />

      {!isAuthConfigured ? (
        <p className="mt-12 rounded-2xl bg-(--color-brand-soft) px-5 py-4 text-base text-(--color-ink-soft)">
          Sign-in is not configured yet, so nothing is being saved. Add the Google OAuth
          variables from <code>.env.example</code> to enable accounts and recording.
        </p>
      ) : null}
    </main>
  );
}
