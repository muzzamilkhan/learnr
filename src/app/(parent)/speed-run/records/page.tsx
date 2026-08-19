import { SpeedRecordsCabinet } from '@/components/speed-records';
import { readSpeedRecords } from '@/lib/speed-records';
import { readParent } from '../../parent';

// Per-player bests, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The parent's own cabinet, at the parent scale. The heading, nav and profile
 * menu come from the layout - same as `/children` - so a hop here from
 * `/speed-run/<op>`'s result screen replaces only what sits below them.
 *
 * `/speed-run/records` is a static segment and wins over `/speed-run/[op]` in
 * Next's routing, matching the child's `/speed/records` precedent.
 */
export default async function ParentSpeedRecordsPage() {
  const { userId } = await readParent();
  const bests = await readSpeedRecords(userId);

  return <SpeedRecordsCabinet bests={bests} scale="parent" />;
}
