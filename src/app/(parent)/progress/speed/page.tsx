import { SpeedCards } from '@/components/speed-cards';
import { Well } from '@/components/well';
import { readParent } from '../../parent';

// Per-parent, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

/**
 * The chooser for a parent's own runs - the twenty-six modes, the same
 * cards the child's home screen offers, pointed at `/progress/speed/...`
 * instead of `/speed/...`. Without this page the nav's "Speed run" item had
 * nowhere honest to land: it went straight to one arbitrary mode, and nothing
 * in the `(parent)` tree linked to the other twenty-six - a parent wanting
 * their own 7 times table had to hand-edit the URL.
 *
 * `readParent` is called here rather than trusted from the layout, for the
 * same reason `/progress`, `/children` and the speed pages beneath this one
 * call it too: the layout is a frame and not a gate, so it does not re-run on
 * a client-side hop between screens.
 */
export default async function ParentSpeedChooserPage() {
  await readParent();

  return (
    <Well title="Speed run">
      <SpeedCards
        basePath="/progress/speed"
        recordsHref="/progress/speed/records"
        scale="parent"
      />
    </Well>
  );
}
