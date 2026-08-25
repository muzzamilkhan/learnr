import { buildServer } from './server';
import { PORT } from './env';

const app = buildServer();

app.listen({ port: PORT, host: '0.0.0.0' }).catch((error) => {
  console.error(error);
  process.exit(1);
});
