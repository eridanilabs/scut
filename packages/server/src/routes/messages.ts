import { FastifyInstance } from 'fastify';
import { listMessages, createMessage } from '../db/MessageRepo.js';
import { getThread } from '../db/ThreadRepo.js';

export default async function messageRoutes(app: FastifyInstance) {
  app.get<{ Params: { threadId: string } }>('/threads/:threadId/messages', async (request, reply) => {
    const thread = getThread(request.params.threadId);
    if (!thread) return reply.status(404).send({ error: 'thread not found' });
    return listMessages(request.params.threadId);
  });

  app.post<{ Params: { threadId: string }; Body: { author: string; authorId?: string | null; content: string; runId?: string | null } }>('/threads/:threadId/messages', {
    schema: {
      body: {
        type: 'object',
        required: ['author', 'content'],
        additionalProperties: false,
        properties: {
          author: { type: 'string' },
          authorId: { type: ['string', 'null'] },
          content: { type: 'string' },
          runId: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const { threadId } = request.params;
    const { author, authorId, content, runId } = request.body;

    const thread = getThread(threadId);
    if (!thread) return reply.status(404).send({ error: 'thread not found' });

    const created = createMessage({ threadId, author, authorId: authorId ?? undefined, content, runId: runId ?? undefined });
    return reply.status(201).send(created);
  });
}
