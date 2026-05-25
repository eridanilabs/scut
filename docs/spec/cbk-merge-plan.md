# CBK → SCUT Merge Plan

Status: draft 1
Owner: bill (eridanilabs)
Branch: `bill/docs/cbk-merge-plan`
Related: `docs/spec/spec.md`, dark-factory `research/scut-pm-experience.md`

## 1. Purpose

`copilot-bridge-kanban` (CBK) is a working kanban + agent-chat surface built on top of `copilot-bridge` via a custom WebSocket channel. SCUT is the canonical eridanilabs coordination plane and already has a published spec (`docs/spec/spec.md`) that goes further than CBK on data model and connector strategy. Going forward:

- **SCUT** owns all PM/UI/coordination surfaces, the data model, and the connector interface.
- **copilot-bridge** stops exposing a bespoke channel for SCUT. It remains an agent harness behind one (legacy) connector implementation.
- The primary protocol going forward is **A2A** (Google Agent-to-Agent), with **ACP** as a compatibility target for Claude / Codex / GHCP-CLI style local harnesses.
- CBK's existing repo continues to be developed by Bob in the short term (it ships features today). This plan is for bringing the useful pieces of CBK into SCUT branch-by-branch on a new SCUT integration branch, not for forking CBK.

## 2. Hard Constraints

1. **Thread-domain IDs are separate from agent-domain IDs.** A `thread.id` is owned by SCUT. A session / connection / agent-side run identifier is owned by the connector. They are related via a join column on the Run row (or a sidecar table), never by overloading one ID for both.
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
| Comment / message on a thread | `card_comments` | `Comment` | **Comment** | Both | Same. CBK already added `metadata` column (migration 016) which matches what SCUT needs for the nested/instruction node model. |
| Agent invocation | `run` (table dropped in CBK migration 015 in favor of card.session_id) | `Run` | **Run** | Both | SCUT keeps Run as a first-class entity (spec §10). The CBK move to drop `runs` was a local simplification; we restore Run on the SCUT side because it carries status, input/output, error, and timing - those don't fit cleanly on a Thread. |
| Registered agent | `agent` (DB table `agents`) | `Replicant` | **Replicant** (DB, API), "Agent" (UI label) | Both | SCUT spec §3 is explicit. "Agent" stays as the user-facing word; `replicant_id` is the column name. |
| Connector implementation kind | `provider` (with `type IN ('acp', 'copilot-bridge', 'a2a')`) | `harness` / `Connector` | **Connector** (interface), **Harness** (connector kind) | Both | SCUT calls the interface `IReplicantConnector`. CBK's `provider` row maps to: one `Connector` instance, parameterized by `harness` kind. Rename `providers` → `connectors`. |
| Agent-side session | `session_id` (ACP / CLI session) | (not directly named) | **`connector_session_id`** | Backend | Explicit rename to make the boundary clear: it is *the connector's* session, not SCUT's. Stored on the Run row, not on the Thread. |
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
- **`connector_session_id` instead of `session_id`.** Forces the reader to remember whose session it is. Removes the ambiguity that caused the kanban silent-failure bug (`bill-f75`) where the bridge-side session and the SCUT-side state diverged invisibly.
- **Drop CBK's "runs table is dead" simplification.** CBK collapsed Run onto Card because in single-session-per-card mode the extra table felt redundant. SCUT supports multiple Runs per Thread (cancellation, retry, parallel dispatch in phase 5), so Run must stay.

### 3.4 ID boundaries (the hard constraint, in table form)

| ID | Owner | Lifetime | Where it lives |
|---|---|---|---|
| `thread.id` | SCUT | Forever; survives connector restarts, replicant swaps, harness migrations | `threads.id` |
| `run.id` | SCUT | One dispatch | `runs.id` |
| `replicant.id` | SCUT | Registration lifetime | `replicants.id` |
| `connector_session_id` | Connector | Connector's choice (may be reused, may be 1:1 with thread) | `runs.connector_session_id` (NOT on threads) |
| `connector_run_id` | Connector | Optional, connector-internal | `runs.connector_run_id` |
| `acp_session_id` | ACP server | Per ACP spec | Stored in `runs.connector_session_id` when harness is ACP. Not a separate column. |
| `a2a_task_id` | A2A server | Per A2A spec | Stored in `runs.connector_session_id` when harness is A2A. |

