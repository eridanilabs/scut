import '../../setup.js';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnAcpServer } from '../../../src/connectors/acp/process.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, '..', '..', 'fixtures');
const FAKE_ACP_NOISY = path.join(FIXTURES, 'fake-acp-noisy-stderr.js');
const FAKE_ACP_WRONG_PORT = path.join(FIXTURES, 'fake-acp-wrong-port-line.js');

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

describe('spawnAcpServer drain & cleanup', () => {
  test('lifetime drain: stdout & stderr remain flowing AFTER readiness', async () => {
    // bill-znj HIGH 1 regression: previously settle() closed the
    // readline interfaces on success, which removed the only data
    // listeners and let the underlying pipes back-pressure once the
    // OS buffer filled. The fix attaches permanent no-op `data`
    // consumers that survive readiness.
    const port = await reserveLoopbackPort();
    const spawned = await spawnAcpServer({
      command: process.execPath,
      args: [FAKE_ACP_NOISY, '--port', String(port)],
      expectedPort: port,
    });
    try {
      assert.ok(spawned.child.stdout, 'expected stdout pipe');
      assert.ok(spawned.child.stderr, 'expected stderr pipe');
      assert.ok(
        (spawned.child.stdout!.listenerCount('data') ?? 0) >= 1,
        'stdout must have a lifetime drain listener after readiness'
      );
      assert.ok(
        (spawned.child.stderr!.listenerCount('data') ?? 0) >= 1,
        'stderr must have a lifetime drain listener after readiness'
      );
      // stderr is being actively written by the noisy fixture; once
      // any chunk has landed the stream must be in flowing mode.
      // (We don't assert on stdout.isPaused() because Node leaves
      // readableFlowing=null until data actually arrives, and the
      // fixture writes nothing to stdout.)
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(
        spawned.child.stderr!.isPaused(),
        false,
        'stderr must remain in flowing mode after readiness'
      );
    } finally {
      spawned.cleanup();
    }
  });

  test('cleanup is idempotent and detaches drain listeners', async () => {
    // bill-znj MEDIUM 2 regression: cleanup() previously sent SIGTERM
    // and scheduled a SIGKILL timer on EVERY call. Multiple callers
    // (e.g. session.safeCleanup + transport socket cleanup) could
    // stack timers/signals. With the fix cleanup is a no-op after
    // the first call.
    const port = await reserveLoopbackPort();
    const spawned = await spawnAcpServer({
      command: process.execPath,
      args: [FAKE_ACP_NOISY, '--port', String(port)],
      expectedPort: port,
    });

    let killCount = 0;
    const seenSignals: Array<NodeJS.Signals | number | undefined> = [];
    const origKill = spawned.child.kill.bind(spawned.child);
    spawned.child.kill = ((sig?: NodeJS.Signals | number) => {
      killCount++;
      seenSignals.push(sig);
      return origKill(sig);
    }) as typeof spawned.child.kill;

    spawned.cleanup();
    spawned.cleanup();
    spawned.cleanup();

    // At most one signal should have been delivered synchronously
    // (the SIGTERM). The SIGKILL fallback timer is 5s so it won't
    // fire during this test.
    assert.ok(
      killCount <= 1,
      `expected at most one kill, saw ${killCount} (${seenSignals.join(',')})`
    );

    // Drain listeners must be removed by cleanup so the streams can
    // be GC'd alongside the (now-terminating) child.
    assert.equal(
      spawned.child.stdout?.listenerCount('data') ?? 0,
      0,
      'cleanup must detach stdout drain listener'
    );
    assert.equal(
      spawned.child.stderr?.listenerCount('data') ?? 0,
      0,
      'cleanup must detach stderr drain listener'
    );

    // Wait for the fixture (which traps SIGTERM and exits ~500ms
    // later) to finish so we don't leak children.
    await new Promise<void>((resolve) => {
      if (spawned.child.exitCode !== null || spawned.child.signalCode !== null) {
        resolve();
        return;
      }
      spawned.child.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500).unref();
    });
  });

  test('expectedPort: stream-parsed wrong port lines must NOT override expectedPort', async () => {
    // bill-znj final-review MEDIUM regression: previously the
    // stdout/stderr readline parsers settled readiness with
    // whichever port they parsed first. A chatty child that
    // emitted an unrelated line such as `metrics port: 9090`
    // before the real loopback listener was up would race
    // waitForLoopbackPort and resolve with the wrong port,
    // causing transport.ts to dial a non-existent service.
    //
    // With the fix, when opts.expectedPort is defined, parsed
    // ports that don't match expectedPort are ignored, so
    // spawnAcpServer must resolve with the expected port.
    const port = await reserveLoopbackPort();
    assert.notEqual(port, 9090, 'reserved port must differ from bogus fixture port');
    const spawned = await spawnAcpServer({
      command: process.execPath,
      args: [FAKE_ACP_WRONG_PORT, '--port', String(port)],
      expectedPort: port,
      readyTimeoutMs: 5_000,
    });
    try {
      assert.equal(
        spawned.port,
        port,
        `spawnAcpServer must resolve with expectedPort (${port}), not a stream-parsed port`
      );
      // Sanity-check: dialing the resolved port must succeed
      // (proves we didn't merely return expectedPort by accident
      // while the child was actually listening elsewhere).
      await new Promise<void>((resolve, reject) => {
        const s = net.connect(spawned.port, '127.0.0.1');
        s.once('connect', () => { s.destroy(); resolve(); });
        s.once('error', (e) => reject(e));
      });
    } finally {
      spawned.cleanup();
      await new Promise<void>((resolve) => {
        if (spawned.child.exitCode !== null || spawned.child.signalCode !== null) {
          resolve();
          return;
        }
        spawned.child.once('exit', () => resolve());
        setTimeout(() => resolve(), 1500).unref();
      });
    }
  });
});
