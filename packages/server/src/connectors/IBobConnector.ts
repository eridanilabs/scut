/**
 * IBobConnector - the contract every Bob adapter must implement.
 *
 * A Bob connector wraps a specific agent harness (copilot-bridge, Claude Code,
 * a subprocess, a remote A2A agent, etc.) and exposes a uniform interface
 * that SCUT uses to dispatch work and check health.
 */

export type BobStatus = {
  available: boolean;
  busy: boolean;
  detail?: string;
};

export type Thread = {
  id: string;
  title: string;
  description: string;
  status: string;
  bobId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Run = {
  id: string;
  threadId: string;
  bobId: string;
  status: 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: string;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * IBobConnector
 *
 * Implement this interface for each agent harness type.
 * Connectors are responsible for:
 *   - Translating a Run + Thread into a harness-specific invocation
 *   - Reporting results back to SCUT via the internal callback endpoint
 *   - Reporting their own availability
 */
export interface IBobConnector {
  /**
   * Dispatch a run to the Bob. Fire-and-forget: the method resolves once the
   * run has been accepted (queued or started), not when it completes.
   * The Bob connector is responsible for posting the result back to
   * POST /api/internal/runs/:id/result when done.
   */
  dispatch(run: Run, thread: Thread): Promise<void>;

  /**
   * Cancel an in-progress or queued run.
   * Should resolve even if the run has already completed.
   */
  cancel(runId: string): Promise<void>;

  /**
   * Return the current health and availability of the Bob.
   */
  status(): Promise<BobStatus>;
}
