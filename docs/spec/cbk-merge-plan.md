# CBK → SCUT Merge Plan

Status: draft 2
Owner: bill (eridanilabs)
Branch: `bill/docs/cbk-merge-plan`
Related: `docs/spec/spec.md`, dark-factory `research/scut-pm-experience.md`

### Revision log

- **draft 2 (2026-05-25)**: Drop `Run` as a SCUT-domain entity. Adopt A2A's `Task` (typed `AgentTask` at the interface boundary) as the connector-domain word. Add `comment_dispatches` sidecar table for dispatch lifecycle; reserve `comments.metadata` for presentation hints. Reverse the "do not port" call on CBK migration 015 (drop runs) - they were right. Collapse two-field connector ID design into one opaque `connector_handle`. Rewrites: §3.1, §3.3, §3.4, §4, §5.
- **draft 1 (2026-05-25)**: Initial nomenclature + phase plan.

## 1. Purpose

`copilot-bridge-kanban` (CBK) is a working kanban + agent-chat surface built on top of `copilot-bridge` via a custom WebSocket channel. SCUT is the canonical eridanilabs coordination plane and already has a published spec (`docs/spec/spec.md`) that goes further than CBK on data model and connector strategy. Going forward:

- **SCUT** owns all PM/UI/coordination surfaces, the data model, and the connector interface.
- **copilot-bridge** stops exposing a bespoke channel for SCUT. It remains an agent harness behind one (legacy) connector implementation.
- The primary protocol going forward is **A2A** (Google Agent-to-Agent), with **ACP** as a compatibility target for Claude / Codex / GHCP-CLI style local harnesses.
- CBK's existing repo continues to be developed by Bob in the short term (it ships features today). This plan is for bringing the useful pieces of CBK into SCUT branch-by-branch on a new SCUT integration branch, not for forking CBK.

## 2. Hard Constraints

1. **Thread-domain IDs are separate from agent-domain IDs.** A `thread.id` is owned by SCUT. An agent-side session / task / connection identifier is owned by the connector. They are related via the opaque `connector_handle` column on the SCUT-owned `comment_dispatches` row, never by overloading one ID for both. SCUT never parses connector handles.
2. **Bridge is unaware of SCUT's presentation choices.** Layered prompts, instruction nodes, nested comment streams, board-level system prompts - all of that is assembled by SCUT before dispatch. Connectors receive opaque prompt strings + structured context. (Carries forward the boundary from `research/bridge-authoritative-session-state.md` and `research/scut-pm-experience.md`.)
3. **SCUT spec is the source of truth.** Where CBK and SCUT-spec disagree on naming, SCUT-spec wins unless the spec is wrong. Disagreements must result in either a spec amendment PR or a CBK→SCUT rename in the port.
4. **No bespoke `copilot-bridge` channel in the long run.** The existing custom WS adapter becomes one optional connector (`CopilotBridgeConnector`, already named in spec §3) that we keep for migration, not extend.

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
| Connector-side work unit | `session_id` / `acp_session_id` / would-be `a2a_task_id` | (none) | **`AgentTask`** (interface type) | Connector boundary | Aligns with A2A's `Task` (the industry-standard word). Typed `AgentTask` in IReplicantConnector to avoid colliding with kanban "task" in any UI text. Connector returns an `AgentTaskHandle` from `dispatch`; SCUT stores it opaquely in `comment_dispatches.connector_handle` and passes it back for `cancel` / `status`. |
| Registered agent | `agent` (DB table `agents`) | `Replicant` | **Replicant** (DB, API), "Agent" (UI label) | Both | SCUT spec §3 is explicit. "Agent" stays as the user-facing word; `replicant_id` is the column name. |
| Connector implementation kind | `provider` (with `type IN ('acp', 'copilot-bridge', 'a2a')`) | `harness` / `Connector` | **Connector** (interface), **Harness** (connector kind) | Both | SCUT calls the interface `IReplicantConnector`. CBK's `provider` row maps to: one `Connector` instance, parameterized by `harness` kind. Rename `providers` → `connectors`. |
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
| Connector kind picker | "Provider Type" | (not specified) | **"Harness"** (e.g. "A2A", "ACP", "Copilot Bridge") |

