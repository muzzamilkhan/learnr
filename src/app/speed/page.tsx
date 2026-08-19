import Link from 'next/link';
import { ExitIcon } from '@/components/exit-icon';
import { SpeedCards } from '@/components/speed-cards';

// Nothing per-player on it, but it sits above screens that are, and the cards
// link straight into them.
export const dynamic = 'force-dynamic';

/**
 * The speed run's own front page: the five operations and the way to the
 * records, at the child's scale.
 *
 * The same cards are on the home screen, and that is not a duplicate to be
 * tidied away - the home screen offers speed runs *beside* practice, which is
 * the choice a child arrives to make, while this page is where the back arrow
 * on a run lands. Without it, backing out of `/speed/multiply` went to `/`,
 * which is a screen further out than the one they came from: choosing an
 * operation and choosing between practice and a speed run are different
 * questions, and going back should answer the nearer one. The parent's
 * `/progress/speed` has been this page all along, and this is its counterpart.
 */
export default function SpeedHomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
        <Link
          href="/"
          aria-label="Go back"
          className="shrink-0 rounded-full border-2 border-(--color-line) bg-(--color-card) p-2.5 text-(--color-ink-soft) transition active:scale-95"
        >
          <ExitIcon />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Speed run</h1>
      </header>

      <SpeedCards />
    </main>
  );
}
