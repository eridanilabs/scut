// Test for /api/v1/traces/* endpoints.
//
// Run via: npm test (inside packages/server). Uses node:test + tsx so no
// extra runner is required.
//
// IMPORTANT: setup.ts must be imported FIRST so SCUT_DB_PATH and
// SCUT_CALLBACK_SECRET are set before any db/route module is loaded.
import { TEST_DB_PATH } from '../setup.js';

import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildApp } from '../../src/index.js';
import db from '../../src/db/db.js';
import { hashToken } from '../../src/auth/replicantAuth.js';
import {
  insertCommentDispatch,
  upsertThreadPermission,
} from '../../src/db/CommentDispatchRepo.js';

import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

// Test fixtures.
const CALLER_REPLICANT_ID = 'rep_caller_001';
const OTHER_REPLICANT_ID = 'rep_other_001';
const RAW_TOKEN_CALLER = 'scut_rk_test_caller_token';
const RAW_TOKEN_NOPERMS = 'scut_rk_test_noperms_token';
const NOPERMS_REPLICANT_ID = 'rep_noperms_001';

const READABLE_THREAD = 'th_readable_001';
const HIDDEN_THREAD = 'th_hidden_001';
const REVOKED_THREAD = 'th_revoked_001';
const TIED_THREAD = 'th_tied_001';

const DISPATCH_READABLE_QUEUED = 'disp_readable_queued';
const DISPATCH_READABLE_SUCCEEDED = 'disp_readable_succeeded';
const DISPATCH_HIDDEN = 'disp_hidden_001';
const DISPATCH_REVOKED = 'disp_revoked_001';

// Sub-second precision fixtures. Two dispatches on a readable thread that
// share the same whole-second component (12:00:00) but differ in the
// fractional seconds. Used to prove the legacy `before` ISO path compares
// canonical ISO strings rather than calling SQLite `datetime()` which
// truncates fractional seconds.
const SUBSEC_THREAD = 'th_subsec_001';
const SUBSEC_REPLICANT_ID = 'rep_subsec_001';
const DISPATCH_SUBSEC_EARLY = 'disp_subsec_early';
const DISPATCH_SUBSEC_LATE = 'disp_subsec_late';
const SUBSEC_EARLY_CREATED_AT = '2024-01-01T12:00:00.500Z';
const SUBSEC_LATE_CREATED_AT = '2024-01-01T12:00:00.999Z';

// Tied-timestamp dispatches used by the keyset-pagination test. All
// three share the exact same `created_at` so a created_at-only cursor
// would skip the middle row on the second page.
const DISPATCH_TIED_A = 'disp_tied_a';
const DISPATCH_TIED_B = 'disp_tied_b';
const DISPATCH_TIED_C = 'disp_tied_c';
const TIED_CREATED_AT = '2024-02-01T00:00:00.000Z';

