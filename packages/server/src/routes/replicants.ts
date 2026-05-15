import { FastifyInstance } from 'fastify';
import { listReplicants, getReplicant, createReplicant, updateReplicant, deleteReplicant, ReplicantRow } from '../db/ReplicantRepo.js';
import { registerConnector, removeConnector } from '../connectors/ConnectorRegistry.js';
import { CopilotBridgeConnector } from '../connectors/CopilotBridgeConnector.js';

function sanitizeReplicant(replicant: ReplicantRow): Record<string, unknown> {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(replicant.config) as Record<string, unknown>;
  } catch {
    // ignore
  }
  const { secret: _secret, ...safeConfig } = config;
  return { ...replicant, config: safeConfig };
}

export default async function replicantRoutes(app: FastifyInstance) {
  app.get('/api/replicants', async () => {
    return listReplicants().map(sanitizeReplicant);
  });

  app.get<{ Params: { id: string } }>('/api/replicants/:id', async (request, reply) => {
    const replicant = getReplicant(request.params.id);
    if (!replicant) {
      return reply.status(404).send({ error: 'not found' });
    }
    return sanitizeReplicant(replicant);
  });

  app.post<{ Body: { name: string; harness: string; config?: Record<string, unknown>; status?: string } }>('/api/replicants', {
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
    const created = createReplicant(request.body);

    // Register connector if this is an online copilot-bridge replicant
    if (created.status === 'online' && created.harness === 'copilot-bridge') {
      let config: Record<string, unknown> = {};
      try { config = JSON.parse(created.config) as Record<string, unknown>; } catch { /* ignore */ }
      const webhookUrl = config.webhookUrl as string | undefined;
      const callbackUrl = (config.callbackUrl as string | undefined) ?? 'http://localhost:3000';
      const secret = config.secret as string | undefined;
      if (webhookUrl) {
        registerConnector(created.id, new CopilotBridgeConnector({ webhookUrl, callbackUrl, secret }));
      }
    }

    return reply.status(201).send(sanitizeReplicant(created));
  });

  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; harness: string; config: Record<string, unknown>; status: string }> }>('/api/replicants/:id', {
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
    const updated = updateReplicant(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: 'not found' });
    }

    // Keep in-memory registry in sync with DB status
    const offlineStatuses = new Set(['offline', 'unknown']);
    if (offlineStatuses.has(updated.status)) {
      removeConnector(updated.id);
    } else if (updated.status === 'online' && updated.harness === 'copilot-bridge') {
      let config: Record<string, unknown> = {};
      try { config = JSON.parse(updated.config) as Record<string, unknown>; } catch { /* ignore */ }
      const webhookUrl = config.webhookUrl as string | undefined;
      const callbackUrl = (config.callbackUrl as string | undefined) ?? 'http://localhost:3000';
      const secret = config.secret as string | undefined;
      if (webhookUrl) {
        registerConnector(updated.id, new CopilotBridgeConnector({ webhookUrl, callbackUrl, secret }));
      }
    }

    return sanitizeReplicant(updated);
  });

  app.delete<{ Params: { id: string } }>('/api/replicants/:id', async (request, reply) => {
    try {
      removeConnector(request.params.id);
      deleteReplicant(request.params.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('FOREIGN KEY') || msg.includes('SQLITE_CONSTRAINT')) {
        return reply.status(409).send({ error: 'replicant has associated runs and cannot be deleted' });
      }
      throw err;
    }
    return reply.status(204).send();
  });
}
