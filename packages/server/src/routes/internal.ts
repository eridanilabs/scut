import { type FastifyInstance } from 'fastify';
import { getRun, updateRun } from '../db/RunRepo.js';
import { createMessage } from '../db/MessageRepo.js';

const CALLBACK_SECRET = process.env.SCUT_CALLBACK_SECRET;

export default async function internalRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: { status: 'completed' | 'failed'; output?: string; error?: string };
  }>('/api/internal/runs/:id/result', async (request, reply) => {
    if (CALLBACK_SECRET) {
      const auth = request.headers['x-scut-callback-secret'];
      if (auth !== CALLBACK_SECRET) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
    }

    const { id } = request.params;
    const { status, output, error } = request.body;

    const run = getRun(id);
    if (!run) return reply.status(404).send({ error: 'not found' });

    updateRun(id, {
      status,
      output: output ?? null,
      error: error ?? null,
      completedAt: new Date().toISOString(),
    });

    createMessage({
      threadId: run.thread_id,
      runId: id,
      author: 'bob',
      authorId: run.bob_id,
      content: output ?? error ?? '',
    });

    return reply.status(200).send({ ok: true });
  });
}
