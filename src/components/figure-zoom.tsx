'use client';

import { useEffect } from 'react';
import type { Figure } from '@/lib/figures/types';
import { ZOOM_LABEL_SIZE } from '@/lib/figures/labels';
import { Diagram } from './diagram';
import { MathsText } from './maths-text';

/**
 * The figure, over the whole screen.
 *
 * **It has to cover the screen, because the question area is bound by height
 * and not by width** (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`).
 * Expanding a figure into the prompt's half of the row buys almost nothing: on
 * a landscape iPad that area is around 270px tall whether the figure has 60%
 * of the width or all of it. The only room left to take is the pad's, and
 * taking the pad's room means covering the pad. So a child cannot answer while
 * this is open, and closing it is one tap **anywhere** rather than a target to
 * find.
 *
 * **The prompt rides along.** The questions this exists for are the ones where
 * the picture carries the data - a bar graph, a coordinate grid - and reading a
 * graph against a question you are trying to remember is the thing that made
 * the small figure hard in the first place.
 *
 * This is the one place the figure is a control, and it is a reversal: the
 * diagrams design said the figure "is not a second control: it takes no tap".
 * What is unchanged is why - a figure must not be a second thing to decode -
 * and a tap that only ever makes the same picture bigger decodes nothing.
 */
export function FigureZoom({
  figure,
  prompt,
  onClose,
  onRepeat,
  repeatable,
}: {
  figure: Figure;
  prompt: string;
  onClose: () => void;
  /** Repeat the question aloud. Only wired up while narration is on. */
  onRepeat: () => void;
  repeatable: boolean;
}) {
  // Escape closes it for whoever is on a keyboard. A tap anywhere is the
  // child's way out and needs nothing here.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="The picture, larger"
      onClick={onClose}
      // z-20, not the highest value in the file: `RoundReward` and
      // `TargetReward` are z-30 and `StreakFlash` is z-40 (see those three
      // components), and a round can close on the same answer that had the
      // picture open - the celebration has to paint over this, not under it.
      // z-20 still covers the header, including the profile menu's dropdown
      // (also z-20, but `absolute` inside the header and earlier in DOM
      // order): a later `fixed` element at an equal z-index paints on top of
      // an earlier one, which is what actually does the covering here, not
      // stacking order alone.
      className="fixed inset-0 z-20 flex flex-col items-center gap-3 bg-(--color-paper) p-4 sm:gap-4 sm:p-6"
    >
      {/* Small and out of the way: the picture is what this screen is for, and
          the words are here so a child does not have to hold the question in
          their head while reading a graph. Tapping them repeats them aloud,
          exactly as tapping the question on the play screen does - and the tap
          must not also close the overlay, hence the stopPropagation. */}
      <p
        onClick={
          repeatable
            ? (event) => {
                event.stopPropagation();
                onRepeat();
              }
            : undefined
        }
        role={repeatable ? 'button' : undefined}
        aria-label={repeatable ? 'Read the question again' : undefined}
        className="w-full max-w-3xl shrink-0 text-center text-[clamp(1rem,2.6vh,1.5rem)] leading-snug font-semibold text-balance text-(--color-ink)"
      >
        <MathsText text={prompt} />
      </p>

      {/* `strokeWidth` 5 rather than the play screen's 3.5: it is real pixels
          (`vectorEffect="non-scaling-stroke"`), and a line that reads at 270px
          is a hairline at 600. */}
      <Diagram
        figure={figure}
        strokeWidth={5}
        labelSize={ZOOM_LABEL_SIZE}
        className="min-h-0 w-full flex-1"
      />
    </div>
  );
}
