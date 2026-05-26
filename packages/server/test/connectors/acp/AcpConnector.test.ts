import '../../setup.js';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';

import db from '../../../src/db/db.js';
import {
  getCommentDispatch,
  insertCommentDispatch,
  type CommentDispatchRow,
} from '../../../src/db/CommentDispatchRepo.js';
import { listDispatchEvents } from '../../../src/db/DispatchEventRepo.js';
import { upsertReplicantPermission } from '../../../src/db/ReplicantPermissionRepo.js';
import { AcpConnector } from '../../../src/connectors/acp/AcpConnector.js';
import type {
  AcpSessionHandleData,
  AcpTransportConfig,
} from '../../../src/connectors/acp/types.js';
import type { AcpSessionTestHooks } from '../../../src/connectors/acp/session.js';

// ----- minimal fake SDK ---------------------------------------------------

type AnyParams = Record<string, unknown>;

interface FakeClient {
  sessionUpdate(params: AnyParams): Promise<void>;
  requestPermission(params: AnyParams): Promise<AnyParams>;
}

interface FakeConnection {
  initialize(_p: AnyParams): Promise<AnyParams>;
  newSession(_p: AnyParams): Promise<{ sessionId: string }>;
  prompt(_p: AnyParams): Promise<{ stopReason: string }>;
  cancel(_p: AnyParams): Promise<void>;
}

interface FakeProgram {
  sessionId?: string;
  sessionUpdates?: Array<{ kind: string; payload: AnyParams }>;
  // If set, ask the SDK to invoke requestPermission before prompt resolves.
  permissionRequest?: AnyParams;
  /** Captured response from client.requestPermission. */
  permissionResponse?: AnyParams;
  // Prompt completion: either a stopReason or an error.
  promptStopReason?: 'end_turn' | 'cancelled' | 'max_tokens' | 'refusal' | 'max_turn_requests';
  promptError?: Error;
  // If true, do not auto-resolve prompt; expose `resolvePrompt` so the test
  // can resolve it manually (used to simulate cancel()).
  deferred?: boolean;
}

function buildHooks(program: FakeProgram): {
  hooks: AcpSessionTestHooks;
  resolvePrompt?: (stopReason: 'end_turn' | 'cancelled') => void;
} {
  let resolveDeferred: ((stopReason: 'end_turn' | 'cancelled') => void) | undefined;

  const hooks: AcpSessionTestHooks = {
    createHandle: async () => ({
      stream: {} as never,
      cleanup: () => {},
    }),
    createConnection: ((toClient: (agent: unknown) => FakeClient) => {
      const client = toClient({});
      const conn: FakeConnection = {
        async initialize(_p) {
          return { protocolVersion: 1, agentCapabilities: {} };
        },
        async newSession(_p) {
          return { sessionId: program.sessionId ?? `sess_${nanoid(6)}` };
        },
        async prompt(_p) {
          for (const u of program.sessionUpdates ?? []) {
            await client.sessionUpdate({
              sessionId: 'sess',
              update: { sessionUpdate: u.kind, ...u.payload },
            });
          }
          if (program.permissionRequest) {
            const resp = await client.requestPermission(program.permissionRequest);
            program.permissionResponse = resp;
          }
          if (program.promptError) throw program.promptError;
          if (program.deferred) {
            return new Promise((resolve) => {
              resolveDeferred = (stopReason) => resolve({ stopReason });
            });
          }
          return { stopReason: program.promptStopReason ?? 'end_turn' };
        },
        async cancel(_p) {
          // no-op; resolution is driven by resolveDeferred when present.
        },
      };
      return conn as unknown as never;
    }) as never,
  };
  return {
    hooks,
    resolvePrompt: (sr) => {
      if (resolveDeferred) resolveDeferred(sr);
    },
  };
}

// ----- helpers ------------------------------------------------------------

function seedFixture(): { dispatch: CommentDispatchRow; replicantId: string; threadId: string } {
  const threadId = `th_${nanoid(6)}`;
  const replicantId = `rep_${nanoid(6)}`;
  db.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, 'acp-test');
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'online')"
  ).run(replicantId, `rep-${replicantId}`);
  const dispatch = insertCommentDispatch({
    id: `disp_${nanoid(6)}`,
    threadId,
    triggeringCommentId: null,
    replicantId,
    status: 'queued',
  });
  return { dispatch, replicantId, threadId };
}

