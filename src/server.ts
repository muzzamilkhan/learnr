import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { childRoutes } from './routes/children.js';
import { reportRoutes } from './routes/reports.js';
import { shareRoutes } from './routes/shares.js';
import { speedRoutes } from './routes/speed.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) console.error(error);
    reply.code(status).send({ error: error.message });
  });

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(sessionRoutes);
  app.register(childRoutes);
  app.register(reportRoutes);
  app.register(shareRoutes);
  app.register(speedRoutes);

  app.get('/health', async () => ({ ok: true }));

  return app;
}
