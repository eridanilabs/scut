import Fastify from 'fastify';
import replicantRoutes from './routes/replicants.js';
import threadRoutes from './routes/threads.js';
import messageRoutes from './routes/messages.js';
import runRoutes from './routes/runs.js';
import internalRoutes from './routes/internal.js';
import { bootstrapConnectors } from './bootstrap/connectors.js';

const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', service: 'scut' };
});

const API_V1_PREFIX = '/api/v1';

await server.register(replicantRoutes, { prefix: API_V1_PREFIX });
await server.register(threadRoutes, { prefix: API_V1_PREFIX });
await server.register(messageRoutes, { prefix: API_V1_PREFIX });
await server.register(runRoutes, { prefix: API_V1_PREFIX });
await server.register(internalRoutes, { prefix: API_V1_PREFIX });

bootstrapConnectors();

const start = async () => {
  try {
    console.log('SCUT server starting');
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
