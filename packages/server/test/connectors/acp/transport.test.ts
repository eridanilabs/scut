import '../../setup.js';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConnectionHandle } from '../../../src/connectors/acp/transport.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, '..', '..', 'fixtures');
const FAKE_ACP = path.join(FIXTURES, 'fake-acp.js');
const FAKE_ACP_STATIC = path.join(FIXTURES, 'fake-acp-static.js');
const FAKE_ACP_NOISY = path.join(FIXTURES, 'fake-acp-noisy-stderr.js');
const FAKE_ACP_STDERR = path.join(FIXTURES, 'fake-acp-stderr-announce.js');

function startLoopbackServer(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.on('error', () => { /* ignore */ });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr !== 'object') {
        reject(new Error('no address'));
        return;
      }
      resolve({
        port: addr.port,
        close: () => server.close(),
      });
    });
  });
}

function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr !== 'object') {
        s.close();
        reject(new Error('no address'));
        return;
      }
      const port = addr.port;
      s.close(() => resolve(port));
    });
  });
}

describe('transport.createConnectionHandle', () => {
  test('TCP dial mode connects to a loopback server and cleanup destroys the socket', async () => {
    const srv = await startLoopbackServer();
    try {
      const handle = await createConnectionHandle({
        transport: 'tcp',
        mode: 'dial',
        host: '127.0.0.1',
        port: srv.port,
      });
      assert.ok(handle.stream, 'expected a stream');
      handle.cleanup();
    } finally {
      srv.close();
    }
  });

  test('TCP dial mode rejects non-loopback hosts', async () => {
    await assert.rejects(
      createConnectionHandle({
        transport: 'tcp',
        mode: 'dial',
        host: '192.168.1.1',
        port: 12345,
      }),
      /TCP transport must be loopback/
    );
  });

  test('TCP spawn mode launches the fixture, dials it, and cleanup kills the child', async () => {
    const handle = await createConnectionHandle({
      transport: 'tcp',
      mode: 'spawn',
      command: process.execPath,
      args: [FAKE_ACP],
    });
    assert.ok(handle.stream, 'expected a stream');
    handle.cleanup();
  });

  test('TCP spawn mode (copilot basename) does NOT inject --bind and rewrites --port 0 to a concrete loopback port', async () => {
    // Per the live Copilot CLI investigation (bill-znj): --bind is
    // rejected by the live CLI, and --port 0 produces no port
    // announcement. We must therefore (a) not inject --bind when the
    // command basename is exactly `copilot`, and (b) rewrite
    // `--port 0` to a concrete pre-allocated loopback port.
    //
    // We exercise the basename check by symlinking the Node binary
    // into a temp dir as `copilot` and invoking the fixture through
    // that name.
    const scratchRoot = path.resolve(here, '..', '..', '.test-data');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(scratchRoot, 'acp-copilot-'));
    const copilotCmd = path.join(scratchDir, 'copilot');
    try {
      fs.symlinkSync(process.execPath, copilotCmd);
    } catch {
      fs.copyFileSync(process.execPath, copilotCmd);
      fs.chmodSync(copilotCmd, 0o755);
    }
    const argsOut = path.join(scratchDir, 'argv.json');
    try {
      const handle = await createConnectionHandle({
        transport: 'tcp',
        mode: 'spawn',
        command: copilotCmd,
        args: [FAKE_ACP_STATIC, '--acp', '--port', '0'],
        env: { SCUT_FIXTURE_ARGS_OUT: argsOut },
      });
      assert.ok(handle.stream, 'expected a stream');
      handle.cleanup();

      for (let i = 0; i < 20 && !fs.existsSync(argsOut); i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(fs.existsSync(argsOut), 'fixture did not write argv');
      const recorded = JSON.parse(fs.readFileSync(argsOut, 'utf8')) as string[];

      assert.equal(
        recorded.includes('--bind'),
        false,
        '--bind must not be injected when command basename is `copilot`'
      );
      assert.equal(
        recorded.some((a) => a.startsWith('--bind=')),
        false,
        '--bind=... must not be injected when command basename is `copilot`'
      );
      const portIdx = recorded.indexOf('--port');
      assert.notEqual(portIdx, -1, 'fixture must have received --port');
      const portVal = Number(recorded[portIdx + 1]);
      assert.ok(
        Number.isFinite(portVal) && portVal > 0,
        `--port 0 must be resolved to a concrete port, got ${recorded[portIdx + 1]}`
      );
    } finally {
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  test('TCP spawn mode (non-copilot basename) injects --bind 127.0.0.1 when not already present', async () => {
    // bill-znj MEDIUM 2: for custom (non-Copilot) ACP harnesses the
    // transport injects `--bind 127.0.0.1` as defense-in-depth so the
    // spawned process cannot bind a non-loopback interface.
    const scratchRoot = path.resolve(here, '..', '..', '.test-data');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(scratchRoot, 'acp-custom-'));
    const argsOut = path.join(scratchDir, 'argv.json');
    try {
      const port = await reserveLoopbackPort();
      // process.execPath has basename `node`, not `copilot`.
      const handle = await createConnectionHandle({
        transport: 'tcp',
        mode: 'spawn',
        command: process.execPath,
        args: [FAKE_ACP_STATIC, '--acp', '--port', String(port)],
        env: { SCUT_FIXTURE_ARGS_OUT: argsOut },
      });
      assert.ok(handle.stream, 'expected a stream');
      handle.cleanup();

      for (let i = 0; i < 20 && !fs.existsSync(argsOut); i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(fs.existsSync(argsOut), 'fixture did not write argv');
      const recorded = JSON.parse(fs.readFileSync(argsOut, 'utf8')) as string[];

      const bindIdx = recorded.indexOf('--bind');
      assert.notEqual(
        bindIdx,
        -1,
        '--bind must be injected for non-copilot harnesses'
      );
      assert.equal(
        recorded[bindIdx + 1],
        '127.0.0.1',
        '--bind value must be 127.0.0.1'
      );
      // Must appear exactly once.
      const bindCount = recorded.filter((a) => a === '--bind').length;
      assert.equal(bindCount, 1, '--bind must appear exactly once');
    } finally {
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  test('TCP spawn mode (non-copilot basename) does not duplicate caller-supplied --bind', async () => {
    // bill-znj MEDIUM 2: if the caller already supplied `--bind`
    // (positional) or `--bind=...` (equals form), the transport must
    // NOT append another --bind flag.
    const scratchRoot = path.resolve(here, '..', '..', '.test-data');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(scratchRoot, 'acp-bind-'));
    const argsOut = path.join(scratchDir, 'argv.json');
    try {
      const port = await reserveLoopbackPort();
      const handle = await createConnectionHandle({
        transport: 'tcp',
        mode: 'spawn',
        command: process.execPath,
        args: [
          FAKE_ACP_STATIC,
          '--acp',
          '--bind',
          '127.0.0.1',
          '--port',
          String(port),
        ],
        env: { SCUT_FIXTURE_ARGS_OUT: argsOut },
      });
      assert.ok(handle.stream, 'expected a stream');
      handle.cleanup();

      for (let i = 0; i < 20 && !fs.existsSync(argsOut); i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(fs.existsSync(argsOut), 'fixture did not write argv');
      const recorded = JSON.parse(fs.readFileSync(argsOut, 'utf8')) as string[];

      const bindCount = recorded.filter((a) => a === '--bind').length;
      assert.equal(
        bindCount,
        1,
        `caller-supplied --bind must not be duplicated, got ${bindCount}`
      );
    } finally {
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  test('TCP spawn mode succeeds against a silent fixture using an explicit static --port', async () => {
    // Models a custom harness that listens silently on a static
    // port the caller already chose. No --port 0 rewrite happens;
    // readiness is satisfied by TCP-accept polling, not by any
    // stdout/stderr port announcement.
    const port = await reserveLoopbackPort();
    const handle = await createConnectionHandle({
      transport: 'tcp',
      mode: 'spawn',
      command: process.execPath,
      args: [FAKE_ACP_STATIC, '--acp', '--port', String(port)],
    });
    assert.ok(handle.stream, 'expected a stream');
    handle.cleanup();
  });

  test('TCP spawn mode does not deadlock when child floods stderr', async () => {
    // Regression test for the unconsumed-stderr-pipe bug
    // (bill-znj HIGH 1). The fixture writes ~2 MiB to stderr; if
    // stderr is not drained the OS pipe buffer fills (~64 KiB on
    // Linux) and the child blocks before/while serving the dial,
    // tripping the readiness timeout.
    const port = await reserveLoopbackPort();
    const handle = await createConnectionHandle({
      transport: 'tcp',
      mode: 'spawn',
      command: process.execPath,
      args: [FAKE_ACP_NOISY, '--port', String(port)],
    });
    assert.ok(handle.stream, 'expected a stream');
    // Give the noisy fixture additional time to write more stderr
    // while we hold the connection - if drain is broken the child
    // will hang and SIGTERM at cleanup will still succeed but the
    // important assertion is that we got here without timing out.
    await new Promise((r) => setTimeout(r, 200));
    handle.cleanup();
  });

  test('TCP spawn mode falls back to stderr port announcement when --port is absent', async () => {
    // No --port → expectedPort is undefined → readiness depends on
    // parsePortFromStdout matching a line from stdout OR stderr.
    // The fixture only emits to stderr.
    const handle = await createConnectionHandle({
      transport: 'tcp',
      mode: 'spawn',
      command: process.execPath,
      args: [FAKE_ACP_STDERR],
    });
    assert.ok(handle.stream, 'expected a stream');
    handle.cleanup();
  });

  test('stdio transport throws the deferred-implementation error', async () => {
    await assert.rejects(
      createConnectionHandle({
        transport: 'stdio',
        mode: 'stdio',
        command: 'whatever',
      }),
      /stdio transport not implemented \(bill-a7t\)/
    );
  });
});
