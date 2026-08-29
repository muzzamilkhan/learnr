import Fastify, { type FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifyCors from '@fastify/cors';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { transformObject } from './openapi.js';
import { registerComponents } from './schemas/register.js';
import { authPlugin } from './auth/plugin.js';
import { timingPlugin } from './timing.js';
import { webOrigins } from './env.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { childRoutes } from './routes/children.js';
import { contentRoutes } from './routes/content.js';
import { reportRoutes } from './routes/reports.js';
import { shareRoutes } from './routes/shares.js';
import { speedRoutes } from './routes/speed.js';
import { playRoutes } from './routes/play.js';

registerComponents();

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) console.error(error);
    reply.code(status).send({ error: error.message });
  });

  // The contract is generated from the zod schemas the routes already validate
  // against, so a route and its documented shape cannot disagree.
  app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'LearnR API', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
    transformObject,
  });

  /*
    The browser talks to this API directly now - a child's answers, the round's
    stars, the day's goal and a finished speed run - rather than through a Next
    server action that forwarded them. That is what took a hop and a session
    lookup off the answer path, and it is what makes these calls cross-origin.

    Exact origins, never reflected: a browser refuses `*` outright once a
    request carries credentials, and the cookie is the whole authorisation here.
    `maxAge` matters more than it looks - a JSON POST is never a simple request,
    so without it every recorded answer would pay a preflight *and* the call,
    which is two round trips to save one.
  */
  app.register(fastifyCors, {
    origin: webOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type'],
    maxAge: 86_400,
  });

  // Registered before the auth plugin so its `onResponse` hook is in place
  // for every request the auth hook then times a part of.
  app.register(timingPlugin);
  app.register(authPlugin);
  app.register(authRoutes);
  app.register(sessionRoutes);
  app.register(childRoutes);
  app.register(reportRoutes);
  app.register(shareRoutes);
  app.register(speedRoutes);
  app.register(playRoutes);
  app.register(contentRoutes);

  app.get('/openapi.json', async () => app.swagger());

  app.get('/health', async () => ({ ok: true }));

  return app;
}
