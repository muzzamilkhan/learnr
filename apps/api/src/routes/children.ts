import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { parseAvatar } from '@learnr/core/avatars';
import { parseTarget } from '@learnr/core/rewards/target';
import { parsePhoto } from '@learnr/core/photo/photo';
import { codeExpiry } from '@learnr/core/login-code';
import { requireParent } from '../auth/plugin.js';
import { childInputSchema, loginCodeSchema } from '../schemas/account.js';
import { errorSchema } from '../schemas/common.js';
import { readViewableChildren } from '../data/sharing.js';
import {
  createChild,
  issueLoginCode,
  listChildren,
  removeChild,
  updateChild,
  type ChildInput,
} from '../data/accounts.js';

/**
 * The wire carries an avatar name, a target as two loose columns and a photo as
 * a data URL; `ChildInput` wants an `Avatar`, a `DailyTarget` and a photo that
 * has been through `parsePhoto`. Each of those parsers is the one place its
 * value is allowed in, so the mapping happens here rather than being asserted
 * past - a request naming an avatar that does not exist is a bad request, not a
 * child with a broken face.
 */
function toChildInput(body: z.infer<typeof childInputSchema>): ChildInput | null {
  const avatar = parseAvatar(body.avatar);
  if (!avatar) return null;

  // A target is either absent on both columns or a valid pair; half a target is
  // a bad request rather than a child with no goal.
  const target = parseTarget(body.targetKind, body.targetValue);
  if (body.targetKind !== null && !target) return null;

  return {
    name: body.name,
    avatar,
    photo: parsePhoto(body.photo),
    level: body.level,
    target,
  };
}

export const childRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/children', {
    schema: { response: { 200: z.array(z.unknown()), 503: errorSchema } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const children = await listChildren(parentId);

    // null is a failed read, [] is a parent with no children. They must not
    // look the same to the screen that renders them.
    if (children === null) return reply.code(503).send({ error: 'Could not read the children' });

    return reply.send(children);
  });

  /**
   * Own children *plus* the ones shared with this parent. Every parent screen
   * resolves `?child=` against this list, so a child not in it is not reachable
   * by typing its id - there is no separate ownership check to drift out of
   * step with the query that produced the list.
   *
   * Deliberately not folded into GET /children, which is the owned list the
   * dashboard's edit controls act on. Serving the owned list here would quietly
   * drop a shared child from every screen that reads it.
   */
  app.get('/children/viewable', {
    schema: { response: { 200: z.array(z.unknown()), 503: errorSchema } },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const children = await readViewableChildren(parentId);

    if (children === null) return reply.code(503).send({ error: 'Could not read the children' });

    return reply.send(children);
  });

  app.post('/children', {
    schema: {
      body: childInputSchema,
      response: { 201: z.object({ id: z.string() }), 400: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);

    const input = toChildInput(request.body);
    if (!input) return reply.code(400).send({ error: 'Could not add that child' });

    const id = await createChild(parentId, input);
    if (!id) return reply.code(400).send({ error: 'Could not add that child' });
    return reply.code(201).send({ id });
  });

  app.patch('/children/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: childInputSchema,
      response: { 204: z.null(), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);

    const input = toChildInput(request.body);
    if (!input) return reply.code(400).send({ error: 'Could not change that child' });

    const ok = await updateChild(parentId, request.params.id, input);
    if (!ok) return reply.code(404).send({ error: 'No such child' });
    return reply.code(204).send(null);
  });

  app.delete('/children/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null(), 404: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await removeChild(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: 'No such child' });
    return reply.code(204).send(null);
  });

  app.post('/children/:id/login-code', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: loginCodeSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);

    // The same `now` the code was minted against, so the expiry reported is the
    // one stored rather than an hour guessed at here.
    const now = new Date();
    const code = await issueLoginCode(parentId, request.params.id, now);
    if (!code) return reply.code(404).send({ error: 'No such child' });

    return reply.send({ code, expiresAt: codeExpiry(now).toISOString() });
  });
};
