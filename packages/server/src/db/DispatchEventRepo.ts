import { nanoid } from 'nanoid';
import db from './db.js';

export interface DispatchEventRow {
  id: string;
  dispatch_id: string;
  sequence: number;
  kind: string;
  payload: string; // JSON-serialized SessionUpdateParams
  created_at: string;
}

/**
 * Append a single dispatch event. Allocates the next monotonic
 * `sequence` for the given dispatch atomically within a transaction so
 * that concurrent inserts cannot collide on the
 * UNIQUE(dispatch_id, sequence) constraint.
 */
export function appendDispatchEvent(input: {
  dispatchId: string;
  kind: string;
  payload: unknown;
}): DispatchEventRow {
  const id = nanoid();
  const serialized = JSON.stringify(input.payload ?? null);

  const insert = db.transaction((dispatchId: string, kind: string, payload: string): DispatchEventRow => {
    const row = db
      .prepare(
        'SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM dispatch_events WHERE dispatch_id = ?'
      )
      .get(dispatchId) as { next: number };
    const sequence = row.next;
    db.prepare(
      `INSERT INTO dispatch_events (id, dispatch_id, sequence, kind, payload)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, dispatchId, sequence, kind, payload);
    return db
      .prepare('SELECT * FROM dispatch_events WHERE id = ?')
      .get(id) as DispatchEventRow;
  });

  try {
    return insert(input.dispatchId, input.kind, serialized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg)) {
      throw new Error(
        'DispatchEventRepo.appendDispatchEvent: sequence collision'
      );
    }
    throw err;
  }
}

export function listDispatchEvents(dispatchId: string): DispatchEventRow[] {
  return db
    .prepare(
      'SELECT * FROM dispatch_events WHERE dispatch_id = ? ORDER BY sequence ASC'
    )
    .all(dispatchId) as DispatchEventRow[];
}

export function countDispatchEvents(dispatchId: string): number {
  const row = db
    .prepare(
      'SELECT COUNT(*) AS n FROM dispatch_events WHERE dispatch_id = ?'
    )
    .get(dispatchId) as { n: number };
  return row.n;
}
