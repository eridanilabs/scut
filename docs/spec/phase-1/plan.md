# SCUT Phase 1 - Implementation Plan

## Architecture

```
packages/
  server/               - Fastify API + SQLite + auth
    src/
      db/
        interfaces/
          IRepository.ts    - root interface and all sub-interfaces
          types.ts          - shared input/filter/output types
        adapters/
          sqlite/
            index.ts            - SQLiteRepository implements IRepository
            projects.ts
            boards.ts
            columns.ts          - includes filter_rule evaluation in findByColumn
            users.ts            - Phase 1+
            threads.ts          - includes filter support (status, assignee_type, assignee_id)
            comments.ts         - was messages.ts
            checklists.ts       - Phase 1+
            checklist_items.ts  - Phase 1+; includes promote()
            replicants.ts       - Phase 2+ (not exposed in Phase 1 API)
            runs.ts             - Phase 2+ (not exposed in Phase 1 API)
            schema.sql          - CREATE TABLE statements (all tables including Phase 2+ stubs)
            migrate.ts          - idempotent migration runner
          postgres/
            index.ts            - PostgresRepository (Phase 3+)
        index.ts              - factory: createRepository(driver) -> IRepository
      connectors/             - Phase 2+ (directory not created in Phase 1)
        IReplicantConnector.ts
        CopilotBridgeConnector.ts
        registry.ts
      middleware/
        auth.ts               - Fastify preHandler: verify JWT, attach user to request
      routes/
        auth.ts               - POST /api/auth/register, /login, GET /api/auth/me, PATCH /api/auth/me
        users.ts              - GET /api/users, GET /api/users/:id
        projects.ts           - CRUD /api/projects
        boards.ts             - CRUD /api/projects/:id/boards, /api/boards/:id
        columns.ts            - CRUD /api/boards/:id/columns, /api/columns/:id (with filter_rule eval)
        threads.ts            - CRUD /api/projects/:id/threads, /api/threads/:id
        comments.ts           - GET/POST/PATCH/DELETE /api/threads/:id/comments, /api/comments/:id
        checklists.ts         - CRUD /api/threads/:id/checklists, /api/checklists/:id
        checklist_items.ts    - CRUD /api/checklists/:id/items, /api/checklist-items/:id, promote
        replicants.ts         - Phase 2+ (not in Phase 1)
        runs.ts               - Phase 2+ (not in Phase 1)
        internal.ts           - Phase 2+ (not in Phase 1)
      openapi.ts              - OpenAPI 3.1 schema generation + /api/docs route
      seed.ts                 - seed default project, board, columns, admin user for local dev
      index.ts                - Fastify app init, plugin registration, server start

  ui/                   - React + Vite Moot board (SPA)
    src/
      api/
        client.ts             - fetch wrapper, base URL config, auth header injection
        auth.ts               - auth API calls
        users.ts              - user API calls
        projects.ts           - project API calls
        boards.ts             - board API calls
        columns.ts            - column API calls
        threads.ts            - thread API calls
        comments.ts           - comment API calls
        checklists.ts         - checklist API calls
        checklist_items.ts    - checklist item API calls
      stores/
        auth.ts               - zustand auth store (user, token, login/logout actions)
        projects.ts           - zustand project store
        boards.ts             - zustand board store
        threads.ts            - zustand thread store
        ui.ts                 - zustand UI state (selected project/board/thread, modals)
      components/
        layout/               - AppShell, Sidebar, Header (ported from kanban)
        ui/                   - shadcn/ui primitives (ported from kanban)
        thread/               - ThreadCard, ThreadDetail, ThreadForm
        checklist/            - ChecklistPanel, ChecklistItem, PromoteButton
      pages/
        LoginPage.tsx         - login form
        RegisterPage.tsx      - registration form
        ProjectsPage.tsx      - project list and creation
        MootPage.tsx          - board view: threads grouped into columns (filter-driven)
        ThreadDetailPage.tsx  - thread comments + checklists + assignee/status controls
      App.tsx
      main.tsx
```

