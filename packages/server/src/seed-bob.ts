import './db/db.js';  // Ensures db is initialized
import { getBobByName, createBob, updateBob } from './db/BobRepo.js';
import { registerConnector } from './connectors/ConnectorRegistry.js';
import { CopilotBridgeBob } from './connectors/CopilotBridgeBob.js';

const BOB_NAME = process.env.BOB_NAME ?? 'copilot-bridge-default';
const BOB_WEBHOOK_URL = process.env.BOB_WEBHOOK_URL;
const BOB_CALLBACK_URL = process.env.BOB_CALLBACK_URL ?? 'http://localhost:3000';
const BOB_SECRET = process.env.BOB_SECRET;

if (!BOB_WEBHOOK_URL) {
  console.error('BOB_WEBHOOK_URL is required');
  process.exit(1);
}

const existing = getBobByName(BOB_NAME);
let bobId: string;

if (existing) {
  updateBob(existing.id, {
    status: 'online',
    config: { webhookUrl: BOB_WEBHOOK_URL, callbackUrl: BOB_CALLBACK_URL, secret: BOB_SECRET },
  });
  console.log(`Updated bob: ${existing.id}`);
  bobId = existing.id;
} else {
  const created = createBob({
    name: BOB_NAME,
    harness: 'copilot-bridge',
    config: { webhookUrl: BOB_WEBHOOK_URL, callbackUrl: BOB_CALLBACK_URL, secret: BOB_SECRET },
    status: 'online',
  });
  console.log(`Created bob: ${created.id}`);
  bobId = created.id;
}

registerConnector(bobId, new CopilotBridgeBob({ webhookUrl: BOB_WEBHOOK_URL, callbackUrl: BOB_CALLBACK_URL, secret: BOB_SECRET }));
console.log(`Registered connector for bobId: ${bobId}`);
console.log('Seed complete.');
process.exit(0);
