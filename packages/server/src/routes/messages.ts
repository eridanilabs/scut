import { FastifyInstance } from 'fastify';
import { listMessages, createMessage } from '../db/MessageRepo.js';

export default async function messageRoutes(app: FastifyInstance) {
  app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/messages', async (request) => {
    return listMessages(request.params.threadId);
  });

  app.post<{ Params: { threadId: string }; Body: { author: string; authorId?: string; content: string; runId?: string } }>('/api/threads/:threadId/messages', async (request, reply) => {
    const { threadId } = request.params;
    const { author, authorId, content, runId } = request.body;
    const created = createMessage({ threadId, author, authorId, content, runId });
    return reply.status(201).send(created);
  });
}
