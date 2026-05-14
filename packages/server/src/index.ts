import Fastify from 'fastify';
import bobRoutes from './routes/bobs.js';
import threadRoutes from './routes/threads.js';
import messageRoutes from './routes/messages.js';
import runRoutes from './routes/runs.js';
import internalRoutes from './routes/internal.js';

const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', service: 'scut' };
});

await server.register(bobRoutes);
await server.register(threadRoutes);
await server.register(messageRoutes);
await server.register(runRoutes);
await server.register(internalRoutes);

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
