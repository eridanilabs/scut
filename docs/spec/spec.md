# SCUT - Design Specification

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Vocabulary](#3-vocabulary)
4. [Application Architecture](#4-application-architecture)
5. [Data Hierarchy](#5-data-hierarchy)
6. [Data Model](#6-data-model)
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

Phase 2 adds agent integration: registered Replicants (agent connectors) can be assigned to threads alongside humans. Posting a comment to a thread with an assigned Replicant triggers a Run. The comment history is the agent session context.

Phase 3 adds real-time updates via Server-Sent Events. Phase 4 adds multi-harness connectors. Phase 5 adds parallel dispatch and thread branching.

SCUT is not an agent framework, does not run language models, and does not replace copilot-bridge - it is the coordination plane above them.

---

## 2. Design Principles

### API-First

Every entity in SCUT is fully addressable via REST API. The React UI (Moot) is one client of that API. An agent connector is another. A CLI tool could be a third. No capability exists only in the UI.

Consequences:
- Every create/read/update/delete operation has a corresponding API endpoint
- API is documented (OpenAPI 3.1) and the docs are generated from code
- API schema is the source of truth; UI is derived from it
- Agents can reorganize boards, create threads, and dispatch runs — all via API

### Columns Are Views, Not Containers

A Thread does not live inside a Column. A Thread lives on a Project and has fields (status, assignee_type, assignee_id, metadata). A Column is a saved filter rule — a JSON expression evaluated at query time. A Thread appears in a Column when its fields match the column's `filter_rule`. Moving a Thread between columns mutates the Thread's fields, not its location. A single Thread can appear in multiple columns if it matches multiple filter rules.

### Assignee Is Polymorphic

Any entity that can be assigned (Thread, ChecklistItem) uses `assignee_type` + `assignee_id`. `assignee_type` is `'user'`, `'replicant'`, or `null`. This means the same assignment field works for human users (Phase 1) and agent connectors (Phase 2) without a schema change.

### Thread = Work Item (Phases 1+) and Agent Session (Phase 2+)

A Thread is the unit of work. In Phase 1 it is a Kanban card. In Phase 2, posting a comment to a Thread with an assigned Replicant triggers a Run — the Thread's comment history becomes the session context. The data model does not change between phases; Phase 2 adds dispatch behavior on top of it.

Threads can have a `parent_id` pointing to another Thread. This is set when a ChecklistItem is promoted to a full Thread, preserving the lineage.

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
| **Board** | A named view within a Project. Displays Threads organized into Columns. |
| **Column** | A saved filter rule on a Board. Threads appear in a column when their fields match the `filter_rule`. Not a container. |
| **Thread** | The unit of work. A card on a board in Phase 1. Gains agent session behavior in Phase 2. |
| **Comment** | One entry in a Thread's history — from a user, a Replicant, or the system. |
| **Checklist** | An optional ordered list of ChecklistItems attached to a Thread. |
| **ChecklistItem** | A single actionable item in a Checklist. Can have an assignee. Can be promoted to a Thread. |
| **Run** | One invocation of a Replicant against a Thread (Phase 2+). Tracks status, input, and output. |
| **User** | A registered human account. Auth via local credentials (username + bcrypt password) + JWT. |
| **Assignee** | A polymorphic reference: `{ type: 'user' \| 'replicant', id: string }` or `null`. |
| **Replicant** | A registered agent connector instance (Phase 2+). Named after Bobiverse replicants. |
| **Moot** | The React board UI. Where humans see and manage Threads across Projects and Boards. |
| **IReplicantConnector** | The harness-agnostic connector interface every Replicant adapter implements (Phase 2+). |
| **CopilotBridgeConnector** | Phase 2 reference implementation of `IReplicantConnector` for copilot-bridge. |
| **ClaudeCodeConnector** | Phase 4 connector for the `claude` CLI via subprocess. |
| **SubprocessConnector** | Phase 4 generic connector for any CLI-based agent harness. |
| **A2AConnector** | Phase 4 connector for remote agents via the Google A2A protocol. |
| **ACPConnector** | Phase 5 connector for local agents via the IBM ACP protocol. |

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

    CBC["CopilotBridgeConnector (Phase 2)"]
    CCC["ClaudeCodeConnector (Phase 4)"]
    A2AC["A2AConnector (Phase 4)"]
    ACPC["ACPConnector (Phase 5)"]

    HO --> moot
    User -->|registers / logs in| AUTH
    REP -->|HTTP REST| API
    moot -->|HTTP REST| API
    moot <-->|SSE (Phase 3+)| SSE
    API --> DB
    API --> RC
    RC --> CBC
    RC --> CCC
    RC --> A2AC
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
  └── Run (Phase 2+ — one Replicant invocation)
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
| Run | (none) | (none) | (none — SCUT-specific) |
| Replicant | (none) | (none) | (none — SCUT-specific) |
| Metadata | Labels + custom fields | Custom fields | Custom fields |

Key difference: in SCUT, a Thread is also a **persistent agent session** (Phase 2+). A Run is a discrete agent invocation within that session. No other tool in this list has a native concept of dispatching work to an agent and tracking the result as a first-class data entity.

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
| **Comment** | Thread | One turn in the thread history. |
| **Checklist** | Thread | Optional ordered list of items. |
| **ChecklistItem** | Checklist | Single actionable item. Can be promoted to Thread. |
| **Run** | Thread | One Replicant invocation (Phase 2+). |
| **Replicant** | Organization | Registered agent connector (Phase 2+). |

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
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Columns (saved filter rules on a board — not containers)
CREATE TABLE IF NOT EXISTS columns (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  filter_rule TEXT NOT NULL DEFAULT '{}', -- JSON: { status?, assignee_type?, assignee_id?, labels?, metadata? }
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Threads: unit of work (Phase 1) and persistent agent session (Phase 2+)
CREATE TABLE IF NOT EXISTS threads (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES threads(id) ON DELETE SET NULL, -- set when promoted from ChecklistItem
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo', -- todo | in_progress | blocked | done | archived
  assignee_type TEXT,                          -- 'user' | 'replicant' | null
  assignee_id   TEXT,                          -- FK to users.id or replicants.id depending on assignee_type
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Comments: conversation history on a thread
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  run_id      TEXT REFERENCES runs(id) ON DELETE SET NULL, -- Phase 2+; null in Phase 1
  author_type TEXT NOT NULL,  -- 'user' | 'replicant' | 'system'
  author_id   TEXT,           -- FK to users.id or replicants.id; null for system
  content     TEXT NOT NULL,
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
  harness    TEXT NOT NULL,              -- copilot-bridge | claude-code | subprocess | a2a | acp
  config     TEXT NOT NULL DEFAULT '{}', -- harness-specific JSON config
  status     TEXT NOT NULL DEFAULT 'unknown', -- online | offline | busy | unknown
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Runs: one Replicant invocation against a Thread (Phase 2+)
-- Table included in schema for continuity; not exposed via API in Phase 1.
CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  replicant_id TEXT NOT NULL REFERENCES replicants(id) ON DELETE RESTRICT,
  status       TEXT NOT NULL DEFAULT 'created', -- created | queued | running | completed | failed | cancelled
  input        TEXT NOT NULL DEFAULT '',
  output       TEXT,
  error        TEXT,
  started_at   TEXT,
  completed_at TEXT,
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_boards_project         ON boards(project_id);
CREATE INDEX IF NOT EXISTS idx_columns_board          ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_threads_project        ON threads(project_id);
CREATE INDEX IF NOT EXISTS idx_threads_parent         ON threads(parent_id);
CREATE INDEX IF NOT EXISTS idx_threads_status         ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_assignee       ON threads(assignee_type, assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_thread        ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_run           ON comments(run_id);
CREATE INDEX IF NOT EXISTS idx_checklists_thread      ON checklists(thread_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_list   ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_runs_thread            ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_status            ON runs(status);
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

### 6.4 Run Status Flow

```mermaid
stateDiagram-v2
    [*] --> created
    created --> queued
    queued --> running
    queued --> cancelled
    running --> completed
    running --> failed
```

---

## 7. Authentication (Phase 1)

### Model

Local accounts only. JWT (JSON Web Tokens) for session management. Future: GitHub OAuth (not in scope for any current phase — noted as a future addition only).

### Token Strategy

- `POST /api/auth/register` creates a user. Password is hashed with bcrypt (cost factor configurable via `BCRYPT_ROUNDS`, default 12).
- `POST /api/auth/login` verifies credentials and returns a signed JWT (HS256, configurable expiry via `JWT_EXPIRY`, default `24h`). Token is stored by the client.
- JWT payload claims: `{ sub: <userId>, username: <username>, iat: <issued-at>, exp: <expiry> }`. The `sub` claim is the user's `id`. `GET /api/auth/me` queries the database using `sub` rather than deserialising user fields from the token — this ensures PATCH /api/auth/me changes are reflected immediately without re-login.
- Auth middleware attaches `request.user` as `{ id: string, username: string }` (decoded from JWT sub + username claims, not a DB lookup on every request).
- All protected endpoints require `Authorization: Bearer <token>` header.
- `POST /api/auth/logout` is a client-side operation (discard token); no server-side blocklist in Phase 1.

### Public Endpoints (no auth required)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/docs` (OpenAPI)
- `GET /health`

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

SCUT uses **Server-Sent Events (SSE)** for server-to-client push (run status updates, new comments, thread status changes). SSE is sufficient for Phase 3 because the primary real-time flow is one-way: the server notifying the UI of agent results.

For bidirectional needs (collaborative editing), **WebSockets** are a future upgrade path. The API design does not prevent this — SSE and WebSocket endpoints are additive.

### Event Streams

| Endpoint | Scope | Events emitted |
|----------|-------|----------------|
| `GET /api/threads/:id/events` | Single thread | `comment`, `run`, `thread` |
| `GET /api/projects/:id/events` | Whole project | `thread_created`, `thread_updated`, `run_updated` |

### Bidirectional Flow: Thread as Agent Session (Phase 2+)

```mermaid
sequenceDiagram
    participant H as Human (UI or API client)
    participant S as SCUT Server
    participant R as Replicant (via IReplicantConnector)

    H->>S: POST /api/threads/:id/comments (author_type=user)
    S->>S: Create Comment record
    S->>S: Create Run record (status=created)
    S->>R: connector.dispatch(run, thread)
    S-->>H: 201 { comment, run }
    R-->>S: POST /api/internal/runs/:id/result
    S->>S: Update Run (status=completed, output=...)
    S->>S: Create Comment (author_type=replicant, content=output)
    S-->>H: SSE event: run updated (Phase 3+)
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
  replicants:     IReplicantRepository;   // Phase 2+
  runs:           IRunRepository;          // Phase 2+
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
      replicants.ts         - Phase 2+ (was bobs.ts)
      runs.ts               - Phase 2+
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

Every Replicant connector implements `IReplicantConnector`. The interface is intentionally thin: SCUT's job is to route and track, not to dictate how the harness works internally.

```typescript
export type ReplicantStatus = {
  available: boolean;
  busy: boolean;
  detail?: string;
};

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

export type Run = {
  id: string;
  threadId: string;
  replicantId: string;
  status: 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: string;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface IReplicantConnector {
  /**
   * Dispatch a Run to the Replicant. Fire-and-forget.
   * Resolves when the run has been accepted (queued or started), not when complete.
   * The connector posts the result back via POST /api/internal/runs/:id/result.
   */
  dispatch(run: Run, thread: Thread): Promise<void>;

  /**
   * Cancel an in-progress or queued Run.
   * Should resolve even if the Run has already completed.
   */
  cancel(runId: string): Promise<void>;

  /**
   * Return the current health and availability of the Replicant.
   */
  status(): Promise<ReplicantStatus>;
}
```

### 10.1 Connector Contract Notes

- `dispatch` is fire-and-forget. SCUT creates the Run record before calling dispatch. The connector may update the Run status to `queued` or `running` synchronously, but the result arrives later via the callback.
- `cancel` is best-effort. Some harnesses may not support mid-run cancellation. Connectors should set Run status to `cancelled` and resolve without throwing if cancellation is not possible.
- `status` is called periodically by SCUT to update the Replicant's availability in the `replicants` table. It should be cheap and non-blocking.
- The connector registry is a `Map<replicantId, IReplicantConnector>` initialized at startup from the `replicants` table `harness` + `config` columns.

---

## 11. API Surface

All endpoints return JSON. Error responses: `{ error: string, code?: string }`. Auth required on all endpoints except those noted. OpenAPI 3.1 served at `/api/docs`, committed to `docs/api/openapi.yaml`.

### 11.1 Auth (public)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create user account. Body: `{ username, email, password, display_name? }` |
| `POST` | `/api/auth/login` | Login. Body: `{ username, password }`. Returns: `{ token, user }` |
| `GET` | `/api/auth/me` | Get current user. Queries DB from JWT `sub` claim. Auth required. |
| `PATCH` | `/api/auth/me` | Update own `display_name`, `avatar_url`, or `password`. Auth required. |
| `POST` | `/api/auth/logout` | Client-side operation. Server returns 204. No server-side token blocklist in Phase 1. Client must discard the token. Auth required. |

### 11.2 Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List users (for assignee picker). Returns `id`, `username`, `display_name`, `avatar_url` only. |
| `GET` | `/api/users/:id` | Get user profile. Returns `id`, `username`, `display_name`, `avatar_url`, `metadata`. |

Note: user creation is via `/api/auth/register` only. No admin user management UI in Phase 1.

### 11.3 Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project. Body: `{ name, description?, metadata? }` |
| `GET` | `/api/projects/:id` | Get project by ID |
| `PATCH` | `/api/projects/:id` | Update project. Body: any subset of `{ name, description, metadata }` |
| `DELETE` | `/api/projects/:id` | Soft-delete: sets `status = 'archived'`. Cascades to boards, columns, and threads are NOT applied on archive — only on hard delete. Archived projects are excluded from `GET /api/projects` by default. Pass `?include_archived=true` to include them. |

### 11.4 Boards

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/boards` | List boards in project |
| `POST` | `/api/projects/:id/boards` | Create board. Body: `{ name, description?, metadata? }` |
| `GET` | `/api/boards/:id` | Get board with columns |
| `PATCH` | `/api/boards/:id` | Update board. Body: any subset of `{ name, description, metadata }` |
| `DELETE` | `/api/boards/:id` | Delete board |

### 11.5 Columns

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/boards/:id/columns` | List columns on board |
| `POST` | `/api/boards/:id/columns` | Create column. Body: `{ name, position, filter_rule?, metadata? }` |
| `GET` | `/api/columns/:id` | Get column with threads (evaluates `filter_rule`) |
| `PATCH` | `/api/columns/:id` | Update. Body: any subset of `{ name, position, filter_rule, metadata }` |
| `DELETE` | `/api/columns/:id` | Delete column |

### 11.6 Threads

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:id/threads` | List threads. Query params: `status`, `assignee_type`, `assignee_id`, `labels`, `metadata.*` (filter_rule key names match query param names) |
| `POST` | `/api/projects/:id/threads` | Create thread. Body: `{ title, description?, status?, assignee_type?, assignee_id?, metadata?, parent_id? }` |
| `GET` | `/api/threads/:id` | Get thread with comments, checklists, latest run |
| `PATCH` | `/api/threads/:id` | Update. Body: any subset of `{ title, description, status, assignee_type, assignee_id, metadata }` |
| `DELETE` | `/api/threads/:id` | Archive thread |

### 11.7 Comments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/threads/:id/comments` | List comments on thread |
| `POST` | `/api/threads/:id/comments` | Add comment. Body: `{ content, metadata? }`. `author_type='user'`, `author_id` from JWT. Phase 2+: triggers Run if thread has replicant assignee. |
| `PATCH` | `/api/comments/:id` | Edit own comment. Body: `{ content }` |
| `DELETE` | `/api/comments/:id` | Delete own comment |

### 11.8 Checklists

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/threads/:id/checklists` | List checklists on thread |
| `POST` | `/api/threads/:id/checklists` | Create checklist. Body: `{ title, position?, metadata? }` |
| `GET` | `/api/checklists/:id` | Get checklist with items |
| `PATCH` | `/api/checklists/:id` | Update. Body: any subset of `{ title, position, metadata }` |
| `DELETE` | `/api/checklists/:id` | Delete checklist and all its items |

### 11.9 Checklist Items

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/checklists/:id/items` | List items in checklist |
| `POST` | `/api/checklists/:id/items` | Create item. Body: `{ title, position?, assignee_type?, assignee_id?, metadata? }` |
| `GET` | `/api/checklist-items/:id` | Get checklist item by ID. Returns full item including `promoted_thread_id` if promoted. |
| `PATCH` | `/api/checklist-items/:id` | Update. Body: any subset of `{ title, done, position, assignee_type, assignee_id, metadata }` |
| `DELETE` | `/api/checklist-items/:id` | Delete item |
| `POST` | `/api/checklist-items/:id/promote` | Promote item to Thread. Creates a new Thread in the same project as the checklist's parent thread. New Thread defaults: `title` = item's `title`, `description` = `''`, `status` = `'todo'`, `assignee_type` = item's `assignee_type`, `assignee_id` = item's `assignee_id`, `parent_id` = item's parent thread id (resolved via checklist join). Sets `promoted_thread_id` on the ChecklistItem to the new Thread's id. If `promoted_thread_id` is already set, returns 409 with `{ error: "already promoted", code: "ALREADY_PROMOTED" }`. Optional request body: `{ title?: string, description?: string, status?: string }` to override defaults. |

### 11.10 Replicants (Phase 2+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/replicants` | List all replicants with status |
| `POST` | `/api/replicants` | Register replicant. Body: `{ name, harness, config, metadata? }` |
| `GET` | `/api/replicants/:id` | Get replicant |
| `PATCH` | `/api/replicants/:id` | Update config or metadata |
| `DELETE` | `/api/replicants/:id` | Deregister. Returns 409 if the Replicant has associated runs (`runs.replicant_id` FK is `ON DELETE RESTRICT`). Delete or reassign all runs for this Replicant before deregistering. |

### 11.11 Runs (Phase 2+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/threads/:id/runs` | List runs for thread |
| `POST` | `/api/threads/:id/runs` | Manually dispatch a run |
| `DELETE` | `/api/runs/:id` | Cancel a run |

### 11.12 Internal Callback (Phase 2+)

`POST /api/internal/runs/:id/result` — used by connectors to post results back to SCUT after a Run completes.

Request body:
```json
{
  "status": "completed | failed | cancelled",
  "output": "string (present if status=completed)",
  "error": "string (present if status=failed)"
}
```

Side effects: updates Run status, creates Comment (`author_type=replicant`), emits SSE events (Phase 3+).

### 11.13 SSE Events (Phase 3+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/threads/:id/events` | SSE stream for single thread |
| `GET` | `/api/projects/:id/events` | SSE stream for whole project |

---

## 12. Connector Implementations (Phase 2+)

> **Phase note:** None of these are in Phase 1 scope. Phase 2 ships `CopilotBridgeConnector` only.

### `CopilotBridgeConnector` (Phase 2)

Wraps the copilot-bridge HTTP channel adapter. Translates a Run into a copilot-bridge channel invocation. Results come back via the bridge's existing webhook/callback mechanism, forwarded to SCUT's internal result endpoint.

- Harness type: `copilot-bridge`
- Transport: HTTP (copilot-bridge's own API)
- Config: `{ baseUrl: string, channelId: string, token: string }`

### `ClaudeCodeConnector` (Phase 4)

Drives the `claude` CLI via subprocess. Launches `claude` with the Run input as a prompt, captures stdout as the result, and posts to the result callback. Supports cancellation via process kill.

- Harness type: `claude-code`
- Transport: subprocess (stdin/stdout)
- Config: `{ claudePath?: string }` (defaults to `claude` on PATH)

### `SubprocessConnector` (Phase 4)

Generic subprocess connector. Launches a configurable command with the Run input on stdin, reads the result from stdout. Enables any CLI-based agent to be connected with minimal configuration.

- Harness type: `subprocess`
- Transport: subprocess (stdin/stdout)
- Config: `{ command: string, args: string[] }`

### `A2AConnector` (Phase 4)

Connects to a remote agent via the Google A2A (Agent-to-Agent) protocol. Translates a Run into an A2A task submission. Polls or subscribes to A2A task status updates and posts results back to SCUT's callback endpoint.

- Harness type: `a2a`
- Transport: HTTP + A2A protocol
- Config: `{ agentCardUrl: string, auth?: object }`

### `ACPConnector` (Phase 5)

Connects to a local agent via the IBM ACP (Agent Communication Protocol). Designed for locally-running agents (local LLMs, edge services).

- Harness type: `acp`
- Transport: HTTP + ACP protocol
- Config: `{ baseUrl: string }`

---

## 13. Phase Plan

### Phase 1 — Core Kanban

**Goal:** A working Kanban app with user auth. No agents. A human can manage work from end to end.

**Deliverables:**
- User auth: local accounts (register, login, JWT). No OAuth in Phase 1.
- Full data model: Project / Board / Column / Thread / Comment / Checklist / ChecklistItem
- Thread assignee: human users only in Phase 1 (`assignee_type='user'`)
- SQLite database with migration runner (`schema.sql` + `migrate.ts`)
- Fastify API: all endpoints in sections 11.1–11.9 (Auth, Users, Projects, Boards, Columns, Threads, Comments, Checklists, ChecklistItems)
- OpenAPI 3.1 spec at `/api/docs` and committed to `docs/api/openapi.yaml`
- React SPA (Moot): login/register page, project list, board view with columns (filter-driven), thread detail with comments and checklists, assignee picker (users only)
- Column `filter_rule` evaluation: `GET /api/columns/:id` returns threads matching the filter rule

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

**Goal:** Threads gain dispatch capability. Replicants (agent connectors) can be assigned. Posting a comment to a thread with a Replicant assignee triggers a Run.

**Deliverables:**
- `replicants` table + `IReplicantRepository` + SQLiteRepository module
- `runs` table + `IRunRepository` + SQLiteRepository module
- `IReplicantConnector` interface
- `CopilotBridgeConnector` (Phase 2 reference implementation)
- Connector registry (`Map<replicantId, IReplicantConnector>`, initialized at startup from `replicants` table)
- `POST /api/threads/:id/comments`: add auto-dispatch logic (if `assignee_type='replicant'`, create Run, call `connector.dispatch`)
- `POST /api/internal/runs/:id/result` callback endpoint
- Replicants API endpoints (11.10)
- Runs API endpoints (11.11)
- Seed script: add a default Replicant (harness from env var, defaults to `copilot-bridge`)
- Moot UI: assignee picker extended to include Replicants; run status badge in thread detail

**Success criteria:** A thread can be assigned to a Replicant. Posting a comment dispatches a Run. The Replicant's result appears as a comment in the thread history.

### Phase 3 — Real-Time

**Goal:** Live board and thread updates. No polling.

**Deliverables:**
- SSE event streams (`GET /api/threads/:id/events`, `GET /api/projects/:id/events`)
- Moot UI: subscribe to SSE on board/thread views, update without page refresh
- Run status timeline view in thread detail

**Success criteria:** When a Replicant completes a run, the thread detail updates in the browser without a page refresh.

### Phase 4 — Multi-Harness

**Goal:** Connect additional agent harnesses.

**Deliverables:**
- `SubprocessConnector` (generic CLI)
- `ClaudeCodeConnector` (wraps `claude` CLI via SubprocessConnector)
- `A2AConnector` (Google A2A protocol)
- Moot UI: Replicant type indicator when assigning

**Success criteria:** A thread can be reassigned from a `CopilotBridgeConnector` Replicant to a `ClaudeCodeConnector` Replicant mid-conversation and the new Replicant picks up from the full comment history.

### Phase 5 — Parallel Dispatch

**Goal:** Multi-Replicant dispatch, thread branching, comparison view.

**Deliverables:**
- `ACPConnector` (IBM ACP protocol)
- Parallel dispatch: send a Thread to multiple Replicants simultaneously
- Thread branching: fork a thread to explore two approaches
- Moot UI: parallel run comparison view

**Success criteria:** A thread can be dispatched to two Replicants simultaneously and the Moot shows both results side-by-side.
