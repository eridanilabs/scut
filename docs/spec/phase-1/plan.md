# SCUT Phase 1 - Implementation Plan

## Architecture

```
packages/
  server/               - Fastify API + SQLite + connectors
    src/
      db/
        interfaces/
          IRepository.ts   - root interface and all sub-interfaces
          types.ts         - shared input/filter/output types
        adapters/
          sqlite/
            index.ts       - SQLiteRepository implements IRepository
            projects.ts
            boards.ts
            columns.ts
            bobs.ts
            threads.ts
            messages.ts
            runs.ts
            schema.sql     - CREATE TABLE statements
            migrate.ts     - idempotent migration runner
          postgres/
            index.ts       - PostgresRepository (Phase 3+)
        index.ts           - factory: createRepository(driver) -> IRepository
      connectors/
        IReplicantConnector.ts   - interface + shared types
        CopilotBridgeConnector.ts - Phase 1 reference connector (copilot-bridge HTTP)
        registry.ts              - in-memory connector registry
      routes/
        projects.ts      - CRUD /api/projects
        boards.ts        - CRUD /api/projects/:id/boards, /api/boards/:id
        columns.ts       - CRUD /api/boards/:id/columns, /api/columns/:id
        bobs.ts          - GET/POST /api/bobs, GET/PATCH/DELETE /api/bobs/:id
        threads.ts       - CRUD /api/projects/:id/threads, /api/threads/:id
        messages.ts      - GET/POST /api/threads/:id/messages
        runs.ts          - GET /api/threads/:id/runs, POST/DELETE /api/runs/:id
        internal.ts      - POST /api/internal/runs/:id/result
      openapi.ts         - OpenAPI 3.1 schema generation + /api/docs route
      seed.ts            - seed a default project, board, and Bob for local dev
      index.ts           - Fastify app init, plugin registration, server start

  ui/                   - React + Vite Moot board (SPA)
    src/
      api/
        client.ts        - fetch wrapper, base URL config
        projects.ts      - project API calls
        boards.ts        - board API calls
        threads.ts       - thread API calls
        bobs.ts          - bob API calls
        messages.ts      - message API calls
        runs.ts          - run API calls
      stores/
        projects.ts      - zustand project store
        boards.ts        - zustand board store
        threads.ts       - zustand thread store
        bobs.ts          - zustand bob store
        ui.ts            - zustand UI state (selected project/board/thread, modals)
      components/
        layout/          - AppShell, Sidebar, Header (from kanban)
        ui/              - shadcn/ui primitives (from kanban)
        thread/          - ThreadCard, ThreadDetail, ThreadForm
        bob/             - BobBadge, BobStatusIndicator
        run/             - RunStatus, RunHistoryItem
      pages/
        ProjectsPage.tsx      - project list and creation
        MootPage.tsx          - board view: threads grouped into columns
        ThreadDetailPage.tsx  - thread messages + run history
        BobsPage.tsx          - registered bobs and status
      App.tsx
      main.tsx
```

## Implementation Order

The work follows a strict backend-first, then frontend order. Each block is independently committable.

### Block 1: DB Layer

- Define `IRepository` root interface and all sub-interfaces (`IProjectRepository`, `IBoardRepository`, `IColumnRepository`, `IBobRepository`, `IThreadRepository`, `IMessageRepository`, `IRunRepository`) in `db/interfaces/`
- All interface methods are async (`Promise<T>`) - works for both SQLite and Postgres
- Implement `SQLiteRepository` in `db/adapters/sqlite/` using better-sqlite3 (sync calls wrapped in promises)
- `schema.sql` matching the full spec data model
- `migrate.ts`: idempotent, runs on startup
- `db/index.ts` factory: `createRepository(driver)` reads `DATABASE_DRIVER` env var, returns `IRepository`
- Route handlers receive `IRepository` via Fastify decoration - no raw SQL outside adapters

### Block 2: API Routes

Build routes in dependency order:
1. `/api/projects` - CRUD
2. `/api/projects/:id/boards`, `/api/boards/:id` - CRUD
3. `/api/boards/:id/columns`, `/api/columns/:id` - CRUD
4. `/api/bobs` - GET (list), POST (register), GET/:id, PATCH/:id, DELETE/:id
5. `/api/projects/:id/threads` - GET (list + filters), POST
6. `/api/threads/:id` - GET, PATCH, DELETE
7. `/api/threads/:id/messages` - GET, POST (with auto-dispatch logic)
8. `/api/threads/:id/runs` - GET
9. `/api/internal/runs/:id/result` - POST (connector callback)

All routes return JSON. Validation via Fastify JSON schema (no zod in Phase 1).

`/api/docs` serves the OpenAPI 3.1 spec (generated from Fastify route schemas). The spec is also written to `docs/api/openapi.yaml` at build time.

