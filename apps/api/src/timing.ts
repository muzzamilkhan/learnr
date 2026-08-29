import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * One line per request, saying where its time went.
 *
 * The server was built with `logger: false` and so said nothing at all about
 * how long anything took - which is a reasonable default for a service nobody
 * is asking questions of, and useless for the one being asked here: the web app
 * is two hops from its data, and without this the middle hop is a black box.
 *
 * The split that matters is `auth=` against the total. Every authenticated
 * request resolves the session cookie against Neon before the handler runs
 * (`resolveUserId`), and the web app has *already* resolved that same cookie
 * against that same table on its own side. If `auth=` is a large share of the
 * total then the second lookup is worth removing; if it is not, the cost is in
 * the handler and batching is the lever instead.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** How long `resolveUserId` took, set by the auth plugin's `onRequest`. */
    authMs: number | null;
  }
}

export const timingPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('authMs', null);

  // `reply.elapsedTime` is Fastify's own, measured from the moment the request
  // was routed, so nothing here has to keep a start stamp of its own.
  app.addHook('onResponse', async (request, reply) => {
    const auth = request.authMs === null ? '' : ` auth=${Math.round(request.authMs)}ms`;
    console.log(
      `[timing] ${request.method} ${request.url} ${reply.statusCode}` +
        ` total=${Math.round(reply.elapsedTime)}ms${auth}`,
    );
  });
});
