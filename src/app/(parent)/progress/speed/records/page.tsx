import { SpeedRecordsCabinet } from '@/components/speed-records';
import { readSpeedAttempts } from '@/lib/speed-records';
import { readParent } from '../../../parent';

// Per-player runs, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The parent's own cabinet, at the parent scale. The heading, nav and profile
 * menu come from the layout - same as `/children` - so a hop here from
 * `/progress/speed/<op>`'s result screen replaces only what sits below them.
 *
 * `/progress/speed/records` is a static segment and wins over
 * `/progress/speed/[op]` in Next's routing, matching the child's
 * `/speed/records` precedent.
 */
export default async function ParentSpeedRecordsPage() {
  const { userId } = await readParent();
  const attempts = await readSpeedAttempts(userId);

  return <SpeedRecordsCabinet attempts={attempts} scale="parent" />;
}
