import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { requireReplicantAuth } from '../auth/replicantAuth.js';
import {
  getCommentDispatch,
  insertCommentDispatch,
  replicantCanReadThread,
  updateDispatchStatus,
  type CommentDispatchRow,
} from '../db/CommentDispatchRepo.js';
import { getThread } from '../db/ThreadRepo.js';
import { getReplicant } from '../db/ReplicantRepo.js';
import { getAcpConnector } from '../connectors/v2/AcpConnectorRegistry.js';

interface DispatchBody {
  replicantId: string;
  input: string;
  triggeringCommentId?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * POST /threads/:threadId/dispatches
 * GET  /dispatches/:id
 *
 * V2-only endpoint that mirrors the fire-and-forget shape of POST
 * /threads/:threadId/runs (V1). See spec sec 3.3.
 */
export default async function dispatchRoutes(app: FastifyInstance) {
  app.post<{ Params: { threadId: string }; Body: DispatchBody }>(
    '/threads/:threadId/dispatches',
    {
      schema: {
        body: {
          type: 'object',
          required: ['replicantId', 'input'],
          additionalProperties: false,
          properties: {
            replicantId: { type: 'string' },
            input: { type: 'string' },
            triggeringCommentId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { threadId } = request.params;
      const { replicantId, input, triggeringCommentId } = request.body;

      const thread = getThread(threadId);
      if (!thread) {
        return reply.status(404).send({ error: 'not found', resource: 'thread' });
      }
      const replicant = getReplicant(replicantId);
      if (!replicant) {
        return reply
          .status(404)
          .send({ error: 'not found', resource: 'replicant' });
      }
      const connector = getAcpConnector(replicantId);
      if (!connector) {
        return reply
          .status(400)
          .send({ error: 'no ACP connector registered for replicantId' });
      }

      const dispatch: CommentDispatchRow = insertCommentDispatch({
        id: nanoid(),
        threadId,
        triggeringCommentId: triggeringCommentId ?? null,
        replicantId,
        status: 'queued',
      });

      // Fire-and-forget; mirror routes/runs.ts. The connector itself
      // updates the row to 'running' once a sessionId is obtained, and
      // to a terminal state when the prompt resolves/rejects.
      void connector
        .dispatch({
          dispatch,
          thread: {
            id: thread.id,
            title: thread.title,
            description: thread.description,
          },
          triggeringComment: null,
          prompt: { text: input },
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          app.log.error(
            { err, dispatchId: dispatch.id },
            'AcpConnector.dispatch failed'
          );
          updateDispatchStatus(dispatch.id, {
            status: 'failed',
            error: message,
            completedAt: nowIso(),
          });
        });

      return reply.status(201).send(dispatch);
    }
  );

  app.get<{ Params: { id: string } }>(
    '/dispatches/:id',
    { preHandler: requireReplicantAuth },
    async (request, reply) => {
      const replicant = request.replicant!;
      const row = getCommentDispatch(request.params.id);
      if (!row) {
        return reply.status(404).send({ error: 'not_found' });
      }
      if (!replicantCanReadThread(row.thread_id, replicant.id)) {
        return reply.status(403).send({ error: 'forbidden' });
      }
      return reply.send(row);
    }
  );
}
