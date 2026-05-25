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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_status         ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_replicant_id   ON threads(replicant_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread        ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_run           ON messages(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_thread            ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_replicant         ON runs(replicant_id);
CREATE INDEX IF NOT EXISTS idx_runs_status            ON runs(status);
