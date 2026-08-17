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
   * more than one — the same topic recurs across years, so it is the caller's job
   * to hand these over already distinct.
   */
  label: string;
  correct: number;
  wrong: number;
}

/**
 * Declared rather than left to the container: ResponsiveContainer renders
 * nothing until it mounts, and without a height the whole page jumps when it does.
 */
const HEIGHT = 260;

/** Two lines at most, and two budgets: a line that would still run past the bar is elided. */
function wrap(text: string, max = 12): string[] {
  const lines: string[] = [];

  for (const word of text.split(' ')) {
    const line = lines.length - 1;
    if (line >= 0 && lines[line].length + word.length + 1 <= max) lines[line] += ` ${word}`;
    else if (lines.length < 2) lines.push(word);
    else lines[line] += ` ${word}`;
  }

  // The line count was never the whole budget — width is the half that actually
  // makes labels collide, so anything still over it is elided rather than drawn.
  return lines.map((line) => (line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`));
}

function TopicTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  return (
    <g transform={`translate(${x},${y + 12})`}>
      {wrap(String(payload?.value ?? '')).map((line, index) => (
        <text
          key={line + index}
          textAnchor="middle"
          fill="var(--color-ink-soft)"
          fontSize={12}
          y={index * 14}
        >
          {line}
        </text>
      ))}
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
    <div className="rounded-xl border-2 border-(--color-line) bg-(--color-card) px-4 py-3 shadow-lg">
      <p className="text-lg font-semibold">{label}</p>
      <p className="text-base text-(--color-ink-soft)">
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
            height={44}
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
