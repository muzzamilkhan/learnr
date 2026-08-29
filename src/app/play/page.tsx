import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readPlayState } from '@/server/play-state';
import { readViewer } from '@/app/viewer';
import { templatesFor } from '@/content/catalog';
import { PlaySession } from '@/components/play-session';
import { SignOutButton } from '@/components/auth-buttons';
import { emptyProfile } from '@/lib/analytics/profile';
import { noStreak } from '@/lib/rewards/streak';
import { RECENT_MEMORY } from '@/lib/reinforcement/select';
import { newSession } from '@/lib/session/seed';
import { parseYearLevel, yearLabel } from '@/lib/curriculum';

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string }>;
}) {
  const { subject = 'maths', level: levelParam = 'K' } = await searchParams;

  const { session, userId, account } = await readViewer();
  const level = parseYearLevel(levelParam);

  // What the child has shown before, so the first question of this sitting is
  // already weighted by it - together with the run of days, the stars and the
  // goal, which all come off the child's own row. Four of the five reads go in
  // parallel inside `readPlayState`, because asked one at a time they are a
  // waterfall in front of the first question.
  //
  // The level is passed as it parsed rather than as the URL wrote it, and null
  // when it is not a school year: there is no course to draw recent topics from,
  // and this is the very read that decides whether to correct the URL.
  const state = userId ? await readPlayState(userId, subject, level, RECENT_MEMORY) : null;
  const player = state?.player ?? null;

  // A managed child's year is the parent's decision, so it is enforced here and
  // not only hidden in the UI - the level is a query parameter, and hiding the
  // dropdown would leave a typed URL as a way straight past it.
  const isManagedChild = account?.role === 'child' && account.parentId !== null;
  const managedLevel = isManagedChild ? (player?.selectedLevel ?? null) : null;
  if (managedLevel && managedLevel !== levelParam) {
    redirect(`/play?subject=${subject}&level=${managedLevel}`);
  }

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

  // Signed out there is no history, and an empty profile is exactly what draws
  // questions at random - so is a read that failed, which is the right trade on
  // the play path: an unweighted first question, never a screen that will not
  // open.
  //
  // The server does not know what day it is where the child is, so it hands over
  // a window of answers and the device decides which of them are today's.
  const profile = state?.profile ?? emptyProfile();
  const recentTopics = state?.recentTopics ?? [];
  const targetAnswers = state?.targetAnswers ?? [];

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
