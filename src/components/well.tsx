import type { ReactNode } from 'react';

/**
 * One section of a parent screen, boxed.
 *
 * The report is a list of separate questions - is she using it, what is hard,
 * what is known - and run together as bare headings they read as one long page
 * a parent has to parse. A box per question makes the boundaries visible at a
 * glance, which is how a weekly skim actually happens.
 *
 * Sized to the parent scale set by `ParentShell`: single-width border,
 * `rounded-xl`, nothing blown up for small hands.
 */
export function Well({
  title,
  note,
  aside,
  children,
}: {
  title: string;
  /** A sentence under the heading, for a section that needs explaining. */
  note?: ReactNode;
  /** A figure or control sitting opposite the heading. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-(--color-line) bg-(--color-card) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside ? <div className="text-sm text-(--color-ink-soft)">{aside}</div> : null}
      </div>
      {note ? <p className="mt-0.5 text-sm text-(--color-ink-soft)">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
