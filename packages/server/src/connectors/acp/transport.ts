import * as acp from '@agentclientprotocol/sdk';
import * as net from 'node:net';
import * as path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { spawnAcpServer } from './process.js';
import type { AcpTransportConfig } from './types.js';

export interface ConnectionHandle {
  stream: ReturnType<typeof acp.ndJsonStream>;
  cleanup(): void;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function dialLoopback(host: string, port: number): Promise<{ socket: net.Socket; stream: ReturnType<typeof acp.ndJsonStream> }> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host);
    const onError = (err: Error): void => {
      socket.off('connect', onConnect);
      reject(err);
    };
    const onConnect = (): void => {
      socket.off('error', onError);
      const writable = Writable.toWeb(socket) as WritableStream<Uint8Array>;
      const readable = Readable.toWeb(socket) as ReadableStream<Uint8Array>;
      const stream = acp.ndJsonStream(writable, readable);
      resolve({ socket, stream });
    };
    socket.once('error', onError);
    socket.once('connect', onConnect);
  });
}

/**
 * Reserve a free ephemeral port on 127.0.0.1 by opening a listener,
 * capturing the assigned port, and closing it. There is an
 * unavoidable race window between close and the subsequent spawn,
 * but on a quiet developer/CI machine this is reliable enough and
 * is the documented workaround for the live Copilot CLI which (a)
 * does not announce its port on stdout/stderr and (b) does not
 * accept `--bind`.
 */
function preallocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr !== 'object') {
        server.close();
        reject(new Error('preallocateLoopbackPort: no address'));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Inspect spawn args for a `--port <n>` pair.
 *   - If `--port 0` or `--port <invalid>` is present, replace it
 *     with a freshly pre-allocated loopback port and return that
 *     port as the expected readiness port.
 *   - If `--port <n>` with n > 0 is present, return n as the
 *     expected readiness port (args unchanged).
 *   - If `--port` is absent entirely, return the args unchanged
 *     and undefined - the caller will rely on stdout/stderr
 *     port-announcement fallback.
 */
async function resolvePortInArgs(
  args: string[]
): Promise<{ args: string[]; expectedPort: number | undefined }> {
  const idx = args.indexOf('--port');
  if (idx === -1 || idx === args.length - 1) {
    return { args, expectedPort: undefined };
  }
  const raw = args[idx + 1];
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { args, expectedPort: parsed };
  }
  const port = await preallocateLoopbackPort();
  const next = args.slice();
  next[idx + 1] = String(port);
  return { args: next, expectedPort: port };
}

/**
 * For custom (non-Copilot) ACP harnesses spawned via TCP, inject
 * `--bind 127.0.0.1` as defense-in-depth so the spawned process
 * cannot accidentally bind a non-loopback interface. The live
 * Copilot CLI rejects `--bind`, so we skip injection when the
 * command basename is exactly `copilot`. We also skip injection
 * when the caller already provided `--bind` or `--bind=...`.
 * (bill-znj MEDIUM 2.)
 */
function maybeInjectBind(command: string, args: string[]): string[] {
  const base = path.basename(command);
  if (base === 'copilot') return args;
  const hasBind = args.some(
    (a) => a === '--bind' || a.startsWith('--bind=')
  );
  if (hasBind) return args;
  return [...args, '--bind', '127.0.0.1'];
}

export async function createConnectionHandle(
  cfg: AcpTransportConfig
): Promise<ConnectionHandle> {
  if (cfg.transport === 'stdio') {
    throw new Error('stdio transport not implemented (bill-a7t)');
  }

  // cfg.transport === 'tcp'
  if (cfg.mode === 'dial') {
    if (!LOOPBACK_HOSTS.has(cfg.host)) {
      throw new Error('AcpConnector: TCP transport must be loopback');
    }
    const { socket, stream } = await dialLoopback(cfg.host, cfg.port);
    return {
      stream,
      cleanup: () => {
        socket.destroy();
      },
    };
  }

  // mode === 'spawn'
  //
  // NOTE: the live Copilot CLI (v0.0.339 as of 2025-11) rejects
  // `--bind` ("error: unknown option '--bind'") and prints no port
  // announcement for `--port 0`. We therefore:
  //   1. Do NOT inject `--bind` when the command basename is exactly
  //      `copilot`. Loopback safety is enforced by only ever dialing
  //      127.0.0.1.
  //   2. For custom (non-Copilot) ACP harnesses, inject
  //      `--bind 127.0.0.1` as defense-in-depth so the spawned
  //      process cannot accidentally bind a non-loopback interface.
  //      (bill-znj MEDIUM 2.) Skipped if the caller already supplied
  //      `--bind` or `--bind=...`.
  //   3. Pre-allocate a concrete loopback port and rewrite `--port 0`
  //      to that port before spawning, then wait for that port to
  //      accept TCP connections.
  // For custom ACP harnesses that omit `--port` entirely we keep the
  // stdout/stderr port-announcement fallback (see process.ts).
  const initialArgs = cfg.args ?? ['--acp', '--port', '0'];
  const withBind = maybeInjectBind(cfg.command, initialArgs);
  const { args: finalArgs, expectedPort } = await resolvePortInArgs(withBind);
  const spawned = await spawnAcpServer({
    command: cfg.command,
    args: finalArgs,
    cwd: cfg.cwd,
    env: cfg.env,
    expectedPort,
  });
  try {
    const { socket, stream } = await dialLoopback('127.0.0.1', spawned.port);
    return {
      stream,
      cleanup: () => {
        socket.destroy();
        spawned.cleanup();
      },
    };
  } catch (err) {
    spawned.cleanup();
    throw err;
  }
}
