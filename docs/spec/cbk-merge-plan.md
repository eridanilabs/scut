# CBK → SCUT Merge Plan

Status: draft 5
Owner: bill (eridanilabs)
Branch: `bill/docs/cbk-merge-plan`
Related: `docs/spec/spec.md`, dark-factory `research/scut-pm-experience.md`

### Revision log

- **draft 5 (2026-05-25)**: ACP naming-collision correction. The "ACP" we are building against is **Agent Client Protocol** (https://agentclientprotocol.com/) - the JSON-RPC 2.0 protocol where SCUT acts as the **Client** and harnesses (Claude Code, Codex, Copilot CLI with `--acp`) act as the **Agent**. CBK's `AcpSessionManager` already speaks this. This is unrelated to the IBM "ACP" that merged into A2A. Connector hierarchy flips: **ACP is now primary**, CopilotBridge legacy, A2A is no longer treated as a primary outbound connector. A2A becomes the **inbound agent-to-SCUT surface** for delegation/handoff (a public API surface, complementary, optional). New §4.2 (SCUT as ACP Client - capability surface). New §4.3 (Inbound agent surfaces: REST + A2A). Phase 3 swapped: ACP primary, A2A inbound deferred.
- **draft 4 (2026-05-25)**: Reverse-proxy deployment topology + versioned API path (`/api/v1/...`) as part of API-first. SPA-fallback rule for the web client. API-first testability rule: every server endpoint must be exercisable via curl/REST and have a curl-based test or example **before** UI code consumes it. New §2.3 (deployment topology) and §2.4 (testability gate).
- **draft 3 (2026-05-25)**: Elevate API-first to constraint #1 (was a SCUT spec §2 principle, not a merge-plan gate). Add §2.1 (port anti-patterns: UI-coupled endpoints, browser-only auth, render hints in transport) and §2.2 (client roadmap: web/native/mobile/CLI/agents/webhooks). UI port unit constraint added in §5.
- **draft 2 (2026-05-25)**: Drop `Run` as a SCUT-domain entity. Adopt the word `Task` (typed `AgentTask` at the interface boundary). Add `comment_dispatches` sidecar table for dispatch lifecycle; reserve `comments.metadata` for presentation hints. Reverse the "do not port" call on CBK migration 015 (drop runs) - they were right. Collapse two-field connector ID design into one opaque `connector_handle`. Rewrites: §3.1, §3.3, §3.4, §4, §5.
- **draft 1 (2026-05-25)**: Initial nomenclature + phase plan.

## 1. Purpose

`copilot-bridge-kanban` (CBK) is a working kanban + agent-chat surface built on top of `copilot-bridge` via a custom WebSocket channel. SCUT is the canonical eridanilabs coordination plane and already has a published spec (`docs/spec/spec.md`) that goes further than CBK on data model and connector strategy. Going forward:

- **SCUT** owns all PM/UI/coordination surfaces, the data model, and the connector interface.
- **copilot-bridge** stops exposing a bespoke channel for SCUT. It remains an agent harness behind one (legacy) connector implementation.
- The primary outbound protocol is **ACP** (Agent Client Protocol, https://agentclientprotocol.com/) - JSON-RPC 2.0, SCUT acts as the **Client**, harnesses (Claude Code, Codex, Copilot CLI with `--acp`, Zed-compatible agents) act as the **Agent**. CBK's `AcpSessionManager` already speaks this protocol.
- **A2A** (Google Agent-to-Agent) is a separate, **complementary** surface used for **inbound** agent-to-SCUT interop - external agents posting threads, assigning work, handing off / delegating to SCUT-managed agents. It is not the primary outbound dispatch path. Optional. See §4.3.
- CBK's existing repo continues to be developed by Bob in the short term (it ships features today). This plan is for bringing the useful pieces of CBK into SCUT branch-by-branch on a new SCUT integration branch, not for forking CBK.

> **Naming-collision note (important):** There are two unrelated protocols both historically called "ACP". The one we are building against is the **Agent Client Protocol** at https://agentclientprotocol.com/ - used by Zed, supported by Claude Code, Codex, and Copilot CLI's `--acp` mode. The other "ACP" was an IBM standard that has since merged with A2A and is not what we mean anywhere in this document. All references to "ACP" in this plan and in SCUT code mean Agent Client Protocol.

## 2. Hard Constraints

1. **API-first is non-negotiable.** Every entity, capability, and state transition in SCUT is reachable via the public HTTP API. The React web UI shipped in this repo is **one client among many** - a native desktop app (Tauri/Electron), a mobile app (iOS/Android), a CLI, and external agents must all be able to do **everything the web UI can do** by calling the same documented API. Practical gates derived from this constraint:
   - No business logic in UI code. The server enforces all rules; the UI renders results.
   - No server-side endpoint exists solely to serve the React UI's convenience. If a query shape is only useful to one client, it goes in that client.
   - All real-time updates flow through a documented, client-agnostic channel (SSE today per spec §8; not WebSocket-only, not React-specific).
   - The OpenAPI document (spec §11, `docs/api/openapi.yaml`) is the contract. UI ports of CBK code MUST result in a server endpoint first; UI work consumes that endpoint, never the other way around.
   - Auth tokens and session model work identically for browser, native, mobile, and headless clients. No browser-only cookie/CSRF coupling.
   - The packaged web UI is shipped from the API server as static assets, but is **not** required for the server to be useful. `scut-server` alone (no UI) is a valid deployment for headless / agent-only setups.
   - **All endpoints are namespaced** under a versioned API prefix (`/api/v1/...`). See §2.3 for the deployment topology that makes web + API coexist on one origin while remaining independently deployable.
   - **Every endpoint must be reachable and testable via `curl`** before any UI consumes it. See §2.4 for the gate.
2. **Thread-domain IDs are separate from agent-domain IDs.** A `thread.id` is owned by SCUT. An agent-side session / task / connection identifier is owned by the connector. They are related via the opaque `connector_handle` column on the SCUT-owned `comment_dispatches` row, never by overloading one ID for both. SCUT never parses connector handles.
3. **Bridge is unaware of SCUT's presentation choices.** Layered prompts, instruction nodes, nested comment streams, board-level system prompts - all of that is assembled by SCUT before dispatch. Connectors receive opaque prompt strings + structured context. (Carries forward the boundary from `research/bridge-authoritative-session-state.md` and `research/scut-pm-experience.md`.)
4. **SCUT spec is the source of truth.** Where CBK and SCUT-spec disagree on naming, SCUT-spec wins unless the spec is wrong. Disagreements must result in either a spec amendment PR or a CBK→SCUT rename in the port.
5. **No bespoke `copilot-bridge` channel in the long run.** The existing custom WS adapter becomes one optional connector (`CopilotBridgeConnector`, already named in spec §3) that we keep for migration, not extend.

### 2.1 Anti-patterns to watch for during the port

Several CBK files mix UI and server concerns or assume the browser is the only client. Each must be untangled during port, not copied verbatim:

| CBK pattern | Why it violates API-first | Port action |
|---|---|---|
| Server endpoints returning React-component-shaped payloads | Couples API to one renderer | Return normalized resources; let clients shape for display |
| WebSocket frames carrying UI render hints (e.g. "show as collapsible") | Mixes transport with presentation | Move render hints to `comments.metadata` (§3.5); transport carries data only |
| Browser-cookie-based session auth | Excludes native/mobile/CLI | Bearer-token auth (already in CBK for agent tokens - extend to user sessions) |
| Endpoints that only the SettingsPage uses | UI-driven API surface | Either generalize the endpoint or move the logic client-side |
| Hot reload / dev-only endpoints | UI-tooling coupling | Strip during port; do not ship in the SCUT API |

### 2.2 Client roadmap (informs but does not constrain Phase 0-1)

The API surface must be designed assuming all of these clients will exist:

| Client | Status | Notes |
|---|---|---|
| Web UI (React, shipped with server) | Phase 1 (exists) | Default client; one of many |
| Native desktop (Tauri or Electron) | Future | Same REST + SSE as web; bundles its own UI shell |
| Mobile (iOS / Android) | Future | Same REST + SSE; push notifications via separate channel |
| CLI (`scut` command) | Future | Thin wrapper over the public API for scripting and agent harnesses |
| External agents (ACP outbound; A2A inbound) | Phase 2+ | ACP harnesses dispatched to via `IReplicantConnector`. A2A-speaking agents post inbound to `/api/v1/a2a/...` (optional surface, see §4.3). Both authenticate as Replicants via the existing agent-token model. |
| External integrations (webhooks in/out) | Future | Out of scope for this plan, but API must not preclude them |

No code lands in this plan for non-web clients. The constraint here is **negative**: no port decision may foreclose any of these clients.

### 2.3 Deployment topology: reverse proxy on a single origin

To keep API-first honest **and** ship the web UI on the same `host:port` users already use, all SCUT deployments (dev, test, prod) sit behind a reverse proxy. The web client and the API server are separate processes that the proxy routes between.

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
                  │  /api/events (SSE)│  │                  │
                  │  /healthz        │  │                  │
                  └──────────────────┘  └──────────────────┘
```

**Routing rules** (proxy config is the contract):

| Path prefix | Routed to | Notes |
|---|---|---|
| `/api/v1/...` | `scut-server` | Versioned business API |
| `/api/docs` | `scut-server` | OpenAPI UI + raw `openapi.yaml` |
| `/api/events` | `scut-server` (SSE; proxy must disable buffering) | Real-time stream per spec §8 |
| `/healthz`, `/readyz` | `scut-server` | Liveness / readiness |
| Everything else | web client | SPA fallback to `index.html`; client-side router handles deep links |

**Proxy choice**:

- **Dev**: Vite's built-in proxy (`server.proxy['/api']` and `server.proxy['/healthz']` in `vite.config.ts`) is the default. Zero new processes for the common case. Pros: one command (`pnpm dev`), HMR, fast. Cons: only handles the web-client side.
- **Dev/test (full topology)**: A tiny **Caddy** or **nginx** reverse proxy in a Compose file (`infra/dev/Caddyfile` or `nginx.dev.conf`) that sits in front of `scut-server` and either the Vite dev server (dev) or the built static assets (test). Used when we want to test the actual production topology, run multiple clients (web + curl) against one origin, or verify CORS / cookie behavior.
- **Prod**: Caddy or nginx (operator choice). Same config shape as `infra/dev/`. The repo ships reference configs; deployers can swap in Envoy, Traefik, or anything else that honors the routing rules above.

**Why a proxy and not "serve the UI from the API server"**:

1. **Independent deploys later.** The web UI can ship to a CDN; the API server can scale separately. Forcing the API server to also be a static-asset server today bakes coupling we will have to undo.
2. **Independent dev.** Frontend devs can run only the web client against a remote staging API by changing one proxy upstream. Backend devs can run only `scut-server` and exercise it with curl, no Vite, no node-modules for the UI.
3. **Independent testing.** The API has its own test suite that hits `scut-server` directly on its bound port (no proxy). The UI has its own test suite that mocks the API or hits a separate test deployment. See §2.4.
4. **Native/mobile/CLI clients** point straight at the API origin and never see the web UI. The proxy is the seam that lets all three classes of client coexist on one URL today and split later.

**SPA fallback rule**: the web client owns all paths that do NOT begin with `/api/`, `/healthz`, `/readyz`. Unmatched routes return `index.html` with HTTP 200; the React Router handles the actual route. This is what makes deep links work, and what makes "unstopped traffic" land somewhere useful instead of 404.

**Versioning rule**: All business endpoints live under `/api/v1/...`. `/api/v2/...` is reserved for breaking changes. `/api/` without a version is reserved for meta endpoints (`/api/docs`, `/api/health`) that intentionally do not version. Connector-facing endpoints (agent token auth, callbacks) are inside `/api/v1/` like everything else - they are not special.

### 2.4 Testability gate: curl / REST before UI

**Every server endpoint must be exercisable end-to-end via `curl` before any UI code consumes it.**

The practical gates:

1. **Endpoint PR sequence**: server endpoint + test + OpenAPI entry land first. UI work that consumes that endpoint is a separate PR, opened after the API PR is merged.
2. **Test artifact**: every endpoint ships with at least one of (a) an integration test that hits the live Fastify instance over HTTP (not just the handler function), or (b) a `docs/api/examples/<endpoint>.sh` script using `curl` that demonstrates a happy-path call. Preferably both.
3. **Smoke script**: `scripts/smoke.sh` runs a sequence of `curl` calls against a local `scut-server` and asserts the responses. Every new endpoint adds one line to this script. CI runs it against a fresh dev instance.
4. **No "tested via the UI"** as the only validation. If the only way to know an endpoint works is to click through the React app, the endpoint is not finished.
5. **Phases gate**: Phase 2 (foundation port) and Phase 3 (ACP connector) MUST be fully exercisable via curl before any Phase 6 (UI port) work begins. This is what "API-first" means operationally for this plan.

This is the same shape as the Small Model Standard (AGENTS.md §3): the gate is binary and a Haiku-class implementer must be able to satisfy it without judgment calls.

## 3. Nomenclature: CBK ↔ SCUT

The recommended-name column is what the merged codebase should use (DB columns, types, route paths, code identifiers). UI labels can diverge per `board.item_singular` / `item_plural` (see SCUT spec §3) but underlying identifiers should be one consistent term.

### 3.1 Domain entities

| Concept | CBK term | SCUT-spec term | **Recommended** | Scope | Notes |
|---|---|---|---|---|---|
| Unit of work | `card` | `Thread` | **Thread** (DB, API), "Card" (default UI label, customizable per board) | Both | SCUT spec §3 already nails this. UI keeps "card" by default for familiarity. |
| Saved view / lane | `column` | `Column` | **Column** | Both | Same word, same meaning. CBK columns are containers; SCUT columns are filter rules. The merge adopts SCUT's filter-rule model (see §5). |
| Board / project surface | `board` (implicit, no top-level Board entity in CBK) | `Board` | **Board** | Both | SCUT introduces an explicit `boards` table that CBK lacks. Required for the merge. |
| Project grouping | (none in CBK) | `Project` | **Project** | Both | New from SCUT. CBK is implicitly single-project. |
| Tenant | (none in CBK) | `Organization` | **Organization** | Both | Phase 1 single-tenant. |
| Comment / message on a thread | `card_comments` | `Comment` | **Comment** | Both | Same. CBK already added `metadata` column (migration 016) - reserved for presentation hints only (see §3.5), NOT dispatch state. |
| Comment presentation hints | `card_comments.metadata` (CBK mig 016) | (not yet specified) | **`comments.metadata`** (JSON) | Backend | Tool-call collapsibles, streaming token chunks, citations, render flags. UI-facing. Not indexed. |
| Agent invocation | `run` (table dropped CBK mig 015) | `Run` | **(removed from SCUT-domain)** | n/a | "Run" is an agent-domain concept. SCUT-core has no `runs` table. CBK's mig 015 was right; we follow them. The lifecycle SCUT cares about lives in `comment_dispatches` (see next row). The agent-side work unit is `AgentTask` at the connector boundary. |
| SCUT-side dispatch lifecycle | (none) | (none) | **`comment_dispatches`** (sidecar table) | Backend | One row per dispatch attempt. Columns: `id`, `comment_id` FK, `thread_id`, `replicant_id`, `status`, `started_at`, `completed_at`, `error`, `connector_handle` (opaque TEXT). Indexed on `(status)`, `(thread_id, created_at)`, `(replicant_id, status)`. SCUT-queryable. |
| Connector-side work unit | `session_id` / `acp_session_id` / per-protocol task IDs | (none) | **`AgentTask`** (interface type) | Connector boundary | A neutral name for "the thing the agent is currently doing." Each connector maps its protocol's primitive onto this type: ACP maps `session/prompt` invocations; CopilotBridge maps a bridge run; a future A2A outbound connector would map an A2A `Task`. Typed `AgentTask` in `IReplicantConnector` to avoid colliding with kanban "task" if it ever surfaces in UI text. Connector returns an `AgentTaskHandle` from `dispatch`; SCUT stores it opaquely in `comment_dispatches.connector_handle` and passes it back for `cancel` / `status`. |
| Registered agent | `agent` (DB table `agents`) | `Replicant` | **Replicant** (DB, API), "Agent" (UI label) | Both | SCUT spec §3 is explicit. "Agent" stays as the user-facing word; `replicant_id` is the column name. |
| Connector implementation kind | `provider` (with `type IN ('acp', 'copilot-bridge', 'a2a')`) | `harness` / `Connector` | **Connector** (interface), **Harness** (connector kind) | Both | SCUT calls the interface `IReplicantConnector`. CBK's `provider` row maps to: one `Connector` instance, parameterized by `harness` kind. Rename `providers` → `connectors`. Initial harness kinds: `'acp'` (primary), `'copilot-bridge'` (legacy). `'a2a'` is **not** a connector harness in the first cut - A2A is an inbound surface (see §4.3). |
| Opaque connector handle | various per-protocol fields | (not directly named) | **`connector_handle`** (TEXT column on `comment_dispatches`) | Backend | One opaque blob per dispatch. SCUT never parses it; it is round-tripped to the connector for `cancel` / `status`. Replaces the previous draft's two-field `connector_session_id` + `connector_run_id` design. |
| Tool-permission record | `agent_permissions` | (not yet specified) | **`replicant_permissions`** | Backend | New table in SCUT, ported from CBK migration 012 + 013. Lives under the Replicant, not the Thread. |
| Per-thread permission grant | implicit via `agent_tokens.card_id` | (not yet specified) | **`thread_permissions`** | Backend | Per-thread overrides. |
| Layered instruction node | (none) | (none in spec) | **Instruction node** (`kind='instruction'` in unified node model) | Both | From `research/scut-pm-experience.md` iteration 3. New, not in CBK. |
| Checklist item | (none) | `ChecklistItem` | **ChecklistItem** | Both | SCUT-only. |

### 3.2 UI / surface labels

| UI surface | CBK label | SCUT-spec label | **Recommended UI label** |
|---|---|---|---|
| Main board view | "Board" | "Moot" | **"Board"** (Moot is the *name of the application surface*; user-facing nav says "Boards") |
| Agent inventory | "Agents" / "Settings" | "Replicants" (internal) / "Agents" (UI per spec §3) | **"Agents"** |
| Per-agent message inbox | "Agent Bot" thread | "Agent Moot" (per spec §3: cross-board query `WHERE replicant_id = ?`) | **"Agent Moot"** or **"My Threads"** (decide in design-system pass) |
| Connector kind picker | "Provider Type" | (not specified) | **"Harness"** (e.g. "ACP", "Copilot Bridge") |

### 3.3 Why these choices

- **Thread over Card (backend), Card stays as default UI label.** Thread is more accurate (it carries history, branching, and agent session semantics) but "card" is what users see on a kanban. Keep both; the `board.item_singular` field already supports this per board.
- **Connector over Provider.** Two reasons: (1) SCUT spec already says "connector" everywhere; (2) "provider" collides with the OAuth/identity sense in many ecosystems. Harness is the *type* of connector ("a2a", "acp", "copilot-bridge").
- **Replicant stays as a real word in the DB.** It is the only term that makes the polymorphic assignee field (`assignee_type IN ('user', 'replicant')`) read cleanly. UI says "Agent".
- **No `Run` in SCUT-domain.** "Run" is an agent-side concept (OpenAI Assistants popularized it; A2A uses "Task"; ACP uses `session/prompt` invocations). SCUT-core does not need a noun for "the thing the agent is doing right now" - SCUT cares about *the comment that triggered it* and *the lifecycle of that dispatch*. Everything that CBK's `runs` table held splits cleanly into: triggering Comment (input, author, time), response Comments (output), `comment_dispatches` row (status, timing, error, opaque handle). CBK migration 015 was right to drop the table; this plan follows them.
- **`AgentTask` at the connector boundary.** A neutral name not tied to any one protocol. ACP `session/prompt` invocations, A2A `Task`s, and bridge sessions all map onto this type behind their respective connectors. Typed `AgentTask` in the interface to avoid colliding with kanban "task" if it ever surfaces in UI text.
- **`comment_dispatches` sidecar over metadata-only.** A JSON metadata column is fine for presentation hints but bad for "list all in-flight agent work" and "show me everything stuck > 5 minutes" - those become full table scans with JSON parsing. The sidecar table gives us indexed queries on status, replicant, and thread, while keeping the connector handle opaque.
- **One `connector_handle` column over two named ID columns.** The previous draft (`connector_session_id` + `connector_run_id`) leaked connector internals into the schema. SCUT shouldn't care whether the connector tracks one ID, two, or a serialized object. One opaque TEXT column is enough; the connector knows how to decode its own handles.
- **Bug-class note.** The kanban silent-failure that prompted `bill-f75` traced back to bridge-side session state and SCUT-side card state drifting invisibly. Making the SCUT-side lifecycle a real, queryable row (`comment_dispatches`) with a status field separate from any agent-side state removes the class entirely: SCUT always knows "is something in flight?" without asking the connector.

### 3.4 ID boundaries (the hard constraint, in table form)

| ID | Owner | Lifetime | Where it lives |
|---|---|---|---|
| `thread.id` | SCUT | Forever; survives connector restarts, replicant swaps, harness migrations | `threads.id` |
| `comment.id` | SCUT | Forever | `comments.id` |
| `replicant.id` | SCUT | Registration lifetime | `replicants.id` |
| `comment_dispatch.id` | SCUT | One dispatch attempt | `comment_dispatches.id` |
| `connector_handle` (opaque blob) | Connector | Connector's choice | `comment_dispatches.connector_handle` (TEXT, never parsed by SCUT) |
| ACP `sessionId` + per-prompt invocation index | ACP agent (per https://agentclientprotocol.com/ spec) | Per ACP spec | Encoded inside `connector_handle` by `AcpConnector` |
| Bridge session ID | copilot-bridge | Bridge's choice | Encoded inside `connector_handle` by `CopilotBridgeConnector` |
| A2A `Task.id`, A2A `Context.id` (inbound) | A2A spec | Per A2A spec | Stored by the A2A inbound surface (§4.3), not by a connector. Mapped to SCUT thread/comment IDs at the API boundary. |

The general rule: **SCUT-side IDs live in named columns. Connector-side IDs live inside an opaque `connector_handle` blob.** SCUT never parses the handle; it round-trips it to the connector for `cancel(handle)` and `status(handle)`. The connector kind is recoverable via the `replicant` referenced by the dispatch row, so the right decoder is always findable.

### 3.5 Dispatch lifecycle vs presentation hints (the cleanup of `comments.metadata`)

CBK migration 016 added a `metadata` JSON column to `card_comments`. SCUT keeps that column but narrows its purpose:

| Where it goes | Why |
|---|---|
| `comment_dispatches` row (sidecar) | Anything SCUT may need to **query** or **filter on**: status, replicant_id, timing, error class, opaque connector handle |
| `comments.metadata` (JSON) | Anything that is **only ever rendered**: tool-call collapsible blocks, partial tokens during streaming, citation footnotes, custom UI badges |

Rule of thumb: if a backend cron / dashboard / "stuck task sweeper" would ever want to `SELECT ... WHERE x = ?` on it, it belongs in `comment_dispatches`. If only the UI ever looks at it, it belongs in `comments.metadata`.

## 4. Connector Interface Evolution

`IReplicantConnector` (spec §10) stays the contract. Two concrete outbound connectors at the end of this work, plus one optional inbound surface:

### 4.1 Outbound connectors (SCUT dispatches to agent)

| Connector | Status | Harness kind | Notes |
|---|---|---|---|
| `AcpConnector` | **primary** | `acp` | Speaks [Agent Client Protocol](https://agentclientprotocol.com/) as the **Client**. Spawns ACP-capable agents as subprocesses (Claude Code, Codex, Copilot CLI with `--acp`, Zed-compatible agents) and drives them via JSON-RPC 2.0 over stdio. Ported from CBK's `AcpSessionManager` (post-Bob-refactor per `research/bridge-authoritative-session-state.md`). |
| `CopilotBridgeConnector` | legacy, deprecated | `copilot-bridge` | Wraps the existing CBK WebSocket channel. Kept for migration continuity only. Sunset target: when ACP coverage is verified across the harnesses bridge currently serves. |

### 4.2 SCUT as ACP Client (capability surface)

Per the ACP spec, the Client side (SCUT) provides methods the Agent can call back into. For Phase 3 we implement the minimum surface needed for the agents we care about:

| ACP method (Agent → Client) | SCUT implementation | Notes |
|---|---|---|
| `session/request_permission` | **Required.** Routes to the SCUT permission system (ported from CBK's `agent_permissions`). User responds via UI; SCUT posts the answer back. | Mandatory per ACP baseline. |
| `session/update` (notification) | **Required.** Each update is converted to a Comment (or appended to a streaming Comment) on the dispatching Thread. | Mandatory per ACP baseline. |
| `fs/read_text_file` | **Optional, scoped.** Only if SCUT's workspace model permits the agent file access. Initially: not exposed. | ACP optional. Defer to Phase 3.5 / 4. |
| `fs/write_text_file` | **Optional, scoped.** Initially: not exposed. | ACP optional. Defer. |
| `terminal/*` | **Optional, scoped.** Initially: not exposed. SCUT is not a terminal host. | ACP optional. Probably never. |

And the methods SCUT calls (as Client) on the Agent:

| ACP method (Client → Agent) | When SCUT calls it | Notes |
|---|---|---|
| `initialize` | Connector start / agent reconnect | Baseline. Negotiates version + capabilities. |
| `authenticate` | If the agent advertises it | Baseline. Uses replicant credentials. |
| `session/new` | First dispatch to a Thread that has no `connector_handle` yet | Baseline. The returned ACP `sessionId` goes into the `connector_handle`. |
| `session/load` | Reconnect after restart, IF agent advertises capability | Optional. Falls back to `session/new`. |
| `session/prompt` | Each dispatch | Baseline. One call per `IReplicantConnector.dispatch()`. |
| `session/cancel` (notification) | `IReplicantConnector.cancel(handle)` | Baseline. |
| `session/set_mode` | Future | Optional. |

### 4.3 Inbound agent surface (A2A and REST)

Separate from the outbound connectors above. This is how **external agents call into SCUT** to post threads, assign work, hand off / delegate.

| Surface | Status | Path | Notes |
|---|---|---|---|
| Native REST (always) | Phase 2 | `/api/v1/threads`, `/api/v1/comments`, etc. | Any agent with a Replicant token can use the public API directly. This is the baseline path. |
| **A2A** (optional, complementary) | Future, post-ACP | `/api/v1/a2a/...` | Implements the Google Agent-to-Agent server surface. Lets A2A-speaking external agents treat SCUT as an A2A peer for delegation / handoff. Maps A2A `Message` → SCUT Comment, A2A `Task` → SCUT Thread + `comment_dispatches`. Optional - SCUT works without it. |

The two paths are complementary, not competing. ACP is **outbound** (SCUT → harness). A2A and REST are **inbound** (external agent → SCUT). An external A2A agent can hand work off to SCUT via the A2A inbound surface; SCUT then dispatches to a local ACP harness to do the actual work.

### 4.4 Interface contract

Connector deltas vs current spec §10:

- **Remove `Run` from the interface.** Replace with `AgentTask` (return type, not entity) and `AgentTaskHandle` (opaque blob, what SCUT stores in `comment_dispatches.connector_handle`).
- **New interface shape (sketch):**

  ```typescript
  // Opaque to SCUT. Each connector owns its shape and serialization.
  type AgentTaskHandle = string;

  type AgentTaskStatus = {
    state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    detail?: string;
  };

  interface IReplicantConnector {
    // SCUT hands over the thread + triggering comment + assembled prompt.
    // Connector returns a handle SCUT can persist for cancel/status.
    dispatch(args: {
      thread: Thread;
      triggeringComment: Comment;
      prompt: AssembledPrompt;  // from IPromptAssembler, see below
    }): Promise<AgentTaskHandle>;

    cancel(handle: AgentTaskHandle): Promise<void>;
    status(handle: AgentTaskHandle): Promise<AgentTaskStatus>;

    // Stream of updates the connector emits while a task is running.
    // SCUT consumes these and writes them as Comments (or updates the
    // dispatch row status). Termination of the stream completes the dispatch.
    events(handle: AgentTaskHandle): AsyncIterable<AgentEvent>;
  }
  ```

- **Add an `IPromptAssembler` boundary** so SCUT (not the connector) assembles the layered prompt (board / column / card / instruction-node stack from `scut-pm-experience.md`). The connector receives a finished `AssembledPrompt`, not raw turns. Defined in the prompt-stack research doc.
- **No `Run` type passed in.** The dispatch arguments are explicit: thread, triggering comment, assembled prompt. The dispatch row is SCUT-internal and never crosses the boundary.

## 5. What's in CBK that SCUT Needs

Pieces to port, in rough order of independence. Each becomes its own SCUT phase-2.x task / PR.

| # | CBK source | SCUT destination | Notes |
|---|---|---|---|
| 1 | `migrations/017-providers-add-a2a-type.ts` | `replicants.harness` enum | Becomes a no-op port. Initial SCUT harness enum is `('acp', 'copilot-bridge')` only. The `'a2a'` value is **not** ported as a harness kind - A2A is an inbound surface (§4.3), not an outbound connector. If a future A2A outbound connector is built, it will be added then. |
| 2 | `src/server/agents-db.ts`, `agents.ts` | `replicants` repo + routes | Rename agent→replicant, provider→harness/connector. |
| 3 | `src/server/agent-tokens.ts` + migrations 008-009 | `replicant_tokens` table + auth path | API-key auth for agents calling back. |
| 4 | `src/server/agent-permissions.ts` + migrations 012-013 | `replicant_permissions` + `thread_permissions` | Permission model. |
| 5 | `src/server/card-routes.ts` per-card chat endpoints | `thread` comment + dispatch endpoints | Already exists in SCUT phase-2 plan; align shapes. |
| 6 | `src/server/acp-session-manager.ts` | `packages/server/src/connectors/AcpConnector.ts` (implements `IReplicantConnector` returning `AgentTaskHandle`, speaks https://agentclientprotocol.com/ as Client) | **This is the primary connector port.** Bob is currently rewriting this per `research/bridge-authoritative-session-state.md`. Wait for that work to land, then port the improved version. ACP `sessionId` + per-prompt invocation index get encoded into the opaque `connector_handle`. Includes Client-side method surface from §4.2: `session/request_permission`, `session/update`. |
| 7 | `src/server/card-session-manager.ts` | Replaced by `comment_dispatches` table + connector `events()` stream | Do not port as-is. The "what's in flight, what tokens have we seen" state moves to SCUT's dispatch row + connector event stream. |
| 8 | `src/server/bridge-stream.ts` | `packages/server/src/connectors/CopilotBridgeConnector.ts` | Wrap as the legacy connector. Bridge session ID becomes part of `connector_handle`. Do not extend. |
| 9 | Admin UI (SettingsPage, agent token manager) | `packages/ui/src/admin/` | Rebrand provider→connector, agent→replicant. **API-first gate**: every action the SettingsPage performs must hit a documented endpoint in `docs/api/openapi.yaml`. No UI-only state mutations. No endpoints that exist solely for the SettingsPage's convenience. If CBK code violates this, fix it during the port - do not copy the violation forward. |
| 10 | `migration 014-cards-session-transcript.ts` + `last_rendered_turn_index` | Replaced by `comment_dispatches` lifecycle + comment ordering | Do not port the transcript column or the render-cursor column. SCUT reconstructs view state from comments + dispatch rows directly. |

Pieces in CBK that we explicitly **do not** port:

- The custom WebSocket channel handshake. Replaced by ACP for the outbound dispatch path. (A2A may later become the inbound peer-to-peer surface per §4.3 - that is a separate workstream.)
- The single-slot `pendingPermission` design in `AcpSessionManager`. Bob's refactor replaces it.
- The `last_rendered_turn_index` column on cards. Replaced by `comment_dispatches` + comment ordering.
- The `cards.session_id` column. Replaced by `comment_dispatches.connector_handle`. (Multiple dispatches per thread, each with its own handle - matches the cancellation / retry / parallel-dispatch goals in SCUT spec phase 5.)

Pieces from CBK we explicitly **do** follow:

- Migration 015 (drop `runs` table). They were right; SCUT-core does not need a `runs` entity. See §3.3.
- Migration 016 (`card_comments.metadata`). We keep the column, but narrow its purpose to presentation hints only (see §3.5).
- Migration 017 (add `'a2a'` to provider type enum). Initial SCUT harness enum is `('acp', 'copilot-bridge')` only - see port unit 1.

## 6. Phase Plan

Each phase ends in a green CI build on SCUT main. No CBK code lands on SCUT main until renamed to SCUT vocabulary and covered by tests.

### Phase 0 - Spec alignment (this PR)

- Land this document.
- One spec-amendment PR (separate) updating `docs/spec/spec.md`:
  - §2 Design Principles (API-First): strengthen the existing principle to **constraint** status - same hard gates as merge-plan §2.1, plus the client roadmap from §2.2, the reverse-proxy + versioned-path topology from §2.3, and the curl-first testability gate from §2.4.
  - §3 Vocabulary: remove `Run` entry; add `AgentTask` (connector boundary type), `comment_dispatches` (sidecar table), `Harness` (connector kind), `connector_handle` (opaque blob).
  - §6 Data Model: remove `runs` table from entity overview + SQL schema; add `comment_dispatches` table; narrow `comments.metadata` purpose to presentation hints.
  - §10 Connector Interface: replace `Run` type with `AgentTask`/`AgentTaskHandle`; update `IReplicantConnector` signature to the shape in §4 of this plan; add `IPromptAssembler` boundary; add `events()` stream.
  - §6.4 (Run Status Flow): repurpose as `AgentTaskStatus` lifecycle, owned by the connector and surfaced via `dispatch row.status`.
  - §11 API Surface: rename all routes to `/api/v1/...`; document the proxy topology; note that the OpenAPI doc is the contract for **all** clients (web, native, mobile, CLI, agents) - not just the bundled React UI.
  - Note **ACP (Agent Client Protocol, https://agentclientprotocol.com/)** as primary outbound connector; **CopilotBridge** as legacy; **A2A** as a complementary inbound surface (not an outbound connector in the first cut). Include the ACP naming-collision note from §1 verbatim.

### Phase 1 - Repo and branch setup

- New long-lived integration branch on SCUT: `integration/cbk-merge`.
- Bill's worktrees feed into this branch. Sub-branches per port unit (one row in the table above per branch).
- CI runs full suite on `integration/cbk-merge` on every push.
- **Reverse-proxy dev topology**: add `infra/dev/` with a minimal Caddy or nginx config that fronts `scut-server` on `/api/v1/*` and the Vite dev server on everything else. Document `pnpm dev:proxy` as the alternate entrypoint.
- **API versioning**: rename existing routes from `/api/...` to `/api/v1/...`. Update OpenAPI doc. Add `/api/docs` for OpenAPI UI.
- **Smoke script**: create `scripts/smoke.sh` with the current Phase 1 endpoints. Every subsequent port unit adds to it.
- Merges to `main` happen only when an integration milestone (group of port units) is fully green AND the smoke script passes against a fresh instance.

### Phase 2 - Foundation port (units 1-4)

- Replicants table, replicant tokens, permissions, harness enum (`'acp'`, `'copilot-bridge'`).
- No connector code yet. Just the data + admin endpoints under SCUT vocabulary.
- **API-first gate**: every new endpoint added in this phase ships with a curl example in `docs/api/examples/` and a line in `scripts/smoke.sh`.

### Phase 3 - ACP connector (primary, port unit 6)

- Port `AcpSessionManager` from CBK into `packages/server/src/connectors/AcpConnector.ts`. Implements `IReplicantConnector`. Speaks the [Agent Client Protocol](https://agentclientprotocol.com/) as the **Client** per §4.2.
- Implements Client-side methods: `session/request_permission` (routes through SCUT permission system), `session/update` (each update becomes a Comment or appends to streaming Comment).
- Calls Agent-side methods: `initialize`, `session/new`, `session/prompt`, `session/cancel`. `session/load` if advertised.
- Reference harnesses for testing: Claude Code, Codex, Copilot CLI with `--acp`. At least two of the three must pass smoke tests before this phase is considered done.
- Encodes ACP `sessionId` + per-prompt invocation index into the opaque `connector_handle` on `comment_dispatches`.
- **Wait for Bob's bridge-authoritative-state refactor to settle** before porting; we want the improved version, not the current one.
- Lands with full `IReplicantConnector` test coverage and curl-exercisable dispatch endpoint.

### Phase 4 - CopilotBridge legacy connector (port unit 8)

- Wrap the existing CBK WS code as `CopilotBridgeConnector`. Mark deprecated in code comments and spec.
- Goal: preserve continuity for users running the current bridge.
- Sunset target: when ACP covers the same harnesses bridge currently serves.

### Phase 5 - A2A inbound surface (optional, deferred)

- Build the inbound A2A server surface per §4.3 at `/api/v1/a2a/...`.
- Maps A2A `Message` → SCUT Comment, A2A `Task` → SCUT Thread + `comment_dispatches` row.
- Complementary to ACP, not a replacement. Lets A2A-speaking external agents post / assign / hand off work to SCUT.
- Authentication uses the existing replicant-token model.
- Deferred until at least Phase 3 (ACP) and Phase 4 (CopilotBridge) are stable. Optional - SCUT works without it.

### Phase 6 - UI port (unit 9)

- Port admin UI under SCUT vocabulary.
- Apply the layered-prompt / instruction-node model from `scut-pm-experience.md`.
- Design-system pass before UI work begins (per AGENTS.md convention).

### Phase 7 - Sunset

- Mark `CopilotBridgeConnector` deprecated.
- Archive or rebrand `copilot-bridge-kanban` repo (decision: keep as historical reference or archive). Defer until SCUT has feature parity.

## 7. Open Questions

1. **Where does the prompt assembler live?** A separate package (`packages/prompt-assembler`) or inside `packages/server`? Prompt assembler walks the node tree and produces the input passed to `IReplicantConnector.dispatch`. Recommended: separate package so a CLI can use it too.
2. **ACP capability scope.** Which optional ACP capabilities does SCUT advertise as Client? Phase 3 starts with `session/request_permission` + `session/update` only. `fs/*` and `terminal/*` are deferred. Decision needed before Phase 3.5 on whether SCUT exposes filesystem to agents (and under what workspace model).
3. **A2A authentication mapping.** A2A spec auth modes vs SCUT's JWT + replicant-token model - need a mapping. Out of scope for this doc; resolve in Phase 5 if/when we build the inbound surface.
3. **Repo rename.** Should `copilot-bridge-kanban` be archived after sunset, or transferred to eridanilabs as `scut-legacy-bridge` for history? Defer.
4. **Test corpus.** CBK has a strong test suite. We should pull in test cases (not test code) as fixtures for SCUT's port.
5. **Migration of live data.** If anyone is running CBK in production with data they care about, do we provide a CBK→SCUT data migration tool? Defer until someone asks.

## 8. Non-goals

- Forking CBK. We pull, not fork.
- Maintaining feature parity with CBK on the CBK side. CBK continues to be Bob's playground for bridge-side experiments; SCUT is the long-term home.
- Building a third outbound connector before ACP (primary) is solid across the reference harnesses.
- Touching `copilot-bridge` itself in this plan. Bridge work happens under Bob's plan (`research/bridge-authoritative-session-state.md`).

## 9. References

- SCUT spec: `docs/spec/spec.md`
- SCUT phase-1 detail: `docs/spec/phase-1/`
- Research (PM experience): dark-factory `research/scut-pm-experience.md` (4-surfaces → nested → unified-node + instructions)
- Research (bridge state): bill workspace `research/bridge-authoritative-session-state.md`
- Beads: `bill-233` (SCUT migration epic)
