import { nanoid } from 'nanoid';
import db from './db.js';

export interface ReplicantTokenRow {
  id: string;
  replicant_id: string;
  name: string | null;
  token_hash: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function createReplicantToken(input: {
  replicantId: string;
  name?: string | null;
  tokenHash: string;
  expiresAt?: string | null;
}): ReplicantTokenRow {
  const id = nanoid();
  const name = input.name ?? null;
  const expiresAt = input.expiresAt ?? null;
  db.prepare(
    'INSERT INTO replicant_tokens (id, replicant_id, name, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.replicantId, name, input.tokenHash, expiresAt);
  return db
    .prepare('SELECT * FROM replicant_tokens WHERE id = ?')
    .get(id) as ReplicantTokenRow;
}

export function listReplicantTokens(replicantId: string): ReplicantTokenRow[] {
  return db
    .prepare('SELECT * FROM replicant_tokens WHERE replicant_id = ? ORDER BY created_at ASC')
    .all(replicantId) as ReplicantTokenRow[];
}

export function getReplicantTokenByHash(tokenHash: string): ReplicantTokenRow | undefined {
  return db
    .prepare('SELECT * FROM replicant_tokens WHERE token_hash = ?')
    .get(tokenHash) as ReplicantTokenRow | undefined;
}

export function touchReplicantTokenLastUsed(id: string): void {
  db.prepare("UPDATE replicant_tokens SET last_used_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteReplicantToken(id: string): boolean {
  const info = db.prepare('DELETE FROM replicant_tokens WHERE id = ?').run(id);
  return info.changes > 0;
}
