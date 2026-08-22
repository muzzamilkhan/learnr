import { splitFractions } from '@/lib/fractions';

/**
 * A rendered prompt, hint, answer or choice, with its fractions drawn the way
 * a child is taught them: one number over another with a bar between, rather
 * than the `1/2` the expression language happens to produce.
 *
 * The dumb half, like `diagram.tsx`: `src/lib/fractions.ts` decides what a
 * slash is and this decides nothing at all, which is what lets the same rule
 * serve the narration, where there is nothing to draw.
 *
 * **Everything is sized in `em`.** The play screen searches for a prompt size
 * at runtime and sets it as an inline `font-size` on the element this sits
 * inside, so a fraction has to grow with whatever it is given rather than
 * being told - and the same component then works unchanged in a choice button
 * at `text-4xl` and in a hint at `clamp(1rem,2.4vh,1.5rem)`.
 *
 * `inline-flex` with `align-middle` puts the stack's centre on the
 * surrounding line's middle, which is where a vinculum belongs - a baseline
 * alignment would hang the whole fraction below the text it sits in.
 */
export function MathsText({ text }: { text: string }) {
  const segments = splitFractions(text);

  // The common case by a long way: 338 of the 350 shipped templates never draw
  // a fraction at all, and this keeps them one text node rather than a span.
  if (segments.length === 1 && segments[0].kind === 'text') return <>{segments[0].text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span
            key={index}
            // 0.72em: a fraction is two lines of type where the text around it
            // is one, so it is set smaller to keep the line it sits in from
            // opening up more than it has to. `leading-none` is the other half
            // of that - the default line-height on the two halves would add a
            // third of a line each.
            className="mx-[0.12em] inline-flex flex-col items-center align-middle text-[0.72em] leading-none"
          >
            <span className="px-[0.18em]">{segment.numerator}</span>
            {/* The vinculum. `border-current` so it takes the colour of
                whatever it is drawn in - the green of a revealed right answer,
                the soft ink of a hint - without any caller passing a colour. */}
            <span className="my-[0.08em] w-full border-t-[0.09em] border-current" />
            <span className="px-[0.18em]">{segment.denominator}</span>
          </span>
        ),
      )}
    </>
  );
}
