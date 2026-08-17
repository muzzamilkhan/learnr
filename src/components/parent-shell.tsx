import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The frame around every parent screen.
 *
 * A parent's screens are deliberately not built to the child's scale. The play
 * and level screens are sized for a six-year-old holding an iPad at arm's length —
 * huge type, huge targets, one thing at a time. A parent is reading a report and
 * managing profiles, and blowing that up to the same size only means more
 * scrolling and less on screen at once. So this shell sets a denser scale, and
 * the parent components below it follow: `text-sm`/`text-base` body, single-width
 * borders, `rounded-xl`, and buttons a mouse can hit.
 *
 * The two parent jobs are two screens — the report and the profiles — so the nav
 * lives here rather than being re-stated by each of them.
 */
export function ParentShell({
  title,
  subtitle,
  current,
  menu,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Which of the two screens this is, so the nav can show it as the current one. */
  current: 'progress' | 'children';
  /** The profile menu, built on the server so sign-out stays a server action. */
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-(--color-ink-soft)">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Nav current={current} />
          {menu}
        </div>
      </header>

      {children}

      {/* What the questions are written against — the one thing a parent would
          actually want to read, so it follows them onto both screens. */}
      <p className="mt-10 text-sm text-(--color-ink-soft)">
        <Link href="/curriculum" className="text-(--color-brand) underline">
          Curriculum sources
        </Link>{' '}
        — what the questions are written against.
      </p>
    </main>
  );
}

function Nav({ current }: { current: 'progress' | 'children' }) {
  return (
    <nav className="no-select flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
      <NavLink href="/progress" label="Progress" active={current === 'progress'} />
      <NavLink href="/children" label="Children" active={current === 'children'} />
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 transition ${
        active
          ? 'bg-(--color-brand) text-white'
          : 'text-(--color-ink-soft) hover:text-(--color-brand)'
      }`}
    >
      {label}
    </Link>
  );
}
