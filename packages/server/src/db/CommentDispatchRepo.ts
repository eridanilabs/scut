import db from './db.js';

export type DispatchStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export const DISPATCH_STATUSES: readonly DispatchStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
];

export interface CommentDispatchRow {
  id: string;
  thread_id: string;
  triggering_comment_id: string | null;
  replicant_id: string;
  status: DispatchStatus;
  connector_handle: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Keyset cursor for stable composite pagination. `createdAt` is the ISO
 * timestamp from the last returned row; `id` ties the order so rows that
 * share the exact same `createdAt` are not skipped.
 */
export interface DispatchCursor {
  createdAt: string;
  id: string;
}

export type DispatchBefore =
  | { kind: 'cursor'; cursor: DispatchCursor }
  | { kind: 'iso'; iso: string }
  | { kind: 'none' };

export interface ListDispatchesFilter {
  /** Maximum rows to return. Caller is responsible for validating range. */
  limit: number;
  /** Pagination bound. */
  before: DispatchBefore;
  /** Optional status filter; if provided must be a valid DispatchStatus. */
  status?: DispatchStatus;
  /** Optional exact-match replicant_id filter. */
  replicantId?: string;
  /**
   * When set, results are restricted to threads on which the given
   * replicant has explicit `can_read = 1` permission. Implemented as an
   * EXISTS join against `thread_permissions` so callers do not need to
   * prefetch thread ids.
   */
  callerReplicantId?: string;
}

/**
 * List comment dispatches matching the supplied filters, ordered by
 * (created_at DESC, id DESC). Callers should fetch `limit + 1` and derive
 * next_cursor by inspecting whether an extra row was returned.
 */
export function listCommentDispatches(
  filter: ListDispatchesFilter
): CommentDispatchRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  switch (filter.before.kind) {
    case 'cursor': {
      // Stable composite keyset: strictly older OR same instant with
      // smaller id. Prevents skipping rows that share `created_at`.
      clauses.push(
        '(created_at < ? OR (created_at = ? AND id < ?))'
      );
      params.push(
        filter.before.cursor.createdAt,
        filter.before.cursor.createdAt,
        filter.before.cursor.id
      );
      break;
    }
    case 'iso': {
      // Legacy ISO-timestamp path: compare canonical ISO strings directly.
      // `parseBefore` normalizes the caller's input via
      //   new Date(Date.parse(raw)).toISOString()
      // so `filter.before.iso` is always in the same canonical
      // "YYYY-MM-DDTHH:mm:ss.sssZ" form as `comment_dispatches.created_at`
      // (see insertCommentDispatch and the column DEFAULT). A direct text
      // comparison therefore yields the correct chronological order AND
      // preserves sub-second precision, which `datetime()` would silently
      // truncate to whole seconds.
      clauses.push('created_at < ?');
      params.push(filter.before.iso);
      break;
    }
    case 'none':
      break;
  }

  if (filter.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter.replicantId) {
    clauses.push('replicant_id = ?');
    params.push(filter.replicantId);
  }
  if (filter.callerReplicantId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM thread_permissions tp ' +
        'WHERE tp.thread_id = comment_dispatches.thread_id ' +
        'AND tp.replicant_id = ? AND tp.can_read = 1)'
    );
    params.push(filter.callerReplicantId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql =
    `SELECT * FROM comment_dispatches ${where} ` +
    `ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(filter.limit);
  return db.prepare(sql).all(...params) as CommentDispatchRow[];
}

export function getCommentDispatch(id: string): CommentDispatchRow | undefined {
  return db
    .prepare('SELECT * FROM comment_dispatches WHERE id = ?')
    .get(id) as CommentDispatchRow | undefined;
}

/**
 * Check whether a replicant has explicit read permission on a thread.
 * Returns true only when a thread_permissions row exists for the pair with
 * can_read = 1. Absent rows are NOT treated as implicit grants.
 */
export function replicantCanReadThread(
  threadId: string,
  replicantId: string
): boolean {
  const row = db
    .prepare(
      'SELECT can_read FROM thread_permissions WHERE thread_id = ? AND replicant_id = ?'
    )
    .get(threadId, replicantId) as { can_read: number } | undefined;
  return row?.can_read === 1;
}

// --- write helpers ---------------------------------------------------------
// These are not part of the public traces API but are used by tests and the
// dev seed to populate deterministic fixtures.

export function insertCommentDispatch(input: {
  id: string;
  threadId: string;
  triggeringCommentId?: string | null;
  replicantId: string;
  status: DispatchStatus;
  connectorHandle?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
}): CommentDispatchRow {
  // Normalize any caller-supplied createdAt to a canonical UTC ISO string
  // (e.g. "2024-01-01T00:00:00.000Z") so cursor pagination, which performs
  // lexical text comparisons on `created_at`, stays well-defined. Reject
  // values Date.parse cannot interpret rather than storing them verbatim.
  let normalizedCreatedAt: string | null = null;
  if (input.createdAt !== undefined) {
    const parsed = Date.parse(input.createdAt);
    if (Number.isNaN(parsed)) {
      throw new Error(
        `insertCommentDispatch: createdAt is not a parseable date: ${input.createdAt}`
      );
    }
    normalizedCreatedAt = new Date(parsed).toISOString();
  }

  const stmt = db.prepare(
    `INSERT INTO comment_dispatches
       (id, thread_id, triggering_comment_id, replicant_id, status,
        connector_handle, error, started_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
             COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
  );
  stmt.run(
    input.id,
    input.threadId,
    input.triggeringCommentId ?? null,
    input.replicantId,
    input.status,
    input.connectorHandle ?? null,
    input.error ?? null,
    input.startedAt ?? null,
    input.completedAt ?? null,
    normalizedCreatedAt
  );
  return getCommentDispatch(input.id)!;
}

export function upsertThreadPermission(
  threadId: string,
  replicantId: string,
  canRead: boolean
): void {
  db.prepare(
    `INSERT INTO thread_permissions (thread_id, replicant_id, can_read)
     VALUES (?, ?, ?)
     ON CONFLICT(thread_id, replicant_id) DO UPDATE SET
       can_read = excluded.can_read,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  ).run(threadId, replicantId, canRead ? 1 : 0);
}
