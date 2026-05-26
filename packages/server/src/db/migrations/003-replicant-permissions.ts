import type { Migration } from '../migrate.js';

// 003-replicant-permissions: per-tool decisions for ACP session/request_permission.
const migration: Migration = {
  version: 3,
  name: 'replicant-permissions',
  up(db) {
    db.exec(`
      -- 003-replicant-permissions: per-tool decisions for ACP session/request_permission.
      CREATE TABLE IF NOT EXISTS replicant_permissions (
        id              TEXT PRIMARY KEY,
        replicant_id    TEXT NOT NULL REFERENCES replicants(id) ON DELETE CASCADE,
        tool            TEXT NOT NULL,                            -- normalized tool key (lowercase, '/' separated)
        scope           TEXT NOT NULL CHECK (scope IN ('session', 'replicant')),
        decision        TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
        acp_session_id  TEXT,                                     -- non-null iff scope='session'
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_replicant_permissions_lookup
        ON replicant_permissions(replicant_id, tool, scope);

      CREATE INDEX IF NOT EXISTS idx_replicant_permissions_session
        ON replicant_permissions(acp_session_id)
        WHERE acp_session_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_replicant_permissions_unique
        ON replicant_permissions(replicant_id, tool, scope, COALESCE(acp_session_id, ''));
    `);
  },
};

export default migration;
