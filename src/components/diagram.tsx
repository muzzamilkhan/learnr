import type { Figure, Mark } from '@/lib/figures/types';

/**
 * A figure the child has to *look* at: the picture is the question and the
 * prompt is its caption (`docs/superpowers/specs/2026-08-20-question-diagrams-design.md`).
 * This is the dumb half - marks to SVG, no geometry and no decisions, which is
 * what `src/lib/figures/build.ts` already made true of the data it hands over.
 *
 * Sized entirely by its container: no width or height here, only a `viewBox`
 * matching the figure's own box and `preserveAspectRatio="xMidYMid meet"`, so
 * the same component draws a ~64px thumbnail in a parent's report row and the
 * play screen's whole flexible area - just the one bigger than the other.
 *
 * **Stroke width is the caller's, not a constant in here.** The two places
 * this renders are a five-times difference in size, and one number cannot read
 * at both: `vectorEffect="non-scaling-stroke"` is the right mechanism for
 * pinning a line's weight in real pixels regardless of the viewBox's scale -
 * matching how every card, pad and button in this app is a flat `border-2`
 * whatever screen it is on - but *which* real-pixel width still has to differ
 * between a play-screen figure and a 64px report thumbnail, so it is a prop
 * (`strokeWidth`) rather than a constant. Everything else that has to read as
 * one drawing - the vertex dot, the dashed mirror line's dash length - is
 * derived from that same number so the whole figure scales as one weight
 * rather than several fighting each other.
 *
 * The vertex dot is drawn as a zero-length, round-capped `<line>` rather than
 * a filled `<circle>`, because `vectorEffect` only pins a *stroke* - a fill
 * radius has no equivalent and would still be a viewBox-unit quantity scaling
 * with the box. A stroke with `strokeLinecap="round"` on a zero-length line
 * renders as a solid dot exactly `strokeWidth` wide, which puts it in the same
 * real-pixel frame as every other line here rather than a second, disagreeing
 * one.
 *
 * `label` has no `vector-effect` trick available - SVG only exempts stroke
 * geometry from the viewBox's own scaling, never `font-size`, so a `<text>`
 * shrinks with a small box exactly like an unmarked coordinate would. True
 * scale-independence would need a measured counter-transform (a
 * `ResizeObserver`, the way `Prompt` in `play-session.tsx` measures its own
 * box), which nothing here builds. What is available instead is
 * `strokeWidth` itself: the caller already picks a bigger one for the play
 * screen's large box and a smaller one for the report's ~64px thumbnail, so
 * it is a real-pixel signal for which of the two very differently sized
 * places this is - the same signal `dotDiameter` and `dash` read, just read
 * the other way. The dot and the dash *multiply* by `strokeWidth`, because a
 * heavier line should carry visually heavier marks at whatever size it is
 * drawn. `LABEL_SIZE_SCALE / strokeWidth` divides instead, because text does
 * not get `dotDiameter`'s free ride: left alone it already shrinks with the
 * small box's smaller scale, and a *larger* `strokeWidth` is exactly the sign
 * that the scale is larger still - multiplying by it would shrink the
 * report's label a second time rather than counteract the first shrink, the
 * same mistake spelled out for a future author of this code before anything
 * called for it. Dividing pushes the opposite way: the play screen's bigger
 * `strokeWidth` buys a *smaller* viewBox-unit size and the report's smaller
 * one a bigger one, which narrows how far apart the two sites' rendered label
 * size ends up rather than widening it - an approximation of the invariance
 * the strokes get exactly, using the only real-pixel signal this renderer has
 * without measuring its own box.
 */

/**
 * The constant half of `labelSize` - see the module comment above for why
 * dividing by `strokeWidth`, rather than multiplying like `dotDiameter` and
 * `dash`, is what keeps a label from reading smaller still in the report.
 */
const LABEL_SIZE_SCALE = 24;

