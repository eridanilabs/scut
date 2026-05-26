import type Database from 'better-sqlite3';
import {
  getCommentDispatch,
  updateDispatchStatus,
} from '../../db/CommentDispatchRepo.js';
import type {
  AgentTaskHandle,
  AgentTaskStatus,
  AssembledPrompt,
  CommentView,
  IReplicantConnectorV2,
  ThreadView,
} from '../v2/IReplicantConnectorV2.js';
import type { CommentDispatchRow } from '../../db/CommentDispatchRepo.js';
import { AcpSession, type AcpSessionTestHooks } from './session.js';
import type {
  AcpSessionHandleData,
  AcpTransportConfig,
} from './types.js';

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

export interface AcpConnectorOpts {
  replicantId: string;
  transport: AcpTransportConfig;
  db: Database.Database;
  logger?: Logger;
  clientInfo?: { name?: string; version?: string };
  /** Test-only seam; do not use in production paths. */
  __testHooks?: AcpSessionTestHooks;
}

export class AcpConnector implements IReplicantConnectorV2 {
  private readonly replicantId: string;
  private readonly transport: AcpTransportConfig;
  private readonly db: Database.Database;
  private readonly logger: Logger;
  private readonly clientInfo?: { name?: string; version?: string };
  private readonly hooks?: AcpSessionTestHooks;
  private readonly liveSessions = new Map<AgentTaskHandle, AcpSession>();

  constructor(opts: AcpConnectorOpts) {
    this.replicantId = opts.replicantId;
    this.transport = opts.transport;
    this.db = opts.db;
    this.logger = opts.logger ?? NULL_LOGGER;
    this.clientInfo = opts.clientInfo;
    this.hooks = opts.__testHooks;
  }

  async dispatch(args: {
    dispatch: CommentDispatchRow;
    thread: ThreadView;
    triggeringComment: CommentView | null;
    prompt: AssembledPrompt;
  }): Promise<AgentTaskHandle> {
    if (this.transport.transport !== 'tcp') {
      // stdio path is bill-a7t. Surface failure on the dispatch row so
      // observers see the error path through the normal channel, then
      // rethrow so the route handler sees it too.
      updateDispatchStatus(args.dispatch.id, {
        status: 'failed',
        error: 'AcpConnector: only TCP transport implemented (stdio is bill-a7t)',
        completedAt: nowIso(),
      });
      throw new Error(
        'AcpConnector: only TCP transport implemented (stdio is bill-a7t)'
      );
    }

    const session = new AcpSession({
      transport: this.transport,
      dispatchId: args.dispatch.id,
      replicantId: this.replicantId,
      db: this.db,
      prompt: args.prompt,
      logger: this.logger,
      clientInfo: this.clientInfo,
      __testHooks: this.hooks,
    });

    let sessionId: string;
    try {
      sessionId = await session.startAndAwaitSessionId();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateDispatchStatus(args.dispatch.id, {
        status: 'failed',
        error: message,
        completedAt: nowIso(),
      });
      throw err;
    }

    const handleData: AcpSessionHandleData = {
      sessionId,
      promptIndex: 0,
      replicantId: this.replicantId,
    };
    const handle: AgentTaskHandle = JSON.stringify(handleData);

    updateDispatchStatus(args.dispatch.id, {
      status: 'running',
      connectorHandle: handle,
      startedAt: nowIso(),
    });

    this.liveSessions.set(handle, session);
    if (session.promptPromise) {
      void session.promptPromise.finally(() => {
        this.liveSessions.delete(handle);
      });
    }

    return handle;
  }

  async cancel(handle: AgentTaskHandle): Promise<void> {
    const session = this.liveSessions.get(handle);
    if (!session) return;
    await session.cancel();
  }

  async status(handle: AgentTaskHandle): Promise<AgentTaskStatus> {
    let data: AcpSessionHandleData;
    try {
      data = JSON.parse(handle) as AcpSessionHandleData;
    } catch {
      return { state: 'failed', detail: 'invalid handle' };
    }
    // Find the dispatch row by connector_handle (verbatim JSON match).
    // We cannot use a sessionId index alone because a dispatch row owns
    // exactly one ACP session in this task.
    const row = this.db
      .prepare(
        'SELECT * FROM comment_dispatches WHERE connector_handle = ? LIMIT 1'
      )
      .get(handle) as CommentDispatchRow | undefined;
    if (!row) {
      // The connector handle is opaque exact-match JSON. An unknown
      // exact handle returns failed; there is no fallback lookup.
      return { state: 'failed', detail: `unknown handle ${data.sessionId}` };
    }
    switch (row.status) {
      case 'queued':
        return { state: 'pending' };
      case 'running':
        return { state: 'running' };
      case 'succeeded':
        return { state: 'completed' };
      case 'failed':
        return { state: 'failed', detail: row.error ?? undefined };
      case 'cancelled':
        return { state: 'cancelled' };
      default:
        return { state: 'failed', detail: `unknown status ${row.status}` };
    }
  }
}

/**
 * Convenience: look up a CommentDispatchRow by id. Re-exported so that
 * tests / demo scripts do not need to import from CommentDispatchRepo
 * directly.
 */
export function getDispatchById(id: string): CommentDispatchRow | undefined {
  return getCommentDispatch(id);
}
