# SCUT - Design Specification

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Vocabulary](#3-vocabulary)
4. [Application Architecture](#4-application-architecture)
5. [Data Hierarchy](#5-data-hierarchy)
6. [Data Model](#6-data-model)
   - [6.5 Board Types](#65-board-types)
7. [Authentication](#7-authentication-phase-1)
8. [Real-Time and Bidirectional Data](#8-real-time-and-bidirectional-data)
9. [Database Adapter Interface](#9-database-adapter-interface)
10. [Connector Interface](#10-connector-interface-phase-2)
11. [API Surface](#11-api-surface)
12. [Connector Implementations](#12-connector-implementations-phase-2)
13. [Phase Plan](#13-phase-plan)

---

## 1. Executive Summary

SCUT (Structured Coordination Utility for Tasks) is an API-first project management and multi-agent coordination plane. It maintains a structured hierarchy of work (Organization > Project > Board > Column > Thread), supports flexible board views driven by column filter rules, and provides a React SPA (the Moot) for humans to create, assign, and track work.

Phase 1 is pure Kanban: user auth, full project hierarchy, threads as work items, checklists, comments, and assignees (human users). No agents in Phase 1.

Phase 2 adds agent integration: registered Replicants (agent connectors) can be assigned to threads alongside humans. Posting a comment to a thread with an assigned Replicant triggers a dispatch via the Replicant's `IReplicantConnector`. The thread's comment history is the agent session context. The dispatch lifecycle (queued, running, succeeded, failed, cancelled) is tracked in the `comment_dispatches` sidecar table; the agent-side work unit is an `AgentTask` at the connector boundary.

Phase 3 adds real-time updates via Server-Sent Events. Phase 4 adds multi-harness connectors. Phase 5 adds parallel dispatch and thread branching.

SCUT is not an agent framework, does not run language models, and does not replace copilot-bridge - it is the coordination plane above them.

---

## 2. Design Principles

### API-First (hard constraint)

API-first is a **hard constraint**, not a guideline. Every entity, capability, and state transition in SCUT is reachable via the public HTTP API. The React web UI shipped in this repo is **one client among many** - a native desktop app (Tauri/Electron), a mobile app (iOS/Android), a CLI, and external agents must all be able to do **everything the web UI can do** by calling the same documented API.

Practical gates derived from this constraint:

- No business logic in UI code. The server enforces all rules; the UI renders results.
- No server-side endpoint exists solely to serve the React UI's convenience. If a query shape is only useful to one client, it goes in that client.
- All real-time updates flow through a documented, client-agnostic channel (SSE per §8; not WebSocket-only, not React-specific).
- The OpenAPI document (§11, `docs/api/openapi.yaml`) is the contract. Server endpoint + test + OpenAPI entry land first; UI work consumes that endpoint as a separate, later PR.
- Auth tokens and session model work identically for browser, native, mobile, and headless clients. No browser-only cookie/CSRF coupling.
- The packaged web UI is shipped from the API server as static assets, but is **not** required for the server to be useful. `scut-server` alone (no UI) is a valid deployment for headless / agent-only setups.
- **All business endpoints are namespaced under a versioned API prefix** (`/api/v1/...`). The `/api/` (no version) namespace is reserved for meta endpoints (`/api/docs`, `/api/health`) that intentionally do not version. See §11 for the deployment topology.
- **Every endpoint must be reachable and testable via `curl`** before any UI consumes it. `scripts/smoke.sh` exercises every endpoint and runs in CI.

#### Client roadmap

The API surface must be designed assuming all of these clients will exist:

| Client | Status | Notes |
|---|---|---|
| Web UI (React, shipped with server) | Phase 1 | Default client; one of many |
| Native desktop (Tauri or Electron) | Future | Same REST + SSE as web; bundles its own UI shell |
| Mobile (iOS / Android) | Future | Same REST + SSE; push notifications via separate channel |
| CLI (`scut` command) | Future | Thin wrapper over the public API for scripting and agent harnesses |
| External agents (ACP outbound; REST/A2A inbound) | Phase 2+ | ACP harnesses dispatched to via `IReplicantConnector`. External agents call into SCUT through `/api/v1/...` (always) or a future A2A inbound surface (see §11). Both authenticate as Replicants via the existing agent-token model. |
| External integrations (webhooks in/out) | Future | API must not preclude them |

No port decision may foreclose any of these clients.

#### Curl-first testability gate

Every server endpoint must be exercisable end-to-end via `curl` before any UI code consumes it.

1. **Endpoint PR sequence**: server endpoint + test + OpenAPI entry land first. UI work that consumes that endpoint is a separate, later PR.
2. **Test artifact**: every endpoint ships with at least one of (a) an integration test that hits the live Fastify instance over HTTP, or (b) a `docs/api/examples/<endpoint>.sh` script using `curl` that demonstrates a happy-path call.
3. **Smoke script**: `scripts/smoke.sh` runs a sequence of `curl` calls against a local `scut-server` and asserts the responses. Every new endpoint adds one line to this script. CI runs it against a fresh dev instance.
4. **No "tested via the UI"** as the only validation. If the only way to know an endpoint works is to click through the React app, the endpoint is not finished.

The deployment topology that makes the web UI + API coexist on one origin while remaining independently deployable is documented in §11 (Reverse-proxy topology).

### Columns Are Views, Not Containers

A Thread does not live inside a Column. A Thread lives on a Project and has fields (status, assignee_type, assignee_id, metadata). A Column is a saved filter rule — a JSON expression evaluated at query time. A Thread appears in a Column when its fields match the column's `filter_rule`. Moving a Thread between columns mutates the Thread's fields, not its location. A single Thread can appear in multiple columns if it matches multiple filter rules.

When a Thread is moved to a column, `thread.status` is set to `column.status_label`. The column's display `name` and its `status_label` are independent fields — renaming a column does not change the status values already written to threads.

### Assignee Is Polymorphic

Any entity that can be assigned (Thread, ChecklistItem) uses `assignee_type` + `assignee_id`. `assignee_type` is `'user'`, `'replicant'`, or `null`. This means the same assignment field works for human users (Phase 1) and agent connectors (Phase 2) without a schema change.

### Thread = Work Item (Phases 1+) and Agent Session (Phase 2+)

A Thread is the unit of work. In Phase 1 it is a Kanban card. In Phase 2, posting a comment to a Thread with an assigned Replicant triggers a dispatch via the Replicant's `IReplicantConnector` — the Thread's comment history becomes the session context, and the dispatch lifecycle is tracked in `comment_dispatches`. The data model does not change between phases; Phase 2 adds dispatch behavior on top of it. See also: **Everything Is a Thread** below — a DM session with a Replicant on a `chat` board is also a Thread, using the same data model.

Threads can have a `parent_id` pointing to another Thread. This is set when a ChecklistItem is promoted to a full Thread, preserving the lineage. It is also set on delegated child threads — see the Delegation vocabulary entry.

### Everything Is a Thread

Work items, agent sessions, and direct messages are all Threads. The board a Thread belongs to (and its `board_type`) determines how it is rendered in the UI and what rules apply. There is no separate `conversations` or `dm_sessions` table. A DM with a Replicant is a Thread on a `chat` board. A work item is a Thread on a `standard` or `agent_board` board. The message history and dispatch history are the same regardless of board type.

### Checklists Are Execution Artifacts

A Checklist on a Thread is an optional ordered list of actionable items. Checklists are useful for both humans (acceptance criteria, steps) and agents (execution plan). A ChecklistItem can be promoted to a full Thread — at that point a new Thread is created with `parent_id` pointing to the originating Thread.

### Pluggable Storage

The database layer is accessed through a repository interface, not directly. Route handlers and business logic call repository methods. The concrete implementation is injected at startup.

Phase 1 ships `SQLiteRepository` (better-sqlite3, synchronous calls wrapped in Promises). A `PostgresRepository` can be swapped in without touching any route handler or connector code. The interface is the contract; the storage engine is a deployment detail.

Consequences:
- All DB access goes through typed repository interfaces
- No raw SQL in route handlers or connectors
- `IRepository` implementations live in `packages/server/src/db/adapters/`
- The active adapter is selected by `DATABASE_DRIVER` env var (`sqlite` | `postgres`)

### Metadata as First-Class

Every entity carries a `metadata` JSON field. This enables filtering, custom views, tagging, labeling, and priority without schema changes. Standard fields (priority, labels, estimate) are conventions on top of metadata, not columns.

---

## 3. Vocabulary

| Term | What it is |
|------|-----------|
| **Organization** | Top-level tenant. Phase 1: single org, config only. |
| **Project** | A named collection of Boards and Threads. Roughly equivalent to a repo or initiative. |
| **Board** | A named view within a Project. Displays Threads organized into Columns. `board_type` is a discriminator field (`standard` \| `agent_board` \| `chat`) driving UI rendering and validation rules — not a structural DB difference. |
| **Column** | A saved filter rule on a Board. Threads appear in a column when their fields match the `filter_rule`. Not a container. |
| **Thread** | The unit of work (internal/DB name). A card on a board in Phase 1. Gains agent session behavior in Phase 2. The display label is configurable per board via `item_singular`/`item_plural` (default: "thread"/"threads"). A DM session with a Replicant on a `chat` board is also a Thread. |
| **Card** | The UI display label for a Thread; the default value. May be customized per board (e.g., "Issue", "Work Item", "Ticket") via the board's `item_singular` field. |
| **Comment** | One entry in a Thread's history — from a user, a Replicant, or the system. `comments.metadata` is reserved for **presentation hints only** (streaming tokens, tool-call collapsibles, citations); dispatch state lives in `comment_dispatches`, not here. |
| **Checklist** | An optional ordered list of ChecklistItems attached to a Thread. |
| **ChecklistItem** | A single actionable item in a Checklist. Can have an assignee. Can be promoted to a Thread. |
| **AgentTask** | Protocol-neutral connector-boundary type. ACP `session/prompt` invocations, A2A `Task`s, and bridge sessions all map onto this behind their respective Connectors. Returned (as an `AgentTaskHandle`) from `IReplicantConnector.dispatch`. |
| **AgentTaskHandle** | Opaque handle returned by `IReplicantConnector.dispatch`. SCUT stores it in `comment_dispatches.connector_handle` and never parses it; it is round-tripped to the Connector for `cancel(handle)` and `status(handle)`. |
| **AgentTaskStatus** | Status of an `AgentTask` as reported by a Connector: `pending | running | completed | failed | cancelled`. Surfaced via `comment_dispatches.status` (see §6.4). |
| **comment_dispatches** | Sidecar SQL table tracking the lifecycle of one dispatch (status, replicant_id, thread_id, triggering comment, timing, error, opaque `connector_handle`). One row per dispatch attempt; SCUT-queryable. See cbk-merge-plan §3.3 for why the agent-side invocation primitive (formerly modeled in SCUT-core as a separate table) is now owned by the connector behind `AgentTaskHandle`, while SCUT keeps only the dispatch-lifecycle row described here. |
| **connector_handle** | Opaque TEXT column on `comment_dispatches`. The Connector encodes whatever it needs inside (ACP `sessionId` + per-prompt invocation index, bridge session ID, A2A `Task.id` + `Context.id`). SCUT never parses it. |
| **Connector** | An implementation of `IReplicantConnector`. Each Replicant is configured with one Connector, parameterized by `harness`. (This is the term SCUT uses for the dispatch-implementation noun.) |
| **Harness** | Connector kind discriminator (`replicants.harness` column). Initial enum: `'acp'` (primary), `'copilot-bridge'` (legacy). New kinds are added as new Connector implementations land. |
| **IPromptAssembler** | Boundary that walks the node tree (board / column / card / instruction nodes per `research/scut-pm-experience.md`) and produces the `AssembledPrompt` passed to `IReplicantConnector.dispatch`. The Connector receives a finished prompt, never raw turns. |
| **User** | A registered human account. Auth via local credentials (username + bcrypt password) + JWT. |
| **Assignee** | A polymorphic reference: `{ type: 'user' \| 'replicant', id: string }` or `null`. |
| **Replicant** | A registered agent connector instance (Phase 2+). Named after Bobiverse replicants. Once a thread's `replicant_id` is set, it is immutable — it cannot be changed. Delegation creates a new child thread. |
| **Moot** | The React board UI. Where humans see and manage Threads across Projects and Boards. The Agent Moot view is a UI query (`WHERE replicant_id = ?`) across all boards — it is not a `board_type`, has no backing DB object, and threads shown in it belong to their home boards. |
| **IReplicantConnector** | The harness-agnostic Connector interface every Replicant implementation provides (Phase 2+). See §10. |
| **CopilotBridgeConnector** | Legacy `IReplicantConnector` implementation (`harness='copilot-bridge'`) that wraps the existing copilot-bridge WebSocket channel. Deprecated; kept for migration continuity only. |
| **AcpConnector** | **Primary** outbound `IReplicantConnector` implementation (`harness='acp'`). Speaks the [Agent Client Protocol](https://agentclientprotocol.com/) as the **Client** over JSON-RPC 2.0, driving ACP-capable harnesses (Claude Code, Codex, Copilot CLI with `--acp`, Zed-compatible agents) as subprocesses. **Note**: "ACP" here means Agent Client Protocol, **not** the IBM ACP that merged into A2A — see the naming-collision note in §10. |
| **A2A inbound surface** | Optional, future inbound surface at `/api/v1/a2a/...` that lets external A2A-speaking agents post threads, assign work, and hand off / delegate to SCUT-managed Replicants. A2A is **not** an outbound Connector harness in the first cut — it is a complementary inbound API surface. |
| **Checkpoint** | A saved snapshot of a Replicant's execution state at a point in time. First-class entity. Defined by `ICheckpointProvider` interface. Not all Connector implementations support checkpoints. |
| **Delegation** | The act of a Replicant creating a child Thread (with `parent_id` set) and assigning it to another Replicant. The original Thread's `replicant_id` is never changed. The parent Thread receives the result when the child completes. |

The pattern: `Replicant` is the registered entity. `IReplicantConnector` is the interface. Each `*Connector` is one harness adapter.

---

## 4. Application Architecture

### Web Application Model

SCUT is a **SPA + API server** (not SSR):

- **`packages/server`** — Fastify API server. Owns the database, business logic, auth, connector registry (Phase 2+), and serves the built UI as static files in production.
- **`packages/ui`** — React + Vite SPA. Fetches all data from the Fastify API. No server-side rendering.

This model is chosen because:
- A persistent backend is required regardless (SQLite, auth, connector registry, SSE)
- SSR adds complexity without benefit here — this is an operator tool, not a public site
- The API-first principle is cleanest when the UI and API are fully decoupled

In development, Vite proxies `/api` requests to the Fastify server. In production, Fastify serves the Vite build as static files and handles all `/api` routes.

### System Architecture

```mermaid
flowchart TB
    HO["Human Operator"]
    User["User (auth)"]
    REP["Replicant (Phase 2+)"]

    subgraph moot["SCUT Moot (React SPA)"]
        PV["Project View"]
        BV["Board View (Moot)"]
        TV["Thread Detail"]
    end

    subgraph server["SCUT Server (Fastify)"]
        API["REST API (OpenAPI documented)"]
        AUTH["Auth (JWT + bcrypt)"]
        SSE["SSE Event Stream (Phase 3+)"]
        DB["SQLite (better-sqlite3)"]
        RC["Connector Registry (Phase 2+)"]
    end

    CBC["CopilotBridgeConnector (Phase 2, legacy)"]
    ACPC["AcpConnector (Phase 2+, primary; speaks Agent Client Protocol)"]

    HO --> moot
    User -->|registers / logs in| AUTH
    REP -->|HTTP REST| API
    moot -->|HTTP REST| API
    moot <-->|SSE (Phase 3+)| SSE
    API --> DB
    API --> RC
    RC --> CBC
    RC --> ACPC
```

### API Documentation

Every endpoint is documented via OpenAPI 3.1. The spec is generated from Fastify's JSON schema validation and served at `/api/docs`. The OpenAPI spec file is committed to the repo at `docs/api/openapi.yaml` and updated with every PR that adds or changes endpoints. Agents and humans use the same docs.

---

## 5. Data Hierarchy

```
Organization
  └── Project
        └── Board (named view + ordered columns)
              └── Column (saved filter rule — not a container)
                    └── [Threads matching the filter_rule]
Thread
  ├── Comment (user, replicant, or system)
  ├── Checklist
  │     └── ChecklistItem (can be promoted to Thread)
  └── comment_dispatch (Phase 2+ — sidecar lifecycle row per dispatch attempt)
```

### Column filter_rule JSON Shape

The `filter_rule` field is a JSON object. The server evaluates it at query time to determine which threads appear in a column. Supported keys:

| Key | Type | Match behavior |
|-----|------|---------------|
| `status` | `string \| string[]` | Thread status equals one of the listed values |
| `assignee_type` | `'user' \| 'replicant' \| 'unassigned'` | Thread assignee_type matches; `'unassigned'` matches null |
| `assignee_id` | `string` | Thread assignee_id matches exactly |
| `labels` | `string[]` | Thread metadata.labels contains any of the listed labels |
| `metadata` | `object` | Shallow subset match: each key in the filter's `metadata` object must be present in the thread's `metadata` JSON with an equal scalar value. Example: `{ "metadata": { "priority": "high" } }` matches any thread where `metadata.priority === "high"`. Nested object and array matching are not supported in Phase 1. |

An empty `filter_rule` (`{}`) matches all threads in the project.

### Comparison to Common Tools

| SCUT | Linear | Jira | GitHub Projects |
|------|--------|------|-----------------|
| Organization | Workspace | Organization | Organization |
| Project | Team/Project | Project | Project |
| Board | Project View | Board | View |
| Column | Status group | Column | Column |
| Thread | Issue | Story/Task | Item (work item / agent session in Phase 2) |
| Comment | Comment | Comment | Comment |
| Checklist | (none) | Sub-tasks | (none) |
| ChecklistItem | (none) | Sub-task item | (none) |
| comment_dispatch | (none) | (none) | (none — SCUT-specific) |
| Replicant | (none) | (none) | (none — SCUT-specific) |
| Metadata | Labels + custom fields | Custom fields | Custom fields |

Key difference: in SCUT, a Thread is also a **persistent agent session** (Phase 2+). A `comment_dispatch` row records one Connector invocation within that session, with an opaque `connector_handle` that lets SCUT cancel and query status without parsing the protocol's IDs. No other tool in this list has a native concept of dispatching work to an agent and tracking the result as a first-class data entity.

### Metadata Conventions

All entities carry a `metadata` JSON field. Standard conventions (not enforced by schema):

| Key | Type | Meaning |
|-----|------|---------|
| `priority` | `"low" \| "medium" \| "high" \| "critical"` | Work priority |
| `labels` | `string[]` | Free-form tags for filtering and column rules |
| `estimate` | `number` | Story points or time estimate |
| `due_date` | ISO 8601 string | Target completion |
| `epic` | `string` | Parent epic identifier |

---

## 6. Data Model

### 6.1 Entity Overview Table

| Entity | Parent | Description |
|--------|--------|-------------|
| **Organization** | — | Top-level tenant. Phase 1: single org, config only. |
| **Project** | Organization | Named collection of boards and threads. |
| **Board** | Project | Named view with ordered columns. |
| **Column** | Board | Saved filter rule. Not a container. |
| **User** | Organization | Human account with local credentials. Phase 1+. |
| **Thread** | Project | Unit of work. Phase 1: Kanban card. Phase 2+: also agent session. |
| **Comment** | Thread | One turn in the thread history. `metadata` is for presentation hints only. |
| **Checklist** | Thread | Optional ordered list of items. |
| **ChecklistItem** | Checklist | Single actionable item. Can be promoted to Thread. |
| **comment_dispatches** | Thread | Sidecar lifecycle for one dispatch attempt (Phase 2+). References `threads(id)`, `replicants(id)`, and optionally `comments(id)` (the triggering comment). |
| **Replicant** | Organization | Registered agent connector (Phase 2+). |
| **Checkpoint** | Thread / comment_dispatch | Saved snapshot of a Replicant's execution state (Phase 2+). |

### 6.2 SQL Schema

```sql
-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active', -- active | archived
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users (Phase 1+)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Boards (named views within a project)
CREATE TABLE IF NOT EXISTS boards (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  board_type    TEXT NOT NULL DEFAULT 'standard',  -- standard | agent_board | chat
  item_singular TEXT NOT NULL DEFAULT 'thread',    -- display label singular, e.g. 'issue', 'work item'
  item_plural   TEXT NOT NULL DEFAULT 'threads',   -- display label plural
  replicant_id  TEXT REFERENCES replicants(id),    -- only set for agent_board type; scopes the board to one replicant
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Columns (saved filter rules on a board — not containers)
CREATE TABLE IF NOT EXISTS columns (
  id           TEXT PRIMARY KEY,
  board_id     TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  filter_rule  TEXT NOT NULL DEFAULT '{}', -- JSON: { status?, assignee_type?, assignee_id?, labels?, metadata? }
  status_label TEXT NOT NULL DEFAULT '',   -- value written to thread.status on move; defaults to slugified name if empty
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note: `name` is the display label (user-editable). `status_label` is the canonical value written to
-- `thread.status` when a Thread is moved to this column. They are independent: renaming the column
-- does not update existing thread statuses. If `status_label` is empty, the server uses a slugified
-- version of `name` as the effective status value.

-- Threads: unit of work (Phase 1) and persistent agent session (Phase 2+)
CREATE TABLE IF NOT EXISTS threads (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES threads(id) ON DELETE SET NULL, -- set when promoted from ChecklistItem, or for delegated child threads
  title         TEXT NOT NULL,  -- on chat boards, defaults to ISO timestamp of creation (e.g. 2026-05-15T09:40:00Z); user may rename
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo', -- todo | in_progress | blocked | done | archived
  assignee_type TEXT,                          -- 'user' | 'replicant' | null
  assignee_id   TEXT,                          -- FK to users.id or replicants.id depending on assignee_type
  replicant_id  TEXT REFERENCES replicants(id), -- immutable once set; see Delegation principle
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note: `replicant_id` is immutable once set. To delegate work, a Replicant creates a new child Thread
-- with `parent_id` referencing the current Thread and `replicant_id` pointing to the delegate Replicant.
-- The original Thread is never reassigned.

-- Comments: conversation history on a thread
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  dispatch_id TEXT REFERENCES comment_dispatches(id) ON DELETE SET NULL, -- Phase 2+; null in Phase 1
  author_type TEXT NOT NULL,  -- 'user' | 'replicant' | 'system'
  author_id   TEXT,           -- FK to users.id or replicants.id; null for system
  content     TEXT NOT NULL,
  -- presentation hints only (streaming tokens, tool-call collapsibles, citations). NOT for dispatch state.
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklists: optional ordered lists on a thread
CREATE TABLE IF NOT EXISTS checklists (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ChecklistItems: individual items within a checklist
CREATE TABLE IF NOT EXISTS checklist_items (
  id                 TEXT PRIMARY KEY,
  checklist_id       TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  done               INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0/1)
  position           INTEGER NOT NULL DEFAULT 0,
  assignee_type      TEXT,   -- 'user' | 'replicant' | null
  assignee_id        TEXT,
  promoted_thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL, -- set when promoted
  metadata           TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Replicants: registered agent connector instances (Phase 2+)
-- Table included in schema for continuity; not exposed via API in Phase 1.
CREATE TABLE IF NOT EXISTS replicants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  harness    TEXT NOT NULL,              -- 'acp' (primary) | 'copilot-bridge' (legacy). New harness kinds added as Connector implementations land.
  config     TEXT NOT NULL DEFAULT '{}', -- harness-specific JSON config
  status     TEXT NOT NULL DEFAULT 'unknown', -- online | offline | busy | unknown
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- comment_dispatches: sidecar lifecycle for one dispatch attempt (Phase 2+)
-- One row per IReplicantConnector.dispatch() call. SCUT-queryable; connector_handle is opaque.
CREATE TABLE comment_dispatches (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  triggering_comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL,
  replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  connector_handle TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comment_dispatches_status ON comment_dispatches(status);
CREATE INDEX idx_comment_dispatches_thread ON comment_dispatches(thread_id, created_at);
CREATE INDEX idx_comment_dispatches_replicant ON comment_dispatches(replicant_id, status);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_boards_project         ON boards(project_id);
CREATE INDEX IF NOT EXISTS idx_columns_board          ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_threads_project        ON threads(project_id);
CREATE INDEX IF NOT EXISTS idx_threads_parent         ON threads(parent_id);
CREATE INDEX IF NOT EXISTS idx_threads_status         ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_assignee       ON threads(assignee_type, assignee_id);
CREATE INDEX IF NOT EXISTS idx_threads_replicant      ON threads(replicant_id);
CREATE INDEX IF NOT EXISTS idx_comments_thread        ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_dispatch      ON comments(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_checklists_thread      ON checklists(thread_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_list   ON checklist_items(checklist_id);

-- Labels/tags join table (Phase 1+)
-- Preferred over metadata.labels array for queryability and future Postgres compatibility.
CREATE TABLE IF NOT EXISTS card_labels (
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (thread_id, label)
);
CREATE INDEX IF NOT EXISTS idx_card_labels_label  ON card_labels(label);
CREATE INDEX IF NOT EXISTS idx_card_labels_thread ON card_labels(thread_id);

-- Note: Labels are queryable via JOIN. A Thread can have any number of labels.
-- Labels are free-text strings. This is preferred over `metadata.labels` array
-- for queryability and future Postgres compatibility.

-- Checkpoints: saved snapshots of Replicant execution state (Phase 2+)
-- Not all IReplicantConnector implementations support checkpointing.
-- Connectors that support it implement ICheckpointProvider in addition to IReplicantConnector.
CREATE TABLE IF NOT EXISTS checkpoints (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  dispatch_id   TEXT REFERENCES comment_dispatches(id) ON DELETE SET NULL,
  replicant_id  TEXT NOT NULL REFERENCES replicants(id),
  label         TEXT,              -- optional human-readable label
  data          TEXT NOT NULL DEFAULT '{}',  -- JSON; connector-specific checkpoint payload
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread   ON checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_dispatch ON checkpoints(dispatch_id);
```

### 6.3 Thread Status Flow

```mermaid
stateDiagram-v2
    [*] --> todo
    todo --> in_progress
    todo --> blocked
    in_progress --> done
    in_progress --> blocked
    blocked --> todo
    blocked --> archived
    done --> archived
```

### 6.4 AgentTaskStatus Lifecycle

`comment_dispatches.status` tracks one Connector invocation. The Connector owns the truth via its `events()` stream; SCUT writes status updates as events arrive.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> running: connector accepts dispatch
    running --> succeeded: event stream closes cleanly
    running --> failed: connector emits error or stream errors
    running --> cancelled: SCUT calls cancel(handle)
```

- `queued` → `running` when the Connector accepts the dispatch (returns an `AgentTaskHandle`).
- `running` → `succeeded` when the Connector's event stream closes cleanly.
- `running` → `failed` when the Connector emits an error event or the stream errors out.
- `running` → `cancelled` when SCUT calls `cancel(handle)` (e.g. user cancels, parent thread archived).

Owned by the Connector's event stream; SCUT writes the status updates as events arrive. The `AgentTaskStatus` reported by `IReplicantConnector.status(handle)` mirrors this lifecycle.

### 6.5 Board Types

The `board_type` field on `boards` is a discriminator that drives UI rendering and validation rules. It is not a structural database difference — all boards share the same table.

**`standard`** — A user-managed Kanban or project board. Columns represent workflow stages. Column names and `status_label` values are fully user-configurable. `item_singular` and `item_plural` are configurable. Thread `replicant_id` may be set to assign a thread to a Replicant, at which point the thread also appears in the Agent Moot view for that Replicant.

**`agent_board`** — A board scoped to a single Replicant (identified by `boards.replicant_id`). Contains threads native to that Replicant (created directly for or by the agent, not sourced from another board). Columns are system-defined and locked (minimal or no user customization). Appears as a dedicated board view for that Replicant.

**`chat`** — A board for direct message sessions between a user and a Replicant (or another human). Threads on a chat board are conversation sessions. Column names are locked (`active`, `archived`, `pinned`). Thread `title` defaults to the ISO timestamp the thread was created (e.g. `2026-05-15T09:40:00Z`); users may rename it. There is no separate `conversations` or `dm_sessions` table — chat DMs are threads on a `chat` board.

**Agent Moot** — Not a `board_type`. A UI view that queries threads across all boards where `replicant_id = :id`. Threads shown in the moot belong to their home boards. Columns in the moot represent Replicants; rows represent threads assigned to each. Because `replicant_id` is immutable once set, the Agent Moot is a read-only cross-board view — threads cannot be reassigned by moving them in this view.

---

### Model

Local accounts only. JWT (JSON Web Tokens) for session management. Future: GitHub OAuth (not in scope for any current phase — noted as a future addition only).

### Token Strategy

- `POST /api/v1/auth/register` creates a user. Password is hashed with bcrypt (cost factor configurable via `BCRYPT_ROUNDS`, default 12).
- `POST /api/v1/auth/login` verifies credentials and returns a signed JWT (HS256, configurable expiry via `JWT_EXPIRY`, default `24h`). Token is stored by the client.
- JWT payload claims: `{ sub: <userId>, username: <username>, iat: <issued-at>, exp: <expiry> }`. The `sub` claim is the user's `id`. `GET /api/v1/auth/me` queries the database using `sub` rather than deserialising user fields from the token — this ensures `PATCH /api/v1/auth/me` changes are reflected immediately without re-login.
- Auth middleware attaches `request.user` as `{ id: string, username: string }` (decoded from JWT sub + username claims, not a DB lookup on every request).
- All protected endpoints require `Authorization: Bearer <token>` header.
- `POST /api/v1/auth/logout` is a client-side operation (discard token); no server-side blocklist in Phase 1.

### Public Endpoints (no auth required)

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/docs` (OpenAPI)
- `GET /api/health`

All other endpoints require a valid JWT.

### Environment Variables for Auth

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | none | Server refuses to start without this |
| `JWT_EXPIRY` | No | `24h` | Token lifetime |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor |

---

## 8. Real-Time and Bidirectional Data

> **Phase note:** SSE is Phase 3. Phase 1 and Phase 2 use polling or manual refresh. This section documents the target model for Phase 3+.

### Model

SCUT uses **Server-Sent Events (SSE)** for server-to-client push (dispatch status updates, new comments, thread status changes). SSE is sufficient for Phase 3 because the primary real-time flow is one-way: the server notifying the UI of agent results.

For bidirectional needs (collaborative editing), **WebSockets** are a future upgrade path. The API design does not prevent this — SSE and WebSocket endpoints are additive.

### Event Streams

| Endpoint | Scope | Events emitted |
|----------|-------|----------------|
| `GET /api/v1/threads/:id/events` | Single thread | `comment`, `dispatch`, `thread` |
| `GET /api/v1/projects/:id/events` | Whole project | `thread_created`, `thread_updated`, `dispatch_updated` |

### Bidirectional Flow: Thread as Agent Session (Phase 2+)

```mermaid
sequenceDiagram
    participant H as Human (UI or API client)
    participant S as SCUT Server
    participant R as Replicant (via IReplicantConnector)

    H->>S: POST /api/v1/threads/:id/comments (author_type=user)
    S->>S: Create Comment record
    S->>S: Create comment_dispatches row (status=queued)
    S->>R: connector.dispatch({thread, triggeringComment, prompt})
    R-->>S: AgentTaskHandle
    S->>S: Update dispatch (status=running, connector_handle=handle)
    S-->>H: 201 { comment, dispatch }
    R-->>S: events(handle) stream: token chunks, tool calls, final message
    S->>S: Append/update Comments; on stream close, set dispatch status=succeeded
    S-->>H: SSE event: dispatch updated (Phase 3+)
    S-->>H: SSE event: new comment (Phase 3+)
```

The same flow works for an agent client: the agent POSTs a comment to the API just like the human UI does.

---

## 9. Database Adapter Interface

SCUT's database layer is accessed exclusively through typed repository interfaces. Route handlers call repository methods; they never touch SQL or a DB client directly. This is the seam that makes storage engines swappable.

### 9.1 Interface Pattern

Each entity group has its own repository interface. All methods are async (return `Promise<T>`), even in the Phase 1 SQLite implementation, so the interface works uniformly when Postgres (inherently async) is introduced.

```typescript
// Root interface: one instance, all repositories
export interface IRepository {
  projects:       IProjectRepository;
  boards:         IBoardRepository;
  columns:        IColumnRepository;
  users:          IUserRepository;
  threads:        IThreadRepository;
  comments:       ICommentRepository;
  checklists:     IChecklistRepository;
  checklistItems: IChecklistItemRepository;
  replicants:        IReplicantRepository;         // Phase 2+
  commentDispatches: ICommentDispatchRepository;   // Phase 2+
}

export interface IProjectRepository {
  findAll(filters?: { include_archived?: boolean }): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  archive(id: string): Promise<void>; // sets status = 'archived', does not delete
}

export interface IThreadRepository {
  findById(id: string): Promise<Thread | null>;
  findByProject(projectId: string, filters?: ThreadFilters): Promise<Thread[]>;
  /**
   * Returns threads matching the column's filter_rule.
   * Resolves project scope by joining: columns.board_id -> boards.project_id.
   * An empty filter_rule {} matches all threads in the project.
   */
  findByColumn(columnId: string): Promise<Thread[]>; // evaluates column filter_rule
  create(input: CreateThreadInput): Promise<Thread>;
  update(id: string, input: UpdateThreadInput): Promise<Thread>;
  archive(id: string): Promise<void>;
}

export interface IChecklistRepository {
  findByThread(threadId: string): Promise<Checklist[]>;
  findById(id: string): Promise<Checklist | null>;
  create(input: CreateChecklistInput): Promise<Checklist>;
  update(id: string, input: UpdateChecklistInput): Promise<Checklist>;
  delete(id: string): Promise<void>;
}

export interface IChecklistItemRepository {
  findByChecklist(checklistId: string): Promise<ChecklistItem[]>;
  findById(id: string): Promise<ChecklistItem | null>;
  create(input: CreateChecklistItemInput): Promise<ChecklistItem>;
  update(id: string, input: UpdateChecklistItemInput): Promise<ChecklistItem>;
  delete(id: string): Promise<void>;
  /**
   * Promotes a ChecklistItem to a Thread.
   * Resolves parent thread id by joining: checklist_items.checklist_id -> checklists.thread_id.
   * Sets the new Thread's parent_id to that thread id.
   * Sets promoted_thread_id on the ChecklistItem to the new Thread's id.
   * Throws if the item's promoted_thread_id is already set (already promoted).
   */
  promote(id: string): Promise<Thread>; // creates Thread with parent_id, returns the new Thread
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
  delete(id: string): Promise<void>;
}
```

The server receives a single `IRepository` instance at startup and passes it to all route handlers via Fastify's dependency injection (decorated on the `fastify` instance).

### 9.2 Implementations

| Adapter | Driver | Phase | Notes |
|---------|--------|-------|-------|
| `SQLiteRepository` | better-sqlite3 (sync, wrapped in Promises) | 1+ | Default. File-based. Zero config. |
| `PostgresRepository` | `pg` or `postgres` | Phase 3+ | For multi-user or hosted deployments. |

### 9.3 Directory Layout

```
packages/server/src/db/
  interfaces/
    IRepository.ts          - root interface and all sub-interfaces
    types.ts                - shared input/filter/output types
  adapters/
    sqlite/
      index.ts              - SQLiteRepository implements IRepository
      projects.ts
      boards.ts
      columns.ts
      users.ts              - Phase 1+
      threads.ts
      comments.ts           - was messages.ts
      checklists.ts         - Phase 1+
      checklist_items.ts    - Phase 1+
      replicants.ts         - Phase 2+
      comment_dispatches.ts - Phase 2+
      schema.sql            - CREATE TABLE statements
      migrate.ts            - idempotent migration runner
    postgres/
      index.ts              - PostgresRepository (Phase 3+)
  index.ts                  - factory: createRepository(driver) -> IRepository
```

### 9.4 Driver Selection

```
DATABASE_DRIVER=sqlite    # default
DATABASE_PATH=./scut.db

# For postgres (Phase 3+ future):
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://user:pass@host:5432/scut
```

---

## 10. Connector Interface (Phase 2+)

> **Phase note:** This section describes functionality that is NOT in Phase 1. It is documented here for continuity of design.

> **Naming-collision note (important):** There are two unrelated protocols both historically called "ACP". The one SCUT speaks is the **Agent Client Protocol** at https://agentclientprotocol.com/ — JSON-RPC 2.0, SCUT acts as the **Client**, harnesses (Claude Code, Codex, Copilot CLI `--acp`, Zed-compatible agents) act as the **Agent**. The other "ACP" was an IBM standard that has since merged with A2A and is **not** what we mean. All references to "ACP" in this spec mean Agent Client Protocol. See dark-factory `research/agent-protocol-landscape.md` for the full landscape.

Every Replicant connector implements `IReplicantConnector`. The interface is intentionally thin: SCUT's job is to route and track, not to dictate how the harness works internally. SCUT assembles the prompt (board / column / card / instruction-node stack) via an `IPromptAssembler` before dispatch — the Connector receives a finished `AssembledPrompt`, never raw turns.

```typescript
export type Thread = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  assigneeType: 'user' | 'replicant' | null;
  assigneeId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  threadId: string;
  dispatchId: string | null;
  authorType: 'user' | 'replicant' | 'system';
  authorId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

// Opaque to SCUT. Each connector owns its shape and serialization.
export type AgentTaskHandle = string;

export type AgentTaskStatus = {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  detail?: string;
};

// Emitted by the connector while a task is running. SCUT consumes these
// and writes them as Comments (or updates the dispatch row status).
export type AgentEvent =
  | { kind: 'token'; text: string }
  | { kind: 'tool_call'; name: string; args: unknown; result?: unknown }
  | { kind: 'message'; content: string }
  | { kind: 'error'; error: string }
  | { kind: 'status'; status: AgentTaskStatus };

export interface IReplicantConnector {
  /**
   * Dispatch one AgentTask. SCUT hands over the thread, the triggering
   * comment, and an already-assembled prompt. The connector returns an
   * opaque AgentTaskHandle SCUT persists in comment_dispatches.connector_handle.
   */
  dispatch(args: {
    thread: Thread;
    triggeringComment: Comment;
    prompt: AssembledPrompt;  // produced by IPromptAssembler
  }): Promise<AgentTaskHandle>;

  /** Cancel an in-flight task. Resolves even if already completed. */
  cancel(handle: AgentTaskHandle): Promise<void>;

  /** Current status of the task. */
  status(handle: AgentTaskHandle): Promise<AgentTaskStatus>;

  /**
   * Stream of updates the connector emits while a task is running.
   * SCUT consumes these and writes them as Comments (or updates the
   * dispatch row status). Termination of the stream completes the dispatch.
   */
  events(handle: AgentTaskHandle): AsyncIterable<AgentEvent>;
}
```

### 10.1 IPromptAssembler

SCUT (not the connector) walks the node tree (board / column / card / instruction nodes per `research/scut-pm-experience.md`) and produces the `AssembledPrompt` passed to `IReplicantConnector.dispatch`. This keeps presentation and layered-prompt logic out of every connector.

```typescript
export interface IPromptAssembler {
  /**
   * Walks the node tree above this thread (board, column, parent card,
   * instruction nodes) plus the triggering comment, and returns a
   * finished prompt the connector can pass straight to its harness.
   */
  assemble(args: {
    thread: Thread;
    triggeringComment: Comment;
    instructionNodes: InstructionNode[];
  }): Promise<AssembledPrompt>;
}
```

The exact shape of `AssembledPrompt` and `InstructionNode` is defined in `research/scut-pm-experience.md` (unified-node + instructions iteration). The contract from `IReplicantConnector`'s point of view: an opaque, ready-to-send prompt object.

### 10.2 ICheckpointProvider

An optional interface that connectors may implement alongside `IReplicantConnector`. Not all harnesses support checkpointing.

```typescript
export interface ICheckpointProvider {
  /** Save a checkpoint for the given dispatch. Returns the checkpoint ID. */
  saveCheckpoint(dispatchId: string, threadId: string, data: Record<string, unknown>): Promise<string>;

  /** Restore execution state from a checkpoint. */
  restoreCheckpoint(checkpointId: string): Promise<void>;

  /** List checkpoints for a thread, most recent first. */
  listCheckpoints(threadId: string): Promise<Array<{ id: string; label?: string; createdAt: string }>>;
}
```

To check at runtime: `if ('saveCheckpoint' in connector) { ... }`

### 10.3 Connector Contract Notes

- `dispatch` returns as soon as the Connector has accepted the task and produced an `AgentTaskHandle`. SCUT writes the handle to `comment_dispatches.connector_handle` and flips status from `queued` to `running`.
- The `events()` stream is the source of truth for what becomes Comments and for dispatch status transitions. Stream close = `succeeded`. Error event or stream error = `failed`.
- `cancel` is best-effort. Some harnesses may not support mid-task cancellation. Connectors should set dispatch status to `cancelled` and resolve without throwing if cancellation is not possible.
- `status` is cheap and non-blocking; SCUT may poll it as a backstop to the event stream.
- The connector registry is a `Map<replicantId, IReplicantConnector>` initialized at startup from the `replicants` table `harness` + `config` columns.
- **Connector handles are opaque.** SCUT never parses them; the right decoder is always findable via the Replicant referenced by the dispatch row, which carries the `harness` discriminator.

### 10.4 AcpConnector (primary)

`AcpConnector` is the primary `IReplicantConnector` implementation. It speaks the [Agent Client Protocol](https://agentclientprotocol.com/) as the **Client** over JSON-RPC 2.0, framed as NDJSON over a transport selected per Replicant (see §10.5). It drives ACP-capable harnesses (Claude Code, Codex, Copilot CLI with `--acp`, Zed-compatible agents) either as spawned subprocesses (stdio) or as already-running ACP servers reachable on a loopback TCP port.

- Maps ACP `session/prompt` invocations onto `AgentTask`. The opaque `connector_handle` encodes ACP `sessionId` + per-prompt invocation index.
- Client-side methods implemented: `session/request_permission` (routes through the SCUT permission system), `session/update` (each update becomes a Comment or appends to a streaming Comment).
- Agent-side methods called: `initialize`, `session/new`, `session/prompt`, `session/cancel`. `session/load` if the Agent advertises it.
- Built on the official `@agentclientprotocol/sdk` TypeScript library (`ClientSideConnection`, `ndJsonStream`); see https://agentclientprotocol.com/libraries/typescript.

See §10.5 for the binding transport contract and §12 for harness configuration. See the CBK→SCUT merge plan (`docs/spec/cbk-merge-plan.md`) §4 for the full Connector roadmap, including the legacy `CopilotBridgeConnector` (`harness='copilot-bridge'`).

### 10.5 ACP Transport (binding)

> **Amendment note (bill-hwl):** This section supersedes the prior implicit assumption (carried over from CBK) that a Connector might reach its harness over a bespoke HTTP + WebSocket channel. For ACP harnesses, the only spec-conformant transports are NDJSON-framed JSON-RPC 2.0 over loopback TCP or stdio. Custom HTTP/WS bridges are not a SCUT transport. The legacy `CopilotBridgeConnector` (§12) is the sole, deprecated exception, retained for migration continuity only.

#### 10.5.1 Supported transports

The ACP server side is provided by an ACP-conformant process (for example, GitHub Copilot CLI's `copilot --acp` server, documented at https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server). The Connector side speaks to it through one of two transports:

| Transport | Server invocation (reference: Copilot CLI) | Connector behaviour |
|---|---|---|
| **TCP** (primary, near-term) | `copilot --acp --port <n>` | Connector dials a loopback TCP port. NDJSON frames each JSON-RPC 2.0 message. |
| **stdio** (follow-on) | `copilot --acp --stdio` (or `copilot --acp`, which defaults to stdio per the Copilot CLI docs) | Connector spawns the ACP server as a child process and pipes its stdin/stdout. NDJSON frames each JSON-RPC 2.0 message. |

Both transports use the `@agentclientprotocol/sdk` `ndJsonStream(output, input)` helper plus `new ClientSideConnection(clientFactory, stream)` on the client side. See https://agentclientprotocol.com/protocol/overview and https://agentclientprotocol.com/libraries/typescript.

#### 10.5.2 Transport-selection policy

- **Default**: TCP. Matches the near-term direction of the CBK transport refit (sibling work tracked separately) and lets the ACP server run as a managed local service independent of the Connector lifecycle.
- **Configurable per Replicant**: `replicants.config.transport: 'tcp' | 'stdio'` (JSON column). If absent, the Connector defaults to `'tcp'`.
- **Deployment-wide override**: an environment variable (`SCUT_ACP_TRANSPORT_DEFAULT`) may set the default for Replicants whose config omits `transport`.
- **Security**: when `transport='tcp'`, the Connector MUST bind to and dial loopback only (`127.0.0.1` or `::1`); it MUST refuse non-loopback addresses. The ACP process is local-trust and is gated by the Connector; Replicant token auth (§7) remains server-side and is unchanged by this section.
- **Preference**: stdio is preferred for production once supported, because process lifetime, stdin/stdout closure, and OS-level isolation give cleaner failure semantics than a long-lived loopback socket.

#### 10.5.3 Mapping SCUT primitives onto ACP

The following mappings are binding. Connector implementations MUST honour them.

| SCUT primitive | ACP element | Binding behaviour |
|---|---|---|
| `comment_dispatches` row lifecycle (§6.4) | ACP session lifecycle: `newSession` → `prompt` → terminal `stopReason` | `queued` → `running` once the Connector has either (a) reused an existing ACP `sessionId` or completed `newSession`, **and** issued `prompt`. `running` → `succeeded` iff the `prompt` result has `stopReason === 'end_turn'`. `running` → `failed` for any other terminal `stopReason` other than an explicit cancellation, or on stream/transport error. `running` → `cancelled` iff SCUT issued `session/cancel` (via `IReplicantConnector.cancel(handle)`) and the prompt terminated as a result. |
| Persisted event stream (Phase 2.5 traces) | ACP `sessionUpdate` notifications (client-side `Client.sessionUpdate` callback) | Each `sessionUpdate` notification persists as one event row, ordered by arrival sequence within the dispatch. Event kinds covered include at least `agent_message_chunk`, `tool_call`, `tool_call_update`, plus any further `sessionUpdate` variants the SDK exposes. SCUT does not reinterpret payloads; it stores them verbatim and renders via `comments.metadata` (§3.5). |
| `replicant_permissions` decisions (per CBK merge plan §5, port unit 4) | ACP `requestPermission` (client-side `Client.requestPermission` callback) | The Connector applies the server-side permission policy stored on the Replicant. Outcome shape returned to ACP: `{ outcome: { outcome: 'allowed' \| 'denied' \| 'cancelled' } }`. No permission decision is made client-side or in the UI on the hot path; the UI may surface a pending request for human resolution and post the answer back through the same server-side policy store. |
| Replicant token auth (§7) | Unchanged | The ACP process is local-trust and is reached only over loopback/stdio; it does not authenticate against SCUT. SCUT's bearer-token model gates the public API, including any inbound surfaces. |

#### 10.5.4 Substrate (bill-1i7) implications

The forthcoming Substrate abstraction (tracked in Beads `bill-1i7`) MUST encode "ACP transport: stdio | NDJSON-framed JSON-RPC 2.0 over loopback TCP" as a hard constraint on any Substrate that hosts a Copilot-CLI-class agent. A Substrate that cannot expose at least one of these two transports cannot host the primary `AcpConnector`. This subsection constrains, but does not block, `bill-1i7`.

#### 10.5.5 Deprecations

The following Connector concepts are removed from the SCUT transport story by this amendment:

- Any notion that the primary outbound Connector reaches its harness via HTTP request/response. SCUT's HTTP surface remains, but it is inbound (§11), not the Connector channel.
- Any notion that the primary outbound Connector reaches its harness via WebSocket. SSE (§8) remains the documented client-facing real-time channel; WebSocket is not the Connector channel.
- CBK's bespoke `copilot-bridge` HTTP + WebSocket channel as a forward direction. It survives only as `CopilotBridgeConnector` (§12), explicitly deprecated, retained for migration continuity, not extended.

Anything CBK ships in HTTP/WS form for its own purposes that does NOT survive the port to SCUT must be re-expressed against ACP transport per this section before landing in SCUT.

---

## 11. API Surface

All endpoints return JSON. Error responses: `{ error: string, code?: string }`. Auth required on all endpoints except those noted. OpenAPI 3.1 served at `/api/docs`, committed to `docs/api/openapi.yaml`.

### 11.0 API surface is multi-client

The OpenAPI document at `/api/docs` is the contract for **all** clients — the bundled React UI, native desktop, mobile, CLI, and external agents. The bundled React UI is one client, not the contract. No endpoint exists solely to serve the React UI's convenience; no UI implements business logic the server does not enforce.

All business endpoints live under a versioned prefix (`/api/v1/...`). The unversioned `/api/` namespace is reserved for meta endpoints (`/api/docs`, `/api/health`) that intentionally do not version. `/api/v2/...` is reserved for future breaking changes.

### 11.0.1 Reverse-proxy topology

All SCUT deployments (dev, test, prod) sit behind a reverse proxy so the web UI and the API server can ship on one origin while remaining independently deployable.

```
                         ┌──────────────────────────────┐
                         │   reverse proxy (one origin) │
                         │   localhost:8080 / prod URL  │
                         └──────┬────────────────┬──────┘
                                │                │
              path: /api/v1/*   │                │   everything else (/, /assets/*, /boards/123, ...)
                                ▼                ▼
                  ┌──────────────────┐  ┌──────────────────┐
                  │  scut-server     │  │  web client      │
                  │  (Fastify)       │  │  (Vite dev or    │
                  │  /api/v1/...     │  │   static assets) │
                  │  /api/docs       │  │  SPA fallback    │
                  │  /healthz        │  │                  │
                  └──────────────────┘  └──────────────────┘
```

**Routing rules** (proxy config is the contract):

| Path prefix | Routed to | Notes |
|---|---|---|
| `/api/v1/...` | `scut-server` | Versioned business API (includes per-resource SSE streams per §11.13) |
| `/api/docs` | `scut-server` | OpenAPI UI + raw OpenAPI document |
| `/healthz`, `/readyz` | `scut-server` | Liveness / readiness |
| Everything else | web client | SPA fallback to `index.html`; client-side router handles deep links |

Reference proxy configs for dev (`infra/dev/Caddyfile` or `nginx.dev.conf`) ship in the repo. Prod deployers can swap in Envoy, Traefik, or anything else that honors the rules above. The web client owns all paths that do NOT begin with the API prefix (`/api/v1/...`, `/api/docs`) or with `/healthz`/`/readyz`; unmatched routes return `index.html` with HTTP 200 so React Router can handle the actual route.

### 11.1 Auth (public)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/register` | Create user account. Body: `{ username, email, password, display_name? }` |
| `POST` | `/api/v1/auth/login` | Login. Body: `{ username, password }`. Returns: `{ token, user }` |
| `GET` | `/api/v1/auth/me` | Get current user. Queries DB from JWT `sub` claim. Auth required. |
| `PATCH` | `/api/v1/auth/me` | Update own `display_name`, `avatar_url`, or `password`. Auth required. |
| `POST` | `/api/v1/auth/logout` | Client-side operation. Server returns 204. No server-side token blocklist in Phase 1. Client must discard the token. Auth required. |

### 11.2 Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/users` | List users (for assignee picker). Returns `id`, `username`, `display_name`, `avatar_url` only. |
| `GET` | `/api/v1/users/:id` | Get user profile. Returns `id`, `username`, `display_name`, `avatar_url`, `metadata`. |

Note: user creation is via `/api/v1/auth/register` only. No admin user management UI in Phase 1.

### 11.3 Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects` | List all projects |
| `POST` | `/api/v1/projects` | Create project. Body: `{ name, description?, metadata? }` |
| `GET` | `/api/v1/projects/:id` | Get project by ID |
| `PATCH` | `/api/v1/projects/:id` | Update project. Body: any subset of `{ name, description, metadata }` |
| `DELETE` | `/api/v1/projects/:id` | Soft-delete: sets `status = 'archived'`. Cascades to boards, columns, and threads are NOT applied on archive — only on hard delete. Archived projects are excluded from `GET /api/v1/projects` by default. Pass `?include_archived=true` to include them. |

### 11.4 Boards

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects/:id/boards` | List boards in project |
| `POST` | `/api/v1/projects/:id/boards` | Create board. Body: `{ name, description?, metadata? }` |
| `GET` | `/api/v1/boards/:id` | Get board with columns |
| `PATCH` | `/api/v1/boards/:id` | Update board. Body: any subset of `{ name, description, metadata }` |
| `DELETE` | `/api/v1/boards/:id` | Delete board |

### 11.5 Columns

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/boards/:id/columns` | List columns on board |
| `POST` | `/api/v1/boards/:id/columns` | Create column. Body: `{ name, position, filter_rule?, metadata? }` |
| `GET` | `/api/v1/columns/:id` | Get column with threads (evaluates `filter_rule`) |
| `PATCH` | `/api/v1/columns/:id` | Update. Body: any subset of `{ name, position, filter_rule, metadata }` |
| `DELETE` | `/api/v1/columns/:id` | Delete column |

### 11.6 Threads

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/projects/:id/threads` | List threads. Query params: `status`, `assignee_type`, `assignee_id`, `labels`, `metadata.*` (filter_rule key names match query param names) |
| `POST` | `/api/v1/projects/:id/threads` | Create thread. Body: `{ title, description?, status?, assignee_type?, assignee_id?, metadata?, parent_id? }` |
| `GET` | `/api/v1/threads/:id` | Get thread with comments, checklists, latest dispatch |
| `PATCH` | `/api/v1/threads/:id` | Update. Body: any subset of `{ title, description, status, assignee_type, assignee_id, metadata }` |
| `DELETE` | `/api/v1/threads/:id` | Archive thread |

### 11.7 Comments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/threads/:id/comments` | List comments on thread |
| `POST` | `/api/v1/threads/:id/comments` | Add comment. Body: `{ content, metadata? }`. `author_type='user'`, `author_id` from JWT. Phase 2+: triggers a dispatch (creates `comment_dispatches` row and calls `connector.dispatch`) if the thread has a replicant assignee. |
| `PATCH` | `/api/v1/comments/:id` | Edit own comment. Body: `{ content }` |
| `DELETE` | `/api/v1/comments/:id` | Delete own comment |

### 11.8 Checklists

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/threads/:id/checklists` | List checklists on thread |
| `POST` | `/api/v1/threads/:id/checklists` | Create checklist. Body: `{ title, position?, metadata? }` |
| `GET` | `/api/v1/checklists/:id` | Get checklist with items |
| `PATCH` | `/api/v1/checklists/:id` | Update. Body: any subset of `{ title, position, metadata }` |
| `DELETE` | `/api/v1/checklists/:id` | Delete checklist and all its items |

### 11.9 Checklist Items

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/checklists/:id/items` | List items in checklist |
| `POST` | `/api/v1/checklists/:id/items` | Create item. Body: `{ title, position?, assignee_type?, assignee_id?, metadata? }` |
| `GET` | `/api/v1/checklist-items/:id` | Get checklist item by ID. Returns full item including `promoted_thread_id` if promoted. |
| `PATCH` | `/api/v1/checklist-items/:id` | Update. Body: any subset of `{ title, done, position, assignee_type, assignee_id, metadata }` |
| `DELETE` | `/api/v1/checklist-items/:id` | Delete item |
| `POST` | `/api/v1/checklist-items/:id/promote` | Promote item to Thread. Creates a new Thread in the same project as the checklist's parent thread. New Thread defaults: `title` = item's `title`, `description` = `''`, `status` = `'todo'`, `assignee_type` = item's `assignee_type`, `assignee_id` = item's `assignee_id`, `parent_id` = item's parent thread id (resolved via checklist join). Sets `promoted_thread_id` on the ChecklistItem to the new Thread's id. If `promoted_thread_id` is already set, returns 409 with `{ error: "already promoted", code: "ALREADY_PROMOTED" }`. Optional request body: `{ title?: string, description?: string, status?: string }` to override defaults. |

### 11.10 Replicants (Phase 2+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/replicants` | List all replicants with status |
| `POST` | `/api/v1/replicants` | Register replicant. Body: `{ name, harness, config, metadata? }` |
| `GET` | `/api/v1/replicants/:id` | Get replicant |
| `PATCH` | `/api/v1/replicants/:id` | Update config or metadata |
| `DELETE` | `/api/v1/replicants/:id` | Deregister. Returns 409 if the Replicant has associated dispatches (`comment_dispatches.replicant_id` FK is `ON DELETE RESTRICT`). Delete or reassign all dispatches for this Replicant before deregistering. |

### 11.11 Dispatches (Phase 2+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/threads/:id/dispatches` | List `comment_dispatches` rows for the thread (status, replicant, timing, error). |
| `POST` | `/api/v1/threads/:id/dispatches` | Manually trigger a dispatch on the thread (creates a `comment_dispatches` row and calls `connector.dispatch`). |
| `DELETE` | `/api/v1/dispatches/:id` | Cancel a dispatch. Calls `connector.cancel(handle)` and flips status to `cancelled`. |

### 11.12 Connector Inbound Surface (Phase 2+)

Connectors do **not** post results back via a callback in the new model — the `IReplicantConnector.events()` async stream is the source of truth. SCUT consumes that stream in-process and writes Comments + dispatch status updates as events arrive (see §8 sequence diagram).

For external A2A-speaking agents (future, optional), an inbound surface at `/api/v1/a2a/...` will let those agents post threads, assign work, and hand off / delegate to SCUT-managed Replicants. A2A maps `Message` → SCUT Comment and `Task` → SCUT Thread + `comment_dispatches`. Authentication uses the existing replicant-token model. This surface is complementary to ACP (outbound) and is not part of Phase 2.

### 11.13 SSE Events (Phase 3+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/threads/:id/events` | SSE stream for single thread |
| `GET` | `/api/v1/projects/:id/events` | SSE stream for whole project |

---

## 12. Connector Implementations (Phase 2+)

> **Phase note:** None of these are in Phase 1 scope. Phase 2 ships `AcpConnector` (primary) and `CopilotBridgeConnector` (legacy).

### `AcpConnector` (Phase 2+, primary)

Speaks the [Agent Client Protocol](https://agentclientprotocol.com/) as the **Client** over JSON-RPC 2.0, framed as NDJSON over the transport selected per Replicant (see §10.5). Drives ACP-capable harnesses (Claude Code, Codex, Copilot CLI with `--acp`, Zed-compatible agents). Implements `IReplicantConnector` per §10.4. Built on `@agentclientprotocol/sdk` (`ClientSideConnection`, `ndJsonStream`).

- Harness type: `acp`
- Transport (binding, per §10.5): `'tcp'` (primary, loopback only) or `'stdio'` (follow-on, child-process pipes). Default `'tcp'`.
- Config:
  - Common: `{ transport: 'tcp' | 'stdio' }`
  - When `transport='tcp'`: `{ host?: '127.0.0.1' | '::1' (default '127.0.0.1'), port: number }`. The port may be ephemeral; the ACP server is expected to be launched out-of-band (for example, `copilot --acp --port <n>`).
  - When `transport='stdio'`: `{ command: string, args?: string[], env?: Record<string, string> }`. The Connector spawns the server and pipes stdin/stdout.
- Opaque `connector_handle` encodes ACP `sessionId` + per-prompt invocation index.
- Client-side callbacks (mapped per §10.5.3): `requestPermission` against `replicant_permissions`; `sessionUpdate` persisted as event rows.
- Reference for the server side of this contract (Copilot CLI): https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server.

### `CopilotBridgeConnector` (Phase 2, legacy; deprecated)

Wraps the existing copilot-bridge HTTP + WebSocket channel as a legacy `IReplicantConnector`. Kept for migration continuity only; **deprecated on landing** and **not** a SCUT-conformant transport (see §10.5.5). Sunset target: when ACP coverage (§10.4, §10.5) is verified across the harnesses the bridge currently serves.

- Harness type: `copilot-bridge`
- Transport: HTTP + WebSocket (copilot-bridge's own bespoke channel adapter). This is the transport SCUT explicitly amends out of the forward design; do not extend.
- Config: `{ baseUrl: string, channelId: string, token: string }`
- Opaque `connector_handle` encodes the bridge session ID.

### Future Connectors

Additional harness kinds (e.g. a generic subprocess connector, a direct CLI wrapper, or a future A2A **outbound** connector) are added as separate Connector implementations behind the same `IReplicantConnector` interface. The CBK→SCUT merge plan (`docs/spec/cbk-merge-plan.md`) tracks the roadmap. Note: A2A in the first cut is an **inbound** surface (§11.12), not an outbound Connector.

---

## 13. Phase Plan

### Phase 1 — Core Kanban

**Goal:** A working Kanban app with user auth. No agents. A human can manage work from end to end.

**Deliverables:**
- User auth: local accounts (register, login, JWT). No OAuth in Phase 1.
- Full data model: Project / Board (`board_type`, `item_singular`, `item_plural`) / Column (`status_label`) / Thread / Comment / Checklist / ChecklistItem / `card_labels`
- Thread assignee: human users only in Phase 1 (`assignee_type='user'`)
- SQLite database with migration runner (`schema.sql` + `migrate.ts`)
- Fastify API: all endpoints in sections 11.1–11.9 (Auth, Users, Projects, Boards, Columns, Threads, Comments, Checklists, ChecklistItems)
- OpenAPI 3.1 spec at `/api/docs` and committed to `docs/api/openapi.yaml`
- React SPA (Moot): login/register page, project list, board view with columns (filter-driven), thread detail with comments and checklists, assignee picker (users only)
- Column `filter_rule` evaluation: `GET /api/v1/columns/:id` returns threads matching the filter rule
- `board_type` field on boards (default `standard`); `item_singular`/`item_plural` display label fields
- `status_label` field on columns: written to `thread.status` on move; independent from display `name`
- `card_labels` table: free-text label join table; queryable via JOIN; preferred over `metadata.labels`

**Sub-phases:**

| Block | Name | Description |
|-------|----|-------------|
| P1-A | DB Layer | Schema, migration runner, IRepository interfaces, SQLiteRepository for all Phase 1 entities |
| P1-B | Auth | JWT middleware, register, login, me endpoints, bcrypt |
| P1-C | Core API Routes | Projects, boards, columns, threads, comments, users |
| P1-D | Checklist API Routes | Checklists, checklist items, promote endpoint |
| P1-E | UI Scaffold | Tailwind v4, shadcn/ui, zustand stores, fetch API client, auth pages, router |
| P1-F | Board UI | ProjectsPage, MootPage with filter-driven columns, ThreadCard |
| P1-G | Thread Detail UI | Comments, checklists, assignee picker, status selector |
| P1-H | Seed Script | Default project, board with 4 status-filter columns, default admin user |

**Success criteria:** A human can register, log in, create a project, create a board with columns, create a thread, assign it to another user, add a checklist with items, post comments, and see the board organized by column filter rules — all through the UI and REST API.

### Phase 2 — Agent Integration

**Goal:** Threads gain dispatch capability. Replicants (agent connectors) can be assigned. Posting a comment to a thread with a Replicant assignee triggers a dispatch via the assigned Connector.

**Deliverables:**
- `replicants` table + `IReplicantRepository` + SQLiteRepository module
- `comment_dispatches` table + `ICommentDispatchRepository` + SQLiteRepository module
- `IReplicantConnector` interface (per §10) with `dispatch / cancel / status / events`
- `IPromptAssembler` interface and a default in-process implementation
- `ICheckpointProvider` interface (optional; implemented by connectors that support checkpointing)
- `checkpoints` table + SQLiteRepository module
- `AcpConnector` (primary; speaks Agent Client Protocol per https://agentclientprotocol.com/, NDJSON over loopback TCP by default, stdio follow-on, per §10.5)
- `CopilotBridgeConnector` (legacy, deprecated on landing per §10.5.5)
- Connector registry (`Map<replicantId, IReplicantConnector>`, initialized at startup from `replicants` table)
- `POST /api/v1/threads/:id/comments`: add auto-dispatch logic (if `assignee_type='replicant'`, create `comment_dispatches` row, call `connector.dispatch`, consume `events()` stream)
- Dispatches API endpoints (§11.11)
- Replicants API endpoints (§11.10)
- `chat` board type: threads as DM sessions; locked columns (`active`, `archived`, `pinned`); title defaults to ISO creation timestamp
- Agent Moot view (UI only — not a `board_type`): queries threads WHERE `replicant_id = :id` across all boards; read-only (replicant_id is immutable once set)
- Seed script: add a default Replicant (harness from env var, defaults to `acp`)
- Moot UI: assignee picker extended to include Replicants; dispatch status badge in thread detail

**Success criteria:** A thread can be assigned to a Replicant. Posting a comment creates a `comment_dispatches` row and dispatches via the Connector. The Replicant's output appears as one or more Comments in the thread history, and the dispatch row reaches `succeeded`.

### Phase 3 — Real-Time

**Goal:** Live board and thread updates. No polling.

**Deliverables:**
- SSE event streams (`GET /api/v1/threads/:id/events`, `GET /api/v1/projects/:id/events`)
- Moot UI: subscribe to SSE on board/thread views, update without page refresh
- Dispatch status timeline view in thread detail

**Success criteria:** When a Replicant completes a dispatch, the thread detail updates in the browser without a page refresh.

### Phase 4 — Inbound A2A (optional, deferred)

**Goal:** Let external A2A-speaking agents post threads, assign work, and hand off / delegate to SCUT-managed Replicants.

**Deliverables:**
- Inbound A2A server surface at `/api/v1/a2a/...` per §11.12
- Mapping: A2A `Message` → SCUT Comment; A2A `Task` → SCUT Thread + `comment_dispatches`
- Replicant-token auth for A2A peers

**Success criteria:** An external A2A agent can authenticate, create a Thread, and dispatch work that flows through SCUT's existing Connector path.

### Phase 5 — Parallel Dispatch

**Goal:** Multi-Replicant dispatch, thread branching, comparison view.

**Deliverables:**
- Parallel dispatch: send a Thread to multiple Replicants simultaneously (multiple `comment_dispatches` rows per triggering comment)
- Thread branching: fork a thread to explore two approaches
- Moot UI: parallel dispatch comparison view

**Success criteria:** A thread can be dispatched to two Replicants simultaneously and the Moot shows both results side-by-side.
