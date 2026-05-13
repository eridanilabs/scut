import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', service: 'scut' };
});

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
