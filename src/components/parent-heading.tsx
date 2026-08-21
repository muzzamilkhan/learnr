'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveChild } from '@/lib/children';

/** Where the nav's third item goes: the screen with the scores and all
 * twenty-six modes on it - not one arbitrary run, which left the other
 * twenty-five reachable only by hand-editing the URL. */
const SPEED_RUN_HREF = '/progress/speed';

type ParentScreen = 'progress' | 'children' | 'speed-run';

/**
 * The heading and the nav, worked out in the browser rather than passed down
 * from whichever page is on screen.
 *
 * The parent's screens share one shell, and the shell lives in a layout so
 * that moving between them re-renders only the page below it - a header that
 * came from the page would be torn down and rebuilt on every hop, which is the
 * flicker this avoids. A layout can't be told which page is showing, so the
 * pieces that change per screen read the URL instead: the title, and which of
 * the nav items is the current one.
 *
 * `/` is treated as the report, because that is where a parent with children is
 * sent; the one parent who lands on `/` has no children yet and is looking at
 * what will become their report.
 */
export function ParentHeading({
  profiles,
  fallbackTitle,
  fallbackSubtitle,
}: {
  profiles: { id: string; name: string }[];
  /** What to say when there is no child to name - the empty `/` screen. */
  fallbackTitle: string;
  fallbackSubtitle?: string;
}) {
  const screen = useParentScreen();
  const childParam = useSearchParams().get('child');
  const child = resolveChild(profiles, childParam);

  const title =
    screen === 'children'
      ? 'Children'
      : screen === 'speed-run'
        ? 'Speed run'
        : child
          ? `${child.name}'s progress`
          : fallbackTitle;
  const subtitle = screen === 'progress' && !child ? fallbackSubtitle : undefined;

  return (
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm text-(--color-ink-soft)">{subtitle}</p> : null}
    </div>
  );
}

/**
 * The three destinations, full width: sharing the space evenly reads as a place
 * to go, where chips floating in a corner read as decoration.
 */
export function ParentNav() {
  const screen = useParentScreen();

  return (
    <nav className="no-select mt-4 flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
      <NavLink href="/progress" label="Progress" active={screen === 'progress'} />
      <NavLink href="/children" label="Children" active={screen === 'children'} />
      <NavLink href={SPEED_RUN_HREF} label="Speed run" active={screen === 'speed-run'} />
    </nav>
  );
}

/**
 * Which of the three the current path is on. The parent's speed pages are
 * nested at `/progress/speed/...` rather than sitting beside `/progress` as
 * their own top-level segment, precisely so they can never collide with the
 * child's own `/speed/...` routes - a route group adds no path segment, so two
 * bare top-level names would be told apart only by spelling. That nesting is
 * why `/progress/speed` has to be checked *before* the bare `/progress` below
 * it: both prefixes match a speed URL, and the more specific one has to win or
 * every speed screen would highlight "Progress" instead of "Speed run". A
 * later reordering of these two lines is the exact mistake this comment exists
 * to catch.
 */
function useParentScreen(): ParentScreen {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/children')) return 'children';
  if (pathname.startsWith('/progress/speed')) return 'speed-run';
  return 'progress';
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 rounded-md px-3 py-1.5 text-center transition ${
        active
          ? 'bg-(--color-brand) text-white'
          : 'text-(--color-ink-soft) hover:text-(--color-brand)'
      }`}
    >
      {label}
    </Link>
  );
}
