import { nanoid } from 'nanoid';
import db from './db.js';

export type RunRow = {
  id: string;
  thread_id: string;
  replicant_id: string;
  status: string;
  input: string;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function listRuns(threadId: string): RunRow[] {
  return db.prepare('SELECT * FROM runs WHERE thread_id = ? ORDER BY created_at DESC').all(threadId) as RunRow[];
}

export function getRun(id: string): RunRow | undefined {
  return db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
}

export function createRun(fields: { threadId: string; bobId: string; input: string; status?: string }): RunRow {
  const id = nanoid();
  const status = fields.status ?? 'created';
  db.prepare('INSERT INTO runs (id, thread_id, replicant_id, input, status) VALUES (?, ?, ?, ?, ?)').run(id, fields.threadId, fields.bobId, fields.input, status);
  return getRun(id)!;
}

export function updateRun(
  id: string,
  fields: Partial<{ status: string; output: string | null; error: string | null; startedAt: string | null; completedAt: string | null }>
): RunRow | undefined {
  const ALLOWED_DIRECT = new Set(['status', 'output', 'error']);
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'startedAt') {
      setClauses.push('started_at = ?');
      values.push(value);
    } else if (key === 'completedAt') {
      setClauses.push('completed_at = ?');
      values.push(value);
    } else if (ALLOWED_DIRECT.has(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    // silently skip unknown keys
  }

  if (setClauses.length === 0) return getRun(id);

  setClauses.push("updated_at = datetime('now')");
  const sql = `UPDATE runs SET ${setClauses.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return getRun(id);
}
