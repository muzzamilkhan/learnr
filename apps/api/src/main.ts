import { buildServer } from './server.js';
import { PORT } from './env.js';

const app = buildServer();

app.listen({ port: PORT, host: '0.0.0.0' }).catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