## Implementation Blocks

Phase 1 is delivered in 8 sequential blocks. Each block is independently committable. Blocks 1–4 are backend only and can be done before any UI work. Block 5 (UI scaffold) can run in parallel with Blocks 2–4. Blocks 6–8 depend on Blocks 1–5.

---

### P1-A: DB Layer

**Files created/modified:**
- `packages/server/src/db/interfaces/IRepository.ts`
- `packages/server/src/db/interfaces/types.ts`
- `packages/server/src/db/adapters/sqlite/schema.sql`
- `packages/server/src/db/adapters/sqlite/migrate.ts`
- `packages/server/src/db/adapters/sqlite/projects.ts`
- `packages/server/src/db/adapters/sqlite/boards.ts`
- `packages/server/src/db/adapters/sqlite/columns.ts`
- `packages/server/src/db/adapters/sqlite/users.ts`
- `packages/server/src/db/adapters/sqlite/threads.ts`
- `packages/server/src/db/adapters/sqlite/comments.ts`
- `packages/server/src/db/adapters/sqlite/checklists.ts`
- `packages/server/src/db/adapters/sqlite/checklist_items.ts`
- `packages/server/src/db/adapters/sqlite/index.ts`
- `packages/server/src/db/index.ts`

**Delivers:** `schema.sql` with all Phase 1 tables plus Phase 2+ stubs (`replicants`, `runs`) with a comment; idempotent `migrate.ts` that runs on server startup; `IRepository` root interface and all sub-interfaces; shared types; all SQLiteRepository per-entity modules; factory function.

**Acceptance test:** `node -e "const { createRepository } = require('./src/db'); const repo = createRepository('sqlite'); console.log(Object.keys(repo))"` outputs all expected repository keys. A fresh `scut.db` file is created on first run with all tables and indexes present.

---

### P1-B: Auth

**Files created/modified:**
- `packages/server/src/middleware/auth.ts`
- `packages/server/src/routes/auth.ts`

**Delivers:** Fastify `preHandler` middleware that verifies JWT from `Authorization: Bearer <token>` header and attaches user to `request.user`. Four auth endpoints: `POST /api/auth/register` (creates user, returns JWT + user), `POST /api/auth/login` (verifies credentials, returns JWT + user), `GET /api/auth/me` (returns user from JWT), `PATCH /api/auth/me` (update display_name, avatar_url, or password). bcrypt password hashing with configurable rounds.

Server refuses to start if `JWT_SECRET` is not set in environment.

**Acceptance test:** `POST /api/auth/register` returns `{ token, user }`. `GET /api/auth/me` with that token returns the same user. `GET /api/projects` without token returns 401. `GET /api/projects` with token returns 200.

---

### P1-C: Core API Routes

**Files created/modified:**
- `packages/server/src/routes/users.ts`
- `packages/server/src/routes/projects.ts`
- `packages/server/src/routes/boards.ts`
- `packages/server/src/routes/columns.ts`
- `packages/server/src/routes/threads.ts`
- `packages/server/src/routes/comments.ts`
- `packages/server/src/openapi.ts`

**Delivers:** Full CRUD for projects, boards, columns, threads, and comments. `GET /api/columns/:id` evaluates `filter_rule` and returns matching threads. `GET /api/projects/:id/threads` supports filter query params (`status`, `assignee_type`, `assignee_id`, `label`). Users list for assignee picker. OpenAPI 3.1 schema generation at `/api/docs`; schema written to `docs/api/openapi.yaml`.

All routes protected by JWT middleware except the health endpoint and `/api/docs`.

**Acceptance test:** All CRUD operations return correct status codes and bodies. `POST /api/projects/:id/threads` with `status=todo` followed by `GET /api/columns/:id` (column with `filter_rule: { status: 'todo' }`) returns the thread. `GET /api/docs` returns valid OpenAPI JSON.

