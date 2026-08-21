import type { ReactNode } from 'react';
import { ScoreTabs } from '@/components/score-tabs';

/**
 * The same two tabs at the parent's density, inside the report's shell.
 *
 * `ParentShell` already carries the title, the nav and the profile menu, so
 * all this layout adds is the pair of tabs - a parent's own cabinet and the
 * family board are the same one screen here as they are for a child.
 *
 * `/progress/speed/records` and `/progress/speed/leaderboard` are unchanged:
 * a route group adds no path segment, so both are still static segments
 * winning over `/progress/speed/[op]`, and `useParentScreen` still sees the
 * `/progress/speed` prefix that lights "Speed run" in the nav above.
 */
export default function ParentScoresLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mb-4">
        <ScoreTabs basePath="/progress/speed" scale="parent" />
      </div>
      {children}
    </>
  );
}
