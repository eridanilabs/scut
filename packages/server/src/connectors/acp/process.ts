import { spawn, type ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import readline from 'node:readline';

/**
 * Try to parse a "listening on host:port" advertisement from a single
 * line of stdout (or stderr) written by the spawned ACP server.
 *
 * The function is named `parsePortFromStdout` for spec/test
 * compatibility (sec 10.5) but is also used against stderr lines:
 * some ACP servers (including custom harnesses observed in
 * development) announce on stderr.
 *
 * Returns the matched port number, or `null` if the line does not
 * appear to announce one.
 */
export function parsePortFromStdout(line: string): number | null {
  const m1 = line.match(/listening on (?:127\.0\.0\.1|::1|localhost):(\d{2,5})/i);
  if (m1) return Number(m1[1]);
  const m2 = line.match(/\bport\s*[:=]\s*(\d{2,5})\b/i);
  if (m2) return Number(m2[1]);
  try {
    const o = JSON.parse(line) as { port?: unknown };
    if (o && typeof o.port === 'number') return o.port;
  } catch {
    /* not JSON */
  }
  return null;
}

/**
 * Probe `127.0.0.1:port` until it accepts a TCP connection or the
 * deadline elapses or the child process exits. Used by spawn-mode
 * readiness when the caller already knows the port (because we
 * pre-allocated it or the caller passed a static --port). This is
 * required for the live Copilot CLI, which prints no port
 * announcement and rejects `--bind`.
 */
async function waitForLoopbackPort(
  port: number,
  child: ChildProcess,
  deadline: number
): Promise<void> {
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `AcpConnector: child process exited (code=${child.exitCode}, signal=${child.signalCode}) before TCP port ${port} became ready`
      );
    }
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, '127.0.0.1');
      const done = (v: boolean): void => {
        s.removeAllListeners();
        s.destroy();
        resolve(v);
      };
      s.once('connect', () => done(true));
      s.once('error', () => done(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `AcpConnector: TCP port 127.0.0.1:${port} did not accept connections before timeout`
  );
}

export async function spawnAcpServer(opts: {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  readyTimeoutMs?: number;
  /**
   * When provided, readiness is determined by polling
   * `127.0.0.1:expectedPort` for TCP acceptance. stdout AND stderr
   * are still fully drained so a chatty child cannot block on a
   * full pipe buffer (bill-znj fix). Stream-parsed port
   * announcements are IGNORED unless they exactly match
   * `expectedPort`, so an unrelated log line such as
   * `metrics port: 9090` cannot race readiness and make
   * transport.ts dial the wrong port (bill-znj final-review MEDIUM).
   */
  expectedPort?: number;
}): Promise<{ port: number; child: ChildProcess; cleanup(): void }> {
  const readyTimeoutMs = opts.readyTimeoutMs ?? 10_000;
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // CRITICAL (bill-znj HIGH 1): drain stdout AND stderr for the
  // LIFETIME of the child. A verbose ACP child (the live Copilot CLI
  // is one such child) that writes substantial output AFTER readiness
  // will block on a full OS pipe buffer (~64 KiB on Linux) and
  // deadlock the live session.
  //
  // We attach a permanent no-op `data` consumer to each pipe. The
  // readline port-parsers below are temporary and are torn down on
  // readiness; they MUST NOT be the only thing keeping the stream in
  // flowing mode.
  const drainStdout = (): void => {
    /* swallow */
  };
  const drainStderr = (): void => {
    /* swallow */
  };
  if (child.stdout) child.stdout.on('data', drainStdout);
  if (child.stderr) child.stderr.on('data', drainStderr);

  // cleanup must be idempotent: repeated calls must NOT schedule
  // additional SIGKILL fallback timers, and SIGTERM must be sent at
  // most once (bill-znj MEDIUM 2). The fallback timer is cleared
  // when the child actually exits, so a well-behaved child never
  // sees SIGKILL.
  let cleanedUp = false;
  let killTimer: NodeJS.Timeout | null = null;
  const childAlive = (): boolean =>
    child.exitCode === null && child.signalCode === null && !child.killed;
  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (child.stdout) child.stdout.off('data', drainStdout);
    if (child.stderr) child.stderr.off('data', drainStderr);
    try {
      if (childAlive()) child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    if (killTimer === null && childAlive()) {
      killTimer = setTimeout(() => {
        killTimer = null;
        try {
          if (childAlive()) child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }, 5_000);
      killTimer.unref();
    }
  };
  child.once('exit', () => {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let rlOut: readline.Interface | undefined;
    let rlErr: readline.Interface | undefined;

    const stopPortParsers = (): void => {
      // Tear down readline port parsers on readiness. The lifetime
      // drain handlers above remain attached so the streams keep
      // flowing - we explicitly resume() in case readline.close()
      // left the underlying stream paused.
      if (rlOut) {
        rlOut.close();
        rlOut = undefined;
      }
      if (rlErr) {
        rlErr.close();
        rlErr = undefined;
      }
      try {
        child.stdout?.resume();
      } catch {
        /* ignore */
      }
      try {
        child.stderr?.resume();
      } catch {
        /* ignore */
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopPortParsers();
      child.off('error', onError);
      cleanup();
      reject(
        new Error(
          `AcpConnector: ACP server did not become ready within ${readyTimeoutMs}ms`
        )
      );
    }, readyTimeoutMs);
    timer.unref();

    const settle = (
      err: Error | null,
      value?: { port: number; child: ChildProcess; cleanup(): void }
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off('error', onError);
      stopPortParsers();
      if (err) {
        cleanup();
        reject(err);
      } else if (value) {
        resolve(value);
      }
    };

    const onError = (err: Error): void => settle(err);
    child.once('error', onError);

    const onLine = (line: string): void => {
      if (settled) return;
      const port = parsePortFromStdout(line);
      if (port === null) return;
      // bill-znj MEDIUM (final review): when the caller pre-allocated
      // a loopback port via opts.expectedPort, stream-parsed port
      // announcements must NEVER override it. A chatty child can
      // emit unrelated lines such as `metrics port: 9090` before
      // the real ACP listener is up; settling on that would race
      // waitForLoopbackPort and make transport.ts dial the wrong
      // port. Ignore any parsed port that doesn't match.
      if (opts.expectedPort !== undefined && port !== opts.expectedPort) {
        return;
      }
      settle(null, { port, child, cleanup });
    };

    if (child.stdout) {
      rlOut = readline.createInterface({ input: child.stdout });
      rlOut.on('line', onLine);
    }
    if (child.stderr) {
      rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on('line', onLine);
    } else {
      settle(new Error('spawnAcpServer: child has no stderr'));
      return;
    }

    if (opts.expectedPort !== undefined) {
      const port = opts.expectedPort;
      waitForLoopbackPort(port, child, Date.now() + readyTimeoutMs).then(
        () => settle(null, { port, child, cleanup }),
        (err: Error) => settle(err)
      );
    }
  });
}
