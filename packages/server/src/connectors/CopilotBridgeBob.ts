import { IBobConnector, BobStatus, Run, Thread } from './IBobConnector.js';

export type CopilotBridgeBobConfig = {
  webhookUrl: string;          // URL to POST the run to
  secret?: string;             // Optional shared secret, sent as Authorization: Bearer <secret>
  callbackUrl: string;         // SCUT's own callback URL for the bob to post results back to
};

export class CopilotBridgeBob implements IBobConnector {
  constructor(private readonly config: CopilotBridgeBobConfig) {}

  async dispatch(run: Run, thread: Thread): Promise<void> {
    const payload = {
      runId: run.id,
      threadId: thread.id,
      title: thread.title,
      description: thread.description,
      input: run.input,
      callbackUrl: this.config.callbackUrl,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.secret) {
      headers['Authorization'] = `Bearer ${this.config.secret}`;
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.status >= 400) {
      throw new Error(`CopilotBridgeBob dispatch failed: ${response.status}`);
    }
  }

  async cancel(_runId: string): Promise<void> {
    // No-op: copilot-bridge does not support cancellation.
    return;
  }

  async status(): Promise<BobStatus> {
    return { available: true, busy: false };
  }
}
