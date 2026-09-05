/**
 * What a parent sees while the report, the profiles or the bench are rendering.
 *
 * **It sits inside `ParentShell`, which is the whole point.** A `loading.tsx`
 * beside a `layout.tsx` boundaries that layout's *children*, so the logo, the
 * nav, the child picker and the profile menu stay exactly where they are and
 * only the panels below them swap. That is the same argument the layout itself
 * was written for - moving between these screens should change only what
 * differs - carried through to the moment in between, where it had been
 * missing: the nav highlighted the screen you had asked for and then nothing
 * happened until the server answered.
 *
 * These are the slowest reads in the app - `GET /progress` is 352ms at p50
 * against 79ms for `/play` - because a report is five reads and an ownership
 * check in front of them.
 *
 * **It only covers hops taken inside the group.** Arriving from `/` renders the
 * layout too, and the layout's own `readParent()` is above this boundary, so
 * that first entry is the root `loading.tsx`'s to answer. Wells rather than
 * anything more specific, because the three screens under here do not share a
 * shape past "a column of panels" - and a skeleton that guesses at a report and
 * gets a list of children is worse than one that admits it is waiting.
 */
export default function Loading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      {[0, 1, 2].map((panel) => (
        <div
          key={panel}
          className="rounded-xl border border-(--color-line) bg-(--color-card) p-4"
        >
          <div className="h-4 w-40 rounded bg-(--color-line)" />
          <div className="mt-4 h-24 rounded-lg bg-(--color-paper)" />
        </div>
      ))}
    </div>
  );
}
