'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveChild } from '@/lib/children';
import { PROGRESS_HREF, PROGRESS_LAB_HREF, progressHref } from '@/lib/parent-links';
import { PARENT_SPEED_HREF } from '@/lib/speedrun/tabs';

type ParentScreen = 'progress' | 'lab' | 'children' | 'speed-run';

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
 * The four destinations, full width: sharing the space evenly reads as a place
 * to go, where chips floating in a corner read as decoration.
 *
 * The two report screens carry the child and the subject across with them,
 * which the other two have no use for. Without that, stepping from a report onto
 * the bench dropped the child and landed on whoever the list happened to name
 * first - the same choice being lost that the pickers were losing.
 */
export function ParentNav() {
  const screen = useParentScreen();
  const params = useSearchParams();
  const looking = { child: params.get('child'), subject: params.get('subject') };

  return (
    <nav className="no-select mt-4 flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
      <NavLink
        href={progressHref(PROGRESS_HREF, looking)}
        label="Progress"
        active={screen === 'progress'}
      />
      <NavLink href="/children" label="Children" active={screen === 'children'} />
      <NavLink href={PARENT_SPEED_HREF} label="Speed run" active={screen === 'speed-run'} />
      {/* The bench, said as what it is rather than as what is on it: what is
          there changes, and "Beta" is the promise a parent needs - findings
          still being judged. */}
      <NavLink
        href={progressHref(PROGRESS_LAB_HREF, looking)}
        label="Beta"
        active={screen === 'lab'}
      />
    </nav>
  );
}

/**
 * Which of the four the current path is on.
 *
 * The speed screens used to be nested at `/progress/speed/...` so they could not
 * collide with the child's `/speed/...`, and that cost this function an ordering
 * constraint: both prefixes matched a speed URL, so the more specific one had to
 * be tested first or every speed screen highlighted "Progress". There is one
 * `/speed` now - but the bench is genuinely inside the report's path, so the
 * constraint is back for that one pair and is written down rather than left to
 * be rediscovered: `/progress/lab` has to be asked about before `/progress`,
 * which is the fallback and therefore last.
 */
function useParentScreen(): ParentScreen {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/children')) return 'children';
  if (pathname.startsWith(PARENT_SPEED_HREF)) return 'speed-run';
  if (pathname.startsWith(PROGRESS_LAB_HREF)) return 'lab';
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
