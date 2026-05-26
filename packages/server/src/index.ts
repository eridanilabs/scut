import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import replicantRoutes from './routes/replicants.js';
import replicantTokenRoutes from './routes/replicantTokens.js';
import threadRoutes from './routes/threads.js';
import messageRoutes from './routes/messages.js';
import runRoutes from './routes/runs.js';
import internalRoutes from './routes/internal.js';
import traceRoutes from './routes/traces.js';
import { bootstrapConnectors } from './bootstrap/connectors.js';

const API_V1_PREFIX = '/api/v1';

/**
 * Build a Fastify app instance with all routes registered but without
 * binding to a network port. Tests use this to drive the API via
 * `app.inject(...)` without starting a listener.
 *
 * Connector bootstrap is intentionally NOT performed here; it has side
 * effects (network registrations) that production startup handles via
 * `start()` and that tests should opt into explicitly.
 */
export async function buildApp(
  options: { logger?: boolean } = {}
): Promise<FastifyInstance> {
  const server = Fastify({ logger: options.logger ?? false });

  server.get('/health', async () => {
    return { status: 'ok', service: 'scut' };
  });

  await server.register(replicantRoutes, { prefix: API_V1_PREFIX });
  await server.register(replicantTokenRoutes, { prefix: API_V1_PREFIX });
  await server.register(threadRoutes, { prefix: API_V1_PREFIX });
  await server.register(messageRoutes, { prefix: API_V1_PREFIX });
  await server.register(runRoutes, { prefix: API_V1_PREFIX });
  await server.register(internalRoutes, { prefix: API_V1_PREFIX });
  await server.register(traceRoutes, { prefix: API_V1_PREFIX });

  return server;
}

async function start(): Promise<void> {
  const server = await buildApp({ logger: true });
  bootstrapConnectors();
  try {
    console.log('SCUT server starting');
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Only auto-start when run as the entrypoint (e.g. `tsx src/index.ts` or
// `node dist/index.js`). When imported by tests, `buildApp` is exported
// and the listener is not opened. We compare URL forms so the check is
// robust to relative vs absolute argv paths and to extension differences
// between the .ts (tsx) and .js (node) entry forms.
const invokedDirectly = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return pathToFileURL(path.resolve(argv1)).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  await start();
}
