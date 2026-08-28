'use client';

import { useEffect, useRef } from 'react';
import type { Figure } from '@/lib/figures/types';
import { ZOOM_LABEL_SIZE } from '@/lib/figures/labels';
import { Diagram } from './diagram';
import { FOCUS_STOPS, nextFocusIndex } from './focus-trap';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes it for whoever is on a keyboard. A tap anywhere is the
  // child's way out and needs nothing here.
  //
  // On `window` rather than on the dialog, even now that focus is moved into
  // it: the two are not the same guarantee. A tap on the overlay can leave
  // focus on the `<body>` in browsers that do not focus what was clicked, and
  // Escape has to work from there too. `onClose` is a `useCallback` at the call
  // site, so this subscribes once rather than once a second behind a ticking
  // minutes target.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * Focus moves into the overlay on open and back to whatever opened it on
   * close - the figure, for anyone who got here from a keyboard, so Tab carries
   * on from where they were rather than from the top of the document.
   *
   * The dialog takes the focus itself rather than handing it to the prompt
   * inside: it is what carries the `aria-label`, so focusing it is what
   * announces the overlay, and the prompt is not always a control.
   *
   * Restoring on unmount rather than in `onClose` covers the way this usually
   * closes: `advance` clears the zoom when the child answers, which never goes
   * through `onClose` at all. `isConnected` because the question behind may
   * have changed to one with no figure, taking the opener out of the document
   * with it - `focus()` on a detached node is a no-op, but asking first says
   * that is expected.
   */
  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal
      aria-label="The picture, larger"
      // Focusable, and not a tab stop: it holds focus so the overlay is
      // announced, and Tab moves between the stops *inside* it.
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        // Read the stops on the keystroke rather than on open: whether the
        // prompt is one of them depends on `repeatable`, which can change while
        // this is open if narration is turned off behind it.
        const stops = [...dialog.querySelectorAll<HTMLElement>(FOCUS_STOPS)];
        const next = nextFocusIndex(
          stops.length,
          stops.indexOf(document.activeElement as HTMLElement),
          event.shiftKey,
        );
        // Prevented either way. With somewhere to go this is the trap doing its
        // work; with nowhere - a figure whose prompt is not repeatable, which is
        // most of them - it is the whole of the trap, since the alternative is
        // Tab landing on the play screen underneath an opaque overlay.
        event.preventDefault();
        stops[next]?.focus();
      }}
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
        // The keyboard half of the same tap. No `stopPropagation` needed: what
        // the click has to be kept from is the overlay's own `onClick`, and the
        // dialog's `onKeyDown` above reads Tab alone.
        onKeyDown={
          repeatable
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onRepeat();
              }
            : undefined
        }
        role={repeatable ? 'button' : undefined}
        tabIndex={repeatable ? 0 : undefined}
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
