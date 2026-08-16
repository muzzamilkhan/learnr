import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { templatesFor } from '@/content/catalog';
import { PlaySession } from '@/components/play-session';
import { newSession } from '@/lib/session/seed';

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string }>;
}) {
  const { subject = 'maths', level: levelParam = '1' } = await searchParams;
  const level = Number(levelParam);
  const templates = Number.isFinite(level) ? templatesFor(subject, level) : [];

  if (templates.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="text-4xl font-semibold">Nothing to practice here yet</h1>
        <p className="text-xl text-(--color-ink-soft)">
          There are no questions for {subject} level {levelParam}.
        </p>
        <Link
          href="/"
          className="rounded-2xl bg-(--color-brand) px-8 py-4 text-xl font-semibold text-white"
        >
          Go back
        </Link>
      </main>
    );
  }

  const session = isAuthConfigured ? await auth() : null;

  // Seeded here rather than in the client so the first question is server
  // rendered and the child never sees an empty screen. The seed is deterministic
  // input to the engine, so server and client render the same question.
  const { seed, startedAt } = newSession();

  return (
    <PlaySession
      subject={subject}
      level={level}
      templates={templates}
      seed={seed}
      startedAt={startedAt}
      recordingEnabled={Boolean(session?.user?.id)}
    />
  );
}
