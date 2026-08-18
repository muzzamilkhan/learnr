'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * How much of each topic has been answered, and how much of that was right.
 * Height is questions and the filled part is correct answers.
 *
 * The unfilled part is line grey rather than `--color-wrong` on purpose: it is
 * "the rest of the questions", not a column of failures. A parent's screen full
 * of red bars is a different message from the one this app is trying to send,
 * and the topics actually worth worrying about are named underneath.
 */

export interface TopicBar {
  /**
   * The topic, with its year appended when the child has practised that topic at
   * more than one - the same topic recurs across years, so it is the caller's job
   * to hand these over already distinct.
   */
  label: string;
  correct: number;
  wrong: number;
}

/**
 * Declared rather than left to the container: ResponsiveContainer renders
 * nothing until it mounts, and without a height the whole page jumps when it does.
 * Tall enough that the rotated labels below take their room out of the page
 * rather than out of the bars.
 */
const HEIGHT = 300;

/**
 * Which way the labels run is a question about width, so it is asked of the
 * viewport rather than decided once. On a phone the panel is a few hundred
 * pixels across and a dozen topics leave a bar barely wider than a letter, so
 * the labels are turned on their side: vertical they cannot collide at all, and
 * what limits them is the height reserved below the axis, which is one number
 * and the same for every bar. On a laptop there is room to lay them flat, which
 * is the way a label is read without tilting your head, so that is what a wide
 * screen gets.
 */
const DESKTOP = '(min-width: 768px)';

/** Room below the axis for the labels, in each of the two orientations. */
const LABEL_HEIGHT = { vertical: 124, horizontal: 34 };

/** Roughly what a 12px label gets through in `LABEL_HEIGHT.vertical` pixels. */
const MAX_CHARS = 18;

/** About what one character of the 12px label costs, for the flat-label budget. */
const CHAR_WIDTH = 6.6;

/** Kept clear of the label next door, so two flat labels never touch. */
const LABEL_GAP = 8;

/**
 * Below this a flat label is elided down to nothing worth reading, so a wide
 * screen with a great many topics on it turns them back on their side rather
 * than ruling a row of stumps under the axis. Horizontal is what a desktop
 * gets when horizontal fits.
 */
const MIN_CHARS = 6;

/** The gutter the value axis and the chart's own margins take out of the width. */
const NON_PLOT_WIDTH = 36 + 8;

function elide(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * The server has no viewport, so it renders the narrow layout and the client
 * corrects it - the same shape as the streak on the profile menu. Recharts
 * draws nothing until it mounts either way, so nothing is seen twice.
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

/** The rendered width of the chart, which is what a flat label has to fit into. */
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function TopicTick({
  x = 0,
  y = 0,
  payload,
  vertical,
  maxChars,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  vertical: boolean;
  maxChars: number;
}) {
  const text = elide(String(payload?.value ?? ''), maxChars);

  return vertical ? (
    // Rotated about the tick, anchored at its end, so the text runs downwards
    // from the axis and reads bottom-to-top - the way an axis label is read.
    <g transform={`translate(${x},${y + 8})`}>
      <text
        transform="rotate(-90)"
        textAnchor="end"
        dominantBaseline="central"
        fill="var(--color-ink-soft)"
        fontSize={12}
      >
        {text}
      </text>
    </g>
  ) : (
    <g transform={`translate(${x},${y + 8})`}>
      <text
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="var(--color-ink-soft)"
        fontSize={12}
      >
        {text}
      </text>
    </g>
  );
}

interface TooltipDatum {
  dataKey?: string | number;
  value?: number;
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipDatum[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const correct = payload.find((item) => item.dataKey === 'correct')?.value ?? 0;
  const wrong = payload.find((item) => item.dataKey === 'wrong')?.value ?? 0;
  const total = correct + wrong;

  return (
    <div className="rounded-lg border border-(--color-line) bg-(--color-card) px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-(--color-ink-soft)">
        {correct} of {total} right
        {total > 0 ? ` · ${Math.round((correct / total) * 100)}%` : ''}
      </p>
    </div>
  );
}

export function TopicBars({ data }: { data: TopicBar[] }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const isDesktop = useIsDesktop();

  /**
   * A flat label is bounded by the bar it sits under, not by the height below
   * the axis, so its budget has to be measured rather than declared: how many
   * characters fit is the plot divided by the number of topics. The tooltip
   * still names the topic in full, which is what makes eliding safe.
   */
  const band = data.length > 0 ? Math.max(width - NON_PLOT_WIDTH, 0) / data.length : 0;
  const flatChars = Math.floor(Math.max(band - LABEL_GAP, 0) / CHAR_WIDTH);
  const vertical = !isDesktop || flatChars < MIN_CHARS;
  const maxChars = vertical ? MAX_CHARS : flatChars;

  return (
    <div ref={box} style={{ height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            interval={0}
            height={vertical ? LABEL_HEIGHT.vertical : LABEL_HEIGHT.horizontal}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={<TopicTick vertical={vertical} maxChars={maxChars} />}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-brand-soft)', opacity: 0.5 }} />
          <Bar dataKey="correct" stackId="questions" fill="var(--color-right)" />
          <Bar dataKey="wrong" stackId="questions" fill="var(--color-line)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
