import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';

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

  app.get('/health', async () => ({ ok: true }));

  return app;
}
