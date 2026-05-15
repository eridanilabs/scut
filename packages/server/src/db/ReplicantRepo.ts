import { nanoid } from 'nanoid';
import db from './db.js';

export type ReplicantRow = {
  id: string;
  name: string;
  harness: string;
  config: string;       // JSON string
  status: string;
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

export function createReplicant(fields: { name: string; harness: string; config?: Record<string, unknown>; status?: string }): ReplicantRow {
  const id = nanoid();
  const config = JSON.stringify(fields.config ?? {});
  const status = fields.status ?? 'unknown';
  db.prepare('INSERT INTO replicants (id, name, harness, config, status) VALUES (?, ?, ?, ?, ?)').run(id, fields.name, fields.harness, config, status);
  return getReplicant(id)!;
}

export function updateReplicant(
  id: string,
  fields: Partial<{ name: string; harness: string; config: Record<string, unknown>; status: string }>
): ReplicantRow | undefined {
  const ALLOWED = new Set(['name', 'harness', 'status']);
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'config') {
      setClauses.push('config = ?');
      values.push(JSON.stringify(value));
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
