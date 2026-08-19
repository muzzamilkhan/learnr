/**
 * The geometry behind the circle a parent drags their child's face into.
 *
 * Pure, and tested here rather than judged by eye in the cropper: what a drag
 * may not do - pull an edge of the picture inside the circle, leaving a crescent
 * of nothing in a profile photo - is exactly the sort of rule that has to be
 * arithmetic somewhere it can be asserted. `src/components/photo-crop.tsx` is
 * the browser half; it owns the pointers and the canvas and nothing else.
 *
 * The model is one square window of `window` pixels with the circle inscribed in
 * it. The picture is drawn scaled to cover that window (`coverScale`) times a
 * `zoom` of 1 or more, and `offset` slides it, in window pixels, from centred.
 * `zoom` starts at 1 rather than at some pixel scale so the slider's floor is
 * the same number for a 12MP photo and a 200px one.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface SourceRect {
  x: number;
  y: number;
  size: number;
}

/**
 * The scale at which the picture just covers the window - the zoom floor, and
 * the reason a photo can never come out with an empty corner. A picture smaller
 * than the window is scaled *up* to it: a little softness beats a gap.
 */
export function coverScale(natural: Size, window: number): number {
  return window / Math.min(natural.width, natural.height);
}

/** How far the picture may slide on each axis before an edge would come inside the window. */
function slack(natural: Size, window: number, zoom: number): Offset {
  const scale = coverScale(natural, window) * zoom;
  return {
    x: Math.max(0, (natural.width * scale - window) / 2),
    y: Math.max(0, (natural.height * scale - window) / 2),
  };
}

export function clampOffset(offset: Offset, natural: Size, window: number, zoom: number): Offset {
  const limit = slack(natural, window, zoom);
  // `+ 0` only to turn a -0 back into 0: an axis with no slack clamps to zero,
  // and a negative zero is a distinction nothing here means to draw.
  return {
    x: Math.min(limit.x, Math.max(-limit.x, offset.x)) + 0,
    y: Math.min(limit.y, Math.max(-limit.y, offset.y)) + 0,
  };
}

/**
 * The square of the original picture the window is showing, in the picture's own
 * pixels - what `drawImage` is handed to write the stored square. The offset is
 * clamped on the way through, so a rect from this function is always inside the
 * picture whatever it was passed.
 */
export function sourceRect(natural: Size, window: number, zoom: number, offset: Offset): SourceRect {
  const scale = coverScale(natural, window) * zoom;
  const { x, y } = clampOffset(offset, natural, window, zoom);
  const size = window / scale;

  return {
    x: natural.width / 2 - x / scale - size / 2,
    y: natural.height / 2 - y / scale - size / 2,
    size,
  };
}
