import './db/db.js';  // Ensures db is initialized
import { getReplicantByName, createReplicant, updateReplicant } from './db/ReplicantRepo.js';
import { registerConnector } from './connectors/ConnectorRegistry.js';
import { CopilotBridgeConnector } from './connectors/CopilotBridgeConnector.js';

const REPLICANT_NAME = process.env.REPLICANT_NAME ?? 'copilot-bridge-default';
const REPLICANT_WEBHOOK_URL = process.env.REPLICANT_WEBHOOK_URL;
const REPLICANT_CALLBACK_URL = process.env.REPLICANT_CALLBACK_URL ?? 'http://localhost:3000';
const REPLICANT_SECRET = process.env.REPLICANT_SECRET;

if (!REPLICANT_WEBHOOK_URL) {
  console.error('REPLICANT_WEBHOOK_URL is required');
  process.exit(1);
}

const existing = getReplicantByName(REPLICANT_NAME);
let replicantId: string;

if (existing) {
  updateReplicant(existing.id, {
    status: 'online',
    config: { webhookUrl: REPLICANT_WEBHOOK_URL, callbackUrl: REPLICANT_CALLBACK_URL, secret: REPLICANT_SECRET },
  });
  console.log(`Updated replicant: ${existing.id}`);
  replicantId = existing.id;
} else {
  const created = createReplicant({
    name: REPLICANT_NAME,
    // harness is one of the post-migration-004 enum values: 'acp' | 'copilot-bridge'.
    harness: 'copilot-bridge',
    config: { webhookUrl: REPLICANT_WEBHOOK_URL, callbackUrl: REPLICANT_CALLBACK_URL, secret: REPLICANT_SECRET },
    status: 'online',
  });
  console.log(`Created replicant: ${created.id}`);
  replicantId = created.id;
}

registerConnector(replicantId, new CopilotBridgeConnector({ webhookUrl: REPLICANT_WEBHOOK_URL, callbackUrl: REPLICANT_CALLBACK_URL, secret: REPLICANT_SECRET }));
console.log(`Registered connector for replicantId: ${replicantId}`);
console.log('Seed complete.');
process.exit(0);
