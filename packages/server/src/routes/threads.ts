import { FastifyInstance } from 'fastify';
import { listThreads, getThread, createThread, updateThread, deleteThread } from '../db/ThreadRepo.js';

export default async function threadRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { status?: string; bobId?: string } }>('/threads', async (request) => {
    const { status, bobId } = request.query;
    return listThreads({ status, bobId });
  });

  app.get<{ Params: { id: string } }>('/threads/:id', async (request, reply) => {
    const thread = getThread(request.params.id);
    if (!thread) {
      return reply.status(404).send({ error: 'not found' });
    }
    return thread;
  });

  app.post<{ Body: { title: string; description?: string; status?: string; bobId?: string | null; metadata?: Record<string, unknown> } }>('/threads', {
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          bobId: { type: ['string', 'null'] },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const created = createThread(request.body);
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ title: string; description: string; status: string; bobId: string | null; metadata: Record<string, unknown> }> }>('/threads/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          bobId: { type: ['string', 'null'] },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const updated = updateThread(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: 'not found' });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/threads/:id', async (request, reply) => {
    deleteThread(request.params.id);
    return reply.status(204).send();
  });
}
