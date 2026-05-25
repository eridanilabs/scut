import { nanoid } from 'nanoid';
import db from './db.js';

export type ReplicantRow = {
  id: string;
  name: string;
  harness: string;
  config: string;       // JSON string
  status: string;
  url: string | null;
  auto_approve: number;
  metadata: string;     // JSON string
  created_at: string;
  updated_at: string;
};

export function listReplicants(): ReplicantRow[] {
  return db.prepare('SELECT * FROM replicants ORDER BY created_at ASC').all() as ReplicantRow[];
}

export function getReplicant(id: string): ReplicantRow | undefined {
  return db.prepare('SELECT * FROM replicants WHERE id = ?').get(id) as ReplicantRow | undefined;
}

export function getReplicantByName(name: string): ReplicantRow | undefined {
  return db.prepare('SELECT * FROM replicants WHERE name = ?').get(name) as ReplicantRow | undefined;
}

export function createReplicant(fields: {
  name: string;
  harness: string;
  config?: Record<string, unknown>;
  status?: string;
  url?: string | null;
  autoApprove?: boolean;
  metadata?: Record<string, unknown>;
}): ReplicantRow {
  const id = nanoid();
  const config = JSON.stringify(fields.config ?? {});
  const status = fields.status ?? 'unknown';
  const url = fields.url ?? null;
  const autoApprove = fields.autoApprove ? 1 : 0;
  const metadata = JSON.stringify(fields.metadata ?? {});
  db.prepare(
    'INSERT INTO replicants (id, name, harness, config, status, url, auto_approve, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, fields.name, fields.harness, config, status, url, autoApprove, metadata);
  return getReplicant(id)!;
}

export function updateReplicant(
  id: string,
  fields: Partial<{
    name: string;
    harness: string;
    config: Record<string, unknown>;
    status: string;
    url: string | null;
    autoApprove: boolean;
    metadata: Record<string, unknown>;
  }>
): ReplicantRow | undefined {
  const ALLOWED = new Set(['name', 'harness', 'status', 'url']);
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'config') {
      setClauses.push('config = ?');
      values.push(JSON.stringify(value));
    } else if (key === 'metadata') {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(value));
    } else if (key === 'autoApprove') {
      setClauses.push('auto_approve = ?');
      values.push(value ? 1 : 0);
    } else if (ALLOWED.has(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    // silently skip unknown keys
  }

  if (setClauses.length === 0) return getReplicant(id);

  setClauses.push("updated_at = datetime('now')");
  const sql = `UPDATE replicants SET ${setClauses.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return getReplicant(id);
}

export function deleteReplicant(id: string): void {
  db.prepare('DELETE FROM replicants WHERE id = ?').run(id);
}
