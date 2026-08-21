import Link from 'next/link';
import { SCORE_TABS, scoreTabHref, type ScoreTab } from '@/lib/speedrun/tabs';

/**
 * The two halves of the scores: your own runs, and the family's.
 *
 * They answer neighbouring questions about the same wall of cards - how *I* am
 * going, and how the house is going - so they are one control with two states
 * rather than two places to go and come back from.
 *
 * **The tabs are links, and the screen knows which is current**, so nothing
 * here is a client component and both halves stay server-rendered: the page
 * reads `?tab=` at the boundary through `parseScoreTab` and says which one is
 * on. It was `usePathname` while the two were routes of their own, which is a
 * client hook and a hydration boundary bought for a bar of two links.
 *
 * **Full width, the two sharing it evenly** - `ParentNav`'s treatment for its
 * reason: a bar that spans what it heads reads as a place to go, where a short
 * control floating at the left reads as a chip somebody dropped above the cards.
 *
 * **Your records is the left tab**, since it is the one a player opens for and
 * the one the leaderboard is context for.
 */

const LABELS: Record<ScoreTab, string> = {
  records: 'Your records',
  leaderboard: 'Leaderboard',
};

const SCALES = {
  child: {
    bar: 'flex w-full rounded-2xl border-2 border-(--color-line) bg-(--color-card) p-1 text-lg font-semibold',
    tab: 'flex-1 rounded-xl px-4 py-2 text-center transition',
  },
  parent: {
    bar: 'flex w-full rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold',
    tab: 'flex-1 rounded-md px-3 py-1.5 text-center transition',
  },
} as const;

export function ScoreTabs({
  basePath,
  tab,
  hash,
  scale = 'child',
}: {
  /** `/` and `/speed` for a child, `/progress/speed` for a parent's own runs. */
  basePath: string;
  /** Which half is on screen - the page's own answer, already normalised. */
  tab: ScoreTab;
  /** Where a switch should land, where the tabs are a long way down a screen. */
  hash?: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];

  return (
    <nav className={`no-select ${style.bar}`}>
      {SCORE_TABS.map((each) => (
        <Link
          key={each}
          href={scoreTabHref(basePath, each, hash)}
          aria-current={each === tab ? 'page' : undefined}
          className={`${style.tab} ${
            each === tab
              ? 'bg-(--color-brand) text-white'
              : 'text-(--color-ink-soft) hover:text-(--color-brand)'
          }`}
        >
          {LABELS[each]}
        </Link>
      ))}
    </nav>
  );
}
