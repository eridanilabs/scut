// Admin endpoints for replicant per-tool permission decisions.
// Backed by ReplicantPermissionRepo (see migration 003-replicant-permissions).
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  upsertReplicantPermission,
  listReplicantPermissions,
  deleteReplicantPermission,
  normalizeToolKey,
} from '../db/ReplicantPermissionRepo.js';
import { getReplicant } from '../db/ReplicantRepo.js';
import { requireReplicantAuth } from '../auth/replicantAuth.js';

// Look up replicant by id, replying 404 when missing. Returns the replicant
// when present, or null when a 404 was sent (caller must return).
async function lookupReplicantOr404(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<{ id: string; name: string } | null> {
  const replicant = getReplicant(request.params.id);
  if (!replicant) {
    reply.status(404).send({ error: 'replicant not found' });
    return null;
  }
  return replicant;
}

export default async function replicantPermissionRoutes(app: FastifyInstance) {
  // NOTE: GET/PUT intentionally do NOT use requireReplicantAuth as a
  // preHandler. The missing-replicant 404 check must run before auth so
  // unauthenticated probes against unknown ids return 404 rather than 401
  // (see scripts/smoke.sh). For existing replicants, auth is still
  // enforced inline below.
  app.get<{ Params: { id: string } }>(
    '/replicants/:id/permissions',
    async (request, reply) => {
      const replicant = await lookupReplicantOr404(request, reply);
      if (!replicant) return;
      await requireReplicantAuth(request, reply);
      if (reply.sent) return;
      if (request.replicant?.id !== replicant.id) {
        return reply.status(403).send({ error: 'forbidden' });
      }
      return listReplicantPermissions(replicant.id);
    }
  );

  app.put<{
    Params: { id: string };
    Body: {
      tool: string;
      scope: 'session' | 'replicant';
      decision: 'allow' | 'deny';
      acpSessionId?: string | null;
    };
  }>(
    '/replicants/:id/permissions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tool', 'scope', 'decision'],
          additionalProperties: false,
          properties: {
            tool: { type: 'string', minLength: 1 },
            scope: { type: 'string', enum: ['session', 'replicant'] },
            decision: { type: 'string', enum: ['allow', 'deny'] },
            acpSessionId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const replicant = await lookupReplicantOr404(request, reply);
      if (!replicant) return;
      await requireReplicantAuth(request, reply);
      if (reply.sent) return;
      if (request.replicant?.id !== replicant.id) {
        return reply.status(403).send({ error: 'forbidden' });
      }
      const { tool, scope, decision } = request.body;
      const acpSessionId =
        request.body.acpSessionId === undefined ? null : request.body.acpSessionId;
      if (
        scope === 'session' &&
        (acpSessionId === null ||
          (typeof acpSessionId === 'string' && acpSessionId.trim() === ''))
      ) {
        return reply
          .status(400)
          .send({ error: 'scope=session requires acpSessionId' });
      }
      if (scope === 'replicant' && acpSessionId !== null) {
        return reply
          .status(400)
          .send({ error: 'scope=replicant must not include acpSessionId' });
      }
      if (normalizeToolKey(tool) === '') {
        return reply
          .status(400)
          .send({ error: 'tool must not be empty after normalization' });
      }
      const row = upsertReplicantPermission({
        replicantId: replicant.id,
        tool,
        scope,
        decision,
        acpSessionId,
      });
      return row;
    }
  );

  app.delete<{ Params: { permId: string } }>(
    '/replicants/permissions/:permId',
    { preHandler: requireReplicantAuth },
    async (request, reply) => {
      // Fail closed: requireReplicantAuth should have populated request.replicant.
      // deleteReplicantPermission requires the owning replicant id, so we must
      // never call it without an authenticated principal.
      if (!request.replicant) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const deleted = deleteReplicantPermission(
        request.params.permId,
        request.replicant.id
      );
      if (!deleted) {
        return reply.status(404).send({ error: 'not found' });
      }
      return reply.status(204).send();
    }
  );
}
