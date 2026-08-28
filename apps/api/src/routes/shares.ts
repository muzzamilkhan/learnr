import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireParent, requireUser } from '../auth/plugin.js';
import { errorSchema } from '../schemas/common.js';
import { acceptResultSchema, inviteDetailsSchema, sharesSchema } from '../schemas/dto.js';
import {
  acceptShareInvite,
  cancelShareInvite,
  leaveShare,
  listPendingInvites,
  listSharedViewers,
  createShareInvite,
  readShareInvite,
  revokeShare,
} from '../data/sharing.js';

export const shareRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/shares', {
    schema: {
      operationId: 'readShares',
      response: {
        200: sharesSchema,
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
      operationId: 'createShareInvite',
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

  /**
   * What a link is offering, for the page whose whole job is to say "accept
   * this?". Read-only and it does not spend the link - following your own link
   * to check it must not burn it.
   *
   * **The one route here with no session at all**, and it has to be: a share
   * link's whole point is that it reaches somebody who has no account here yet.
   * They read who is offering and which children, and signing in *is* the
   * acceptance - so putting this behind a session would gate the page on the
   * very thing following the link is meant to produce.
   *
   * What makes that safe is that the token authorises it and nothing else does:
   * this says first names and year levels, which is what someone needs to
   * recognise an invitation meant for them, and nothing about how anyone is
   * going. The report is behind `POST /shares/:token/accept`, which is signed
   * in and spends the link.
   */
  app.get('/shares/:token', {
    schema: {
      operationId: 'readShareInvite',
      params: z.object({ token: z.string() }),
      response: { 200: inviteDetailsSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const invite = await readShareInvite(request.params.token);
    if (!invite) return reply.code(404).send({ error: 'No such link' });
    return reply.send(invite);
  });

  app.delete('/shares/:id', {
    schema: {
      operationId: 'cancelShareInvite',
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
    schema: {
      operationId: 'acceptShareInvite',
      params: z.object({ token: z.string() }),
      response: { 200: acceptResultSchema },
    },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const result = await acceptShareInvite(request.params.token, userId);
    return reply.send(result);
  });

  app.delete('/shares/viewers/:viewerId', {
    schema: {
      operationId: 'revokeShare',
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
      operationId: 'leaveShare',
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
