import * as acp from '@agentclientprotocol/sdk';
import type Database from 'better-sqlite3';
import { appendDispatchEvent } from '../../db/DispatchEventRepo.js';
import { updateDispatchStatus } from '../../db/CommentDispatchRepo.js';
import { getReplicantPermission } from '../../db/ReplicantPermissionRepo.js';
import { createConnectionHandle, type ConnectionHandle } from './transport.js';
import {
  mapStoredDecisionToAcpResponse,
  permissionDetailFromParams,
} from './permissions.js';
import type { AcpTransportConfig } from './types.js';
import type { AssembledPrompt } from '../v2/IReplicantConnectorV2.js';

type Fn = (...args: unknown[]) => void;
type Logger = { info: Fn; warn: Fn; error: Fn };

const NULL_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function nowIso(): string {
  return new Date().toISOString();
}

export interface AcpSessionTestHooks {
  createHandle?: (cfg: AcpTransportConfig) => Promise<ConnectionHandle>;
  createConnection?: (
    toClient: (agent: acp.Agent) => acp.Client,
    stream: ConnectionHandle['stream']
  ) => acp.ClientSideConnection;
}

export interface AcpSessionOpts {
  transport: AcpTransportConfig;
  dispatchId: string;
  replicantId: string;
  db: Database.Database;
  prompt: AssembledPrompt;
  logger?: Logger;
  clientInfo?: { name?: string; version?: string };
  /** Test-only seam; do not use in production paths. */
  __testHooks?: AcpSessionTestHooks;
}

/**
 * AcpSession wraps a single ACP `ClientSideConnection`. It connects,
 * runs `newSession` to obtain a sessionId (which is returned eagerly
 * from `startAndAwaitSessionId`), then runs `prompt` in the background
 * and writes the terminal dispatch state when prompt resolves/rejects.
 *
 * The caller (AcpConnector) does NOT await the prompt; it returns its
 * `AgentTaskHandle` as soon as `startAndAwaitSessionId` resolves.
 */
export class AcpSession {
  private readonly transport: AcpTransportConfig;
  private readonly dispatchId: string;
  private readonly replicantId: string;
  private readonly db: Database.Database;
  private readonly prompt: AssembledPrompt;
  private readonly logger: Logger;
  private readonly clientInfo: { name: string; version: string };
  private readonly hooks: AcpSessionTestHooks;

  private connection: acp.ClientSideConnection | null = null;
  private handle: ConnectionHandle | null = null;
  private sessionId: string | null = null;
  private cancelRequested = false;
  private terminated = false;
  /** Promise representing the in-progress prompt(), once started. */
  promptPromise: Promise<void> | null = null;

  constructor(opts: AcpSessionOpts) {
    this.transport = opts.transport;
    this.dispatchId = opts.dispatchId;
    this.replicantId = opts.replicantId;
    this.db = opts.db;
    this.prompt = opts.prompt;
    this.logger = opts.logger ?? NULL_LOGGER;
    this.clientInfo = {
      name: opts.clientInfo?.name ?? 'scut-server',
      version: opts.clientInfo?.version ?? '0.1.0',
    };
    this.hooks = opts.__testHooks ?? {};
  }

  /**
   * Connect, initialize, and call `newSession`. Resolves with the new
   * sessionId. The prompt() call is started internally; the caller
   * does NOT await it. Errors that happen BEFORE a sessionId is
   * obtained cause this method to reject.
   */
  async startAndAwaitSessionId(): Promise<string> {
    const createHandle =
      this.hooks.createHandle ?? createConnectionHandle;
    const handle = await createHandle(this.transport);
    this.handle = handle;

    const client: acp.Client = {
      requestPermission: async (params) =>
        this.handleRequestPermission(params),
      sessionUpdate: async (params) => {
        this.handleSessionUpdate(params);
      },
    };

    const createConn =
      this.hooks.createConnection ??
      ((toClient, stream) => new acp.ClientSideConnection(toClient, stream));
    let connection: acp.ClientSideConnection;
    try {
      connection = createConn(() => client, handle.stream);
    } catch (err) {
      this.safeCleanup();
      throw err;
    }
    this.connection = connection;

    try {
      await connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: this.clientInfo,
      });