export function Diagram({
  figure,
  strokeWidth,
  className,
}: {
  figure: Figure;
  /**
   * Real pixels, via `vectorEffect="non-scaling-stroke"`. Roughly 3-4 on the
   * play screen, 1.5-2 in a report row - the caller's call, because it is the
   * caller who knows which of the two very differently sized places this is.
   */
  strokeWidth: number;
  className?: string;
}) {
  // A dot noticeably heavier than the line it marks, so "the arms alone do
  // not say which end is the corner" (`angle.ts`) still holds at a glance;
  // a dash pattern proportioned to the same line weight rather than a fixed
  // absolute length, so it does not go from a handful of dashes at report
  // scale to a wall of them at play-screen scale for no reason but the
  // caller having picked a different `strokeWidth`.
  const dotDiameter = strokeWidth * 3;
  const dash = `${strokeWidth * 2.5} ${strokeWidth * 1.5}`;
  const labelSize = LABEL_SIZE_SCALE / strokeWidth;

  return (
    <svg
      viewBox={`0 0 ${figure.width} ${figure.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      // Deliberately not a description of the picture. "A shape with three
      // sides" *is* the answer to half of what this draws, so narration reads
      // the prompt and stops - see the design's "Narration" section. The figure
      // is not a second control either: it takes no click handler, and tapping
      // the question to repeat it is untouched by this component existing.
      aria-label="Diagram for this question"
      className={className}
    >
      {figure.marks.map((mark, index) => (
        // The marks are a fixed list rebuilt fresh for every question, never
        // reordered or filtered in place, so the index is a stable key.
        <MarkShape
          key={index}
          mark={mark}
          strokeWidth={strokeWidth}
          dotDiameter={dotDiameter}
          dash={dash}
          labelSize={labelSize}
        />
      ))}
    </svg>
  );
}

function MarkShape({
  mark,
  strokeWidth,
  dotDiameter,
  dash,
  labelSize,
}: {
  mark: Mark;
  strokeWidth: number;
  dotDiameter: number;
  dash: string;
  labelSize: number;
}) {
  switch (mark.kind) {
    case 'path': {
      // A closed path is the shape's own outline (or a tick that happens to
      // close); an open one is a mirror line or a right-angle tick's two short
      // strokes. `<polygon>` and `<polyline>` differ only in whether the last
      // point joins back to the first, so the two branches share every prop but
      // the tag - written out rather than picked with a dynamic tag name, which
      // TypeScript's JSX does not narrow cleanly across a union of host elements.
      const points = mark.points.map(([x, y]) => `${x},${y}`).join(' ');
      const fill = mark.fill ? 'var(--color-brand-soft)' : 'none';
      const dashArray = mark.dashed ? dash : undefined;
      return mark.closed ? (
        <polygon
          points={points}
          fill={fill}
          stroke="var(--color-ink)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline
          points={points}
          fill={fill}
          stroke="var(--color-ink)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    case 'arc':
      return (
        <path
          d={arcPath(mark)}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'dot':
      // See the module comment: a zero-length round-capped line renders as a
      // dot exactly `dotDiameter` real pixels wide, which is what keeps it in
      // the same non-scaling frame as every stroke here rather than a filled
      // circle sized in the viewBox's own, different units.
      return (
        <line
          x1={mark.at[0]}
          y1={mark.at[1]}
          x2={mark.at[0]}
          y2={mark.at[1]}
          stroke="var(--color-ink)"
          strokeWidth={dotDiameter}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'label':
      return (
        <text
          x={mark.at[0]}
          y={mark.at[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={labelSize}
          fill="var(--color-ink)"
        >
          {mark.text}
        </text>
      );
  }
}

/**
 * An SVG arc command for one `arc` mark. This is the one place the figure's two
 * coordinate frames meet in the renderer, and getting it backwards is the
 * easiest mistake to make here: `at` already lives in screen coordinates
 * (`src/lib/figures/build.ts`'s `fit` placed it there, y increasing downward),
 * but `from`/`to` never left the maths frame the rest of the figure was
 * authored in - degrees, anticlockwise-positive, 0 = east. `types.ts`'s doc
 * comment on the `arc` case of `Mark` is explicit about the formula this has to
 * use: a point on the sweep is `(cx + r·cos θ, cy − r·sin θ)`, **minus** on the
 * y term, because turning y downward without also turning the angle around
 * would spin every sweep the wrong way.
 *
 * `from` is always less than `to` in what `angleMarks` produces today, but
 * this reads the sign rather than assuming it: walking from `from` to `to` in
 * the direction of increasing degrees is anticlockwise in this frame, which
 * visually stays anticlockwise once the arc is on screen (the minus above is
 * exactly what keeps that true) - and SVG's own sweep flag calls that
 * direction `0`. A negative delta walks the other way and flips it. The
 * large-arc flag is the ordinary one: whichever direction is walked, going
 * further than a half turn is the "large" arc.
 *
 * **Exported only so it can be tested.** Nothing outside this file calls it, and
 * it is the one piece of the renderer that is arithmetic rather than markup -
 * two reviewers have now re-derived the minus and the two flags by hand to
 * satisfy themselves it is right, which is exactly the work a test is for.
 * `diagram.test.ts` asserts where the endpoints land rather than the string, so
 * a change to how the numbers are formatted is not a failure.
 */
export function arcPath(mark: Extract<Mark, { kind: 'arc' }>): string {
  const [cx, cy] = mark.at;
  const start = pointOnArc(cx, cy, mark.radius, mark.from);
  const end = pointOnArc(cx, cy, mark.radius, mark.to);
  const delta = mark.to - mark.from;
  const largeArc = Math.abs(delta) % 360 > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 0 : 1;
  return `M ${start[0]} ${start[1]} A ${mark.radius} ${mark.radius} 0 ${largeArc} ${sweep} ${end[0]} ${end[1]}`;
}

function pointOnArc(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy - radius * Math.sin(radians)];
}
