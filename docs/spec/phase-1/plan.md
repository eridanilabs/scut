# SCUT Phase 1 - Implementation Plan

## Architecture

```
packages/
  server/               - Fastify API + SQLite + connectors
    src/
      db/
        migrate.ts      - run migrations on startup
        schema.sql      - CREATE TABLE statements
        bobs.ts         - Bob queries
        threads.ts      - Thread queries
        messages.ts     - Message queries
        runs.ts         - Run queries
      connectors/
        IBobConnector.ts         - interface + shared types
        CopilotBridgeBob.ts      - copilot-bridge HTTP connector
        registry.ts              - in-memory connector registry
      routes/
        bobs.ts          - GET /api/bobs, POST /api/bobs
        threads.ts       - CRUD /api/threads
        messages.ts      - POST /api/threads/:id/messages
        runs.ts          - GET /api/threads/:id/runs
        internal.ts      - POST /api/internal/runs/:id/result
      seed.ts            - seed a default CopilotBridgeBob for local dev
      index.ts           - Fastify app init, plugin registration, server start

  ui/                   - React + Vite Moot board
    src/
      api/
        client.ts        - fetch wrapper, base URL config
        threads.ts       - thread API calls
        bobs.ts          - bob API calls
        messages.ts      - message API calls
        runs.ts          - run API calls
      stores/
        threads.ts       - zustand thread store
        bobs.ts          - zustand bob store
        ui.ts            - zustand UI state (selected thread, modals)
      components/
        layout/          - AppShell, Sidebar, Header (from kanban)
        ui/              - shadcn/ui primitives (from kanban)
        thread/          - ThreadCard, ThreadDetail, ThreadForm
        bob/             - BobBadge, BobStatusIndicator
        run/             - RunStatus, RunHistoryItem
      pages/
        MootPage.tsx     - main board: thread list by status
        ThreadDetailPage.tsx  - thread messages + run history
        BobsPage.tsx     - registered bobs and status
      App.tsx
      main.tsx
```

## Implementation Order

The work follows a strict backend-first, then frontend order. Each block is independently committable.

### Block 1: DB Layer

- `schema.sql` matching the spec data model (bobs, threads, messages, runs)
- `migrate.ts`: reads schema.sql, runs on startup, idempotent
- Query modules: typed wrappers for insert/select/update on each table
- No ORM. better-sqlite3 only.

### Block 2: API Routes

Build routes in dependency order:
1. `/api/bobs` - GET (list), POST (register)
2. `/api/threads` - GET (list + filters), POST, GET /:id, PATCH /:id, DELETE /:id
3. `/api/threads/:id/messages` - POST (with auto-dispatch logic)
4. `/api/threads/:id/runs` - GET
5. `/api/internal/runs/:id/result` - POST (connector callback)

All routes return JSON. Validation via Fastify JSON schema (no zod in Phase 1).

Auto-dispatch logic (in POST /api/threads/:id/messages):
- If thread has a `bob_id` and message `author` is `human`
- Create a Run record (status=created)
- Look up the connector in the registry
- Call `connector.dispatch(run, thread)` - fire-and-forget
- Return `{ message, run }`

### Block 3: IBobConnector + CopilotBridgeBob

`IBobConnector` interface (TypeScript):
- `dispatch(run, thread): Promise<void>`
- `cancel(runId): Promise<void>`
- `status(): BobStatus` (sync is fine for Phase 1)

`CopilotBridgeBob`:
- Config: `{ baseUrl: string, channelId: string, token: string }`
- `dispatch`: POST the run input to the copilot-bridge HTTP channel endpoint, record run as `queued`, return
- Result comes back asynchronously via `POST /api/internal/runs/:id/result`
- `cancel`: PATCH the bridge run to cancelled, best-effort
- `status`: GET the bridge health endpoint

Connector registry: a Map<bobId, IBobConnector> initialized at startup. CopilotBridgeBob instances are created from the `bobs` table `config` column on startup.

### Block 4: Seed Script

`seed.ts`: upserts a default Bob (id=`default`, harness=`copilot-bridge`) using env vars for config. Run automatically in dev if no Bobs exist. Documents the env vars needed.

### Block 5: UI Scaffold (borrow from kanban)

Port from `raykao/copilot-bridge-kanban`:
- `tailwind.config.ts`, `postcss.config.js`, `components.json` - adapt for scut
- `src/client/index.css` -> `packages/ui/src/index.css`
- `src/client/components/layout/` -> `packages/ui/src/components/layout/`
- `src/client/components/ui/` (shadcn primitives) -> `packages/ui/src/components/ui/`
- `src/client/stores/theme.ts` -> `packages/ui/src/stores/theme.ts`
- `src/client/components/ErrorBoundary.tsx`, `ErrorState.tsx`

Replace TanStack Query with fetch + zustand. No `@tanstack/react-query` dependency.

### Block 6: Moot Board (Thread List)

`MootPage.tsx`:
- Loads threads via `GET /api/threads`
- Displays threads grouped by status column (idea, refining, ready, in_progress, blocked, done)
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
| Styling | Tailwind CSS v4 + shadcn/ui | Borrowed from kanban |

## Environment Variables (server)

```
PORT=3000
DATABASE_PATH=./scut.db
# For seeding the default CopilotBridgeBob:
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
