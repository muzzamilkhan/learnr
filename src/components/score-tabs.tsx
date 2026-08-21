'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The two halves of one scores screen: your own runs, and the family's.
 *
 * They were two screens with a back arrow each, reached by two separate links,
 * and they answer neighbouring questions about the same wall of cards - how
 * *I* am going, and how the house is going. Splitting them meant going out to
 * the chooser and back in to compare a card with itself, which is the one
 * comparison anybody opens either screen to make.
 *
 * **The tabs are links, not state**, so both halves stay server-rendered and
 * each is its own URL - a bookmark, a back button and the links from
 * `SpeedCards` and the result screen all keep working exactly as they did.
 * Which one is current is read from the path in the browser, `ParentNav`'s
 * trick and for `ParentNav`'s reason: this sits in a layout, and a layout is
 * never told which page it is wrapping.
 *
 * **Your records is the left tab**, since it is the one a player opens most and
 * the one the leaderboard is context for.
 */

const SCALES = {
  child: {
    // Full width on a phone, where two equal halves are the whole row, and
    // capped on anything larger: a tab bar stretched across a six-column wall
    // of cards stops reading as a control and starts reading as a header.
    bar: 'flex w-full max-w-md rounded-2xl border-2 border-(--color-line) bg-(--color-card) p-1 text-lg font-semibold',
    tab: 'flex-1 rounded-xl px-4 py-2 text-center transition',
  },
  parent: {
    // Narrower than `ParentNav` above it on purpose: a sub-control the width of
    // the nav it sits under reads as a second nav.
    bar: 'flex w-full max-w-xs rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold',
    tab: 'flex-1 rounded-md px-3 py-1.5 text-center transition',
  },
} as const;

export function ScoreTabs({
  basePath,
  scale = 'child',
}: {
  /** `/speed` for the child, `/progress/speed` for a parent's own runs. */
  basePath: string;
  scale?: keyof typeof SCALES;
}) {
  const style = SCALES[scale];
  const pathname = usePathname() ?? '';
  // The leaderboard is the only other thing under here, so anything that is not
  // it is the records tab - which keeps a trailing slash or a query from
  // leaving neither tab lit.
  const onLeaderboard = pathname.startsWith(`${basePath}/leaderboard`);

  return (
    <nav className={`no-select ${style.bar}`}>
      <Tab
        href={`${basePath}/records`}
        label="Your records"
        active={!onLeaderboard}
        style={style}
      />
      <Tab
        href={`${basePath}/leaderboard`}
        label="Leaderboard"
        active={onLeaderboard}
        style={style}
      />
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  style,
}: {
  href: string;
  label: string;
  active: boolean;
  style: (typeof SCALES)[keyof typeof SCALES];
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${style.tab} ${
        active
          ? 'bg-(--color-brand) text-white'
          : 'text-(--color-ink-soft) hover:text-(--color-brand)'
      }`}
    >
      {label}
    </Link>
  );
}
