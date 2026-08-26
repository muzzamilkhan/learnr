import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { resolveUserId } from './session.js';
import { readAccount } from '../data/accounts.js';

const COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
}

function tokenFrom(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  const cookie = request.headers.cookie;
  if (!cookie) return undefined;

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }

  return undefined;
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('userId', null);

  app.addHook('onRequest', async (request) => {
    request.userId = await resolveUserId(tokenFrom(request));
  });
});

/** The gate for anything a signed-in user may do. */
export function requireUser(request: FastifyRequest): string {
  if (!request.userId) {
    const error = new Error('Not signed in') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
  return request.userId;
}

/** The gate for the parent screens. A child reaching one is a 403, not a 404. */
export async function requireParent(request: FastifyRequest): Promise<string> {
  const userId = requireUser(request);
  const account = await readAccount(userId);

  if (account?.role !== 'parent') {
    const error = new Error('Not a parent') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return userId;
}