---

### P1-D: Checklist API Routes

**Files created/modified:**
- `packages/server/src/routes/checklists.ts`
- `packages/server/src/routes/checklist_items.ts`

**Delivers:** Full CRUD for checklists and checklist items. `POST /api/checklist-items/:id/promote` creates a new Thread with `parent_id` = the item's thread ID, sets `promoted_thread_id` on the ChecklistItem, and returns the new Thread.

**Acceptance test:** Create a thread → create a checklist → create a checklist item → call promote → verify a new thread exists with `parent_id` pointing to the original thread, and the item's `promoted_thread_id` is set. Deleting a checklist cascades to its items.

---

### P1-E: UI Scaffold

**Files created/modified:**
- `packages/ui/tailwind.config.ts` (adapted from kanban)
- `packages/ui/components.json` (shadcn config)
- `packages/ui/src/index.css`
- `packages/ui/src/components/layout/` (AppShell, Sidebar, Header)
- `packages/ui/src/components/ui/` (shadcn/ui primitives)
- `packages/ui/src/components/ErrorBoundary.tsx`, `ErrorState.tsx`
- `packages/ui/src/stores/auth.ts`
- `packages/ui/src/stores/projects.ts`
- `packages/ui/src/stores/boards.ts`
- `packages/ui/src/stores/threads.ts`
- `packages/ui/src/stores/ui.ts`
- `packages/ui/src/stores/theme.ts`
- `packages/ui/src/api/client.ts`
- `packages/ui/src/api/auth.ts`
- `packages/ui/src/api/users.ts`
- `packages/ui/src/api/projects.ts`
- `packages/ui/src/api/boards.ts`
- `packages/ui/src/api/columns.ts`
- `packages/ui/src/api/threads.ts`
- `packages/ui/src/api/comments.ts`
- `packages/ui/src/api/checklists.ts`
- `packages/ui/src/api/checklist_items.ts`
- `packages/ui/src/pages/LoginPage.tsx`
- `packages/ui/src/pages/RegisterPage.tsx`
- `packages/ui/src/App.tsx`
- `packages/ui/src/main.tsx`

**Delivers:** Tailwind v4 + shadcn/ui setup ported from `raykao/copilot-bridge-kanban`. Zustand stores for all entities plus auth. Fetch-based API client that injects JWT from auth store. LoginPage and RegisterPage wired to auth store. react-router-dom v7 routes with a protected route wrapper that redirects unauthenticated users to login.

No TanStack dependencies. No react-query.

**Acceptance test:** `npm run dev` starts without errors. Navigating to `/` redirects to `/login` when not authenticated. After login, redirects to `/projects`.

---

### P1-F: Board UI

**Files created/modified:**
- `packages/ui/src/pages/ProjectsPage.tsx`
- `packages/ui/src/pages/MootPage.tsx`
- `packages/ui/src/components/thread/ThreadCard.tsx`
- `packages/ui/src/components/thread/ThreadForm.tsx`

**Delivers:** `ProjectsPage` — lists all projects with name, description, and thread count; create project button opens a modal. `MootPage` — loads board with columns, evaluates each column's `filter_rule` by calling `GET /api/columns/:id`, displays threads as cards grouped by column. `ThreadCard` shows title, status badge, assignee name, comment count. Create thread button opens a form modal.

**Acceptance test:** Creating a project appears in the list. Creating a thread with `status=todo` causes it to appear in the "Todo" column on the board. Clicking a thread card navigates to `ThreadDetailPage`.

---

### P1-G: Thread Detail UI

**Files created/modified:**
- `packages/ui/src/pages/ThreadDetailPage.tsx`
- `packages/ui/src/components/thread/AssigneePicker.tsx`
- `packages/ui/src/components/thread/StatusSelector.tsx`
- `packages/ui/src/components/checklist/ChecklistPanel.tsx`
- `packages/ui/src/components/checklist/ChecklistItemRow.tsx`
- `packages/ui/src/components/checklist/PromoteButton.tsx`