Auto-dispatch logic (in POST /api/threads/:id/messages):
- If thread has a `bob_id` and message `author` is `human`
- Create a Run record (status=created)
- Look up the connector in the registry
- Call `connector.dispatch(run, thread)` - fire-and-forget
- Return `{ message, run }`

### Block 3: IReplicantConnector + Phase 1 Reference Connector

`IReplicantConnector` interface (TypeScript):
- `dispatch(run, thread): Promise<void>`
- `cancel(runId): Promise<void>`
- `status(): BobStatus` (sync is fine for Phase 1)

The interface must contain no harness-specific types or imports. Each connector is a self-contained adapter.

`CopilotBridgeConnector` (Phase 1 reference connector):
- Config: `{ baseUrl: string, channelId: string, token: string }`
- `dispatch`: POST the run input to the copilot-bridge HTTP channel endpoint, set run status to `queued`, return
- Result comes back asynchronously via `POST /api/internal/runs/:id/result`
- `cancel`: PATCH the bridge run to cancelled, best-effort
- `status`: GET the bridge health endpoint

This connector is one implementation. Any other harness (subprocess, A2A, ACP, etc.) can be plugged in by implementing `IReplicantConnector` without touching SCUT core.

Connector registry: a `Map<bobId, IReplicantConnector>` initialized at startup. Connector instances are created from the `bobs` table `harness` + `config` columns on startup.

### Block 4: Seed Script

`seed.ts`: upserts a default project, board with standard columns, and a default Bob (harness=`copilot-bridge`) using env vars for config. Run automatically in dev if no data exists. The harness type in the seed is configurable - changing it requires only env var changes, not code changes.

### Block 5: UI Scaffold (borrow from kanban)

Port from `raykao/copilot-bridge-kanban`:
- `tailwind.config.ts`, `postcss.config.js`, `components.json` - adapt for scut
- `src/client/index.css` -> `packages/ui/src/index.css`
- `src/client/components/layout/` -> `packages/ui/src/components/layout/`
- `src/client/components/ui/` (shadcn primitives) -> `packages/ui/src/components/ui/`
- `src/client/stores/theme.ts` -> `packages/ui/src/stores/theme.ts`
- `src/client/components/ErrorBoundary.tsx`, `ErrorState.tsx`

Replace TanStack Query with fetch + zustand. No `@tanstack/react-query` dependency.

### Block 6: Moot Board (Project + Board View)

`ProjectsPage.tsx`:
- Loads projects via `GET /api/projects`
- Lists projects with name, description, thread count
- Create project button -> modal

`MootPage.tsx`:
- Loads a single board (with columns) and the project's threads
- Displays threads grouped by column (each column's filter_rule determines which threads appear)
- ThreadCard shows: title, status badge, assigned Bob name, message count
- Create thread button -> modal with title + description form
- Click thread -> navigate to `/threads/:id`

### Block 7: Thread Detail

`ThreadDetailPage.tsx`:
- Loads thread, messages, latest run via `GET /api/threads/:id`
- Shows message history (human and bob messages, styled differently)
- Shows run status badge next to Bob messages
- Message input form at bottom: posts to `POST /api/threads/:id/messages`
- Bob assignment selector: PATCH thread with selected bobId
- Thread status selector: PATCH thread status

### Block 8: Bobs Page

`BobsPage.tsx`:
- Loads bobs via `GET /api/bobs`
- Table: id, name, harness, status indicator
- No creation UI in Phase 1 (use API or seed)

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| State management | zustand | Already in kanban, no TanStack constraint |
| Data fetching | fetch + useEffect in zustand actions | No TanStack Query |
| Routing | react-router-dom v7 | Same as kanban |
| DB | better-sqlite3 (sync) | Simple, no async complexity for Phase 1 |
| Validation | Fastify JSON schema | Lightweight, no extra deps |
| Auth | None | Out of scope for Phase 1 |
| API documentation | OpenAPI 3.1 via Fastify schema | API-first; agents and humans share the same docs |
| Styling | Tailwind CSS v4 + shadcn/ui | Borrowed from kanban |

## Environment Variables (server)

```
PORT=3000
DATABASE_DRIVER=sqlite          # sqlite | postgres
DATABASE_PATH=./scut.db         # sqlite only
# DATABASE_URL=postgresql://... # postgres only
# For seeding the default Bob (Phase 1 uses copilot-bridge connector):
DEFAULT_BOB_HARNESS=copilot-bridge
COPILOT_BRIDGE_URL=http://localhost:4000
COPILOT_BRIDGE_CHANNEL_ID=<channel-id>
COPILOT_BRIDGE_TOKEN=<token>
```

## Dev Workflow

```bash
# From repo root
npm install
npm run dev              # starts server on :3000, UI on :5173 (proxied)
```

Server serves the built UI as static files in production. In dev, Vite dev server proxies `/api` to the Fastify server.
