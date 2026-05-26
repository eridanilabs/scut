import db from './db/db.js'; // Ensures db is initialized
import { getReplicantByName, createReplicant, updateReplicant } from './db/ReplicantRepo.js';
import { registerConnector } from './connectors/ConnectorRegistry.js';
import { CopilotBridgeConnector } from './connectors/CopilotBridgeConnector.js';
import { hashToken } from './auth/replicantAuth.js';
import {
  insertCommentDispatch,
  getCommentDispatch,
  upsertThreadPermission,
} from './db/CommentDispatchRepo.js';

const REPLICANT_NAME = process.env.REPLICANT_NAME ?? 'copilot-bridge-default';
const REPLICANT_WEBHOOK_URL = process.env.REPLICANT_WEBHOOK_URL;
const REPLICANT_CALLBACK_URL = process.env.REPLICANT_CALLBACK_URL ?? 'http://localhost:3000';
const REPLICANT_SECRET = process.env.REPLICANT_SECRET;
const SEED_SMOKE = process.env.SCUT_SEED_SMOKE === '1';
const SEED_SMOKE_ONLY = process.env.SCUT_SEED_SMOKE_ONLY === '1';

function seedSmoke(): void {
  // Deterministic dev fixture used by scripts/smoke.sh. Idempotent.
  // We pin a preferred replicant id, but `replicants.name` is UNIQUE and
  // the insert below uses ON CONFLICT(name). If a prior run (or another
  // seed path) already inserted a row with the same name but a *different*
  // id, we must reuse that existing id for the token / permission /
  // dispatch FKs - otherwise the FK inserts silently target a missing
  // parent row.
  const PREFERRED_REPLICANT_ID = 'scut_smoke_replicant_001';
  const REPLICANT_NAME_SMOKE = 'scut-smoke-replicant';
  const TOKEN_ID = 'scut_smoke_token_001';
  const RAW_TOKEN = 'scut_rk_dev_smoke_token';
  const THREAD_ID = 'scut_smoke_thread_001';
  const DISPATCH_ID = 'scut_smoke_dispatch_001';

  // Replicant. Guard by NAME to match the unique constraint that
  // ON CONFLICT(name) targets. If no row exists for the smoke name we
  // insert one using the preferred id; if a row already exists under a
  // different id we adopt that id for all downstream inserts.
  const existingByName = db
    .prepare('SELECT id FROM replicants WHERE name = ?')
    .get(REPLICANT_NAME_SMOKE) as { id: string } | undefined;
  let replicantId: string;
  if (existingByName) {
    replicantId = existingByName.id;
  } else {
    db.prepare(
      `INSERT INTO replicants (id, name, harness, config, status)
       VALUES (?, ?, 'copilot-bridge', '{}', 'online')
       ON CONFLICT(name) DO NOTHING`
    ).run(PREFERRED_REPLICANT_ID, REPLICANT_NAME_SMOKE);
    // Re-query in case of a race with another seeder; in normal runs the
    // INSERT above will have used PREFERRED_REPLICANT_ID.
    const justInserted = db
      .prepare('SELECT id FROM replicants WHERE name = ?')
      .get(REPLICANT_NAME_SMOKE) as { id: string } | undefined;
    replicantId = justInserted?.id ?? PREFERRED_REPLICANT_ID;
  }

  // Token: deterministic hash of the well-known raw token.
  //
  // We must reconcile two independent drift cases without violating the
  // PRIMARY KEY on `id` or the UNIQUE constraint on `token_hash`:
  //
  //   1. A row with TOKEN_ID exists but its `replicant_id` points at a
  //      stale replicant (e.g. previous smoke run left it pinned to a now
  //      gone id, or the user rebuilt the smoke replicant under a new id).
  //      Fix: update `replicant_id` to the current smoke `replicantId` and
  //      ensure `token_hash` is the deterministic value.
  //
  //   2. A row with the deterministic `token_hash` exists under a *different*
  //      id (e.g. produced by a non-smoke seeder reusing the same raw
  //      token, or a partially-rolled-back run). Fix: update that row's
  //      `replicant_id` rather than insert a duplicate, which would fail
  //      the UNIQUE(token_hash) constraint.
  const tokenHash = hashToken(RAW_TOKEN);
  const existingTokenById = db
    .prepare('SELECT id, replicant_id, token_hash FROM replicant_tokens WHERE id = ?')
    .get(TOKEN_ID) as { id: string; replicant_id: string; token_hash: string } | undefined;
  const existingTokenByHash = db
    .prepare('SELECT id, replicant_id, token_hash FROM replicant_tokens WHERE token_hash = ?')
    .get(tokenHash) as { id: string; replicant_id: string; token_hash: string } | undefined;

  if (existingTokenById) {
    // If the deterministic hash currently lives on a *different* id, free
    // it first so the UPDATE below cannot collide with UNIQUE(token_hash).
    if (
      existingTokenById.token_hash !== tokenHash &&
      existingTokenByHash &&
      existingTokenByHash.id !== TOKEN_ID
    ) {
      db.prepare('DELETE FROM replicant_tokens WHERE id = ?').run(existingTokenByHash.id);
    }
    db.prepare(
      'UPDATE replicant_tokens SET replicant_id = ?, token_hash = ? WHERE id = ?'
    ).run(replicantId, tokenHash, TOKEN_ID);
  } else if (existingTokenByHash) {
    db.prepare('UPDATE replicant_tokens SET replicant_id = ? WHERE id = ?').run(
      replicantId,
      existingTokenByHash.id
    );
  } else {
    db.prepare(
      `INSERT INTO replicant_tokens (id, replicant_id, name, token_hash)
       VALUES (?, ?, 'dev-smoke', ?)`
    ).run(TOKEN_ID, replicantId, tokenHash);
  }

  // Thread.
  const existingThread = db
    .prepare('SELECT id FROM threads WHERE id = ?')
    .get(THREAD_ID) as { id: string } | undefined;
  if (!existingThread) {
    db.prepare(
      `INSERT INTO threads (id, title, description, status)
       VALUES (?, 'smoke thread', 'deterministic dev seed for smoke', 'idea')`
    ).run(THREAD_ID);
  }

  // Permission.
  upsertThreadPermission(THREAD_ID, replicantId, true);

  // Dispatch.
  if (!getCommentDispatch(DISPATCH_ID)) {
    insertCommentDispatch({
      id: DISPATCH_ID,
      threadId: THREAD_ID,
      replicantId: replicantId,
      status: 'succeeded',
      connectorHandle: 'dev-smoke-handle',
    });
  }

  console.log(`Seed smoke ok: replicant=${replicantId} token=${RAW_TOKEN} dispatch=${DISPATCH_ID}`);
}

if (SEED_SMOKE || SEED_SMOKE_ONLY) {
  seedSmoke();
  if (SEED_SMOKE_ONLY) {
    process.exit(0);
  }
  // SCUT_SEED_SMOKE=1 with no webhook means: dev/CI smoke setup only.
  // Seed the deterministic smoke fixture and exit 0 rather than failing
  // out because the normal connector requires REPLICANT_WEBHOOK_URL.
  // When the webhook IS set we fall through and also register the normal
  // connector.
  if (!REPLICANT_WEBHOOK_URL) {
    console.log('SCUT_SEED_SMOKE set without REPLICANT_WEBHOOK_URL; smoke seeded, skipping connector.');
    process.exit(0);
  }
}

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
