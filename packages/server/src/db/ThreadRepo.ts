import { nanoid } from 'nanoid';
import db from './db.js';

export type ThreadRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  bob_id: string | null;
  metadata: string;      // JSON string
  created_at: string;
  updated_at: string;
};

export function listThreads(filters?: { status?: string; bobId?: string }): ThreadRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters?.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.bobId !== undefined) {
    conditions.push('bob_id = ?');
    params.push(filters.bobId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM threads ${where} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...params) as ThreadRow[];
}

export function getThread(id: string): ThreadRow | undefined {
  return db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow | undefined;
}

export function createThread(fields: { title: string; description?: string; status?: string; bobId?: string | null; metadata?: Record<string, unknown> }): ThreadRow {
  const id = nanoid();
  const description = fields.description ?? '';
  const status = fields.status ?? 'idea';
  const bob_id = fields.bobId ?? null;
  const metadata = JSON.stringify(fields.metadata ?? {});
  db.prepare('INSERT INTO threads (id, title, description, status, bob_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(id, fields.title, description, status, bob_id, metadata);
  return getThread(id)!;
}

export function updateThread(
  id: string,
  fields: Partial<{ title: string; description: string; status: string; bobId: string | null; metadata: Record<string, unknown> }>
): ThreadRow | undefined {
  const ALLOWED_DIRECT = new Set(['title', 'description', 'status']);
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'metadata') {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(value));
    } else if (key === 'bobId') {
      setClauses.push('bob_id = ?');
      values.push(value);
    } else if (ALLOWED_DIRECT.has(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    // silently skip unknown keys
  }

  if (setClauses.length === 0) return getThread(id);

  setClauses.push("updated_at = datetime('now')");
  const sql = `UPDATE threads SET ${setClauses.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return getThread(id);
}

export function deleteThread(id: string): void {
  db.prepare('DELETE FROM threads WHERE id = ?').run(id);
}
