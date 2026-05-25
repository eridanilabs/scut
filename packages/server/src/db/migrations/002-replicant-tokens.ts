import type { Migration } from '../migrate.js';

// 002-replicant-tokens: bearer-token auth for replicants.
const migration: Migration = {
  version: 2,
  name: 'replicant-tokens',
  up(db) {
    db.exec(`
      -- 002-replicant-tokens: bearer-token auth for replicants.
      CREATE TABLE IF NOT EXISTS replicant_tokens (
        id            TEXT PRIMARY KEY,
        replicant_id  TEXT NOT NULL REFERENCES replicants(id) ON DELETE CASCADE,
        name          TEXT,                    -- human label (e.g. 'claude-cli prod')
        token_hash    TEXT NOT NULL UNIQUE,    -- sha256 of the raw token, hex
        last_used_at  TEXT,
        expires_at    TEXT,                    -- nullable = no expiry
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_replicant_tokens_replicant ON replicant_tokens(replicant_id);
      CREATE INDEX IF NOT EXISTS idx_replicant_tokens_hash      ON replicant_tokens(token_hash);
    `);
  },
};

export default migration;
