import type { Migration } from '../migrate.js';

// 005-comment-dispatches: dispatch records produced when a replicant comment
// triggers downstream work, plus a minimal thread_permissions table used to
// authorize read access to traces. Both tables are created with IF NOT EXISTS
// so the migration is safe against fresh databases that already received
// these tables via schema.sql.
//
// Note: this is numbered 005 (after 004-harness-enum) so that databases
// previously upgraded to version 4 apply this in proper chronological order.
const migration: Migration = {
  version: 5,
  name: 'comment-dispatches',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS comment_dispatches (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        triggering_comment_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
        connector_handle TEXT,
        error TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_comment_dispatches_status
        ON comment_dispatches(status);
      CREATE INDEX IF NOT EXISTS idx_comment_dispatches_thread
        ON comment_dispatches(thread_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_comment_dispatches_replicant
        ON comment_dispatches(replicant_id, status);
      -- Composite sort index for keyset list pagination ordered by
      -- (created_at DESC, id DESC) — see CommentDispatchRepo.listCommentDispatches.
      CREATE INDEX IF NOT EXISTS idx_comment_dispatches_created_at
        ON comment_dispatches(created_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS thread_permissions (
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE CASCADE,
        can_read INTEGER NOT NULL DEFAULT 1 CHECK (can_read IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (thread_id, replicant_id)
      );

      CREATE INDEX IF NOT EXISTS idx_thread_permissions_replicant
        ON thread_permissions(replicant_id, can_read);
    `);
  },
};

export default migration;
