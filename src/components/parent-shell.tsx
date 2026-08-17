import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/logo';

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
      {/* Title and profile menu share one row at every width — the menu is the
          account, and an account belongs beside the name of the screen, not
          stranded under it. It never wraps, so on a phone it stays pinned to the
          right edge rather than sliding to the left of a new line. The nav is
          the row below, full width: two destinations sharing the space evenly
          read as a place to go, where two chips floating in a corner read as
          decoration. */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* The mark links home, which for a parent is the report — the one
              place every other parent screen is a detour from. */}
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="LearnR home" className="no-select">
              <LogoMark size="md" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-sm text-(--color-ink-soft)">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {menu}
        </div>
        <Nav current={current} />
      </header>

      {children}

      {/* What the questions are written against — the one thing a parent would
          actually want to read, so it follows them onto both screens. Drawn as a
          panel rather than a footnote: a line of small print under a page of
          boxed sections is the shape of something nobody is meant to click. */}
      <Link
        href="/curriculum"
        className="no-select mt-8 flex items-center gap-4 rounded-xl border border-(--color-line) bg-(--color-card) p-4 transition hover:border-(--color-brand)"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold">Curriculum sources</span>
          <span className="mt-0.5 block text-sm text-(--color-ink-soft)">
            What the questions are written against — the Australian Curriculum, year by year.
          </span>
        </span>
        <span aria-hidden className="ml-auto text-lg text-(--color-brand)">
          &rarr;
        </span>
      </Link>
    </main>
  );
}

function Nav({ current }: { current: 'progress' | 'children' }) {
  return (
    <nav className="no-select mt-4 flex rounded-lg border border-(--color-line) bg-(--color-card) p-0.5 text-sm font-semibold">
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
