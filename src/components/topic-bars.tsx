'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisLabels, CHART_INSETS, LABEL_ANGLE } from '@/lib/chart/axis-labels';

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
 * Tall enough that the tilted labels below take their room out of the page
 * rather than out of the bars.
 */
const HEIGHT = 300;

/**
 * Which way the labels run is a question about width, so it is asked of the
 * viewport rather than decided once. On a phone the panel is a few hundred
 * pixels across and a dozen topics leave a bar barely wider than a letter, so
 * a flat label has nowhere to go and the labels are tilted instead. On a laptop
 * there is room to lay them flat, which is the way a label is read with no tilt
 * at all, so that is what a wide screen gets. `axisLabels` is where the two are
 * chosen between, and the geometry behind it is tested there.
 */
const DESKTOP = '(min-width: 768px)';

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

/** The rendered width of the chart, which is what the labels have to fit into. */
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
  angled,
  maxChars,
  fontSize,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  angled: boolean;
  maxChars: number;
  fontSize: number;
}) {
  const text = elide(String(payload?.value ?? ''), maxChars);

  return angled ? (
    // Rotated about the tick and anchored at its **end**, so the label leans up
    // and to the left away from the bar it names and finishes directly under
    // it. Which bar a name belongs to is the one thing a tilted axis can get
    // wrong, and anchoring the end is what settles it: the name stops where the
    // bar is, rather than starting there and drifting over its neighbours.
    <g transform={`translate(${x},${y + 10})`}>
      <text
        transform={`rotate(-${LABEL_ANGLE})`}
        textAnchor="end"
        dominantBaseline="central"
        fill="var(--color-ink-soft)"
        fontSize={fontSize}
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
        fontSize={fontSize}
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
   * The labels are laid out against the box they are actually in rather than a
   * declared worst case: which way they run, what size they are set at, how
   * long a name may be, how much of the height they take and how much room they
   * are left to lean into all fall out of the measured width. The tooltip still
   * names the topic in full, which is what makes eliding safe.
   */
  const longestChars = data.reduce((longest, bar) => Math.max(longest, bar.label.length), 0);
  const labels = axisLabels({ width, count: data.length, longestChars, wide: isDesktop });

  return (
    <div ref={box} style={{ height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        {/* The left margin is the gutter a tilted label leans into - blank above
            the axis and full of names below it. An SVG clips at its own edge,
            so without it the leftmost name would simply lose its first half. */}
        <BarChart
          data={data}
          margin={{ top: 8, right: CHART_INSETS.right, left: labels.gutter, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            interval={0}
            height={labels.height}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={
              <TopicTick
                angled={labels.angled}
                maxChars={labels.maxChars}
                fontSize={labels.fontSize}
              />
            }
          />
          <YAxis
            allowDecimals={false}
            width={CHART_INSETS.valueAxis}
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
