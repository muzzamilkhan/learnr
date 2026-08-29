'use server';

import { readViewer } from '@/app/viewer';
import { dismissSpeedRecords } from '@/server/speed-records';

/**
 * A parent dismissing the "new record" banner, and nothing else.
 *
 * Submitting a run left this file when the browser started calling this app's
 * own route handlers directly (`src/browser-api.ts`): a run is on the path where
 * a round trip is something a child can feel, and this is not - it is a grown-up
 * tapping a banner away on a screen with no clock running.
 *
 * **It reads the session, and it has to.** It used to skip that read and let
 * `requireParent` refuse the wrong caller on the far side of the wire instead.
 * There is no far side now: `dismissSpeedRecords` scopes its `where` by
 * `parentId`, so the parent has to be resolved here for that scope to exist at
 * all. An action is its own request, so `readViewer`'s `cache` buys nothing
 * across from the render - this genuinely costs the session lookup and the
 * account read. It is a grown-up tapping a banner away with no clock running,
 * which is the one place in the app where that is the right trade.
 */

export async function dismissRecordsAction(childId: string): Promise<void> {
  const { userId, account } = await readViewer();
  if (!userId || account?.role !== 'parent') return;

  await dismissSpeedRecords(userId, childId);
}
