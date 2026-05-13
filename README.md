# SCUT - Structured Coordination Utility for Tasks

A coordination plane for multi-agent AI workflows.

---

SCUT is a kanban-style task routing and tracking layer that connects any number of AI agent harnesses (GitHub Copilot CLI, Claude Code, OpenAI Codex, Gemini, and others) behind a uniform interface. You create tasks (Threads), assign them to agent connectors (Bobs), and watch results arrive in a shared board (the Moot). SCUT does not run models or replace your existing tools - it is the backbone that lets distributed agent instances coordinate on shared work. The name comes from the Bobiverse sci-fi series by Dennis E. Taylor.

---

## The Bobiverse Connection

In Dennis E. Taylor's Bobiverse series, Bob Johansson is a self-replicating AI spacecraft. Bob copies himself endlessly, each instance diverging and specializing over time: some become engineers, some explorers, some diplomats. They coordinate across interstellar distances using SCUT - the subspace communications backbone that keeps distributed Bob instances in contact. This project borrows that name and repurposes the acronym - Structured Coordination Utility for Tasks - to describe the same coordination role applied to AI agent harnesses.

The analogy to multi-agent AI development is direct. Different agent harnesses (Copilot, Claude Code, a local LLM) are like different Bob instances: specialized, distributed, and capable of working in parallel. SCUT (the app) is the coordination backbone that lets them work on shared tasks without each being an island. The vocabulary is precise, not decorative: Bob, Thread, Moot, and Run each name a concept that maps exactly to the Bobiverse original.

---

## Core Concepts

**Bob** - A registered agent connector. One Bob per harness instance. A Bob wraps a specific tool (copilot-bridge, the claude CLI, a remote A2A agent) and exposes a uniform dispatch interface to SCUT. You can register as many Bobs as you have harness instances.

**Thread** - The unit of work. A Thread has a title, a description, a status (idea -> refining -> ready -> in_progress -> done), and a conversation history. Threads persist across sessions. When you assign a Bob to a Thread and add a message, SCUT dispatches a Run automatically.

**Moot** - The board view. In the Bobiverse, a Moot is the meeting where Bob instances coordinate. In SCUT, the Moot is the React dashboard where you see all Threads, their statuses, their assigned Bobs, and the results of recent Runs. It is the human-facing surface of the coordination plane.

**Run** - One invocation of a Bob against a Thread. A Run has a status (created -> queued -> running -> completed | failed | cancelled), the input sent to the Bob, and the output returned. All Runs for a Thread are stored in its history.

---

## Architecture

SCUT is a TypeScript monorepo with two packages:

- `packages/server` - Fastify backend. Owns the SQLite database, the REST API, the SSE event stream, and the connector registry.
- `packages/ui` - React + Vite frontend. The Moot board.

Bob connectors are adapter classes that implement `IBobConnector`. Adding support for a new agent harness means writing a new connector class - no changes to the core server.

```
Human -> Moot (React UI) -> SCUT Server (Fastify) -> IBobConnector
                                                         |
                                           CopilotBridgeBob | ClaudeCodeBob | A2ABob | ACPBob
                                                         |
                                               (agent harness)
```

For full architecture details, protocol landscape (A2A, ACP, MCP), and prior art analysis, see [docs/research/architecture.md](docs/research/architecture.md).

---

## Spec

The design specification covers the data model (SQL schema), connector interface, full REST API surface, planned connector implementations, and four-phase delivery plan.

See [docs/spec/spec.md](docs/spec/spec.md).

---

## Status

Alpha - early development. The monorepo scaffold and documentation are in place. Phase 1 (MVP) is in progress.

Planned connectors: CopilotBridgeBob (Phase 1), ClaudeCodeBob and A2ABob (Phase 3), ACPBob (Phase 4).

---

## License

MIT