      const newSessionResult = await connection.newSession({
        cwd: process.cwd(),
        mcpServers: [],
      });
      this.sessionId = newSessionResult.sessionId;
    } catch (err) {
      this.safeCleanup();
      throw err;
    }

    // Kick off the prompt() chain via setImmediate so the caller
    // (AcpConnector.dispatch) has a chance to flip the dispatch row to
    // 'running' BEFORE prompt resolution races us back to a terminal
    // state. Without this, a synchronously-resolving prompt() would
    // settle ahead of the 'running' write and the terminal status
    // (succeeded / failed / cancelled) would be silently overwritten.
    const sessionId = this.sessionId;
    this.promptPromise = new Promise<void>((resolve) => {
      setImmediate(() => {
        // bill-znj MEDIUM 3: cancel() may have run between dispatch
        // returning the handle and this setImmediate firing. If so,
        // do NOT invoke prompt() - that would let a fast-resolving
        // prompt mark the dispatch succeeded after a cancel.
        if (this.cancelRequested) {
          this.finishPrompt('cancelled', null);
          resolve();
          return;
        }
        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text: this.prompt.text }],
          })
          .then(
            (result) => {
              this.finishPrompt(result.stopReason, null);
              resolve();
            },
            (err: unknown) => {
              this.finishPrompt(null, err);
              resolve();
            }
          );
      });
    });

    return sessionId;
  }

  /**
   * Best-effort cancel. Issues `connection.cancel({ sessionId })` if
   * the session is live. Safe to call any time after construction.
   */
  async cancel(): Promise<void> {
    this.cancelRequested = true;
    if (this.terminated) return;
    if (!this.connection || !this.sessionId) return;
    try {
      await this.connection.cancel({ sessionId: this.sessionId });
    } catch (err) {
      this.logger.warn('AcpSession.cancel: connection.cancel threw', err);
    }
  }

  private handleSessionUpdate(
    params: Parameters<acp.Client['sessionUpdate']>[0]
  ): void {
    try {
      const kind =
        (params as { update?: { sessionUpdate?: string } }).update
          ?.sessionUpdate ?? 'unknown';
      appendDispatchEvent({
        dispatchId: this.dispatchId,
        kind,
        payload: params,
      });
    } catch (err) {
      // Never throw out of an SDK callback - it would tear down the
      // live ACP session.
      this.logger.error(
        'AcpSession.handleSessionUpdate: failed to persist event',
        err
      );
    }
  }

  private async handleRequestPermission(
    params: Parameters<acp.Client['requestPermission']>[0]
  ): ReturnType<acp.Client['requestPermission']> {
    try {
      const { tool, sessionId } = permissionDetailFromParams(params);
      // Session-scoped lookup first, then replicant scope.
      let stored = sessionId
        ? getReplicantPermission({
            replicantId: this.replicantId,
            tool,
            scope: 'session',
            acpSessionId: sessionId,
          })
        : undefined;
      if (!stored) {
        stored = getReplicantPermission({
          replicantId: this.replicantId,
          tool,
          scope: 'replicant',
        });
      }
      if (!stored) {
        return { outcome: { outcome: 'cancelled' } };
      }
      return mapStoredDecisionToAcpResponse(stored.decision, params);
    } catch (err) {
      this.logger.error(
        'AcpSession.handleRequestPermission: lookup failed',
        err
      );
      return { outcome: { outcome: 'cancelled' } };
    }
  }

  private finishPrompt(stopReason: string | null, err: unknown): void {
    if (this.terminated) return;
    this.terminated = true;
    try {
      if (err !== null && err !== undefined) {
        const message =
          err instanceof Error ? err.message : String(err);
        updateDispatchStatus(this.dispatchId, {
          status: 'failed',
          error: message,
          completedAt: nowIso(),
        });
      } else if (stopReason === 'end_turn') {
        updateDispatchStatus(this.dispatchId, {
          status: 'succeeded',
          completedAt: nowIso(),
        });
      } else if (stopReason === 'cancelled' && this.cancelRequested) {
        updateDispatchStatus(this.dispatchId, {
          status: 'cancelled',
          completedAt: nowIso(),
        });
      } else {
        updateDispatchStatus(this.dispatchId, {
          status: 'failed',
          error: stopReason ?? 'unknown',
          completedAt: nowIso(),
        });
      }
    } catch (writeErr) {
      this.logger.error(
        'AcpSession.finishPrompt: status write failed',
        writeErr
      );
    } finally {
      this.safeCleanup();
    }
  }

  private safeCleanup(): void {
    try {
      this.handle?.cleanup();
    } catch (err) {
      this.logger.warn('AcpSession.safeCleanup: handle.cleanup threw', err);
    } finally {
      this.handle = null;
    }
  }
}
