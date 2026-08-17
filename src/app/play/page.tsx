import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { templatesFor } from '@/content/catalog';
import { PlaySession } from '@/components/play-session';
import { SignOutButton } from '@/components/auth-buttons';
import { emptyProfile } from '@/lib/analytics/profile';
import { readLearnerProfile, readPlayStreak, readRecentTopics, readStarTotal } from '@/lib/records';
import { RECENT_MEMORY } from '@/lib/reinforcement/select';
import { newSession } from '@/lib/session/seed';
import { parseYearLevel, yearLabel } from '@/lib/curriculum';
import { noStreak } from '@/lib/rewards/streak';

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string }>;
}) {
  const { subject = 'maths', level: levelParam = 'K' } = await searchParams;
  const level = parseYearLevel(levelParam);
  const templates = level ? templatesFor(subject, level) : [];

  if (!level || templates.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="text-4xl font-semibold">Nothing to practice here yet</h1>
        <p className="text-xl text-(--color-ink-soft)">
          {level
            ? `There are no ${subject} questions for ${yearLabel(level)}.`
            : `"${levelParam}" is not a school year.`}
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
  const userId = session?.user?.id;

  // What the child has shown before, so the first question of this sitting is
  // already weighted by it. Signed out there is no history, and an empty profile
  // is exactly what draws questions at random.
  const [profile, recentTopics, streak, stars] = userId
    ? await Promise.all([
        readLearnerProfile(userId, subject),
        readRecentTopics(userId, subject, level, RECENT_MEMORY),
        readPlayStreak(userId),
        readStarTotal(userId),
      ])
    : [emptyProfile(), [], noStreak(), 0];

  // Seeded here rather than in the client so the first question is server
  // rendered and the child never sees an empty screen. The seed and the profile
  // are deterministic input to the engine, so server and client render the same
  // question.
  const { seed, startedAt } = newSession();

  return (
    <PlaySession
      subject={subject}
      level={level}
      templates={templates}
      seed={seed}
      startedAt={startedAt}
      profile={profile}
      recentTopics={recentTopics}
      recordingEnabled={Boolean(userId)}
      account={
        session?.user ? { name: session.user.name ?? null, image: session.user.image ?? null, streak, stars } : null
      }
      signOutSlot={session?.user ? <SignOutButton /> : null}
    />
  );
}
