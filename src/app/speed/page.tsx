import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth-buttons';
import { ParentShell } from '@/components/parent-shell';
import { ProfileMenu } from '@/components/profile-menu';
import { SpeedCards } from '@/components/speed-cards';
import { SpeedScores } from '@/components/speed-scores';
import { Well } from '@/components/well';
import {
  CHILD_SPEED_HREF,
  PARENT_DEFAULT_TAB,
  PARENT_SPEED_HREF,
} from '@/lib/speedrun/tabs';
import { readParent, readViewer } from '../(parent)/parent';

// Per-viewer: which screen this even is depends on who is asking, so it must
// never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The speed run screen, for whoever is signed in.
 *
 * **One route, branching on the reader rather than on the URL.** A parent's
 * speed screens used to live at `/progress/speed`, nested under the report on
 * the argument that a bare `(parent)/speed` would sit beside the child's
 * `/speed/...` as a second top-level path - two URLs told apart only by
 * spelling, where a copied `href` that got them backwards would produce no build
 * error and no failing test. That argument is answered by there being one path
 * now instead of two: a parent and a child asking for `/speed` are asking the
 * same question, and the difference between the answers is a frame and a
 * density, not an address.
 *
 * **A child is sent on to their own screen rather than served here.** Their
 * speed screen *is* their home screen - the scores and the five cards sit under
 * "Speed run" below practice - and drawing that a second time at `/speed` would
 * be two screens showing one thing, which is the very duplication removing
 * `/speed` fixed the first time. So this redirects and `CHILD_SPEED_HREF` stays
 * the one place a child's speed section is named. A signed-out visitor goes the
 * same way, landing on the page that offers them a way in.
 *
 * The shell is drawn here rather than inherited, because this route sits outside
 * the `(parent)` group - it has to, since that group adds no path segment and
 * `/speed` is the path. `ParentNav` reads the URL for which item is current, so
 * the nav highlights "Speed run" from here exactly as it did from under
 * `/progress`.
 */
export default async function SpeedScreen({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { account } = await readViewer();
  if (account?.role !== 'parent') redirect(CHILD_SPEED_HREF);

  const tab = (await searchParams).tab;
  // Past the role check, so this cannot redirect: it re-reads nothing, being
  // the same cached call the branch above already made.
  const { userId, name, image, viewable } = await readParent();

  // A parent doesn't play for stars, so the menu counts nothing - the same two
  // nulls the parent layout passes.
  const menu = (
    <ProfileMenu name={name} image={image} streak={null} stars={null}>
      <SignOutButton />
    </ProfileMenu>
  );

  return (
    <ParentShell profiles={viewable ?? []} title="LearnR" menu={menu}>
      <div className="space-y-4">
        <Well title="Scores">
          {/* The tabs and the runs share a path here, where a child's do not: a
              parent's scores and a parent's runs are both under this screen. */}
          <SpeedScores
            tab={tab}
            defaultTab={PARENT_DEFAULT_TAB}
            tabPath={PARENT_SPEED_HREF}
            runPath={PARENT_SPEED_HREF}
            userId={userId}
            scale="parent"
          />
        </Well>

        <Well title="Start a run">
          <SpeedCards basePath={PARENT_SPEED_HREF} scale="parent" />
        </Well>
      </div>
    </ParentShell>
  );
}
