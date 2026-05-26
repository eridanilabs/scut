import '../setup.js';

import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAcpTransport } from '../../src/bootstrap/connectors.js';
import type { AcpReplicantConfig } from '../../src/connectors/acp/types.js';

describe('resolveAcpTransport', () => {
  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    savedEnv.SCUT_ACP_COPILOT_PATH = process.env.SCUT_ACP_COPILOT_PATH;
    savedEnv.SCUT_ACP_TRANSPORT_DEFAULT = process.env.SCUT_ACP_TRANSPORT_DEFAULT;
    delete process.env.SCUT_ACP_COPILOT_PATH;
    delete process.env.SCUT_ACP_TRANSPORT_DEFAULT;
  });
  afterEach(() => {
    if (savedEnv.SCUT_ACP_COPILOT_PATH === undefined) {
      delete process.env.SCUT_ACP_COPILOT_PATH;
    } else {
      process.env.SCUT_ACP_COPILOT_PATH = savedEnv.SCUT_ACP_COPILOT_PATH;
    }
    if (savedEnv.SCUT_ACP_TRANSPORT_DEFAULT === undefined) {
      delete process.env.SCUT_ACP_TRANSPORT_DEFAULT;
    } else {
      process.env.SCUT_ACP_TRANSPORT_DEFAULT = savedEnv.SCUT_ACP_TRANSPORT_DEFAULT;
    }
  });

  test('tcp spawn does NOT bleed cfg.stdio.command into tcp command resolution (bill-znj MEDIUM 1)', () => {
    const cfg: AcpReplicantConfig = {
      transport: 'tcp',
      stdio: { command: '/should/not/be/used/stdio-only' },
    };
    const resolved = resolveAcpTransport(cfg);
    assert.equal(resolved.transport, 'tcp');
    if (resolved.transport === 'tcp' && resolved.mode === 'spawn') {
      assert.equal(
        resolved.command,
        'copilot',
        'tcp spawn must default to "copilot", not bleed stdio.command'
      );
    } else {
      assert.fail('expected tcp spawn');
    }
  });

  test('tcp spawn honours SCUT_ACP_COPILOT_PATH over cfg.stdio.command', () => {
    process.env.SCUT_ACP_COPILOT_PATH = '/env/override/copilot';
    const cfg: AcpReplicantConfig = {
      transport: 'tcp',
      stdio: { command: '/should/not/be/used/stdio-only' },
    };
    const resolved = resolveAcpTransport(cfg);
    if (resolved.transport === 'tcp' && resolved.mode === 'spawn') {
      assert.equal(resolved.command, '/env/override/copilot');
    } else {
      assert.fail('expected tcp spawn');
    }
  });

  test('tcp spawn prefers cfg.tcp.command when set', () => {
    const cfg: AcpReplicantConfig = {
      transport: 'tcp',
      tcp: { command: '/explicit/tcp/cmd' },
      stdio: { command: '/should/not/be/used' },
    };
    const resolved = resolveAcpTransport(cfg);
    if (resolved.transport === 'tcp' && resolved.mode === 'spawn') {
      assert.equal(resolved.command, '/explicit/tcp/cmd');
    } else {
      assert.fail('expected tcp spawn');
    }
  });

  test('stdio does NOT bleed cfg.tcp.command into stdio command resolution (bill-znj MEDIUM 1)', () => {
    const cfg: AcpReplicantConfig = {
      transport: 'stdio',
      tcp: { command: '/should/not/be/used/tcp-only' },
    };
    const resolved = resolveAcpTransport(cfg);
    if (resolved.transport === 'stdio') {
      assert.equal(
        resolved.command,
        'copilot',
        'stdio must default to "copilot", not bleed tcp.command'
      );
    } else {
      assert.fail('expected stdio');
    }
  });

  test('stdio prefers cfg.stdio.command when set', () => {
    const cfg: AcpReplicantConfig = {
      transport: 'stdio',
      stdio: { command: '/explicit/stdio/cmd' },
      tcp: { command: '/should/not/be/used' },
    };
    const resolved = resolveAcpTransport(cfg);
    if (resolved.transport === 'stdio') {
      assert.equal(resolved.command, '/explicit/stdio/cmd');
    } else {
      assert.fail('expected stdio');
    }
  });

  test('tcp dial mode requires tcp.port', () => {
    const cfg: AcpReplicantConfig = {
      transport: 'tcp',
      tcp: { mode: 'dial' },
    };
    assert.throws(() => resolveAcpTransport(cfg), /tcp\.port is required/);
  });
});
