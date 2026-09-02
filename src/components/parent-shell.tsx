import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { LogoMark } from '@/components/logo';
import { ParentHeading, ParentNav } from '@/components/parent-heading';

/**
 * The frame around every parent screen.
 *
 * A parent's screens are deliberately not built to the child's scale. The play
 * and level screens are sized for a six-year-old holding an iPad at arm's length -
 * huge type, huge targets, one thing at a time. A parent is reading a report and
 * managing profiles, and blowing that up to the same size only means more
 * scrolling and less on screen at once. So this shell sets a denser scale, and
 * the parent components below it follow: `text-sm`/`text-base` body, single-width
 * borders, `rounded-xl`, and buttons a mouse can hit.
 *
 * The parent's screens share one nav, so it lives here rather than being
 * re-stated by each of them. It is rendered from a
 * **layout**, not from either page: a shell rebuilt by whichever page is on
 * screen would be unmounted and remounted on every hop between them, and the
 * logo, the menu and the nav would visibly flash. From the layout they are
 * mounted once and only the page beneath them changes, so what moves is what
 * actually differs. That is also why the title and the current nav item are read
 * from the URL by `ParentHeading` - a layout is never told which page it is
 * wrapping.
 */
export function ParentShell({
  profiles,
  title,
  subtitle,
  menu,
  children,
}: {
  /** This parent's children, so the heading can name whichever one is on screen. */
  profiles: { id: string; name: string }[];
  /** What the heading says when there is no child to name yet. */
  title: string;
  subtitle?: string;
  /** The profile menu, built on the server so sign-out stays a server action. */
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      {/* Title and profile menu share one row at every width - the menu is the
          account, and an account belongs beside the name of the screen, not
          stranded under it. It never wraps, so on a phone it stays pinned to the
          right edge rather than sliding to the left of a new line. The nav is
          the row below, full width. */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* The mark links home, which for a parent is the report - the one
              place every other parent screen is a detour from. */}
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="LearnR home" className="no-select">
              <LogoMark size="md" />
            </Link>
            {/* The heading reads the query string, so it is suspended: a page
                that hasn't got its search params yet gets the row's height
                rather than nothing, and the layout above never blocks. */}
            <Suspense fallback={<div className="min-w-0 h-8" />}>
              <ParentHeading profiles={profiles} fallbackTitle={title} fallbackSubtitle={subtitle} />
            </Suspense>
          </div>
          {menu}
        </div>
        <Suspense fallback={<div className="mt-4 h-9" />}>
          <ParentNav />
        </Suspense>
      </header>

      {children}

      {/* What the questions are written against - the one thing a parent would
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
            What the questions are written against - the Australian Curriculum, year by year.
          </span>
        </span>
        <span aria-hidden className="ml-auto text-lg text-(--color-brand)">
          &rarr;
        </span>
      </Link>
    </main>
  );
}
