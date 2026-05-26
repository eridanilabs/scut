import type { Migration } from '../migrate.js';

// 006-dispatch-events: append-only event log for ACP `sessionUpdate`
// notifications received during a dispatch. One row per notification,
// sequence-ordered within a dispatch. Backs /api/v1/traces/:id/events.
const migration: Migration = {
  version: 6,
  name: 'dispatch-events',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dispatch_events (
        id TEXT PRIMARY KEY,
        dispatch_id TEXT NOT NULL REFERENCES comment_dispatches(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (dispatch_id, sequence)
      );

      CREATE INDEX IF NOT EXISTS idx_dispatch_events_dispatch_seq
        ON dispatch_events(dispatch_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_dispatch_created
        ON dispatch_events(dispatch_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_kind
        ON dispatch_events(kind);
    `);
  },
};

export default migration;
