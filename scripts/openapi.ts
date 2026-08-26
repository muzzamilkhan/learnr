import { writeFile, mkdir } from 'node:fs/promises';
import { dump } from 'js-yaml';
import { buildServer } from '../src/server.js';

/**
 * The contract is generated, never hand-written: the zod schemas the routes
 * already validate against are the single source of truth, so a route and its
 * documented shape cannot disagree.
 */
export async function writeOpenApi(): Promise<string> {
  const app = buildServer();
  await app.ready();

  const document = app.swagger();
  await mkdir('contract', { recursive: true });
  await writeFile('contract/openapi.yaml', dump(document), 'utf8');

  await app.close();
  return 'contract/openapi.yaml';
}

writeOpenApi().then((path) => console.log(`Wrote ${path}`));
