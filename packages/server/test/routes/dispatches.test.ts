import '../setup.js';

import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';

import { buildApp } from '../../src/index.js';
import db from '../../src/db/db.js';
import {
  registerAcpConnector,
  removeAcpConnector,
} from '../../src/connectors/v2/AcpConnectorRegistry.js';
import { getCommentDispatch } from '../../src/db/CommentDispatchRepo.js';
import type { FastifyInstance } from 'fastify';
import type { IReplicantConnectorV2 } from '../../src/connectors/v2/IReplicantConnectorV2.js';

let app: FastifyInstance;

const THREAD_ID = 'th_disp_route_001';
const REGISTERED_REPLICANT = 'rep_disp_registered_001';
const UNREGISTERED_REPLICANT = 'rep_disp_unregistered_001';

let lastDispatchSpyCall: { dispatchId: string } | null = null;

const spyConnector: IReplicantConnectorV2 = {
  async dispatch(args) {
    lastDispatchSpyCall = { dispatchId: args.dispatch.id };
    return JSON.stringify({
      sessionId: 'sess_spy',
      promptIndex: 0,
      replicantId: REGISTERED_REPLICANT,
    });
  },
  async cancel() {},
  async status() {
    return { state: 'pending' as const };
  },
};

before(async () => {
  app = await buildApp();
  await app.ready();
  db.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(
    THREAD_ID,
    'dispatch route test'
  );
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'online')"
  ).run(REGISTERED_REPLICANT, `rep-${nanoid(6)}`);
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'online')"
  ).run(UNREGISTERED_REPLICANT, `rep-${nanoid(6)}`);
  registerAcpConnector(REGISTERED_REPLICANT, spyConnector);
});

after(async () => {
  removeAcpConnector(REGISTERED_REPLICANT);
  await app.close();
});

describe('POST /api/v1/threads/:threadId/dispatches', () => {
  test('404 when thread missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/threads/does_not_exist/dispatches',
      payload: { replicantId: REGISTERED_REPLICANT, input: 'hi' },
    });
    assert.equal(res.statusCode, 404);
  });

  test('404 when replicant missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${THREAD_ID}/dispatches`,
      payload: { replicantId: 'rep_missing_xyz', input: 'hi' },
    });
    assert.equal(res.statusCode, 404);
  });

  test('400 when no AcpConnector registered for replicantId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${THREAD_ID}/dispatches`,
      payload: { replicantId: UNREGISTERED_REPLICANT, input: 'hi' },
    });
    assert.equal(res.statusCode, 400);
    assert.match(
      (res.json() as { error: string }).error,
      /no ACP connector registered/
    );
  });

  test('201 inserts a queued dispatch and invokes connector.dispatch once', async () => {
    lastDispatchSpyCall = null;
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${THREAD_ID}/dispatches`,
      payload: {
        replicantId: REGISTERED_REPLICANT,
        input: 'do the thing',
      },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json() as {
      id: string;
      status: string;
      thread_id: string;
      replicant_id: string;
    };
    assert.equal(body.status, 'queued');
    assert.equal(body.thread_id, THREAD_ID);
    assert.equal(body.replicant_id, REGISTERED_REPLICANT);
    // Row exists in DB.
    assert.ok(getCommentDispatch(body.id));
    // Spy was invoked exactly once with that id.
    // Allow the microtask scheduled by `void connector.dispatch(...)` to run.
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(lastDispatchSpyCall, { dispatchId: body.id });
  });
});
