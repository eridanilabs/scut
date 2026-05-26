-- SCUT database schema
-- All IDs are nanoid strings (21 chars)

-- Registered Replicant connectors (agent harness instances)
CREATE TABLE IF NOT EXISTS replicants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  harness     TEXT NOT NULL,            -- 'acp' | 'copilot-bridge'
  config      TEXT NOT NULL DEFAULT '{}', -- JSON connector config
  status      TEXT NOT NULL DEFAULT 'unknown', -- online | offline | busy | unknown
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Threads: the unit of work (analogous to a kanban card)
CREATE TABLE IF NOT EXISTS threads (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'idea', -- idea | refining | ready | in_progress | blocked | done | archived
  replicant_id TEXT REFERENCES replicants(id) ON DELETE SET NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',   -- JSON freeform metadata
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages: conversation history on a thread
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id      TEXT REFERENCES runs(id) ON DELETE SET NULL,
  author      TEXT NOT NULL,             -- human | replicant | system
  author_id   TEXT,                      -- replicant_id if author = replicant, user id if human
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Runs: one invocation of a Replicant against a Thread
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'created', -- created | queued | running | completed | failed | cancelled
  input       TEXT NOT NULL DEFAULT '',  -- the prompt/input sent to the Replicant
  output      TEXT,                      -- the result returned by the Replicant
  error       TEXT,                      -- error message if status = failed
  started_at  TEXT,
  completed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Comment dispatches: a queued/run record produced when a replicant comment
-- triggers downstream work. Read access is gated by thread_permissions.
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

-- Thread permissions: explicit per-replicant read grants on a thread.
CREATE TABLE IF NOT EXISTS thread_permissions (
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE CASCADE,
  can_read INTEGER NOT NULL DEFAULT 1 CHECK (can_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (thread_id, replicant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comment_dispatches_status    ON comment_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_comment_dispatches_thread    ON comment_dispatches(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comment_dispatches_replicant ON comment_dispatches(replicant_id, status);
CREATE INDEX IF NOT EXISTS idx_comment_dispatches_created_at ON comment_dispatches(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_thread_permissions_replicant ON thread_permissions(replicant_id, can_read);
CREATE INDEX IF NOT EXISTS idx_threads_status         ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_replicant_id   ON threads(replicant_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread        ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_run           ON messages(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_thread            ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_replicant         ON runs(replicant_id);
CREATE INDEX IF NOT EXISTS idx_runs_status            ON runs(status);
