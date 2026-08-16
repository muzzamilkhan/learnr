'use server';

import { auth } from '@/auth';
import { writeSelectedLevel } from '@/lib/records';
import { parseYearLevel } from '@/lib/curriculum';

/**
 * The home screen's level picker is usable before this resolves — remembering the
 * choice is a convenience, so a signed-out child or a failed write costs the
 * memory, not the pick.
 */
export async function saveSelectedLevelAction(level: string): Promise<void> {
  const parsed = parseYearLevel(level);
  if (!parsed) return;

  const session = await auth();
  if (!session?.user?.id) return;

  await writeSelectedLevel(session.user.id, parsed);
}
