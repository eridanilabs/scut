import { nanoid } from 'nanoid';
import db from './db.js';

export type BobRow = {
  id: string;
  name: string;
  harness: string;
  config: string;       // JSON string
  status: string;
  created_at: string;
  updated_at: string;
};

export function listBobs(): BobRow[] {
  return db.prepare('SELECT * FROM bobs ORDER BY created_at ASC').all() as BobRow[];
}

export function getBob(id: string): BobRow | undefined {
  return db.prepare('SELECT * FROM bobs WHERE id = ?').get(id) as BobRow | undefined;
}

export function getBobByName(name: string): BobRow | undefined {
  return db.prepare('SELECT * FROM bobs WHERE name = ?').get(name) as BobRow | undefined;
}

export function createBob(fields: { name: string; harness: string; config?: Record<string, unknown>; status?: string }): BobRow {
  const id = nanoid();
  const config = JSON.stringify(fields.config ?? {});
  const status = fields.status ?? 'unknown';
  db.prepare('INSERT INTO bobs (id, name, harness, config, status) VALUES (?, ?, ?, ?, ?)').run(id, fields.name, fields.harness, config, status);
  return getBob(id)!;
}

export function updateBob(id: string, fields: Partial<{ name: string; harness: string; config: Record<string, unknown>; status: string }>): BobRow | undefined {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return getBob(id);
  }
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of entries) {
    if (key === 'config') {
      setClauses.push('config = ?');
      values.push(JSON.stringify(value));
    } else {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }
  setClauses.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE bobs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  return getBob(id);
}

export function deleteBob(id: string): void {
  db.prepare('DELETE FROM bobs WHERE id = ?').run(id);
}
