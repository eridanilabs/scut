import type { Migration } from '../migrate.js';

// 001-replicants-port: align replicants with cbk-merge-plan §3 and CBK agents table.
const migration: Migration = {
  version: 1,
  name: 'replicants-port',
  up(db) {
    db.exec(`
      ALTER TABLE replicants ADD COLUMN url TEXT;                              -- ACP command / WS URL / external base
      ALTER TABLE replicants ADD COLUMN auto_approve INTEGER NOT NULL DEFAULT 0; -- 0|1 (boolean)
      ALTER TABLE replicants ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';   -- JSON freeform per spec §11.10

      CREATE INDEX IF NOT EXISTS idx_replicants_harness ON replicants(harness);
      CREATE INDEX IF NOT EXISTS idx_replicants_status  ON replicants(status);
    `);
  },
};

export default migration;
