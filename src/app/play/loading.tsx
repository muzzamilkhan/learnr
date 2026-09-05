/**
 * What a child sees between tapping a subject card and the first question.
 *
 * **This file is why the tap feels like anything at all.** Next's router will
 * not leave the screen it is on until a dynamic route's server response
 * arrives, unless that route has a `loading.tsx` - so without this one, a tap
 * on a subject card did nothing whatsoever for the whole round trip and the
 * home screen simply sat there. Measured on the target iPad by the launch
 * probe, the equivalent wait into a speed run is **~340ms at the median and
 * 800-1300ms at p95**; `GET /play` itself is 79ms at p50, so most of it is the
 * network and the client render either side. None of that was visible: the
 * screen was frozen for all of it, which is the difference between an app that
 * is slow and one that looks broken.
 *
 * With this file the transition commits immediately and the wait is spent
 * *here* instead. The route also becomes partially prefetchable, which it could
 * not be before - a `<Link>` to a dynamic route with no loading boundary has
 * nothing to prefetch.
 *
 * **It is the frame and not a picture of the screen.** The geometry is copied
 * from `PlaySession` exactly - the same `h-[100dvh]` column, the same header
 * row, the same pad slot with the same clamps and the same
 * `min-height:501px` query - so the question lands into a box that is already
 * the right size and nothing moves when it arrives. Those numbers are
 * duplicated rather than shared: a constant imported into both would make this
 * file a reason not to change the play screen's layout, and a skeleton that
 * has drifted a few pixels costs nothing while a shared constant that has to
 * be honoured costs every future change.
 *
 * **No logo, no spinner and nothing that counts.** The same rules the play
 * screen itself is built to: a logo in the corner is a thing to watch instead
 * of the question, and this is the corner it would be in. What is left is the
 * shape of where things will be, pulsing, at the app's own quiet contrast -
 * soft blocks rather than convincing buttons, because a fake pad that is
 * tappable-looking for a fifth of a second is an invitation to tap something
 * that cannot answer.
 */
export default function Loading() {
  return (
    <main
      aria-hidden
      className="no-select flex h-[100dvh] animate-pulse flex-col overflow-hidden px-4 py-3 sm:px-10 sm:py-5"
    >
      {/* The door, the speaker and the profile menu, at the sizes they land at:
          two `p-2.5` circles on the left and the menu opposite. */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <div className="size-11 rounded-full bg-(--color-card)" />
          <div className="size-11 rounded-full bg-(--color-card)" />
        </div>
        <div className="size-11 rounded-full bg-(--color-card)" />
      </header>

      {/* The question's own room - the flexible middle, which is what the
          prompt fitter measures and the figure shares. One soft bar rather than
          lines of fake text: the prompt is set at one size for the worst case
          and a skeleton pretending to know its length would be the one claim
          this screen cannot make. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-16 w-2/3 max-w-xl rounded-2xl bg-(--color-card)" />
      </div>

      {/* The pad's slot, to the pixel: `PlaySession` gives it the same clamped
          height behind the same width-and-height query, so this reserves the
          40% of the screen the pad is about to take. */}
      <div className="flex h-[clamp(12rem,40vh,20rem)] shrink-0 flex-col justify-center gap-2 [@media(min-width:640px)_and_(min-height:501px)]:h-[clamp(16rem,40vh,22rem)] [@media(min-width:640px)_and_(min-height:501px)]:gap-3">
        <div className="mx-auto grid h-full w-full max-w-2xl grid-cols-4 grid-rows-4 gap-2 sm:gap-3">
          {Array.from({ length: 16 }, (_, key) => (
            <div key={key} className="rounded-xl bg-(--color-card) sm:rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
