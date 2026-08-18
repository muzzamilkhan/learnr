'use client';

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
 * The labels are turned on their side, and that is the whole reason they fit.
 * A topic name is several words long and a year's worth of topics puts a dozen
 * bars on a chart the width of a panel, so laid flat they collided into each
 * other however they were wrapped. Turned vertical they cannot collide at all:
 * what limits them is the height reserved below the axis, which is one number
 * and the same for every bar.
 */
const LABEL_HEIGHT = 124;

/** Roughly what a 12px label gets through in `LABEL_HEIGHT` pixels. */
const MAX_CHARS = 18;

function elide(text: string, max = MAX_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function TopicTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  return (
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
        {elide(String(payload?.value ?? ''))}
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
  return (
    <div style={{ height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            interval={0}
            height={LABEL_HEIGHT}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={<TopicTick />}
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
