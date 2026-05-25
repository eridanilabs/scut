import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireReplicantAuth } from '../auth/replicantAuth.js';
import {
  DISPATCH_STATUSES,
  type DispatchStatus,
  type CommentDispatchRow,
  type DispatchBefore,
  type DispatchCursor,
  getCommentDispatch,
  listCommentDispatches,
  replicantCanReadThread,
} from '../db/CommentDispatchRepo.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface ListQuery {
  limit?: string;
  before?: string;
  status?: string;
  replicant_id?: string;
}

interface TraceDto {
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

function toDto(row: CommentDispatchRow): TraceDto {
  return {
    id: row.id,
    thread_id: row.thread_id,
    triggering_comment_id: row.triggering_comment_id,
    replicant_id: row.replicant_id,
    status: row.status,
    connector_handle: row.connector_handle,
    error: row.error,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: 'bad_request', message });
}

// --- cursor encoding -------------------------------------------------------
// next_cursor is an opaque URL-safe base64 of the JSON `{ created_at, id }`
// of the last returned row. Containing both keys lets pagination stay
// stable when multiple rows share the exact same created_at.

function encodeCursor(c: DispatchCursor): string {
  const json = JSON.stringify({ created_at: c.createdAt, id: c.id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

// Strict ISO-like datetime regex for the legacy `before` parameter and for
// validating decoded cursor payloads. Accepts:
//   YYYY-MM-DDTHH:mm:ss(.sss)?Z
//   YYYY-MM-DDTHH:mm:ss(.sss)?±HH:MM
// Anything looser (e.g. "2024", "2024-01-02", "Jan 2 2024", "bogus") is
// rejected so callers cannot accidentally widen the result window.
const STRICT_ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function tryDecodeCursor(value: string): DispatchCursor | null {
  // Reject anything that does not look like base64url (e.g. ISO strings,
  // which contain ':' and '.' and are also rejected by base64url's
  // alphabet). We still validate the decoded structure defensively.
  if (!/^[A-Za-z0-9_-]+=*$/.test(value)) return null;
  let json: string;
  try {
    json = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !obj ||
    typeof obj !== 'object' ||
    typeof (obj as { created_at?: unknown }).created_at !== 'string' ||
    typeof (obj as { id?: unknown }).id !== 'string'
  ) {
    return null;
  }
  const o = obj as { created_at: string; id: string };
  // The cursor's created_at must be a strict ISO datetime string AND parse
  // to a valid Date. This prevents an attacker-crafted payload like
  // `{ "created_at": "bogus", "id": "bogus" }` from silently degrading the
  // keyset filter into a no-op (text comparison `created_at < 'bogus'`
  // would otherwise be evaluated by SQLite as a lexical comparison and
  // could include arbitrary rows).
  if (!STRICT_ISO_RE.test(o.created_at)) return null;
  const parsedCreatedAt = Date.parse(o.created_at);
  if (Number.isNaN(parsedCreatedAt)) return null;
  // id must be non-empty so the composite (created_at, id) tie-breaker
  // does not collapse to an unbounded comparison.
  if (o.id.length === 0) return null;
  // Normalize to canonical UTC ISO so a hand-crafted cursor with a
  // timezone offset (e.g. "+00:00") compares the same as its Z form
  // against `comment_dispatches.created_at`, which is stored as
  // canonical "...Z". Without this the lexical text comparison used by
  // the keyset filter could yield surprising orderings.
  return { createdAt: new Date(parsedCreatedAt).toISOString(), id: o.id };
}

function parseBefore(raw: string): DispatchBefore | { error: string } {
  // First attempt: opaque cursor (preferred).
  const cursor = tryDecodeCursor(raw);
  if (cursor) {
    return { kind: 'cursor', cursor };
  }
  // Fall back to a legacy ISO timestamp accepted by the original spec.
  // Require a strict ISO-like shape before handing to Date.parse, since
  // Date.parse otherwise accepts loose inputs like "2024".
  if (!STRICT_ISO_RE.test(raw)) {
    return { error: 'before must be an opaque cursor or ISO timestamp' };
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return { error: 'before must be an opaque cursor or ISO timestamp' };
  }
  // Normalize to canonical ISO so SQL datetime() comparison is well-defined
  // regardless of the exact text the caller supplied.
  return { kind: 'iso', iso: new Date(parsed).toISOString() };
}

export default async function traceRoutes(app: FastifyInstance) {
  // GET /traces - list dispatches readable by the caller.
  app.get<{ Querystring: ListQuery }>(
    '/traces',
    { preHandler: requireReplicantAuth },
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply) => {
      const replicant = request.replicant!;
      const q = request.query ?? {};

      // limit
      let limit = DEFAULT_LIMIT;
      if (q.limit !== undefined) {
        const n = Number(q.limit);
        if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
          return badRequest(
            reply,
            `limit must be an integer between 1 and ${MAX_LIMIT}`
          );
        }
        limit = n;
      }

      // before
      let before: DispatchBefore = { kind: 'none' };
      if (q.before !== undefined) {
        const parsed = parseBefore(q.before);
        if ('error' in parsed) {
          return badRequest(reply, parsed.error);
        }
        before = parsed;
      }

      // status
      let status: DispatchStatus | undefined;
      if (q.status !== undefined) {
        if (!(DISPATCH_STATUSES as readonly string[]).includes(q.status)) {
          return badRequest(
            reply,
            `status must be one of ${DISPATCH_STATUSES.join(', ')}`
          );
        }
        status = q.status as DispatchStatus;
      }

      // replicant_id: if present, must be non-empty. Treat `?replicant_id=`
      // as a client error rather than silently dropping the filter and
      // returning all readable traces.
      let replicantIdFilter: string | undefined;
      if (q.replicant_id !== undefined) {
        if (typeof q.replicant_id !== 'string' || q.replicant_id.length === 0) {
          return badRequest(reply, 'replicant_id must not be empty');
        }
        replicantIdFilter = q.replicant_id;
      }

      // Fetch limit + 1 to compute next_cursor accurately. Permission
      // scoping is pushed into the SQL via an EXISTS join against
      // thread_permissions; we never materialize the full readable-thread
      // set here.
      const rows = listCommentDispatches({
        limit: limit + 1,
        before,
        status,
        replicantId: replicantIdFilter,
        callerReplicantId: replicant.id,
      });

      let nextCursor: string | null = null;
      let returned = rows;
      if (rows.length > limit) {
        returned = rows.slice(0, limit);
        const last = returned[returned.length - 1]!;
        nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id });
      }

      return reply.send({
        dispatches: returned.map(toDto),
        next_cursor: nextCursor,
      });
    }
  );

  // GET /traces/:id - detail.
  app.get<{ Params: { id: string } }>(
    '/traces/:id',
    { preHandler: requireReplicantAuth },
    async (request, reply) => {
      const replicant = request.replicant!;
      const row = getCommentDispatch(request.params.id);
      if (!row) {
        return reply.status(404).send({ error: 'not_found' });
      }
      if (!replicantCanReadThread(row.thread_id, replicant.id)) {
        return reply.status(403).send({ error: 'forbidden' });
      }
      return reply.send(toDto(row));
    }
  );

  // GET /traces/:id/events - event persistence not yet enabled.
  // Even when Accept includes text/event-stream we still respond 501
  // because no underlying event store exists.
  app.get<{ Params: { id: string } }>(
    '/traces/:id/events',
    { preHandler: requireReplicantAuth },
    async (request, reply) => {
      const replicant = request.replicant!;
      const row = getCommentDispatch(request.params.id);
      if (!row) {
        return reply.status(404).send({ error: 'not_found' });
      }
      if (!replicantCanReadThread(row.thread_id, replicant.id)) {
        return reply.status(403).send({ error: 'forbidden' });
      }
      return reply
        .status(501)
        .send({ error: 'event persistence not yet enabled' });
    }
  );
}
