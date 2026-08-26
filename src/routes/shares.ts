import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import {
  acceptShareInvite,
  cancelShareInvite,
  leaveShare,
  listPendingInvites,
  listSharedViewers,
  createShareInvite,
  revokeShare,
} from '../data/sharing.js';

export const shareRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/shares', {
    schema: {
      response: {
        200: z.object({ invites: z.array(z.unknown()), viewers: z.array(z.unknown()) }),
        503: errorSchema,
      },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const [invites, viewers] = await Promise.all([
      listPendingInvites(parentId),
      listSharedViewers(parentId),
    ]);

    if (invites === null || viewers === null) {
      return reply.code(503).send({ error: 'Could not read the sharing' });
    }

    return reply.send({ invites, viewers });
  });

  app.post('/shares', {
    schema: {
      body: z.object({ childIds: z.array(z.string()).min(1) }),
      response: {
        201: z.object({ token: z.string(), expiresAt: z.string() }),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const invite = await createShareInvite(parentId, request.body.childIds);
    if (!invite) return reply.code(400).send({ error: 'Could not create the link' });
    return reply.code(201).send({ token: invite.token, expiresAt: invite.expiresAt.toISOString() });
  });

  app.delete('/shares/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null(), 404: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await cancelShareInvite(parentId, request.params.id);
    if (!ok) return reply.code(404).send({ error: 'No such link' });
    return reply.code(204).send(null);
  });

  /**
   * The token authorizes the call, so this is one of the two deliberate
   * exceptions to ownership-as-where: the caller need only be signed in.
   */
  app.post('/shares/:token/accept', {
    schema: { params: z.object({ token: z.string() }), response: { 200: z.unknown() } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const result = await acceptShareInvite(request.params.token, userId);
    return reply.send(result);
  });

  app.delete('/shares/viewers/:viewerId', {
    schema: {
      params: z.object({ viewerId: z.string() }),
      querystring: z.object({ childId: z.string().optional() }),
      response: { 204: z.null(), 404: errorSchema },
    },
  }, async (request, reply) => {
    const parentId = await requireParent(request);
    const ok = await revokeShare(parentId, request.params.viewerId, request.query.childId);
    if (!ok) return reply.code(404).send({ error: 'No such grant' });
    return reply.code(204).send(null);
  });

  app.delete('/shares/mine/:childId', {
    schema: {
      params: z.object({ childId: z.string() }),
      response: { 204: z.null(), 404: errorSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const ok = await leaveShare(userId, request.params.childId);
    if (!ok) return reply.code(404).send({ error: 'No such grant' });
    return reply.code(204).send(null);
  });
};
