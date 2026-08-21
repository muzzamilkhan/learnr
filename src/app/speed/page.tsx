import Link from 'next/link';
import { auth, isAuthConfigured } from '@/auth';
import { ExitIcon } from '@/components/exit-icon';
import { SpeedCards } from '@/components/speed-cards';
import { SpeedScores } from '@/components/speed-scores';
import { parseScoreTab } from '@/lib/speedrun/tabs';

// Per-player scores, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The speed run on its own screen: the scores, then the five ways to start a
 * run - the same pair the child's home screen carries under "Speed run", with
 * the practice half of that screen left off.
 *
 * That is not a duplicate to tidy away. This is where the arrow on a chooser
 * and the door inside a run land, and going back should answer the nearer
 * question: what somebody is undoing is "I picked Multiply", not "I opened this
 * app". Without it, backing out of `/speed/multiply` went to `/`, a screen
 * further out than the one they came from.
 */
export default async function SpeedHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = parseScoreTab((await searchParams).tab);
  const session = isAuthConfigured ? await auth() : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <Link
          href="/"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Speed run</h1>
      </header>

      {/* No hash on the tabs: they are the top of this screen, so a switch has
          nowhere to scroll away from. */}
      <SpeedScores tab={tab} basePath="/speed" userId={session?.user?.id} />

      <h2 className="mt-8 mb-4 text-2xl font-bold tracking-tight sm:mt-10 sm:text-3xl">
        Start a run
      </h2>
      <SpeedCards />
    </main>
  );
}
