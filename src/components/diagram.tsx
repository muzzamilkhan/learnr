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
 * **`label` cannot be derived off `strokeWidth` the way the dot and the dash
 * are, and is a second prop (`labelSize`) instead.** SVG 2 defines
 * `vector-effect: non-scaling-size`, which would cover `font-size` the way
 * `non-scaling-stroke` covers a line - but no shipping engine implements it,
 * so a `<text>` here scales with the viewBox like an unmarked coordinate, and
 * true scale-independence would still need a measured counter-transform (a
 * `ResizeObserver`, the way `Prompt` in `play-session.tsx` measures its own
 * box) that nothing here builds. `strokeWidth` looked like a substitute
 * signal - the caller already picks a bigger one for the bigger box - but it
 * is a real-pixel line weight, not a proxy for box size, and treating it as
 * one is exactly the mistake this comment used to make: deriving `labelSize`
 * from it (either direction) means a `strokeWidth` chosen for purely visual
 * weight - a thicker line for emphasis, a hairline for a crisper report row -
 * silently resizes every label on the figure, which is not what either edit
 * is about and not what either caller would expect. `strokeWidth` is a prop
 * "because it is the caller who knows which of the two very differently sized
 * places this is" (above); that argument applies to the label exactly as it
 * applies to the line, so `labelSize` is the same kind of prop, set
 * independently by each caller - roughly 7 on the play screen, roughly 16 in
 * a report thumbnail, which is what a divide-by-`strokeWidth` formula once
 * computed here, kept as plain numbers now that nothing ties them to
 * `strokeWidth`'s value. Across the range of real device sizes this still
 * only narrows the two sites' rendered label size to roughly 2.3-3.6:1 apart
 * rather than equalising it - a caller choosing these numbers is estimating
 * its own box, the same approximation the derivation used to make, just made
 * by a human who can see the screen instead of a formula that cannot. Below
 * roughly a 150px play-screen box the two sites' ratio inverts (the play
 * figure, this small, needs *more* real pixels per label than the standing
 * report thumbnail, not fewer) - measurement is still the only fix for that,
 * and nothing here builds it.
 *
 * **A label's width in user units is not a constant, and geometry cannot see
 * `labelSize` to account for it.** At the report's `labelSize`, a two-digit
 * label is roughly 18 units wide in the figure's 100-unit box; at the play
 * screen's it is roughly 7 - a ~2.3x difference this renderer sees and
 * `src/lib/figures/` never will, since figures are built once, before either
 * caller has picked a `strokeWidth` or a `labelSize` (`buildFigure`'s
 * signature carries no scale). Any figure kind that places labels by geometry
 * - `bar`, `number-line` and `grid` among the kinds about to - has to leave
 * spacing for the *larger* (report) case, or ticks spaced correctly on the
 * play screen will collide once the same figure renders at report scale.
 */

export function Diagram({
  figure,
  strokeWidth,
  labelSize,
  className,
}: {
  figure: Figure;
  /**
   * Real pixels, via `vectorEffect="non-scaling-stroke"`. Roughly 3-4 on the
   * play screen, 1.5-2 in a report row - the caller's call, because it is the
   * caller who knows which of the two very differently sized places this is.
   */
  strokeWidth: number;
  /**
   * ViewBox units - `label` has no `vector-effect` equivalent to pin a real-
   * pixel size, so unlike `strokeWidth` this is not real pixels and does not
   * itself derive anything. Roughly 7 on the play screen, roughly 16 in a
   * report row - see the module comment for why it is a caller's estimate of
   * its own box rather than something computed from `strokeWidth`.
   */
  labelSize: number;
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