### 3.3 Why these choices

- **Thread over Card (backend), Card stays as default UI label.** Thread is more accurate (it carries history, branching, and agent session semantics) but "card" is what users see on a kanban. Keep both; the `board.item_singular` field already supports this per board.
- **Connector over Provider.** Two reasons: (1) SCUT spec already says "connector" everywhere; (2) "provider" collides with the OAuth/identity sense in many ecosystems. Harness is the *type* of connector ("a2a", "acp", "copilot-bridge").
- **Replicant stays as a real word in the DB.** It is the only term that makes the polymorphic assignee field (`assignee_type IN ('user', 'replicant')`) read cleanly. UI says "Agent".
- **No `Run` in SCUT-domain.** "Run" is an agent-side concept (OpenAI Assistants popularized it; A2A uses "Task"; ACP uses "session+prompt"). SCUT-core does not need a noun for "the thing the agent is doing right now" - SCUT cares about *the comment that triggered it* and *the lifecycle of that dispatch*. Everything that CBK's `runs` table held splits cleanly into: triggering Comment (input, author, time), response Comments (output), `comment_dispatches` row (status, timing, error, opaque handle). CBK migration 015 was right to drop the table; this plan follows them.
- **`AgentTask` at the connector boundary.** Adopts A2A's primary noun (`Task`). Typed `AgentTask` in the interface to avoid colliding with kanban "task" if it ever surfaces in UI text. ACP's `session/prompt` and the legacy bridge's session model both map onto this single type behind their respective connectors.
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
| A2A `Task.id`, A2A `Context.id` | A2A server | Per A2A spec | Encoded inside `connector_handle` by `A2AConnector` |
| ACP session ID + prompt index | ACP server | Per ACP spec | Encoded inside `connector_handle` by `AcpConnector` |
| Bridge session ID | copilot-bridge | Bridge's choice | Encoded inside `connector_handle` by `CopilotBridgeConnector` |

The general rule: **SCUT-side IDs live in named columns. Connector-side IDs live inside an opaque `connector_handle` blob.** SCUT never parses the handle; it round-trips it to the connector for `cancel(handle)` and `status(handle)`. The connector kind is recoverable via the `replicant` referenced by the dispatch row, so the right decoder is always findable.

### 3.5 Dispatch lifecycle vs presentation hints (the cleanup of `comments.metadata`)

CBK migration 016 added a `metadata` JSON column to `card_comments`. SCUT keeps that column but narrows its purpose:

| Where it goes | Why |
|---|---|
| `comment_dispatches` row (sidecar) | Anything SCUT may need to **query** or **filter on**: status, replicant_id, timing, error class, opaque connector handle |
| `comments.metadata` (JSON) | Anything that is **only ever rendered**: tool-call collapsible blocks, partial tokens during streaming, citation footnotes, custom UI badges |

Rule of thumb: if a backend cron / dashboard / "stuck task sweeper" would ever want to `SELECT ... WHERE x = ?` on it, it belongs in `comment_dispatches`. If only the UI ever looks at it, it belongs in `comments.metadata`.

## 4. Connector Interface Evolution

`IReplicantConnector` (spec §10) stays the contract. Three concrete connectors at the end of this work:

