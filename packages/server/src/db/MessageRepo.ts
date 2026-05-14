import { nanoid } from 'nanoid';
import db from './db.js';

export type MessageRow = {
  id: string;
  thread_id: string;
  run_id: string | null;
  author: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

export function listMessages(threadId: string): MessageRow[] {
  return db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC').all(threadId) as MessageRow[];
}

export function getMessage(id: string): MessageRow | undefined {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
}

export function createMessage(fields: { threadId: string; runId?: string | null; author: string; authorId?: string | null; content: string }): MessageRow {
  const id = nanoid();
  const run_id = fields.runId ?? null;
  const author_id = fields.authorId ?? null;
  db.prepare('INSERT INTO messages (id, thread_id, run_id, author, author_id, content) VALUES (?, ?, ?, ?, ?, ?)').run(id, fields.threadId, run_id, fields.author, author_id, fields.content);
  return getMessage(id)!;
}
