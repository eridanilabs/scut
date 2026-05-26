import '../../setup.js';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  mapStoredDecisionToAcpResponse,
  permissionDetailFromParams,
} from '../../../src/connectors/acp/permissions.js';

type Params = Parameters<typeof mapStoredDecisionToAcpResponse>[1];

function makeParams(overrides: Partial<{
  toolCall: { kind?: string; rawInput?: unknown };
  options: Array<{ kind: string; optionId: string; name?: string }>;
  sessionId?: string;
}> = {}): Params {
  const base = {
    sessionId: overrides.sessionId ?? 'sess_abc',
    toolCall: {
      toolCallId: 'tc_1',
      kind: overrides.toolCall?.kind,
      rawInput: overrides.toolCall?.rawInput,
    },
    options: overrides.options ?? [
      { kind: 'allow_once', optionId: 'opt_a1', name: 'Allow once' },
      { kind: 'allow_always', optionId: 'opt_a2', name: 'Allow always' },
      { kind: 'reject_once', optionId: 'opt_r1', name: 'Reject once' },
      { kind: 'reject_always', optionId: 'opt_r2', name: 'Reject always' },
    ],
  };
  return base as unknown as Params;
}

describe('permissions.permissionDetailFromParams', () => {
  test('derives tool from rawInput.kind when present', () => {
    const p = makeParams({
      toolCall: { kind: 'fallback', rawInput: { kind: 'fs/write' } },
    });
    assert.deepEqual(permissionDetailFromParams(p), {
      tool: 'fs/write',
      sessionId: 'sess_abc',
    });
  });

  test('falls back to toolCall.kind when rawInput.kind missing', () => {
    const p = makeParams({ toolCall: { kind: 'terminal/execute' } });
    assert.deepEqual(permissionDetailFromParams(p), {
      tool: 'terminal/execute',
      sessionId: 'sess_abc',
    });
  });

  test('falls back to "unknown" when neither tool key present', () => {
    const p = makeParams({ toolCall: {} });
    assert.deepEqual(permissionDetailFromParams(p), {
      tool: 'unknown',
      sessionId: 'sess_abc',
    });
  });

  test('normalizes mixed-case rawInput.kind via ReplicantPermissionRepo.normalizeToolKey (sec 7.7)', () => {
    const p = makeParams({
      toolCall: { rawInput: { kind: 'FS/Write' } },
    });
    assert.deepEqual(permissionDetailFromParams(p), {
      tool: 'fs/write',
      sessionId: 'sess_abc',
    });
  });

  test('normalizes whitespace-separated toolCall.kind to slash form', () => {
    const p = makeParams({
      toolCall: { kind: '  Terminal Execute  ' },
    });
    assert.deepEqual(permissionDetailFromParams(p), {
      tool: 'terminal/execute',
      sessionId: 'sess_abc',
    });
  });
});

describe('permissions.mapStoredDecisionToAcpResponse', () => {
  test('allow returns selected allow_once optionId', () => {
    const p = makeParams();
    assert.deepEqual(mapStoredDecisionToAcpResponse('allow', p), {
      outcome: { outcome: 'selected', optionId: 'opt_a1' },
    });
  });

  test('allow prefers allow_once over allow_always', () => {
    const p = makeParams({
      options: [
        { kind: 'allow_always', optionId: 'opt_a2' },
        { kind: 'allow_once', optionId: 'opt_a1' },
      ],
    });
    assert.equal(
      (
        mapStoredDecisionToAcpResponse('allow', p).outcome as {
          outcome: string;
          optionId?: string;
        }
      ).optionId,
      'opt_a1'
    );
  });

  test('deny returns selected reject_once optionId', () => {
    const p = makeParams();
    assert.deepEqual(mapStoredDecisionToAcpResponse('deny', p), {
      outcome: { outcome: 'selected', optionId: 'opt_r1' },
    });
  });

  test('both decisions return cancelled when no matching option exists (allow)', () => {
    const p = makeParams({
      options: [{ kind: 'reject_once', optionId: 'opt_r1' }],
    });
    assert.deepEqual(mapStoredDecisionToAcpResponse('allow', p), {
      outcome: { outcome: 'cancelled' },
    });
  });

  test('both decisions return cancelled when no matching option exists (deny)', () => {
    const p = makeParams({
      options: [{ kind: 'allow_once', optionId: 'opt_a1' }],
    });
    assert.deepEqual(mapStoredDecisionToAcpResponse('deny', p), {
      outcome: { outcome: 'cancelled' },
    });
  });
});
