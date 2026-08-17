'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveChild } from '@/lib/children';

/**
 * The heading and the nav, worked out in the browser rather than passed down
 * from whichever page is on screen.
 *
 * The two parent screens share one shell, and the shell lives in a layout so
 * that moving between them re-renders only the page below it — a header that
 * came from the page would be torn down and rebuilt on every hop, which is the
 * flicker this avoids. A layout can't be told which page is showing, so the
 * pieces that change per screen read the URL instead: the title, and which of
 * the two nav items is the current one.
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
  /** What to say when there is no child to name — the empty `/` screen. */
  fallbackTitle: string;
  fallbackSubtitle?: string;
}) {
  const onChildren = useIsChildrenScreen();
  const childParam = useSearchParams().get('child');
  const child = resolveChild(profiles, childParam);

  const title = onChildren ? 'Children' : child ? `${child.name}'s progress` : fallbackTitle;
  const subtitle = onChildren || child ? undefined : fallbackSubtitle;

  return (
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm text-(--color-ink-soft)">{subtitle}</p> : null}
    </div>
  );
}

/**
 * The two destinations, full width: two of them sharing the space evenly read as
 * a place to go, where two chips floating in a corner read as decoration.
 */
export function ParentNav() {
  const onChildren = useIsChildrenScreen();

  return (
    <nav className="no-select mt-4 flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
      <NavLink href="/progress" label="Progress" active={!onChildren} />
      <NavLink href="/children" label="Children" active={onChildren} />
    </nav>
  );
}

function useIsChildrenScreen() {
  return usePathname()?.startsWith('/children') ?? false;
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
