import '../setup.js';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';

import db from '../../src/db/db.js';
import {
  insertCommentDispatch,
  type CommentDispatchRow,
} from '../../src/db/CommentDispatchRepo.js';
import {
  appendDispatchEvent,
  countDispatchEvents,
  listDispatchEvents,
} from '../../src/db/DispatchEventRepo.js';

function seedDispatch(): CommentDispatchRow {
  const thread = `th_${nanoid(6)}`;
  const replicant = `rep_${nanoid(6)}`;
  db.prepare(
    "INSERT INTO threads (id, title) VALUES (?, ?)"
  ).run(thread, 'evt-test');
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'online')"
  ).run(replicant, `rep-${replicant}`);
  return insertCommentDispatch({
    id: `disp_${nanoid(6)}`,
    threadId: thread,
    triggeringCommentId: null,
    replicantId: replicant,
    status: 'queued',
  });
}

describe('DispatchEventRepo', () => {
  test('appendDispatchEvent assigns monotonic sequences starting at 1', () => {
    const d = seedDispatch();
    const r1 = appendDispatchEvent({
      dispatchId: d.id,
      kind: 'agent_message_chunk',
      payload: { update: { sessionUpdate: 'agent_message_chunk' }, i: 1 },
    });
    const r2 = appendDispatchEvent({
      dispatchId: d.id,
      kind: 'tool_call',
      payload: { update: { sessionUpdate: 'tool_call' }, i: 2 },
    });
    assert.equal(r1.sequence, 1);
    assert.equal(r2.sequence, 2);
    assert.equal(r1.dispatch_id, d.id);
  });

  test('appendDispatchEvent payload is round-trippable as JSON', () => {
    const d = seedDispatch();
    const payload = { a: 1, nested: { b: [1, 2, 3] }, s: 'hello' };
    const row = appendDispatchEvent({
      dispatchId: d.id,
      kind: 'plan',
      payload,
    });
    assert.deepEqual(JSON.parse(row.payload), payload);
  });

  test('appendDispatchEvent concurrent inserts produce unique sequences', async () => {
    const d = seedDispatch();
    const inserts = Array.from({ length: 8 }, (_, i) =>
      Promise.resolve().then(() =>
        appendDispatchEvent({
          dispatchId: d.id,
          kind: 'agent_message_chunk',
          payload: { i },
        })
      )
    );
    const rows = await Promise.all(inserts);
    const seqs = rows.map((r) => r.sequence).sort((a, b) => a - b);
    assert.deepEqual(seqs, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('listDispatchEvents returns rows ordered by sequence asc', () => {
    const d = seedDispatch();
    appendDispatchEvent({ dispatchId: d.id, kind: 'k1', payload: {} });
    appendDispatchEvent({ dispatchId: d.id, kind: 'k2', payload: {} });
    appendDispatchEvent({ dispatchId: d.id, kind: 'k3', payload: {} });
    const rows = listDispatchEvents(d.id);
    assert.deepEqual(
      rows.map((r) => r.kind),
      ['k1', 'k2', 'k3']
    );
    assert.deepEqual(
      rows.map((r) => r.sequence),
      [1, 2, 3]
    );
  });

  test('countDispatchEvents returns correct count and 0 for unknown', () => {
    const d = seedDispatch();
    assert.equal(countDispatchEvents(d.id), 0);
    appendDispatchEvent({ dispatchId: d.id, kind: 'k', payload: {} });
    appendDispatchEvent({ dispatchId: d.id, kind: 'k', payload: {} });
    assert.equal(countDispatchEvents(d.id), 2);
    assert.equal(countDispatchEvents('disp_does_not_exist'), 0);
  });
});
