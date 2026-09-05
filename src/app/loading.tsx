import { LogoMark } from '@/components/logo';

/**
 * The root loading boundary: what shows while any screen without one of its own
 * is being rendered.
 *
 * **The one that matters is the way out of a lesson.** The play screen's door
 * goes to `/`, and `/` is `force-dynamic` because it opens on the level that
 * child last chose - so before this file existed, tapping the door left the
 * play screen on screen, unchanged, for the whole round trip. `GET /` is the
 * slowest route the app has: **260ms at p50**, against 79ms for `/play`, and it
 * is the one a child taps into most often. Exiting felt worse than entering
 * because it *was* worse, and neither showed anything while it happened.
 *
 * **It is deliberately generic, because a root boundary is not one screen's.**
 * It stands in for `/`, `/curriculum`, `/signin`, `/password/*` and `/share/*`
 * alike - every route that has not got a nearer one - so a skeleton shaped like
 * the child's home screen would be a wrong promise on four of them. What all of
 * those do share is the mark and the paper, so that is what this is: the app,
 * arriving, saying nothing it might have to take back.
 *
 * `/play` has its own for the opposite reason - there the frame is worth
 * reserving to the pixel, and a logo is the one thing that screen may not
 * carry.
 */
export default function Loading() {
  return (
    <main
      aria-hidden
      className="flex min-h-[100dvh] items-center justify-center bg-(--color-paper)"
    >
      <div className="animate-pulse">
        <LogoMark size="lg" />
      </div>
    </main>
  );
}
