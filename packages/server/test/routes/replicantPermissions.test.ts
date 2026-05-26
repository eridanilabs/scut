import '../setup.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';
import { buildApp } from '../../src/index.js';
import db from '../../src/db/db.js';
import { hashToken } from '../../src/auth/replicantAuth.js';
import type { FastifyInstance } from 'fastify';

function seedReplicant(name: string): string {
  const id = nanoid();
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'unknown')"
  ).run(id, name);
  return id;
}

function seedToken(replicantId: string): string {
  const raw = `scut_rk_${nanoid(24)}`;
  const id = nanoid();
  db.prepare(
    'INSERT INTO replicant_tokens (id, replicant_id, token_hash) VALUES (?, ?, ?)'
  ).run(id, replicantId, hashToken(raw));
  return raw;
}

describe('routes: replicant permissions', () => {
  let app: FastifyInstance;
  let replicantId: string;
  let rawToken: string;
  let authHeaders: Record<string, string>;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
    replicantId = seedReplicant(`route-test-${nanoid(6)}`);
    rawToken = seedToken(replicantId);
    authHeaders = { authorization: `Bearer ${rawToken}` };
  });

  it('GET /replicants/:id/permissions returns 200 and an array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body));
  });

  it('GET /replicants/:id/permissions returns 404 for missing replicant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/replicants/__nope__/permissions',
      headers: authHeaders,
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: 'replicant not found' });
  });

  it('GET without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantId}/permissions`,
    });
    assert.equal(res.statusCode, 401);
  });

  it('GET missing replicant without auth returns 404 (precedes auth)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/replicants/__nope__/permissions',
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: 'replicant not found' });
  });

  it('PUT missing replicant without auth returns 404 (precedes auth)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/replicants/__nope__/permissions',
      payload: { tool: 'a', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: 'replicant not found' });
  });

  it('PUT existing replicant without auth returns 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      payload: { tool: 'a', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('PUT 400 when scope=session and acpSessionId is empty string', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: {
        tool: 'fs/write_text_file',
        scope: 'session',
        decision: 'allow',
        acpSessionId: '',
      },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: 'scope=session requires acpSessionId' });
  });

  it('PUT 400 when tool normalizes to empty string', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: { tool: '   ', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), {
      error: 'tool must not be empty after normalization',
    });
  });

  it('PUT happy path scope=replicant; GET round-trips it', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: { tool: 'fs/read_text_file', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(putRes.statusCode, 200);
    const row = putRes.json() as {
      id: string;
      tool: string;
      scope: string;
      decision: string;
      acp_session_id: string | null;
    };
    assert.equal(row.tool, 'fs/read_text_file');
    assert.equal(row.scope, 'replicant');
    assert.equal(row.decision, 'allow');
    assert.equal(row.acp_session_id, null);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
    });
    assert.equal(listRes.statusCode, 200);
    const list = listRes.json() as { id: string }[];
    assert.ok(list.some((r) => r.id === row.id));
  });

  it('PUT 400 when scope=session and acpSessionId is missing', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: { tool: 'fs/write_text_file', scope: 'session', decision: 'allow' },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: 'scope=session requires acpSessionId' });
  });

  it('PUT 400 when scope=replicant and acpSessionId is provided', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: {
        tool: 'fs/write_text_file',
        scope: 'replicant',
        decision: 'allow',
        acpSessionId: 'sess-x',
      },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), {
      error: 'scope=replicant must not include acpSessionId',
    });
  });

  it('PUT 404 for missing replicant', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/replicants/__nope__/permissions',
      headers: authHeaders,
      payload: { tool: 'a', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: 'replicant not found' });
  });

  it('DELETE 204 for existing and 404 for missing', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantId}/permissions`,
      headers: authHeaders,
      payload: { tool: 'delete/me/route', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(putRes.statusCode, 200);
    const { id } = putRes.json() as { id: string };

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/replicants/permissions/${id}`,
      headers: authHeaders,
    });
    assert.equal(delRes.statusCode, 204);

    const delAgain = await app.inject({
      method: 'DELETE',
      url: `/api/v1/replicants/permissions/${id}`,
      headers: authHeaders,
    });
    assert.equal(delAgain.statusCode, 404);
  });
});

describe('routes: replicant permissions cross-replicant authorization', () => {
  let app: FastifyInstance;
  let replicantA: string;
  let replicantB: string;
  let tokenA: string;
  let tokenB: string;
  let headersA: Record<string, string>;
  let headersB: Record<string, string>;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
    replicantA = seedReplicant(`route-auth-A-${nanoid(6)}`);
    replicantB = seedReplicant(`route-auth-B-${nanoid(6)}`);
    tokenA = seedToken(replicantA);
    tokenB = seedToken(replicantB);
    headersA = { authorization: `Bearer ${tokenA}` };
    headersB = { authorization: `Bearer ${tokenB}` };
  });

  it('GET with token for A targeting B returns 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantB}/permissions`,
      headers: headersA,
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: 'forbidden' });
  });

  it('PUT with token for A targeting B returns 403 and does not create permission on B', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantB}/permissions`,
      headers: headersA,
      payload: { tool: 'cross/tenant', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: 'forbidden' });

    // Verify B owns nothing for that tool.
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantB}/permissions`,
      headers: headersB,
    });
    assert.equal(listRes.statusCode, 200);
    const list = listRes.json() as { tool: string }[];
    assert.ok(!list.some((r) => r.tool === 'cross/tenant'));
  });

  it('DELETE with token for A on a permission owned by B returns 404 and does not delete', async () => {
    // Create a permission on B via B's token.
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/replicants/${replicantB}/permissions`,
      headers: headersB,
      payload: { tool: 'b/owned', scope: 'replicant', decision: 'allow' },
    });
    assert.equal(putRes.statusCode, 200);
    const { id } = putRes.json() as { id: string };

    // A tries to delete it.
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/replicants/permissions/${id}`,
      headers: headersA,
    });
    assert.equal(delRes.statusCode, 404);
    assert.deepEqual(delRes.json(), { error: 'not found' });

    // Still exists for B.
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/replicants/${replicantB}/permissions`,
      headers: headersB,
    });
    assert.equal(listRes.statusCode, 200);
    const list = listRes.json() as { id: string }[];
    assert.ok(list.some((r) => r.id === id));
  });
});
