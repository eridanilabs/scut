// Bearer-token management endpoints backed by the `replicant_tokens` table
// (see ReplicantTokenRepo / migration 002-replicant-tokens).
import { FastifyInstance } from 'fastify';
import {
  createReplicantToken,
  listReplicantTokens,
  deleteReplicantToken,
  ReplicantTokenRow,
} from '../db/ReplicantTokenRepo.js';
import { getReplicant } from '../db/ReplicantRepo.js';
import {
  generateRawToken,
  hashToken,
  parseReplicantTokenExpiry,
} from '../auth/replicantAuth.js';

function stripHash(row: ReplicantTokenRow): Omit<ReplicantTokenRow, 'token_hash'> {
  const { token_hash: _omit, ...rest } = row;
  return rest;
}

export default async function replicantTokenRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: { name?: string | null; expiresAt?: string | null };
  }>(
    '/replicants/:id/tokens',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: ['string', 'null'] },
            expiresAt: { type: ['string', 'null'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const replicant = getReplicant(request.params.id);
      if (!replicant) {
        return reply.status(404).send({ error: 'replicant not found' });
      }
      const expiresAtInput = request.body?.expiresAt;
      if (expiresAtInput !== undefined && expiresAtInput !== null) {
        const parsed =
          typeof expiresAtInput === 'string'
            ? parseReplicantTokenExpiry(expiresAtInput)
            : undefined;
        if (parsed === undefined || parsed <= Date.now()) {
          return reply.status(400).send({
            error: 'expiresAt must be a valid ISO 8601 date-time in the future',
          });
        }
      }
      const raw = generateRawToken();
      const tokenHash = hashToken(raw);
      const row = createReplicantToken({
        replicantId: replicant.id,
        name: request.body?.name ?? null,
        tokenHash,
        expiresAt: request.body?.expiresAt ?? null,
      });
      return reply.status(201).send({
        id: row.id,
        name: row.name,
        token: raw,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      });
    }
  );

  app.get<{ Params: { id: string } }>(
    '/replicants/:id/tokens',
    async (request, reply) => {
      const replicant = getReplicant(request.params.id);
      if (!replicant) {
        return reply.status(404).send({ error: 'replicant not found' });
      }
      return listReplicantTokens(replicant.id).map(stripHash);
    }
  );

  app.delete<{ Params: { tokenId: string } }>(
    '/replicants/tokens/:tokenId',
    async (request, reply) => {
      const deleted = deleteReplicantToken(request.params.tokenId);
      if (!deleted) {
        return reply.status(404).send({ error: 'not found' });
      }
      return reply.status(204).send();
    }
  );
}