The general rule: SCUT-side IDs live in named columns. Connector-side IDs live in two generic columns (`connector_session_id`, `connector_run_id`) regardless of harness. The harness kind is in `replicants.harness`, so the meaning of those generic columns is always recoverable.

## 4. Connector Interface Evolution

`IReplicantConnector` (spec §10) stays the contract. Three concrete connectors at the end of this work:

| Connector | Status | Harness kind | Notes |
|---|---|---|---|
| `A2AConnector` | **primary, new** | `a2a` | Built fresh on the Google A2A spec. Used for: GHCP CLI agents, Claude when wrapped, any A2A-capable remote agent. |
| `ACPConnector` | secondary, ported | `acp` | Ported from CBK's `AcpSessionManager`. Covers local stdio harnesses (Claude Code, Codex). |
| `CopilotBridgeConnector` | legacy, migration-only | `copilot-bridge` | Ported from the current custom WS channel. Marked deprecated. Kept until A2A coverage of bridge-fronted agents is verified, then removed. |

Connector deltas vs current spec §10:

- Add `connector_session_id` and `connector_run_id` to the `Run` type for connector-side correlation.
- Add an optional `IPromptAssembler` boundary so SCUT can hand the connector a pre-assembled prompt string + structured turns, not just an `input: string`. Defined in the prompt-stack research doc.
- Add `events()` async iterator (or callback) so connectors can stream incremental output. CBK has this via the bridge stream; A2A has it natively; ACP has `session/update`.

## 5. What's in CBK that SCUT Needs

Pieces to port, in rough order of independence. Each becomes its own SCUT phase-2.x task / PR.

| # | CBK source | SCUT destination | Notes |
|---|---|---|---|
| 1 | `migrations/017-providers-add-a2a-type.ts` | `replicants.harness` enum | One-line schema change in SCUT. |
| 2 | `src/server/agents-db.ts`, `agents.ts` | `replicants` repo + routes | Rename agent→replicant, provider→harness/connector. |
| 3 | `src/server/agent-tokens.ts` + migrations 008-009 | `replicant_tokens` table + auth path | API-key auth for agents calling back. |
| 4 | `src/server/agent-permissions.ts` + migrations 012-013 | `replicant_permissions` + `thread_permissions` | Permission model. |
| 5 | `src/server/card-routes.ts` per-card chat endpoints | `thread` comment + dispatch endpoints | Already exists in SCUT phase-2 plan; align shapes. |
| 6 | `src/server/acp-session-manager.ts` | `packages/server/src/connectors/AcpConnector.ts` | The piece Bob is currently rewriting per `research/bridge-authoritative-session-state.md`. Wait for that work to land, then port the improved version, not the current one. |
| 7 | `src/server/card-session-manager.ts` | Folded into Run + Connector | Bob's bridge-authoritative refactor changes the shape of this. Port post-refactor. |
| 8 | `src/server/bridge-stream.ts` | `packages/server/src/connectors/CopilotBridgeConnector.ts` | Wrap as the legacy connector. Do not extend. |
| 9 | Admin UI (SettingsPage, agent token manager) | `packages/ui/src/admin/` | Rebrand provider→connector, agent→replicant. |
| 10 | `migration 014-cards-session-transcript.ts` + render-turn-index | Comment metadata + Run output stream | Use the unified node model + comment metadata; do not port the `last_rendered_turn_index` column verbatim - re-express it as a per-Run cursor. |

Pieces in CBK that we explicitly **do not** port:

- The CBK migration that drops the `runs` table (015). SCUT keeps Run.
- The custom WebSocket channel handshake. Replaced by A2A.
- The single-slot `pendingPermission` design in `AcpSessionManager`. Bob's refactor replaces it.

## 6. Phase Plan

Each phase ends in a green CI build on SCUT main. No CBK code lands on SCUT main until renamed to SCUT vocabulary and covered by tests.

### Phase 0 - Spec alignment (this PR)

- Land this document.
- One spec-amendment PR (separate) updating `docs/spec/spec.md` §3 with: `harness` term, `connector_session_id` field, A2A as primary connector, ACP secondary, CopilotBridge legacy.

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
