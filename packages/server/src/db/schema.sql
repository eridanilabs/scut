-- SCUT database schema
-- All IDs are nanoid strings (21 chars)

-- Registered Bob connectors (agent harness instances)
CREATE TABLE IF NOT EXISTS bobs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  harness     TEXT NOT NULL,            -- copilot-bridge | claude-code | subprocess | a2a | acp
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
  bob_id      TEXT REFERENCES bobs(id) ON DELETE SET NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',   -- JSON freeform metadata
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages: conversation history on a thread
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id      TEXT REFERENCES runs(id) ON DELETE SET NULL,
  author      TEXT NOT NULL,             -- human | bob | system
  author_id   TEXT,                      -- bob_id if author = bob, user id if human
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Runs: one invocation of a Bob against a Thread
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  bob_id      TEXT NOT NULL REFERENCES bobs(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'created', -- created | queued | running | completed | failed | cancelled
  input       TEXT NOT NULL DEFAULT '',  -- the prompt/input sent to the Bob
  output      TEXT,                      -- the result returned by the Bob
  error       TEXT,                      -- error message if status = failed
  started_at  TEXT,
  completed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_status   ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_bob_id   ON threads(bob_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread  ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_run     ON messages(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_thread      ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_bob         ON runs(bob_id);
CREATE INDEX IF NOT EXISTS idx_runs_status      ON runs(status);
