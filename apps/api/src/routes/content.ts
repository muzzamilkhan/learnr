import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { parseYearLevel } from '@learnr/core/curriculum';
import { CONTENT_MANIFEST, contentPack } from '@learnr/core/content/packs';
import { errorSchema } from '../schemas/common.js';
import { contentManifestSchema, contentPackSchema } from '../schemas/dto.js';

/**
 * The shipped question templates, for a client that cannot import TypeScript.
 *
 * **These two are public, and that is deliberate.** Content is not personal
 * data - the web app's landing page already renders coverage from these very
 * templates to a signed-out visitor - and public is what lets a device cache
 * hold a pack and lets iOS warm its bundled copy before a child has signed in.
 * The route is public by simply never calling `requireUser`, the way
 * `GET /shares/:token` is.
 *
 * The packs ship inside the bundle: esbuild inlines an imported JSON file, so
 * there is no path to resolve at runtime and the Docker build context - which
 * is the repository root, for the symlink's sake - never enters into it.
 */
export const contentRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/content/manifest', {
    // 304 is declared `z.undefined()` rather than left off the map: the
    // route always calls `.send()` with no argument for it - Fastify's own
    // `send()` short-circuits on an undefined payload before serialization
    // ever runs, which is what keeps a 304 genuinely bodyless - and the
    // declaration is what lets that no-argument call typecheck at all,
    // since a code absent from `response` isn't one `reply.code()` accepts.
    schema: {
      operationId: 'readContentManifest',
      headers: z.object({ 'if-none-match': z.string().optional() }),
      response: { 200: contentManifestSchema, 304: z.undefined() },
    },
  }, async (request, reply) => {
    const etag = `"${CONTENT_MANIFEST.version}"`;
    if (request.headers['if-none-match'] === etag) {
      return reply.header('etag', etag).code(304).send();
    }

    return reply
      .header('etag', etag)
      .header('cache-control', 'public, max-age=0, must-revalidate')
      .send(CONTENT_MANIFEST);
  });

  app.get('/content/:subject/:level', {
    schema: {
      operationId: 'readContentPack',
      params: z.object({ subject: z.string(), level: z.string() }),
      headers: z.object({ 'if-none-match': z.string().optional() }),
      response: { 200: contentPackSchema, 304: z.undefined(), 404: errorSchema },
    },
  }, async (request, reply) => {
    // The same boundary parser every other reader of a year uses, so `k` and
    // `03` mean what they mean everywhere else and nothing else gets through.
    const level = parseYearLevel(request.params.level);
    if (!level) return reply.code(404).send({ error: 'No such level' });

    const pack = contentPack(request.params.subject, level);
    if (!pack) return reply.code(404).send({ error: 'No such content' });

    const etag = `"${pack.version}"`;
    if (request.headers['if-none-match'] === etag) {
      return reply.header('etag', etag).code(304).send();
    }

    return reply
      .header('etag', etag)
      .header('cache-control', 'public, max-age=0, must-revalidate')
      .send(pack);
  });
};