| Connector | Status | Harness kind | Notes |
|---|---|---|---|
| `A2AConnector` | **primary, new** | `a2a` | Built fresh on the Google A2A spec. Used for: GHCP CLI agents, Claude when wrapped, any A2A-capable remote agent. |
| `ACPConnector` | secondary, ported | `acp` | Ported from CBK's `AcpSessionManager`. Covers local stdio harnesses (Claude Code, Codex). |
| `CopilotBridgeConnector` | legacy, migration-only | `copilot-bridge` | Ported from the current custom WS channel. Marked deprecated. Kept until A2A coverage of bridge-fronted agents is verified, then removed. |

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
| 1 | `migrations/017-providers-add-a2a-type.ts` | `replicants.harness` enum | One-line schema change in SCUT. |
| 2 | `src/server/agents-db.ts`, `agents.ts` | `replicants` repo + routes | Rename agent→replicant, provider→harness/connector. |
| 3 | `src/server/agent-tokens.ts` + migrations 008-009 | `replicant_tokens` table + auth path | API-key auth for agents calling back. |
| 4 | `src/server/agent-permissions.ts` + migrations 012-013 | `replicant_permissions` + `thread_permissions` | Permission model. |
| 5 | `src/server/card-routes.ts` per-card chat endpoints | `thread` comment + dispatch endpoints | Already exists in SCUT phase-2 plan; align shapes. |
| 6 | `src/server/acp-session-manager.ts` | `packages/server/src/connectors/AcpConnector.ts` (implements `IReplicantConnector` returning `AgentTaskHandle`) | The piece Bob is currently rewriting per `research/bridge-authoritative-session-state.md`. Wait for that work to land, then port the improved version. ACP session ID + prompt index get encoded into the opaque `connector_handle`. |
| 7 | `src/server/card-session-manager.ts` | Replaced by `comment_dispatches` table + connector `events()` stream | Do not port as-is. The "what's in flight, what tokens have we seen" state moves to SCUT's dispatch row + connector event stream. |
| 8 | `src/server/bridge-stream.ts` | `packages/server/src/connectors/CopilotBridgeConnector.ts` | Wrap as the legacy connector. Bridge session ID becomes part of `connector_handle`. Do not extend. |
| 9 | Admin UI (SettingsPage, agent token manager) | `packages/ui/src/admin/` | Rebrand provider→connector, agent→replicant. |
| 10 | `migration 014-cards-session-transcript.ts` + `last_rendered_turn_index` | Replaced by `comment_dispatches` lifecycle + comment ordering | Do not port the transcript column or the render-cursor column. SCUT reconstructs view state from comments + dispatch rows directly. |

Pieces in CBK that we explicitly **do not** port:

- The custom WebSocket channel handshake. Replaced by A2A.
- The single-slot `pendingPermission` design in `AcpSessionManager`. Bob's refactor replaces it.
- The `last_rendered_turn_index` column on cards. Replaced by `comment_dispatches` + comment ordering.
- The `cards.session_id` column. Replaced by `comment_dispatches.connector_handle`. (Multiple dispatches per thread, each with its own handle - matches the cancellation / retry / parallel-dispatch goals in SCUT spec phase 5.)

Pieces from CBK we explicitly **do** follow:

- Migration 015 (drop `runs` table). They were right; SCUT-core does not need a `runs` entity. See §3.3.
- Migration 016 (`card_comments.metadata`). We keep the column, but narrow its purpose to presentation hints only (see §3.5).
- Migration 017 (add `'a2a'` to provider type enum). Becomes part of SCUT's `replicants.harness` enum.

## 6. Phase Plan

Each phase ends in a green CI build on SCUT main. No CBK code lands on SCUT main until renamed to SCUT vocabulary and covered by tests.

### Phase 0 - Spec alignment (this PR)

- Land this document.
- One spec-amendment PR (separate) updating `docs/spec/spec.md`:
  - §3 Vocabulary: remove `Run` entry; add `AgentTask` (connector boundary type), `comment_dispatches` (sidecar table), `Harness` (connector kind), `connector_handle` (opaque blob).
  - §6 Data Model: remove `runs` table from entity overview + SQL schema; add `comment_dispatches` table; narrow `comments.metadata` purpose to presentation hints.
  - §10 Connector Interface: replace `Run` type with `AgentTask`/`AgentTaskHandle`; update `IReplicantConnector` signature to the shape in §4 of this plan; add `IPromptAssembler` boundary; add `events()` stream.
  - §6.4 (Run Status Flow): repurpose as `AgentTaskStatus` lifecycle, owned by the connector and surfaced via `dispatch row.status`.
  - Note A2A as primary connector, ACP secondary, CopilotBridge legacy.

