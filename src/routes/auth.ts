import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../auth/plugin.js';
import { readAccount, redeemLoginCode } from '../data/accounts.js';
import { errorSchema } from '../schemas/common.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * The whole of the iOS sign-in surface. The code is spent at redemption and
   * the session it buys does not expire on a schedule: the window protects the
   * handoff from parent to child, and once the child is in they stay in.
   */
  app.post('/auth/redeem', {
    schema: {
      body: z.object({ code: z.string().min(1).max(16) }),
      response: {
        200: z.object({
          token: z.string(),
          childId: z.string(),
          expiresAt: z.string(),
        }),
        401: errorSchema,
      },
    },
  }, async (request, reply) => {
    const redeemed = await redeemLoginCode(request.body.code);
    if (!redeemed) return reply.code(401).send({ error: 'That code did not work' });

    return reply.send({
      token: redeemed.token,
      childId: redeemed.userId,
      expiresAt: redeemed.expires.toISOString(),
    });
  });

  app.get('/me', {
    schema: { response: { 200: z.unknown(), 503: errorSchema } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const account = await readAccount(userId);
    if (!account) return reply.code(503).send({ error: 'Could not read the account' });
    return reply.send(account);
  });
};
