import { FastifyInstance } from 'fastify';
import { listBobs, getBob, createBob, updateBob, deleteBob } from '../db/BobRepo.js';

export default async function bobRoutes(app: FastifyInstance) {
  app.get('/api/bobs', async () => {
    return listBobs();
  });

  app.get<{ Params: { id: string } }>('/api/bobs/:id', async (request, reply) => {
    const bob = getBob(request.params.id);
    if (!bob) {
      return reply.status(404).send({ error: 'not found' });
    }
    return bob;
  });

  app.post<{ Body: { name: string; harness: string; config?: Record<string, unknown>; status?: string } }>('/api/bobs', async (request, reply) => {
    const created = createBob(request.body);
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; harness: string; config: Record<string, unknown>; status: string }> }>('/api/bobs/:id', async (request, reply) => {
    const updated = updateBob(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: 'not found' });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/api/bobs/:id', async (request, reply) => {
    deleteBob(request.params.id);
    return reply.status(204).send();
  });
}
