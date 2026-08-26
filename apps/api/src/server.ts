import Fastify, { type FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { childRoutes } from './routes/children.js';
import { contentRoutes } from './routes/content.js';
import { reportRoutes } from './routes/reports.js';
import { shareRoutes } from './routes/shares.js';
import { speedRoutes } from './routes/speed.js';
import { playRoutes } from './routes/play.js';

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
  });

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