### Phase 1 - Repo and branch setup

- New long-lived integration branch on SCUT: `integration/cbk-merge`.
- Bill's worktrees feed into this branch. Sub-branches per port unit (one row in the table above per branch).
- CI runs full suite on `integration/cbk-merge` on every push.
- Merges to `main` happen only when an integration milestone (group of port units) is fully green.

### Phase 2 - Foundation port (units 1-4)

- Replicants table, replicant tokens, permissions, harness enum incl. `a2a`.
- No connector code yet. Just the data + admin endpoints under SCUT vocabulary.

### Phase 3 - A2A connector (new)

- Build `A2AConnector` from scratch against A2A spec, not by copying CBK.
- Reference implementation target: GHCP CLI A2A endpoint (when available) or a stub A2A server for tests.
- Lands with full IReplicantConnector test coverage.

### Phase 4 - ACP connector port (unit 6)

- Wait for Bob's bridge-authoritative-state refactor on CBK to settle.
- Port the post-refactor `AcpSessionManager` shape into `AcpConnector`.
- Cover stdio harnesses: Claude Code, Codex.

### Phase 5 - CopilotBridge legacy connector (unit 8)

- Wrap the existing CBK WS code as `CopilotBridgeConnector`. Mark deprecated in code comments and spec.
- Goal: preserve continuity for users running the current bridge.
- Sunset target: when A2A covers the same harnesses.

### Phase 6 - UI port (unit 9)

- Port admin UI under SCUT vocabulary.
- Apply the layered-prompt / instruction-node model from `scut-pm-experience.md`.
- Design-system pass before UI work begins (per AGENTS.md convention).

### Phase 7 - Sunset

- Mark `CopilotBridgeConnector` deprecated.
- Archive or rebrand `copilot-bridge-kanban` repo (decision: keep as historical reference or archive). Defer until SCUT has feature parity.

## 7. Open Questions

1. **Where does the prompt assembler live?** A separate package (`packages/prompt-assembler`) or inside `packages/server`? Prompt assembler walks the node tree and produces the input passed to `IReplicantConnector.dispatch`. Recommended: separate package so a CLI can use it too.
2. **A2A authentication.** A2A spec auth modes vs SCUT's JWT model - need a mapping. Out of scope for this doc; first thing to resolve in Phase 3.
3. **Repo rename.** Should `copilot-bridge-kanban` be archived after sunset, or transferred to eridanilabs as `scut-legacy-bridge` for history? Defer.
4. **Test corpus.** CBK has a strong test suite. We should pull in test cases (not test code) as fixtures for SCUT's port.
5. **Migration of live data.** If anyone is running CBK in production with data they care about, do we provide a CBK→SCUT data migration tool? Defer until someone asks.

## 8. Non-goals

- Forking CBK. We pull, not fork.
- Maintaining feature parity with CBK on the CBK side. CBK continues to be Bob's playground for bridge-side experiments; SCUT is the long-term home.
- Building a fourth connector before A2A is solid.
- Touching `copilot-bridge` itself in this plan. Bridge work happens under Bob's plan (`research/bridge-authoritative-session-state.md`).

## 9. References

- SCUT spec: `docs/spec/spec.md`
- SCUT phase-1 detail: `docs/spec/phase-1/`
- Research (PM experience): dark-factory `research/scut-pm-experience.md` (4-surfaces → nested → unified-node + instructions)
- Research (bridge state): bill workspace `research/bridge-authoritative-session-state.md`
- Beads: `bill-233` (SCUT migration epic)
