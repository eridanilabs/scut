import { FastifyInstance } from 'fastify';
import { listBobs, getBob, createBob, updateBob, deleteBob, BobRow } from '../db/BobRepo.js';

function sanitizeBob(bob: BobRow): Record<string, unknown> {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(bob.config) as Record<string, unknown>;
  } catch {
    // ignore
  }
  const { secret: _secret, ...safeConfig } = config;
  return { ...bob, config: safeConfig };
}

export default async function bobRoutes(app: FastifyInstance) {
  app.get('/api/bobs', async () => {
    return listBobs().map(sanitizeBob);
  });

  app.get<{ Params: { id: string } }>('/api/bobs/:id', async (request, reply) => {
    const bob = getBob(request.params.id);
    if (!bob) {
      return reply.status(404).send({ error: 'not found' });
    }
    return sanitizeBob(bob);
  });

  app.post<{ Body: { name: string; harness: string; config?: Record<string, unknown>; status?: string } }>('/api/bobs', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'harness'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          harness: { type: 'string' },
          config: { type: 'object' },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const created = createBob(request.body);
    return reply.status(201).send(sanitizeBob(created));
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; harness: string; config: Record<string, unknown>; status: string }> }>('/api/bobs/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          harness: { type: 'string' },
          config: { type: 'object' },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const updated = updateBob(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: 'not found' });
    }
    return sanitizeBob(updated);
  });

  app.delete<{ Params: { id: string } }>('/api/bobs/:id', async (request, reply) => {
    try {
      deleteBob(request.params.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('FOREIGN KEY') || msg.includes('SQLITE_CONSTRAINT')) {
        return reply.status(409).send({ error: 'bob has associated runs and cannot be deleted' });
      }
      throw err;
    }
    return reply.status(204).send();
  });
}