function seedFixtures(): void {
  // Replicants.
  for (const [id, name] of [
    [CALLER_REPLICANT_ID, 'caller'],
    [OTHER_REPLICANT_ID, 'other'],
    [NOPERMS_REPLICANT_ID, 'noperms'],
    [SUBSEC_REPLICANT_ID, 'subsec'],
  ]) {
    db.prepare(
      `INSERT INTO replicants (id, name, harness, config, status)
       VALUES (?, ?, 'copilot-bridge', '{}', 'online')`
    ).run(id, name);
  }

  // Tokens.
  db.prepare(
    `INSERT INTO replicant_tokens (id, replicant_id, token_hash)
     VALUES (?, ?, ?)`
  ).run('tok_caller', CALLER_REPLICANT_ID, hashToken(RAW_TOKEN_CALLER));
  db.prepare(
    `INSERT INTO replicant_tokens (id, replicant_id, token_hash)
     VALUES (?, ?, ?)`
  ).run('tok_noperms', NOPERMS_REPLICANT_ID, hashToken(RAW_TOKEN_NOPERMS));

  // Threads.
  for (const id of [READABLE_THREAD, HIDDEN_THREAD, REVOKED_THREAD, TIED_THREAD, SUBSEC_THREAD]) {
    db.prepare(
      `INSERT INTO threads (id, title) VALUES (?, ?)`
    ).run(id, `thread ${id}`);
  }

  // Permission: only caller can read READABLE_THREAD and TIED_THREAD.
  upsertThreadPermission(READABLE_THREAD, CALLER_REPLICANT_ID, true);
  upsertThreadPermission(TIED_THREAD, CALLER_REPLICANT_ID, true);
  upsertThreadPermission(SUBSEC_THREAD, CALLER_REPLICANT_ID, true);
  // Explicit can_read=0 row to exercise the "row exists but denies" path
  // as distinct from "no row exists at all".
  upsertThreadPermission(REVOKED_THREAD, CALLER_REPLICANT_ID, false);

  // Dispatches. Note: we set explicit ascending createdAt timestamps to
  // produce a deterministic ordering for pagination tests.
  insertCommentDispatch({
    id: DISPATCH_READABLE_QUEUED,
    threadId: READABLE_THREAD,
    replicantId: OTHER_REPLICANT_ID,
    status: 'queued',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  insertCommentDispatch({
    id: DISPATCH_READABLE_SUCCEEDED,
    threadId: READABLE_THREAD,
    replicantId: OTHER_REPLICANT_ID,
    status: 'succeeded',
    createdAt: '2024-01-02T00:00:00.000Z',
  });
  insertCommentDispatch({
    id: DISPATCH_HIDDEN,
    threadId: HIDDEN_THREAD,
    replicantId: OTHER_REPLICANT_ID,
    status: 'queued',
    createdAt: '2024-01-03T00:00:00.000Z',
  });
  // Dispatch on a thread whose permission row exists with can_read=0.
  insertCommentDispatch({
    id: DISPATCH_REVOKED,
    threadId: REVOKED_THREAD,
    replicantId: OTHER_REPLICANT_ID,
    status: 'queued',
    createdAt: '2024-01-04T00:00:00.000Z',
  });
  // Three dispatches sharing the EXACT same created_at - used to verify
  // composite-keyset pagination does not skip rows with tied timestamps.
  for (const id of [DISPATCH_TIED_A, DISPATCH_TIED_B, DISPATCH_TIED_C]) {
    insertCommentDispatch({
      id,
      threadId: TIED_THREAD,
      replicantId: OTHER_REPLICANT_ID,
      status: 'queued',
      createdAt: TIED_CREATED_AT,
    });
  }

  // Two dispatches on the same whole second but differing fractional
  // seconds, on their own thread/replicant so they cannot perturb the
  // status=queued / replicant_id=OTHER_REPLICANT_ID assertions above.
  // Status 'running' keeps them out of every queued/succeeded fixture.
  insertCommentDispatch({
    id: DISPATCH_SUBSEC_EARLY,
    threadId: SUBSEC_THREAD,
    replicantId: SUBSEC_REPLICANT_ID,
    status: 'running',
    createdAt: SUBSEC_EARLY_CREATED_AT,
  });
  insertCommentDispatch({
    id: DISPATCH_SUBSEC_LATE,
    threadId: SUBSEC_THREAD,
    replicantId: SUBSEC_REPLICANT_ID,
    status: 'running',
    createdAt: SUBSEC_LATE_CREATED_AT,
  });
}

before(async () => {
  seedFixtures();
  app = await buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  for (const ext of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(TEST_DB_PATH + ext);
    } catch {
      /* ignore */
    }
  }
});

function authHeaders(raw: string): Record<string, string> {
  return { authorization: `Bearer ${raw}` };
}

describe('GET /api/v1/traces', () => {
  test('401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/traces' });
    assert.equal(res.statusCode, 401);
  });

  test('200 returns only dispatches on readable threads', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string; thread_id: string }>; next_cursor: string | null };
    const ids = body.dispatches.map((d) => d.id).sort();
    assert.deepEqual(ids, [
      DISPATCH_READABLE_QUEUED,
      DISPATCH_READABLE_SUCCEEDED,
      DISPATCH_SUBSEC_EARLY,
      DISPATCH_SUBSEC_LATE,
      DISPATCH_TIED_A,
      DISPATCH_TIED_B,
      DISPATCH_TIED_C,
    ]);
    // None should reference the hidden or revoked threads.
    for (const d of body.dispatches) {
      assert.notEqual(d.thread_id, HIDDEN_THREAD);
      assert.notEqual(d.thread_id, REVOKED_THREAD);
    }
    assert.equal(body.next_cursor, null);
  });

  test('200 empty for caller with no permissions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces',
      headers: authHeaders(RAW_TOKEN_NOPERMS),
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { dispatches: [], next_cursor: null });
  });

  test('status filter narrows results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?status=succeeded',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string; status: string }> };
    assert.equal(body.dispatches.length, 1);
    assert.equal(body.dispatches[0]!.id, DISPATCH_READABLE_SUCCEEDED);
  });

  test('400 on invalid status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?status=bogus',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on non-integer limit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?limit=abc',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on limit < 1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?limit=0',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on limit > MAX_LIMIT (201)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?limit=201',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error: string; message: string };
    assert.equal(body.error, 'bad_request');
    assert.match(body.message, /1 and 200/);
  });

  test('400 on invalid before', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?before=not-a-date',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on base64url cursor whose decoded created_at is not a valid ISO datetime', async () => {
    // Hand-crafted opaque-looking cursor that decodes to bogus fields.
    // tryDecodeCursor must reject it (strict ISO + non-empty id), and the
    // legacy ISO fallback must also reject the base64url string (no ':').
    // The route must therefore return 400 rather than silently widening
    // the query to all rows.
    const bogus = Buffer.from(
      JSON.stringify({ created_at: 'bogus', id: 'bogus' }),
      'utf8'
    ).toString('base64url');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?before=${encodeURIComponent(bogus)}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on loose before like a year-only string', async () => {
    // Date.parse('2024') returns a number, but the legacy `before` path
    // should require a strict ISO-like datetime and reject this with 400.
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?before=2024',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('400 on date-only before', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?before=2024-01-02',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
  });

  test('200 on strict ISO before with timezone offset', async () => {
    // before=2024-01-02T00:00:00+00:00 is equivalent to
    // 2024-01-02T00:00:00.000Z. With status=queued the readable rows that
    // are strictly older than that bound are exactly:
    //   - DISPATCH_READABLE_QUEUED (2024-01-01T00:00:00.000Z)
    // The tied queued rows (2024-02-01) are newer and must be excluded.
    // If the `before` filter were silently dropped, the response would
    // also contain DISPATCH_TIED_{A,B,C}, so asserting on the exact id
    // set proves the offset timestamp was applied.
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?before=${encodeURIComponent('2024-01-02T00:00:00+00:00')}&status=queued`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string }> };
    const ids = body.dispatches.map((d) => d.id);
    assert.deepEqual(ids, [DISPATCH_READABLE_QUEUED]);
  });

  test('before preserves sub-second precision (no datetime() truncation)', async () => {
    // Two readable dispatches share the whole-second component
    // 2024-01-01T12:00:00 but differ in fractional seconds:
    //   - SUBSEC_EARLY @ .500Z
    //   - SUBSEC_LATE  @ .999Z
    // Bound at .999Z must include EARLY (strictly older) and exclude
    // LATE (equal, not strictly less). If the legacy ISO `before` path
    // were implemented with SQLite `datetime()`, both rows would be
    // truncated to 12:00:00 and neither would satisfy `< 12:00:00`,
    // returning an empty list - so the assertions below would fail.
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?before=${encodeURIComponent('2024-01-01T12:00:00.999Z')}&status=running`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string; created_at: string }> };
    const ids = body.dispatches.map((d) => d.id);
    assert.deepEqual(ids, [DISPATCH_SUBSEC_EARLY]);
    assert.equal(body.dispatches[0]!.created_at, SUBSEC_EARLY_CREATED_AT);

    // And a tighter bound at .500Z must exclude EARLY itself.
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?before=${encodeURIComponent('2024-01-01T12:00:00.500Z')}&status=running`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res2.statusCode, 200);
    const body2 = res2.json() as { dispatches: Array<{ id: string }> };
    assert.deepEqual(body2.dispatches.map((d) => d.id), []);
  });

  test('limit=1 produces opaque next_cursor that decodes to last row', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?limit=1',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      dispatches: Array<{ id: string; created_at: string }>;
      next_cursor: string | null;
    };
    assert.equal(body.dispatches.length, 1);
    // Order is (created_at DESC, id DESC); the tied rows (created_at
    // 2024-02-01) are newer than both 2024-01 readable rows.
    const tiedNewest = [DISPATCH_TIED_A, DISPATCH_TIED_B, DISPATCH_TIED_C]
      .sort()
      .reverse()[0]!; // largest id
    assert.equal(body.dispatches[0]!.id, tiedNewest);
    assert.ok(body.next_cursor);
    // Cursor must be opaque (URL-safe base64url chars only), not an ISO
    // timestamp; decoded payload must reference the returned row.
    assert.match(body.next_cursor!, /^[A-Za-z0-9_-]+=*$/);
    const decoded = JSON.parse(
      Buffer.from(body.next_cursor!, 'base64url').toString('utf8')
    ) as { created_at: string; id: string };
    assert.equal(decoded.id, body.dispatches[0]!.id);
    assert.equal(decoded.created_at, body.dispatches[0]!.created_at);
  });

  test('keyset pagination does not skip rows with tied created_at', async () => {
    // Restrict to TIED_THREAD via replicant_id filter is not possible (all
    // tied rows share the replicant). Instead we use status=queued AND
    // before=cursor across the tied + readable_queued set. The tied
    // dispatches and DISPATCH_READABLE_QUEUED are all status=queued; the
    // revoked-thread queued row is excluded by permission scoping.
    //
    // Page 1: limit=2 over status=queued returns the two largest-id tied
    // rows (both share created_at=TIED_CREATED_AT). Page 2 with the
    // returned cursor must include the third tied row, then
    // DISPATCH_READABLE_QUEUED.
    const page1 = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?status=queued&limit=2',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(page1.statusCode, 200);
    const body1 = page1.json() as {
      dispatches: Array<{ id: string; created_at: string }>;
      next_cursor: string | null;
    };
    assert.equal(body1.dispatches.length, 2);
    assert.ok(body1.next_cursor, 'page 1 must produce a next_cursor');
    // Both rows must share the tied created_at.
    for (const d of body1.dispatches) {
      assert.equal(d.created_at, TIED_CREATED_AT);
    }

    const page2 = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?status=queued&limit=2&before=${encodeURIComponent(body1.next_cursor!)}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(page2.statusCode, 200);
    const body2 = page2.json() as {
      dispatches: Array<{ id: string; created_at: string }>;
      next_cursor: string | null;
    };
    // Must contain the third tied row (the one a created_at-only cursor
    // would have skipped) plus the older readable_queued row.
    const page2Ids = body2.dispatches.map((d) => d.id).sort();
    const pickedFirstTwo = body1.dispatches.map((d) => d.id).sort();
    const allTied = [DISPATCH_TIED_A, DISPATCH_TIED_B, DISPATCH_TIED_C].sort();
    const missingTied = allTied.filter((id) => !pickedFirstTwo.includes(id));
    assert.equal(missingTied.length, 1);
    assert.ok(
      page2Ids.includes(missingTied[0]!),
      `page 2 must include the un-returned tied row ${missingTied[0]}`
    );
    assert.ok(
      page2Ids.includes(DISPATCH_READABLE_QUEUED),
      'page 2 must include the older queued readable row'
    );
  });

  test('cursor with +00:00 offset normalizes to canonical Z', async () => {
    // Hand-craft two cursors that point to the same instant: one using
    // the canonical "Z" suffix (matches the stored created_at form) and
    // one using the equivalent "+00:00" timezone offset. Both must
    // produce the same result set. Without normalization the offset form
    // would be compared lexically against canonical "...Z" values in
    // SQLite and could include/exclude the wrong rows.
    const canonicalCursor = Buffer.from(
      JSON.stringify({
        created_at: '2024-01-02T00:00:00.000Z',
        id: 'zzz_after_all_jan1_rows',
      }),
      'utf8'
    ).toString('base64url');
    const offsetCursor = Buffer.from(
      JSON.stringify({
        created_at: '2024-01-02T00:00:00.000+00:00',
        id: 'zzz_after_all_jan1_rows',
      }),
      'utf8'
    ).toString('base64url');

    const resZ = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?status=queued&before=${encodeURIComponent(canonicalCursor)}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    const resOffset = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?status=queued&before=${encodeURIComponent(offsetCursor)}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });

    assert.equal(resZ.statusCode, 200);
    assert.equal(resOffset.statusCode, 200);
    const idsZ = (resZ.json() as { dispatches: Array<{ id: string }> })
      .dispatches.map((d) => d.id);
    const idsOffset = (resOffset.json() as { dispatches: Array<{ id: string }> })
      .dispatches.map((d) => d.id);
    assert.deepEqual(idsOffset, idsZ);
    // Must apply the bound: DISPATCH_READABLE_QUEUED is at 2024-01-01
    // and is older than the cursor; tied rows at 2024-02-01 are newer
    // and must be excluded.
    assert.ok(idsZ.includes(DISPATCH_READABLE_QUEUED));
    for (const id of [DISPATCH_TIED_A, DISPATCH_TIED_B, DISPATCH_TIED_C]) {
      assert.equal(idsZ.includes(id), false);
    }
  });

  test('before accepts a legacy ISO timestamp', async () => {
    // ISO bound just after DISPATCH_READABLE_QUEUED.createdAt; should
    // return only that row out of the two non-tied readable rows.
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?before=${encodeURIComponent('2024-01-02T00:00:00.000Z')}&status=queued`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string }> };
    const ids = body.dispatches.map((d) => d.id);
    assert.ok(ids.includes(DISPATCH_READABLE_QUEUED));
    // Tied rows are at 2024-02-01 which is NOT strictly less than the
    // 2024-01-02 bound.
    for (const id of [DISPATCH_TIED_A, DISPATCH_TIED_B, DISPATCH_TIED_C]) {
      assert.equal(ids.includes(id), false);
    }
  });

  test('400 on empty replicant_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?replicant_id=',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error: string; message: string };
    assert.equal(body.error, 'bad_request');
    assert.match(body.message, /replicant_id must not be empty/);
  });

  test('replicant_id filter applies', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?replicant_id=${OTHER_REPLICANT_ID}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<unknown> };
    // 2 readable + 3 tied. Hidden + revoked are excluded by permission.
    assert.equal(body.dispatches.length, 5);

    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/traces?replicant_id=does_not_exist`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res2.statusCode, 200);
    assert.equal((res2.json() as { dispatches: unknown[] }).dispatches.length, 0);
  });

  test('list excludes dispatches on threads where can_read=0', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { dispatches: Array<{ id: string }> };
    const ids = body.dispatches.map((d) => d.id);
    assert.equal(
      ids.includes(DISPATCH_REVOKED),
      false,
      'list must not include dispatches whose thread_permissions row has can_read=0'
    );
  });
});

describe('GET /api/v1/traces/:id', () => {
  test('401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_READABLE_QUEUED}`,
    });
    assert.equal(res.statusCode, 401);
  });

  test('200 for readable dispatch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_READABLE_QUEUED}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { id: string };
    assert.equal(body.id, DISPATCH_READABLE_QUEUED);
  });

  test('404 for missing id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces/does_not_exist',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 404);
  });

  test('403 when caller lacks permission on the dispatch thread', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_HIDDEN}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: 'forbidden' });
  });

  test('403 when caller has an explicit can_read=0 row on the dispatch thread', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_REVOKED}`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: 'forbidden' });
  });
});

describe('GET /api/v1/traces/:id/events', () => {
  test('401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_READABLE_QUEUED}/events`,
    });
    assert.equal(res.statusCode, 401);
  });

  test('404 for missing dispatch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces/does_not_exist/events',
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 404);
  });

  test('403 when caller lacks permission', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_HIDDEN}/events`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 403);
  });

  test('403 when caller has an explicit can_read=0 row on the thread', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_REVOKED}/events`,
      headers: authHeaders(RAW_TOKEN_CALLER),
    });
    assert.equal(res.statusCode, 403);
  });

  test('501 when permitted but event persistence is disabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${DISPATCH_READABLE_QUEUED}/events`,
      headers: {
        ...authHeaders(RAW_TOKEN_CALLER),
        accept: 'text/event-stream',
      },
    });
    assert.equal(res.statusCode, 501);
    assert.deepEqual(res.json(), { error: 'event persistence not yet enabled' });
  });
});
