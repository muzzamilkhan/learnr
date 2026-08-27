import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createThrottle } from '@learnr/core/throttle';
import {
  REDEEM_BACKSTOP_LIMIT,
  REDEEM_FAILURE_WINDOW_MS,
} from '@learnr/core/login-code';
import { requireUser } from '../auth/plugin.js';
import { claimParentRole, readAccount, redeemLoginCode } from '../data/accounts.js';
import { errorSchema } from '../schemas/common.js';
import { accountSchema } from '../schemas/dto.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * Failed redemptions, per caller. Created per server rather than at module
   * scope so two servers in one process - which is what the tests build - do
   * not share a counter.
   */
  const redeemFailures = createThrottle({
    limit: REDEEM_BACKSTOP_LIMIT,
    windowMs: REDEEM_FAILURE_WINDOW_MS,
  });

  /**
   * Who is asking, for the throttle above.
   *
   * `fly-client-ip` is set by Fly's proxy and overwritten if a client sends
   * one, so it cannot be spoofed; `request.ip` is the socket address, which is
   * what a local run and the tests have. **For a web-app request this is
   * Vercel**, not the child - every browser shares one key here, which is the
   * whole reason this limit is a generous backstop and the per-browser one
   * lives in the web app's own action.
   */
  const caller = (request: { headers: Record<string, unknown>; ip: string }): string => {
    const forwarded = request.headers['fly-client-ip'];
    return typeof forwarded === 'string' && forwarded.length > 0 ? forwarded : request.ip;
  };

  /**
   * The whole of the iOS sign-in surface. The code is spent at redemption and
   * the session it buys does not expire on a schedule: the window protects the
   * handoff from parent to child, and once the child is in they stay in.
   *
   * **Throttled, because the code is the credential and this route is open.**
   * 31^4 is 923,521 codes, `redeemLoginCode` matches any live code rather than
   * one child's, and a hit buys a session that does not expire - so an
   * unbounded number of guesses is the one thing that turns a short code from
   * a deliberate trade into a hole. Only failures count and a success clears
   * the caller, so a child mistyping and then getting it right spends nothing.
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
        429: errorSchema,
      },
    },
  }, async (request, reply) => {
    const key = caller(request);
    const now = Date.now();

    if (redeemFailures.blocked(key, now)) {
      return reply
        .header('retry-after', String(redeemFailures.retryAfterSeconds(key, now)))
        .code(429)
        .send({ error: 'Too many tries. Wait a few minutes and try again.' });
    }

    const redeemed = await redeemLoginCode(request.body.code);
    if (!redeemed) {
      redeemFailures.fail(key, now);
      return reply.code(401).send({ error: 'That code did not work' });
    }

    redeemFailures.clear(key);

    return reply.send({
      token: redeemed.token,
      childId: redeemed.userId,
      expiresAt: redeemed.expires.toISOString(),
    });
  });

  /**
   * A Google sign-in is a grown-up by definition - the only way to become a
   * child is a parent creating the profile. The write is a compare-and-set on
   * `role IS NULL`, so a role already set is never overwritten and a managed
   * child can never be promoted by a stray sign-in.
   */
  app.post('/me/claim-parent', {
    schema: { response: { 200: z.object({ claimed: z.boolean() }) } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    return reply.send({ claimed: await claimParentRole(userId) });
  });

  app.get('/me', {
    schema: { response: { 200: accountSchema, 503: errorSchema } },
  }, async (request, reply) => {
    const userId = requireUser(request);
    const account = await readAccount(userId);
    if (!account) return reply.code(503).send({ error: 'Could not read the account' });
    return reply.send(account);
  });
};
