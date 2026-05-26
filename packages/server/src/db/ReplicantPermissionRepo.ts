import { nanoid } from 'nanoid';
import db from './db.js';

export interface ReplicantPermissionRow {
  id: string;
  replicant_id: string;
  tool: string;
  scope: 'session' | 'replicant';
  decision: 'allow' | 'deny';
  acp_session_id: string | null;
  created_at: string;
}

/**
 * Normalize a tool key for permission matching.
 *
 * Rules:
 * - lowercase
 * - trim leading/trailing whitespace
 * - collapse internal whitespace runs to a single '/'
 * - collapse consecutive internal '/' runs to a single '/'
 * - strip leading/trailing '/'
 * - preserve underscores and existing slash-separated keys
 *
 * Examples:
 *   '  Read File  '            -> 'read/file'
 *   'fs/read_text_file'        -> 'fs/read_text_file'
 *   'Terminal Execute'         -> 'terminal/execute'
 *   'fs/  readFile'            -> 'fs/readfile'
 *   '///Terminal   Execute///' -> 'terminal/execute'
 */
export function normalizeToolKey(input: string): string {
  const lowered = input.toLowerCase().trim();
  const collapsed = lowered.replace(/\s+/g, '/').replace(/\/+/g, '/');
  return collapsed.replace(/^\/+|\/+$/g, '');
}

export function upsertReplicantPermission(input: {
  replicantId: string;
  tool: string;
  scope: 'session' | 'replicant';
  decision: 'allow' | 'deny';
  acpSessionId?: string | null;
}): ReplicantPermissionRow {
  const acpSessionId = input.acpSessionId ?? null;
  if (
    input.scope === 'session' &&
    (acpSessionId === null ||
      acpSessionId === '' ||
      acpSessionId.trim() === '')
  ) {
    throw new Error('scope=session requires acp_session_id');
  }
  if (input.scope === 'replicant' && acpSessionId !== null) {
    throw new Error('scope=replicant must not include acp_session_id');
  }

  const tool = normalizeToolKey(input.tool);
  if (tool === '') {
    throw new Error('tool must not be empty after normalization');
  }
  const id = nanoid();

  db.prepare(
    `INSERT INTO replicant_permissions
       (id, replicant_id, tool, scope, decision, acp_session_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(replicant_id, tool, scope, COALESCE(acp_session_id, ''))
     DO UPDATE SET decision = excluded.decision, created_at = datetime('now')`
  ).run(id, input.replicantId, tool, input.scope, input.decision, acpSessionId);

  const row = db
    .prepare(
      `SELECT * FROM replicant_permissions
       WHERE replicant_id = ?
         AND tool = ?
         AND scope = ?
         AND COALESCE(acp_session_id, '') = COALESCE(?, '')`
    )
    .get(input.replicantId, tool, input.scope, acpSessionId) as ReplicantPermissionRow;
  return row;
}

export function getReplicantPermission(input: {
  replicantId: string;
  tool: string;
  scope: 'session' | 'replicant';
  acpSessionId?: string | null;
}): ReplicantPermissionRow | undefined {
  const tool = normalizeToolKey(input.tool);
  if (tool === '') {
    throw new Error('tool must not be empty after normalization');
  }
  const acpSessionId = input.acpSessionId ?? null;
  return db
    .prepare(
      `SELECT * FROM replicant_permissions
       WHERE replicant_id = ?
         AND tool = ?
         AND scope = ?
         AND COALESCE(acp_session_id, '') = COALESCE(?, '')`
    )
    .get(input.replicantId, tool, input.scope, acpSessionId) as
    | ReplicantPermissionRow
    | undefined;
}

export function listReplicantPermissions(replicantId: string): ReplicantPermissionRow[] {
  return db
    .prepare(
      'SELECT * FROM replicant_permissions WHERE replicant_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(replicantId) as ReplicantPermissionRow[];
}

export function deleteReplicantPermission(id: string, replicantId: string): boolean {
  const info = db
    .prepare('DELETE FROM replicant_permissions WHERE id = ? AND replicant_id = ?')
    .run(id, replicantId);
  return info.changes > 0;
}
