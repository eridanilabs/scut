# SCUT - Research and Architecture

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Prior Art](#2-prior-art)
3. [Protocol Landscape](#3-protocol-landscape)
4. [Reference Implementations](#4-reference-implementations)
5. [Bobiverse Inspiration](#5-bobiverse-inspiration)
6. [SCUT Design Decisions](#6-scut-design-decisions)

---

## 1. Problem Statement

### The Multi-Agent Island Problem

AI-assisted development has fragmented into a set of powerful but isolated tools. GitHub Copilot CLI, Claude Code, OpenAI Codex, Gemini CLI, and a growing list of alternatives each operate as independent execution environments. Each has its own invocation model, state storage, session concept, and output format. None of them natively knows about the others.

This creates a coordination tax. A developer working with multiple agent harnesses must manually:

- Track which tasks have been assigned to which agent
- Poll or re-read chat history to determine task progress
- Copy context between sessions when switching agents
- Reconstruct history when a session is lost or a model is swapped

The problem compounds in team settings. When multiple engineers are each using their own agent harnesses on a shared codebase, there is no shared view of what is being worked on, what is blocked, or what has been completed. Work duplicates. Context scatters. The agents are powerful in isolation and blind to each other.

### What is Missing

The gap is not a better agent. It is a **coordination plane**: a layer that sits above individual agent harnesses and provides:

1. A shared, persistent record of work (tasks, not sessions)
2. A uniform interface to dispatch work to any registered agent
3. A view (the board) where humans and agents can see the state of everything
4. An async result pathway so the agent harness does not need to stay connected

This is exactly what SCUT is.

SCUT does not run inference. It does not wrap a model. It does not replace any agent harness. It is the routing and tracking layer that lets distributed agent instances coordinate on shared work.

---

## 2. Prior Art

Three prior projects from `raykao/dark-factory` established the building blocks. Each got something right and something wrong.

### 2.1 copilot-bridge-kanban

**What it is:** A standalone kanban application (React + Fastify + SQLite) where copilot-bridge acts as a stateless execution backend. Cards represent tasks. The user creates a card, assigns it to the bridge, and the bridge processes it and returns a result. The card updates in place.

**What it got right:**
- The data model is correct. Cards (tasks) are persistent. The agent invocation is stateless and transient. Keeping these two concerns separate is the right architecture.
- The kanban metaphor is the right UX. Status columns (idea, ready, in-progress, done) map directly to how humans think about work distribution.
- Fastify + SQLite is an appropriate stack for this problem: low overhead, embeddable, easy to run locally.

**What it got wrong:**
- It assumed copilot-bridge is the only backend. The card model has a hard dependency on the bridge's specific invocation interface. Adding a second agent harness would require restructuring the backend.
- It conflated "the board app" with "the bridge integration." The bridge should be one connector among many.

**SCUT's correction:** The kanban model is preserved and generalized. The agent backend is abstracted behind a `IBobConnector` interface. copilot-bridge becomes `CopilotBridgeBob` - one connector implementation, not the whole system.

### 2.2 inter-agent-task-handoff

**What it is:** A protocol spec for async task handoff using `delegate_task` and `check_task` operations. The caller fires a task to a remote agent and periodically polls for results. Designed around fire-and-forget semantics: the caller does not block waiting for a result.

**What it got right:**
- The async pattern is correct. Agent tasks are long-running. Blocking on synchronous responses is the wrong model.
- `delegate_task` / `check_task` maps cleanly onto the Run concept: dispatch creates a Run, check reads its status.
- Fire-and-forget with a callback or poll-based result retrieval is operationally honest about how LLM invocations work.

**What it got wrong:**
- It was scoped to bridge-internal communication. The spec describes agent-to-agent handoff within copilot-bridge's own multi-agent features.
- It did not include a persistent store. Without persistence, task state lives only in memory and is lost on restart.

**SCUT's correction:** The `delegate_task` / `check_task` pattern becomes SCUT's `dispatch` / Run status model. The Run record is persisted. Results come back via `POST /api/internal/runs/:id/result`. The pattern is generalized to any connector, not just bridge-to-bridge.

### 2.3 work-board

**What it is:** A Mattermost-native dashboard that aggregates agent state from multiple sources into a single view. Posts updates to a Mattermost channel. Designed for teams that already use Mattermost as their communication hub.

**What it got right:**
- The aggregated board view is the right UX for multi-agent oversight. One place to see everything.
- Treating the board as a read surface that reflects state from multiple sources (rather than a source of truth itself) is architecturally sound.
- The idea of surfacing agent work in a communication tool where the human already lives reduces context switching.

**What it got wrong:**
- Mattermost is not universal. Locking the board to Mattermost means teams not using Mattermost cannot use it.
- The board was a view-only surface. It did not support dispatch (assigning work to agents from the board).

**SCUT's correction:** The Moot is the generalized board. It is a first-class React application, not a Mattermost plugin. It reads state from SCUT's own API. In the future, SCUT can push updates to Mattermost, Slack, or other surfaces - but the board is not dependent on any of them.

### 2.4 Summary Table

| Project | Got right | Got wrong | SCUT's correction |
|---|---|---|---|
| copilot-bridge-kanban | Card model, kanban UX, Fastify+SQLite stack | Hard-coded bridge backend | `IBobConnector` adapter interface |
| inter-agent-task-handoff | Async fire-and-forget, delegate+check pattern | Bridge-internal scope, no persistence | Run record, persisted state, callback endpoint |
| work-board | Aggregated board view, communication-surface idea | Mattermost lock-in, view-only | Moot as standalone React app with dispatch capability |

---

## 3. Protocol Landscape

### 3.1 Overview

Two agent interoperability protocols have emerged from the Linux Foundation AI and Data ecosystem:

- **A2A (Agent-to-Agent):** Backed by Google and a broad cross-vendor coalition. Designed for cloud-native, cross-organization agent communication. Uses HTTP + JSON-LD with capability negotiation, agent cards, and task lifecycle management.
- **ACP (Agent Communication Protocol):** Backed by IBM and BeeAI. Designed for local-first, edge-compatible, and offline-capable scenarios. REST-based with multimodal message support and a simpler deployment model.

Both are in active development. Neither is a clear winner. The two protocols address different deployment contexts rather than competing directly.

### 3.2 A2A

A2A's key design choices:

- **Agent Cards:** Each agent publishes a machine-readable description of its capabilities (name, skills, input/output types, auth requirements).
- **Task lifecycle:** A2A defines a standard task state machine (submitted, working, completed, failed, cancelled) that maps closely to SCUT's Run status.
- **Streaming:** A2A supports SSE-based streaming for real-time partial results.
- **Auth:** Designed for cross-organization deployment with OAuth and API key support.

A2A is well suited to `A2ABob`: a SCUT connector that routes a Run to a remote A2A-compatible agent. The connector translates SCUT's Run into an A2A task submission and receives the result via A2A's callback or poll mechanism.

**A2A is appropriate when:** the Bob lives in a different organization's infrastructure, when capability negotiation matters, or when the deployment environment is cloud-native.

### 3.3 ACP

ACP's key design choices:

- **Local-first:** ACP is designed to work without cloud connectivity. Agents run on the same machine or local network.
- **Multimodal:** ACP's message model supports text, images, and binary content in a single message.
- **Simpler wire format:** REST + JSON without the JSON-LD overhead of A2A.
- **Agent discovery:** Local service discovery rather than internet-hosted agent directories.

ACP is well suited to `ACPBob`: a SCUT connector for locally-running agent services (a local LLM, an on-premises automation service, an edge device).

**ACP is appropriate when:** the Bob runs on the same machine or local network, when offline capability matters, or when deployment simplicity is a priority.

### 3.4 MCP (Model Context Protocol)

MCP is orthogonal to both A2A and ACP. Where A2A and ACP are about agent-to-agent task coordination, MCP is about tool-calling: giving a model structured access to external data and functions (file system, databases, APIs, browser).

SCUT operates at the coordination layer, above MCP. A Bob running inside copilot-bridge or Claude Code may use MCP internally to call tools during a Run. SCUT does not care. From SCUT's perspective, a Run is dispatched to a Bob and a result comes back. What happens inside the Bob (including any MCP tool calls) is the Bob's concern.

### 3.5 SCUT's Position

```
+----------------------------------+
|         Human operator           |
|         SCUT Moot (UI)           |
+----------------------------------+
|         SCUT server              |
|  Thread / Run / Message / Bob    |
+----------------------------------+
|       Connector interface        |
|  IBobConnector                   |
+----------+----------+------------+
           |          |
    +------+--+  +----+----+  +----+----+
    |CopilotBob|  | A2ABob  |  | ACPBob  |
    |subprocess|  | HTTP+A2A|  | HTTP+ACP|
    +----------+  +---------+  +---------+
           |          |              |
      copilot-   remote A2A     local ACP
      bridge     agent         agent
```

A2A and ACP are transport options behind SCUT's connector interface. A team can run `CopilotBridgeBob` for local Copilot work, `A2ABob` for a cloud-hosted specialist agent, and `ACPBob` for a local LLM - all on the same SCUT board, tracked in the same Thread history.

The connector choice is per-Bob, not per-system. SCUT does not pick a protocol. Each Bob connector picks the protocol appropriate for the harness it wraps.

---

## 4. Reference Implementations

### 4.1 Hermes (Nous Research)

Hermes is an open-source multi-agent framework that demonstrates a three-tier design:

1. **Interfaces layer:** Abstract base classes defining what an agent, a tool, and a memory store look like. No implementation here, only contracts.
2. **Core agent loop:** The reasoning loop (plan, act, observe, reflect) implemented against the interfaces. Harness-agnostic.
3. **Execution backends:** Concrete implementations for specific models and tool providers. Swapped in via configuration.

Hermes also publishes an ACP adapter, making it ACP-accessible from outside. A Hermes agent can receive a task via ACP, execute it using its internal loop, and return the result via ACP.

**What SCUT learns from Hermes:**
- The interface/implementation separation is correct and SCUT uses the same pattern (`IBobConnector` as the interface, `CopilotBridgeBob` etc. as implementations).
- ACP as an integration surface validates SCUT's `ACPBob` connector plan.

**How SCUT differs from Hermes:**
- Hermes is an agent framework. It runs the reasoning loop. SCUT is not. SCUT does not reason, plan, or execute. It routes and tracks.
- Hermes does not have a board/coordination view. It is a framework for building agents, not for coordinating between them.
- SCUT treats a Hermes instance as a potential Bob. SCUT dispatches work to it via `ACPBob`. What Hermes does internally is opaque to SCUT.

### 4.2 The Coordination Plane Concept

The general pattern SCUT follows has precedents in non-AI software:

- **Message queues (Kafka, RabbitMQ):** Persistent, ordered log of work items. Producers and consumers are decoupled. SCUT's Thread/Run model is a domain-specific version of this.
- **CI/CD coordinators (Tekton, Argo Workflows):** A graph of tasks dispatched to workers. The coordinator tracks state; workers execute. SCUT is this pattern applied to AI agent harnesses.
- **Kanban boards (Jira, Linear, GitHub Projects):** Persistent card-based work tracking with status transitions. SCUT's Moot is a kanban board where the "assignees" are AI agents.

SCUT is the intersection of these patterns, domain-specific to AI agent harnesses: a persistent task queue with a kanban view and a uniform dispatch interface.

---

## 5. Bobiverse Inspiration

### 5.1 The Source Material

The Bobiverse series (Dennis E. Taylor, beginning with *We Are Legion (We Are Bob)*) follows Bob Johansson, a software engineer who is killed in a car accident and wakes up as a Von Neumann probe: a self-replicating AI spacecraft. Bob can copy himself, and each copy diverges over time, developing different specializations and personalities. The copies coordinate loosely, sharing information and delegating tasks to whichever instance is best positioned to handle them.

SCUT is named after one of the technologies in the books: the Subspace Communications Universal Transceiver, which is the backbone that allows geographically distributed Bob instances to communicate faster than light. Without SCUT, each Bob is an island. With SCUT, they form a loosely-coupled network.

### 5.2 Why the Analogy is Not Just Cosmetic

The Bobiverse pattern maps directly to multi-agent AI development:

| Bobiverse | SCUT (the app) |
|---|---|
| Bob (a Von Neumann probe instance) | A registered agent harness instance |
| SCUT (the FTL comm backbone) | The coordination plane (this app) |
| Thread (a task Bob works on) | A Thread in the task board |
| Moot (the meeting where Bobs coordinate) | The board/dashboard UI |
| Run (one Bob working on a problem) | One invocation of a Bob against a Thread |
| Forking a new Bob | Spinning up a new agent connector instance |

In the books, Bobs specialize: some become engineers, some become explorers, some become diplomats. A task is dispatched to whichever Bob has the right specialization and capacity. Results come back asynchronously because the distances are large and the communication latency is real.

In SCUT, agent harnesses specialize: copilot-bridge is good at code in the current workspace, Claude Code is good at long-context reasoning, a subprocess Bob might run a specialized local model fine-tuned for a specific domain. A Thread is dispatched to whichever Bob is assigned to it. Results come back asynchronously because LLM inference is slow and the agent may need to run for minutes or hours.

The analogy holds at every level. The vocabulary is precise, not decorative.

### 5.3 What the Vocabulary Signals

Using Bobiverse vocabulary is a deliberate design choice with a practical effect: it avoids collision with existing terminology in the AI agent ecosystem. "Agent," "task," "session," "run," "worker," and "job" all have overloaded meanings across different frameworks. "Bob," "Thread," "Moot," and "Run" are unambiguous within the SCUT context. Anyone who knows the books understands the system model immediately. Anyone who does not knows to look up the glossary rather than assume a meaning.

---

## 6. SCUT Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| State ownership | SCUT owns Thread, Run, Message, Bob records | Agent harnesses are stateless or ephemeral. The coordination plane must own persistence. The harness should not be the system of record for task state. |
| Connector interface | `IBobConnector` thin adapter per harness type | Isolates harness-specific logic. Adding a new Bob type requires only a new class implementing the interface, not changes to the core. |
| Protocol choice | Per-connector (A2A / ACP / HTTP callback / subprocess) | No single protocol fits all deployment contexts. Cloud agents, local agents, and subprocess agents have different operational requirements. Forcing one protocol would exclude valid use cases. |
| Vocabulary | Bobiverse-aligned (Bob, Thread, Moot, Run) | Avoids term collision with existing AI frameworks. Precise within the domain. Signals the design model to people familiar with the source material. |
| Runtime | TypeScript monorepo (server + UI share types) | TypeScript gives end-to-end type safety across the API boundary. npm workspaces keeps the repo manageable without requiring a separate build tool (Nx, Turborepo) at MVP. |
| Database | SQLite via better-sqlite3 | Embedded, zero-infrastructure, queryable. Appropriate for a tool that may run on a developer's laptop. Can be swapped for Postgres in a team deployment if needed. |
| Server | Fastify | Low overhead, schema-based validation, good TypeScript support. Matches the copilot-bridge-kanban prior art. |
| UI | React + Vite | Standard, fast iteration, large ecosystem. The Moot does not need anything exotic. |
| Run result pathway | Callback: `POST /api/internal/runs/:id/result` | Fire-and-forget dispatch means the connector cannot return the result synchronously. A callback endpoint allows the connector to post results when they arrive, without holding an open connection. |
| SSE for real-time | `GET /api/threads/:id/events` SSE stream | Lower overhead than WebSockets for the read-heavy, server-push pattern of board updates. Works natively with Fastify and browsers. |
