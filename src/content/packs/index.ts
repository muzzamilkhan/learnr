import type { YearLevel } from '../../lib/curriculum';
import type { ContentManifest, ContentPack } from '../../lib/dto';
import manifest from './manifest.json';
import mathsK from './maths.K.json';
import maths1 from './maths.1.json';
import maths2 from './maths.2.json';
import maths3 from './maths.3.json';
import maths4 from './maths.4.json';
import maths5 from './maths.5.json';
import maths6 from './maths.6.json';
import englishK from './english.K.json';
import english1 from './english.1.json';
import english2 from './english.2.json';
import english3 from './english.3.json';
import english4 from './english.4.json';
import english5 from './english.5.json';
import english6 from './english.6.json';

/**
 * The generated content packs, and the one place the JSON is imported.
 *
 * The packs are written by `scripts/build-content.ts` from the TypeScript
 * literals under `maths/` and `english/`, which stay the thing an author
 * edits - `packs.test.ts` fails if the two disagree by a byte. Everything
 * downstream reads them from here: `catalog.ts` for the web app, and the
 * API's `/content` routes for a client that cannot import TypeScript.
 *
 * **The order is maths K-6 then english K-6**, which is the order
 * `allTemplates` has always had.
 *
 * The cast is the boundary. JSON widens `level` to `string` and a figure's
 * `kind` with it, and what stands behind the cast is not optimism: the
 * generator refuses to write a pack that fails `validateTemplates`, the drift
 * test holds these bytes to the literals, and `catalog.test.ts` runs the whole
 * shipped-content suite over what this exports.
 */
const packs = [
  mathsK, maths1, maths2, maths3, maths4, maths5, maths6,
  englishK, english1, english2, english3, english4, english5, english6,
] as ContentPack[];

export const PACKS: readonly ContentPack[] = packs;

export const CONTENT_MANIFEST = manifest as ContentManifest;

/** The pack for one course, or undefined where no such course ships. */
export function contentPack(subject: string, level: YearLevel): ContentPack | undefined {
  return packs.find((pack) => pack.subject === subject && pack.level === level);
}
