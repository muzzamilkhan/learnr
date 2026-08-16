import { auth, isAuthConfigured } from '@/auth';
import { listLevels, listSubjects } from '@/content/catalog';
import { SignInButton, SignOutButton } from '@/components/auth-buttons';
import { LevelPicker } from '@/components/level-picker';
import { readSelectedLevel } from '@/lib/records';
import { resolveInitialLevel } from '@/lib/curriculum';

// The screen is per-child: it opens on the level that child last chose, so it
// must never be prerendered and shared.
export const dynamic = 'force-dynamic';

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
      </main>
    );
  }

  // Signed out or without a database there is nowhere to remember the choice, so
  // the picker simply opens on Kindergarten.
  const stored = session?.user?.id ? await readSelectedLevel(session.user.id) : null;
  const initialLevel = resolveInitialLevel(stored, levels);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
      <header className="mb-12 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">
            {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}` : 'Learnr'}
          </h1>
          <p className="mt-2 text-2xl text-(--color-ink-soft)">What shall we practice?</p>
        </div>
        {session?.user ? <SignOutButton /> : null}
      </header>

      {initialLevel ? (
        <LevelPicker subjects={subjects} levels={levels} initialLevel={initialLevel} />
      ) : (
        <p className="text-xl text-(--color-ink-soft)">There is no content to practice yet.</p>
      )}

      {!isAuthConfigured ? (
        <p className="mt-12 rounded-2xl bg-(--color-brand-soft) px-5 py-4 text-base text-(--color-ink-soft)">
          Sign-in is not configured yet, so nothing is being saved. Add the Google OAuth
          variables from <code>.env.example</code> to enable accounts and recording.
        </p>
      ) : null}
    </main>
  );
}
