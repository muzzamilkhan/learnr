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
 * **Stroke width is pinned in real pixels, not viewBox units.** The two places
 * this renders are a five-times difference in size, and a width declared in
 * viewBox units scales with the box like everything else drawn in it - bold on
 * the play screen, close to a hairline at 64px. `vectorEffect:
 * 'non-scaling-stroke'` keeps the line the same weight everywhere instead,
 * which matches how the rest of the app draws a line: every card, pad and
 * button here is `border-2` regardless of the screen it is on, never a border
 * that thickens with the box it sits in.
 */

/** In real pixels, via `vectorEffect="non-scaling-stroke"` - see above. */
const STROKE_WIDTH = 2;
const DASH = '6 4';

/** A marked vertex. Viewbox units, so it shrinks with the drawing like the
 * shape itself rather than staying a fixed dot on a shrunk figure. */
const DOT_RADIUS = 2.5;

/** No template emits a `label` mark yet (`types.ts`) - sized so the day one
 * does, this reads rather than being retuned then. */
const LABEL_SIZE = 10;

export function Diagram({ figure, className }: { figure: Figure; className?: string }) {
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
        <MarkShape key={index} mark={mark} />
      ))}
    </svg>
  );
}

function MarkShape({ mark }: { mark: Mark }) {
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
      const dash = mark.dashed ? DASH : undefined;
      return mark.closed ? (
        <polygon
          points={points}
          fill={fill}
          stroke="var(--color-ink)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline
          points={points}
          fill={fill}
          stroke="var(--color-ink)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
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
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );

    case 'dot':
      return <circle cx={mark.at[0]} cy={mark.at[1]} r={DOT_RADIUS} fill="var(--color-ink)" />;

    case 'label':
      return (
        <text
          x={mark.at[0]}
          y={mark.at[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={LABEL_SIZE}
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
 */
function arcPath(mark: Extract<Mark, { kind: 'arc' }>): string {
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
