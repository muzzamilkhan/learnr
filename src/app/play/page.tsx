import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { templatesFor } from '@/content/catalog';
import { PlaySession } from '@/components/play-session';
import { SignOutButton } from '@/components/auth-buttons';
import { emptyProfile } from '@/lib/analytics/profile';
import { noStreak } from '@/lib/rewards/streak';
import { readAccount } from '@/lib/accounts';
import {
  TARGET_WINDOW_MS,
  readLearnerProfile,
  readPlayerState,
  readSelectedLevel,
  readRecentAnswers,
  readRecentTopics,
} from '@/lib/records';
import { RECENT_MEMORY } from '@/lib/reinforcement/select';
import { newSession } from '@/lib/session/seed';
import { parseYearLevel, yearLabel } from '@/lib/curriculum';
import { requestNow } from '@/app/now';

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string }>;
}) {
  const { subject = 'maths', level: levelParam = 'K' } = await searchParams;

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  const account = userId ? await readAccount(userId) : null;

  // A managed child's year is the parent's decision, so it is enforced here and
  // not only hidden in the UI - the level is a query parameter, and hiding the
  // dropdown would leave a typed URL as a way straight past it.
  const isManagedChild = account?.role === 'child' && account.parentId !== null;
  const managedLevel = isManagedChild ? await readSelectedLevel(account.id) : null;
  if (managedLevel && managedLevel !== levelParam) {
    redirect(`/play?subject=${subject}&level=${managedLevel}`);
  }

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

  // What the child has shown before, so the first question of this sitting is
  // already weighted by it. Signed out there is no history, and an empty profile
  // is exactly what draws questions at random. The run of days, the stars and the
  // goal all come off the child's own row, so they are one read rather than four.
  const [profile, recentTopics, player] = userId
    ? await Promise.all([
        readLearnerProfile(userId, subject),
        readRecentTopics(userId, subject, level, RECENT_MEMORY),
        readPlayerState(userId),
      ])
    : [emptyProfile(), [], null];

  // The server does not know what day it is where the child is, so it hands over
  // a window of answers and the device decides which of them are today's. The
  // one read that has to wait for another, since there is no point fetching a
  // window of answers for a child with no goal to measure them against. A failed
  // read is best-effort here, as everything on the play path is: the bar starts
  // empty and the next question's read repairs it.
  const targetAnswers =
    player?.target && userId
      ? ((await readRecentAnswers(userId, requestNow() - TARGET_WINDOW_MS)) ?? [])
      : [];

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
      target={
        player?.target
          ? { target: player.target, answers: targetAnswers, awardedDay: player.targetDay }
          : null
      }
      account={
        session?.user
          ? {
              name: session.user.name ?? null,
              image: session.user.image ?? null,
              // A managed child has no Google picture, so their face is the one
              // their parent set and the animal they picked - both already on the
              // account read above, rather than a second query for one column.
              photo: account?.photo ?? null,
              avatar: account?.avatar ?? null,
              streak: player?.streak ?? noStreak(),
              stars: player?.stars ?? 0,
            }
          : null
      }
      signOutSlot={session?.user ? <SignOutButton /> : null}
    />
  );
}
