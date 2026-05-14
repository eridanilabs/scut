import { type FastifyInstance } from 'fastify';
import { getRun, updateRun } from '../db/RunRepo.js';
import { createMessage } from '../db/MessageRepo.js';

const CALLBACK_SECRET = process.env.SCUT_CALLBACK_SECRET;
if (!CALLBACK_SECRET) {
  throw new Error('SCUT_CALLBACK_SECRET env var must be set - internal callback endpoint would be unauthenticated without it');
}

export default async function internalRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: { status: 'completed' | 'failed'; output?: string; error?: string };
  }>('/api/internal/runs/:id/result', {
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['completed', 'failed'] },
          output: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
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
