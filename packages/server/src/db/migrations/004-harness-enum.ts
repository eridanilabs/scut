import type { Migration } from '../migrate.js';

// 004-harness-enum: constrain replicants.harness to ('acp', 'copilot-bridge').
// Required because SQLite cannot ALTER an existing column to add CHECK; we
// rebuild the table.
const migration: Migration = {
  version: 4,
  name: 'harness-enum',
  up(db) {
    db.exec(`
      -- Step 2: rebuild.
      CREATE TABLE replicants_new (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL UNIQUE,
        harness       TEXT NOT NULL CHECK (harness IN ('acp', 'copilot-bridge')),
        config        TEXT NOT NULL DEFAULT '{}',
        status        TEXT NOT NULL DEFAULT 'unknown',
        url           TEXT,
        auto_approve  INTEGER NOT NULL DEFAULT 0,
        metadata      TEXT NOT NULL DEFAULT '{}',
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Step 3: normalize legacy harness values into the new enum before copying.
      -- Anything not in the allowed set becomes 'acp' (the new default kind).
      INSERT INTO replicants_new (id, name, harness, config, status, url, auto_approve, metadata, created_at, updated_at)
      SELECT
        id,
        name,
        CASE
          WHEN harness IN ('acp', 'copilot-bridge') THEN harness
          ELSE 'acp'
        END AS harness,
        config, status, url, auto_approve, metadata, created_at, updated_at
      FROM replicants;

      DROP TABLE replicants;
      ALTER TABLE replicants_new RENAME TO replicants;

      -- Recreate indexes from the previous migrations.
      CREATE INDEX IF NOT EXISTS idx_replicants_harness ON replicants(harness);
      CREATE INDEX IF NOT EXISTS idx_replicants_status  ON replicants(status);
    `);
  },
};

export default migration;
