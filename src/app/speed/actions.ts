'use server';

import { api } from '@/api';
import { timed } from '@/timing';

/**
 * A parent dismissing the "new record" banner, and nothing else.
 *
 * Submitting a run left this file when the browser started calling the API
 * directly (`src/browser-api.ts`): a run is on the path where a round trip is
 * something a child can feel, and this is not - it is a grown-up tapping a
 * banner away on a screen with no clock running.
 *
 * It does not call `auth()`. The session read it used to open with was a Neon
 * round trip whose only outcome was an early return, and
 * `DELETE /speed/unseen/:childId` gates on `requireParent`, which refuses the
 * same caller on the far side anyway.
 */

export async function dismissRecordsAction(childId: string): Promise<void> {
  return timed('action dismissRecords', () => dismissRecords(childId));
}

async function dismissRecords(childId: string): Promise<void> {
  await api.dismissRecords(childId);
}
