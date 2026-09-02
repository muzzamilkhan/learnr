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
        : screen === 'lab'
          ? 'Beta'
          : child
            ? `${child.name}'s progress`
            : fallbackTitle;

  /**
   * The bench takes the nav's own word as its title and names the child
   * underneath, where the report does the opposite. Two reasons, and the second
   * is the one that decided it: a heading reading `${name}'s progress` on both
   * screens left the nav highlight as the only thing saying which of them you
   * were on - and what a parent most needs to know here is that they are
   * looking at something still being judged, which is a poor fit for the half
   * of the line that gets truncated on a phone.
   */
  const subtitle =
    screen === 'lab'
      ? child
        ? `Analytics being tried out on ${child.name}'s answers`
        : 'Analytics being tried out'
      : screen === 'progress' && !child
        ? fallbackSubtitle
        : undefined;

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
 *
 * **The bench is not one of them.** It had a fourth item here for a day, which
 * put an experiment on the same footing as the three things a parent came to
 * do - four equal tabs say four equal screens. It is a badge on the report
 * instead (`ProgressReport`), which is where a parent is when the question
 * "what else is there?" occurs to them. The nav still lights "Progress" up for
 * it: the bench is inside the report's path, and a screen reached from the
 * report is not a fourth place to be.
 *
 * The report link carries the child and the subject across, which the other two
 * have no use for.
 */
export function ParentNav() {
  const screen = useParentScreen();
  const params = useSearchParams();

  return (
    <nav className="no-select mt-4 flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
      <NavLink
        href={progressHref(PROGRESS_HREF, {
          child: params.get('child'),
          subject: params.get('subject'),
        })}
        label="Progress"
        active={screen === 'progress' || screen === 'lab'}
      />
      <NavLink href="/children" label="Children" active={screen === 'children'} />
      <NavLink href={PARENT_SPEED_HREF} label="Speed run" active={screen === 'speed-run'} />
    </nav>
  );
}

/**
 * Which screen the current path is on - four answers for three nav items, since
 * the bench has a heading of its own and no tab of its own.
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
