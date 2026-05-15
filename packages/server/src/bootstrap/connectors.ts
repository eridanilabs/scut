import { listReplicants } from '../db/ReplicantRepo.js';
import { registerConnector } from '../connectors/ConnectorRegistry.js';
import { CopilotBridgeConnector } from '../connectors/CopilotBridgeConnector.js';

export function bootstrapConnectors(): void {
  const replicants = listReplicants();
  let count = 0;
  for (const replicant of replicants) {
    if (replicant.harness === 'copilot-bridge' && replicant.status === 'online') {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(replicant.config) as Record<string, unknown>;
      } catch {
        continue;
      }
      const webhookUrl = config.webhookUrl as string | undefined;
      const callbackUrl = (config.callbackUrl as string | undefined) ?? 'http://localhost:3000';
      const secret = config.secret as string | undefined;
      if (!webhookUrl) continue;
      registerConnector(replicant.id, new CopilotBridgeConnector({ webhookUrl, callbackUrl, secret }));
      count++;
    }
  }
  console.log(`bootstrapConnectors: registered ${count} connector(s)`);
}