const TCP_SPAWN: AcpTransportConfig = {
  transport: 'tcp',
  mode: 'spawn',
  command: 'fake',
  args: [],
};

const STDIO_CFG: AcpTransportConfig = {
  transport: 'stdio',
  mode: 'stdio',
  command: 'fake',
};

function makeConnector(
  replicantId: string,
  hooks: AcpSessionTestHooks,
  transport: AcpTransportConfig = TCP_SPAWN
) {
  return new AcpConnector({
    replicantId,
    transport,
    db,
    __testHooks: hooks,
  });
}

// ----- tests --------------------------------------------------------------

describe('AcpConnector.dispatch (mocked SDK)', () => {
  test('happy path: queued -> running -> succeeded; events persisted; handle parses', async () => {
    const fx = seedFixture();
    const { hooks } = buildHooks({
      sessionId: 'sess_happy_1',
      sessionUpdates: [
        { kind: 'agent_message_chunk', payload: { ix: 1 } },
        { kind: 'tool_call', payload: { ix: 2 } },
      ],
      promptStopReason: 'end_turn',
    });
    const conn = makeConnector(fx.replicantId, hooks);
    const handle = await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hello' },
    });
    const parsed = JSON.parse(handle) as AcpSessionHandleData;
    assert.equal(parsed.sessionId, 'sess_happy_1');
    assert.equal(parsed.promptIndex, 0);
    assert.equal(parsed.replicantId, fx.replicantId);

    // The prompt resolves on the next microtask boundary; wait briefly.
    await new Promise((r) => setTimeout(r, 30));

    const row = getCommentDispatch(fx.dispatch.id)!;
    assert.equal(row.status, 'succeeded');
    assert.equal(row.connector_handle, handle);
    assert.ok(row.started_at);
    assert.ok(row.completed_at);

    const events = listDispatchEvents(fx.dispatch.id);
    assert.equal(events.length, 2);
    assert.equal(events[0].kind, 'agent_message_chunk');
    assert.equal(events[1].kind, 'tool_call');
  });

  test('stopReason=cancelled AFTER cancel() -> status cancelled', async () => {
    const fx = seedFixture();
    const { hooks, resolvePrompt } = buildHooks({
      sessionId: 'sess_cancel',
      deferred: true,
    });
    const conn = makeConnector(fx.replicantId, hooks);
    const handle = await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    // Allow prompt() (scheduled via setImmediate by the session) to
    // actually start so the deferred resolver is wired up.
    await new Promise((r) => setImmediate(r));
    await conn.cancel(handle);
    resolvePrompt?.('cancelled');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(getCommentDispatch(fx.dispatch.id)!.status, 'cancelled');
  });

  test('stopReason=cancelled WITHOUT cancel() -> status failed (mismatch)', async () => {
    const fx = seedFixture();
    const { hooks } = buildHooks({
      sessionId: 'sess_cancel_mismatch',
      promptStopReason: 'cancelled',
    });
    const conn = makeConnector(fx.replicantId, hooks);
    await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    await new Promise((r) => setTimeout(r, 30));
    const row = getCommentDispatch(fx.dispatch.id)!;
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'cancelled');
  });

  test('prompt rejects with Error("boom") -> status failed, error=boom', async () => {
    const fx = seedFixture();
    const { hooks } = buildHooks({
      sessionId: 'sess_boom',
      promptError: new Error('boom'),
    });
    const conn = makeConnector(fx.replicantId, hooks);
    await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    await new Promise((r) => setTimeout(r, 30));
    const row = getCommentDispatch(fx.dispatch.id)!;
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'boom');
  });

  test('requestPermission with stored allow -> selected/allow_once', async () => {
    const fx = seedFixture();
    upsertReplicantPermission({
      replicantId: fx.replicantId,
      tool: 'fs/write',
      scope: 'replicant',
      decision: 'allow',
    });
    const program: Parameters<typeof buildHooks>[0] = {
      sessionId: 'sess_perm_allow',
      promptStopReason: 'end_turn',
      permissionRequest: {
        sessionId: 'sess_perm_allow',
        toolCall: { rawInput: { kind: 'fs/write' }, kind: 'fs/write' },
        options: [
          { kind: 'allow_once', optionId: 'opt_a1' },
          { kind: 'reject_once', optionId: 'opt_r1' },
        ],
      },
    };
    const { hooks } = buildHooks(program);
    const conn = makeConnector(fx.replicantId, hooks);
    await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(program.permissionResponse, {
      outcome: { outcome: 'selected', optionId: 'opt_a1' },
    });
  });

  test('requestPermission with stored deny -> selected/reject_once', async () => {
    const fx = seedFixture();
    upsertReplicantPermission({
      replicantId: fx.replicantId,
      tool: 'fs/write',
      scope: 'replicant',
      decision: 'deny',
    });
    const program: Parameters<typeof buildHooks>[0] = {
      sessionId: 'sess_perm_deny',
      promptStopReason: 'end_turn',
      permissionRequest: {
        sessionId: 'sess_perm_deny',
        toolCall: { rawInput: { kind: 'fs/write' }, kind: 'fs/write' },
        options: [
          { kind: 'allow_once', optionId: 'opt_a1' },
          { kind: 'reject_once', optionId: 'opt_r1' },
        ],
      },
    };
    const { hooks } = buildHooks(program);
    const conn = makeConnector(fx.replicantId, hooks);
    await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(program.permissionResponse, {
      outcome: { outcome: 'selected', optionId: 'opt_r1' },
    });
  });

  test('requestPermission with no stored decision -> cancelled', async () => {
    const fx = seedFixture();
    const program: Parameters<typeof buildHooks>[0] = {
      sessionId: 'sess_perm_none',
      promptStopReason: 'end_turn',
      permissionRequest: {
        sessionId: 'sess_perm_none',
        toolCall: { rawInput: { kind: 'fs/write' }, kind: 'fs/write' },
        options: [
          { kind: 'allow_once', optionId: 'opt_a1' },
          { kind: 'reject_once', optionId: 'opt_r1' },
        ],
      },
    };
    const { hooks } = buildHooks(program);
    const conn = makeConnector(fx.replicantId, hooks);
    await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(program.permissionResponse, {
      outcome: { outcome: 'cancelled' },
    });
  });

  test('cancel before prompt starts: connection.prompt is NOT invoked; status=cancelled', async () => {
    // bill-znj MEDIUM 3 regression: prompt() is scheduled via
    // setImmediate after newSession resolves. If cancel() runs before
    // the immediate fires, the scheduled prompt() previously still
    // ran and could mark the dispatch succeeded. With the fix the
    // setImmediate callback short-circuits to finishPrompt('cancelled', null).
    const fx = seedFixture();
    let promptCalled = false;
    const hooks: AcpSessionTestHooks = {
      createHandle: async () => ({
        stream: {} as never,
        cleanup: () => {},
      }),
      createConnection: ((toClient: (agent: unknown) => FakeClient) => {
        toClient({});
        const conn: FakeConnection = {
          async initialize(_p) {
            return { protocolVersion: 1, agentCapabilities: {} };
          },
          async newSession(_p) {
            return { sessionId: 'sess_cancel_race' };
          },
          async prompt(_p) {
            promptCalled = true;
            return { stopReason: 'end_turn' };
          },
          async cancel(_p) {
            /* no-op */
          },
        };
        return conn as unknown as never;
      }) as never,
    };
    const conn = makeConnector(fx.replicantId, hooks);
    const handle = await conn.dispatch({
      dispatch: fx.dispatch,
      thread: { id: fx.threadId, title: 't', description: '' },
      triggeringComment: null,
      prompt: { text: 'hi' },
    });
    // Cancel BEFORE yielding to setImmediate so the scheduled
    // prompt() must see cancelRequested=true.
    await conn.cancel(handle);
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(promptCalled, false, 'connection.prompt must not be invoked after pre-flight cancel');
    const row = getCommentDispatch(fx.dispatch.id)!;
    assert.equal(row.status, 'cancelled');
  });

  test('stdio transport dispatch rejects with the deferred-impl error', async () => {
    const fx = seedFixture();
    const { hooks } = buildHooks({});
    const conn = makeConnector(fx.replicantId, hooks, STDIO_CFG);
    await assert.rejects(
      conn.dispatch({
        dispatch: fx.dispatch,
        thread: { id: fx.threadId, title: 't', description: '' },
        triggeringComment: null,
        prompt: { text: 'hi' },
      }),
      /only TCP transport implemented \(stdio is bill-a7t\)/
    );
    const row = getCommentDispatch(fx.dispatch.id)!;
    assert.equal(row.status, 'failed');
  });
});
