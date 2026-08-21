import type { ReactNode } from 'react';
import Link from 'next/link';
import { ExitIcon } from '@/components/exit-icon';
import { ScoreTabs } from '@/components/score-tabs';

/**
 * One scores screen with two tabs: the child's own cabinet and the family
 * leaderboard.
 *
 * The frame is a layout rather than something each page draws, exactly as
 * `ParentShell` is: hopping between the tabs replaces only the wall of cards
 * below them, so the arrow and the tabs stay mounted instead of being torn
 * down and rebuilt. It is also what makes them read as two views of one screen
 * rather than two screens that happen to look alike.
 *
 * The route group adds no path segment, so `/speed/records` and
 * `/speed/leaderboard` are the URLs they always were - both are still static
 * segments winning over `/speed/[op]`, and both still return null from
 * `parseOperation`, so neither can collide with an operation.
 *
 * The arrow goes to `/speed`, not home: what someone backing out of here is
 * undoing is "I came to look at the scores", the same reason a run's door
 * lands on the chooser.
 */
export default function ScoresLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <Link
          href="/speed"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Scores</h1>
      </header>

      <div className="mb-5 sm:mb-7">
        <ScoreTabs basePath="/speed" />
      </div>

      {children}
    </main>
  );
}
