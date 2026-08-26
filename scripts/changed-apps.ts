import { execFileSync } from 'node:child_process';

/**
 * Which halves of this repository a push has to move.
 *
 * The deploy workflow runs this before anything else, so a CSS tweak does not
 * roll the API and an API-only change does not rebuild the web app. It is a
 * separate file rather than a `case` statement inside the YAML because the
 * cost of getting it wrong is a half that silently does not ship, and a shell
 * fragment in a workflow is the one kind of code nobody can run at their desk.
 *
 * Node 24 runs TypeScript directly, so the workflow needs no `npm ci` to call
 * it - which is the whole reason this file imports nothing but `node:*`.
 */
export type ChangedApps = { api: boolean; web: boolean };

const both: ChangedApps = { api: true, web: true };

/**
 * Prose, and the fixture digests. Neither ships anywhere - the digests are not
 * in the Next bundle and not in the API's Docker context, which copies only
 * `src/lib`, `src/content`, `packages/core` and `apps/api` - so a regeneration
 * commit must not roll production for a test artifact.
 */
const IGNORED = [/\.md$/, /^docs\//, /^\.claude\//, /^\.superpowers\//, /^fixtures\//];

/** The API workspace and the things that put its image on Fly. */
const API_ONLY = ['apps/api/', 'fly.toml', '.dockerignore'];

/**
 * The engine, and the workspace root that installs it.
 *
 * These deploy **both** halves. `src/lib` and `src/content` ship inside the
 * Next bundle *and* inside the API image - `packages/core/src` is a symlink to
 * `src/` and the Dockerfile copies both directories - so moving one half
 * without the other leaves the two running different engine code. That is the
 * exact drift the symlink exists to prevent, and it must not come back in
 * through the deploy pipeline.
 */
const SHARED = [
  'src/lib/',
  'src/content/',
  'packages/',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
];

/** The Next app at the repository root, and the tooling that builds it. */
const WEB_ONLY = [
  'src/',
  'public/',
  'prisma/',
  'next.config.ts',
  'prisma.config.ts',
  'postcss.config.mjs',
  'eslint.config.mjs',
  'vercel.json',
  '.vercelignore',
];

/** A trailing slash is a directory prefix; anything else is a whole path. */
function matches(file: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}

/**
 * `null` means *could not tell*, never *nothing changed* - the same
 * distinction `src/api.ts` makes, and load-bearing for the same reason. A
 * force-push, a first push or a manual run leaves no base commit to diff
 * against, and answering "nothing" there would quietly ship neither half.
 *
 * A path matching no rule deploys both. Failing open costs a wasted deploy;
 * failing closed costs a change that never went out and said it did.
 */
export function changedApps(files: readonly string[] | null): ChangedApps {
  if (files === null) return { ...both };

  const result: ChangedApps = { api: false, web: false };
  for (const file of files) {
    if (!file || IGNORED.some((p) => p.test(file))) continue;
    if (matches(file, API_ONLY)) result.api = true;
    else if (matches(file, SHARED)) result.api = result.web = true;
    else if (matches(file, WEB_ONLY)) result.web = true;
    else result.api = result.web = true;
  }
  return result;
}

/** The diff a push covers, or `null` when there is no base commit to read. */
function changedFiles(base: string | undefined, head: string): string[] | null {
  const git = (args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  if (!base || /^0+$/.test(base)) return null;
  try {
    git(['cat-file', '-e', `${base}^{commit}`]);
  } catch {
    return null;
  }
  return git(['diff', '--name-only', base, head]).split('\n').filter(Boolean);
}

function main(): void {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  const files = changedFiles(base, head);
  const { api, web } = changedApps(files);

  console.error(files === null ? 'No base commit to diff against.' : files.join('\n'));
  console.error(`api=${api} web=${web}`);
  console.log(`api=${api}\nweb=${web}`);
}

if (process.argv[1]?.endsWith('changed-apps.ts')) main();
