import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  getReplicantTokenByHash,
  touchReplicantTokenLastUsed,
} from '../db/ReplicantTokenRepo.js';
import { getReplicant } from '../db/ReplicantRepo.js';

declare module 'fastify' {
  interface FastifyRequest {
    replicant?: { id: string; name: string };
  }
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateRawToken(): string {
  // 24 random bytes -> 32 base64url chars (no padding).
  const buf = crypto.randomBytes(24);
  const b64 = buf.toString('base64url').slice(0, 32);
  return `scut_rk_${b64}`;
}

/**
 * Normalize an expiration date-time string for deterministic parsing.
 *
 * - Replaces a single space separator between date and time with `T`.
 * - Appends `Z` when the normalized string lacks a timezone designator
 *   (`Z`, `+HH:MM`, `-HH:MM`, `+HHMM`, or `-HHMM`).
 *
 * This avoids treating zone-less ISO strings like `2025-12-31T23:59:59`
 * as local time, which would vary by host timezone.
 */
export function normalizeReplicantTokenExpiryInput(expiresAt: string): string {
  let s = expiresAt.trim();
  // Convert `YYYY-MM-DD HH:MM:SS` to `YYYY-MM-DDTHH:MM:SS`.
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  // If there's no time component at all, leave as-is (date-only).
  if (!s.includes('T')) {
    return s;
  }
  // Check for an existing timezone designator on the time portion.
  const timePart = s.slice(s.indexOf('T') + 1);
  const hasZone = /Z$/.test(timePart) || /[+-]\d{2}:?\d{2}$/.test(timePart);
  if (!hasZone) {
    s += 'Z';
  }
  return s;
}

/**
 * Parse an expiration string into a millisecond epoch timestamp.
 * Returns `undefined` if the string is not a valid date-time.
 */
export function parseReplicantTokenExpiry(expiresAt: string): number | undefined {
  const normalized = normalizeReplicantTokenExpiryInput(expiresAt);
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? undefined : ms;
}

function sendUnauthorized(reply: FastifyReply): void {
  reply
    .header('www-authenticate', 'Bearer realm="replicant"')
    .status(401)
    .send({ error: 'unauthorized' });
}

export async function requireReplicantAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = req.headers['authorization'];
  if (!header || typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
    sendUnauthorized(reply);
    return;
  }
  const raw = header.slice(7).trim();
  if (!raw) {
    sendUnauthorized(reply);
    return;
  }
  const row = getReplicantTokenByHash(hashToken(raw));
  if (!row) {
    sendUnauthorized(reply);
    return;
  }
  if (row.expires_at) {
    const exp = parseReplicantTokenExpiry(row.expires_at);
    if (exp === undefined || exp < Date.now()) {
      sendUnauthorized(reply);
      return;
    }
  }
  const replicant = getReplicant(row.replicant_id);
  if (!replicant) {
    sendUnauthorized(reply);
    return;
  }
  touchReplicantTokenLastUsed(row.id);
  req.replicant = { id: replicant.id, name: replicant.name };
}
