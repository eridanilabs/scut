import { FastifyInstance } from 'fastify';
import { listRuns, getRun, createRun, updateRun } from '../db/RunRepo.js';
import { getThread } from '../db/ThreadRepo.js';
import { getConnector } from '../connectors/ConnectorRegistry.js';
import { Run, Thread } from '../connectors/IReplicantConnector.js';
import { RunRow } from '../db/RunRepo.js';
import { ThreadRow } from '../db/ThreadRepo.js';

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    threadId: row.thread_id,
    bobId: row.replicant_id,
    status: row.status as Run['status'],
    input: row.input,
    output: row.output,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    bobId: row.replicant_id,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function runRoutes(app: FastifyInstance) {
  app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/runs', async (request) => {
    return listRuns(request.params.threadId);
  });

  app.get<{ Params: { id: string } }>('/api/runs/:id', async (request, reply) => {
    const run = getRun(request.params.id);
    if (!run) {
      return reply.status(404).send({ error: 'not found' });
    }
    return run;
  });

  app.post<{ Params: { threadId: string }; Body: { replicantId: string; input: string } }>('/api/threads/:threadId/runs', {
    schema: {
      body: {
        type: 'object',
        required: ['replicantId', 'input'],
        additionalProperties: false,
        properties: {
          replicantId: { type: 'string' },
          input: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { threadId } = request.params;
    const { replicantId, input } = request.body;

    const thread = getThread(threadId);
    if (!thread) {
      return reply.status(404).send({ error: 'not found' });
    }

    const connector = getConnector(replicantId);
    if (!connector) {
      return reply.status(400).send({ error: 'no connector registered for replicantId' });
    }

    const runRow = createRun({ threadId, bobId: replicantId, input, status: 'created' });
    const run = rowToRun(runRow);
    const threadObj = rowToThread(thread);

    // Fire and forget - do not await
    connector.dispatch(run, threadObj).catch((err: unknown) => {
      app.log.error({ err, runId: run.id }, 'connector.dispatch failed');
      updateRun(run.id, {
        status: 'failed',
        error: String(err),
        completedAt: new Date().toISOString(),
      });
    });

    const updated = updateRun(run.id, { status: 'queued' });
    return reply.status(201).send(updated);
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ status: string; output: string | null; error: string | null; startedAt: string | null; completedAt: string | null }> }>('/api/runs/:id', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string' },
          output: { type: ['string', 'null'] },
          error: { type: ['string', 'null'] },
          startedAt: { type: ['string', 'null'] },
          completedAt: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const updated = updateRun(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: 'not found' });
    }
    return updated;
  });
}