**Delivers:** `ThreadDetailPage` — displays thread title, description, comments list (user comments styled differently from system), checklist panel, assignee picker (users only in Phase 1), and status selector. Comment input form posts to `POST /api/threads/:id/comments`. Checklist panel supports add/edit/delete checklists and items, check/uncheck items, promote item to thread. Assignee picker calls `GET /api/users` and patches the thread. Status selector patches thread status.

**Acceptance test:** Posting a comment appears in the list. Checking a checklist item marks it done. Promoting an item navigates to the new thread. Changing the assignee or status is reflected after PATCH.

---

### P1-H: Seed Script

**Files created/modified:**
- `packages/server/src/seed.ts`

**Delivers:** `seed.ts` that upserts a default project with a standard Kanban board and 4 columns with appropriate `filter_rule` values:

| Column | filter_rule |
|--------|-------------|
| Todo | `{ "status": "todo" }` |
| In Progress | `{ "status": "in_progress" }` |
| Blocked | `{ "status": "blocked" }` |
| Done | `{ "status": "done" }` |

Also upserts a default admin user from env vars (`SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`). Runs automatically in dev if no data exists. Idempotent — safe to run multiple times.

**Acceptance test:** Starting the server against a fresh database creates the default project and board. `GET /api/projects` returns one project. `GET /api/boards/:id/columns` returns 4 columns with correct `filter_rule` values.

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth | Local accounts (bcrypt + JWT). GitHub OAuth is a future addition, not scheduled. | Simplest path to working auth with no external dependencies |
| Assignee | Polymorphic (`assignee_type` + `assignee_id`). Phase 1 only sets `assignee_type='user'`. Phase 2 adds `'replicant'` without schema changes. | Avoids a breaking migration when agents are added in Phase 2 |
| Messages → Comments | Table and API renamed to `comments`. `author_type` replaces `author` enum. | More natural vocabulary for a Kanban app; `author_type` is more explicit for polymorphism |
| Column filter rules | JSON `filter_rule` on each column. Server evaluates at query time. No `column_id` on threads. | Columns are views, not containers. A thread can match multiple columns. |
| Replicants (Phase 2) | Not in Phase 1. `replicants` and `runs` tables are in `schema.sql` for continuity but not exposed via API. | Avoids a migration file delta in Phase 2; Phase 1 simply ignores those tables |
| State management | zustand | Already in kanban, lightweight, no TanStack constraint |
| Data fetching | fetch + useEffect in zustand actions | No TanStack Query allowed |
| Routing | react-router-dom v7 | Same as kanban |
| DB | better-sqlite3 (sync, wrapped in Promises) | Simple, no async complexity, zero config |
| Validation | Fastify JSON schema | Lightweight, generates OpenAPI for free |
| API documentation | OpenAPI 3.1 via Fastify schema | API-first; agents and humans share the same docs |
| Styling | Tailwind CSS v4 + shadcn/ui (ported from kanban) | Consistent visual language, no duplicated design work |

## Environment Variables (server)

```
PORT=3000
DATABASE_DRIVER=sqlite          # sqlite | postgres
DATABASE_PATH=./scut.db         # sqlite only
# DATABASE_URL=postgresql://... # postgres only (Phase 3+)

# Auth (required)
JWT_SECRET=<required — server will not start without this>
JWT_EXPIRY=24h
BCRYPT_ROUNDS=12

# Seed script (optional — used to upsert default admin user)
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_EMAIL=admin@local
SEED_ADMIN_PASSWORD=<password>
```

## Dev Workflow

```bash
# From repo root
npm install
npm run dev              # starts server on :3000, UI on :5173 (proxied)
```

Server serves the built UI as static files in production. In dev, Vite dev server proxies `/api` to the Fastify server.
