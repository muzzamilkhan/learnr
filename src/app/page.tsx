import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { listLevels, listSubjects } from '@/content/catalog';
import { SignInButton, SignOutButton } from '@/components/auth-buttons';
import { CodeSignIn } from '@/components/code-sign-in';
import { LevelPicker } from '@/components/level-picker';
import { ParentDashboard, type ChildRow } from '@/components/parent-dashboard';
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
 */
function CurriculumLink() {
  return (
    <p className="mt-12 text-lg text-(--color-ink-soft)">
      <Link href="/curriculum" className="text-(--color-brand) underline">
        Curriculum sources
      </Link>{' '}
      — what the questions are written against.
    </p>
  );
}

export default async function HomePage() {
  const session = isAuthConfigured ? await auth() : null;
  const subjects = listSubjects();
  const levels = listLevels();

  if (isAuthConfigured && !session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-10 px-8 text-center">
        <div className="space-y-3">
          <h1 className="text-6xl font-bold tracking-tight">Learnr</h1>
          <p className="text-2xl text-(--color-ink-soft)">Practice maths at your own pace.</p>
        </div>
        <SignInButton />
        {/* Two ways in, not one with a fallback: a grown-up signs in with Google, a
            child types the code they were given. */}
        <div className="flex w-full flex-col items-center gap-6">
          <span className="text-lg text-(--color-ink-soft)">or</span>
          <CodeSignIn />
        </div>
      </main>
    );
  }

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
          <h1 className="text-5xl font-bold tracking-tight">Welcome to Learnr</h1>
          <p className="mt-2 text-2xl text-(--color-ink-soft)">Who&rsquo;s using this account?</p>
        </header>
        <RoleChooser />
      </main>
    );
  }

  const childProfiles = isParent && userId ? await listChildren(userId) : [];
  const children: ChildRow[] | null =
    childProfiles === null
      ? null
      : childProfiles.map((child) => ({
          id: child.id,
          name: child.name,
          avatar: child.avatar,
          level: child.level,
          code: child.code,
          codeExpiresAt: child.codeExpiresAt?.toISOString() ?? null,
        }));

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
      <header className="mb-12 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}` : 'Learnr'}
          </h1>
          <p className="mt-2 text-2xl text-(--color-ink-soft)">
            {isParent ? 'Who are you setting up?' : 'What shall we practice?'}
          </p>
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

      {/* A parent doesn't play, so they get no level and no subjects at all. */}
      {isParent ? (
        children === null ? (
          <p className="text-xl text-(--color-ink-soft)">
            Couldn&rsquo;t load your children just now. Try again in a moment.
          </p>
        ) : (
          <ParentDashboard profiles={children} levels={levels} />
        )
      ) : !initialLevel ? (
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
