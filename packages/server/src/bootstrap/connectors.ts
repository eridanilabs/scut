import { listBobs } from '../db/BobRepo.js';
import { registerConnector } from '../connectors/ConnectorRegistry.js';
import { CopilotBridgeBob } from '../connectors/CopilotBridgeBob.js';

export function bootstrapConnectors(): void {
  const bobs = listBobs();
  let count = 0;
  for (const bob of bobs) {
    if (bob.harness === 'copilot-bridge' && bob.status === 'online') {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(bob.config) as Record<string, unknown>;
      } catch {
        continue;
      }
      const webhookUrl = config.webhookUrl as string | undefined;
      const callbackUrl = (config.callbackUrl as string | undefined) ?? 'http://localhost:3000';
      const secret = config.secret as string | undefined;
      if (!webhookUrl) continue;
      registerConnector(bob.id, new CopilotBridgeBob({ webhookUrl, callbackUrl, secret }));
      count++;
    }
  }
  console.log(`bootstrapConnectors: registered ${count} connector(s)`);
}
