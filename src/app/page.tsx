import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { listSubjects } from '@/content/catalog';
import { SignInButton, SignOutButton } from '@/components/auth-buttons';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Counting',
  2: 'Adding',
  3: 'Taking away',
  4: 'Mixing it up',
  5: 'Times tables',
  6: 'Sharing out',
};

export default async function HomePage() {
  const session = isAuthConfigured ? await auth() : null;
  const subjects = listSubjects();

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

      {subjects.map((subject) => (
        <section key={subject.subject} className="mb-12">
          <h2 className="mb-5 text-3xl font-semibold capitalize">{subject.subject}</h2>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {subject.levels.map((level) => (
              <li key={level.level}>
                <Link
                  href={`/play?subject=${subject.subject}&level=${level.level}`}
                  className="no-select block rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-7 transition active:scale-[0.98] hover:border-(--color-brand)"
                >
                  <span className="text-sm font-semibold tracking-widest text-(--color-ink-soft) uppercase">
                    Level {level.level}
                  </span>
                  <span className="mt-1 block text-3xl font-semibold">
                    {LEVEL_NAMES[level.level] ?? level.categories.join(', ')}
                  </span>
                  <span className="mt-2 block text-lg text-(--color-ink-soft) capitalize">
                    {level.categories.join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!isAuthConfigured ? (
        <p className="rounded-2xl bg-(--color-brand-soft) px-5 py-4 text-base text-(--color-ink-soft)">
          Sign-in is not configured yet, so nothing is being saved. Add the Google OAuth
          variables from <code>.env.example</code> to enable accounts and recording.
        </p>
      ) : null}
    </main>
  );
}
