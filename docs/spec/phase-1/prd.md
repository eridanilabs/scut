# SCUT Phase 1 - Product Requirements

## Goal

Deliver a working coordination board (the Moot) where a human operator can create threads, assign them to a CopilotBridgeBob, add a message, and see the Bob's response appear in the thread history - all through a persistent REST API and a minimal React UI.

## Problem Statement

Multi-agent orchestration across multiple copilot-bridge sessions is currently manual and stateless. There is no durable record of what was asked, what was answered, or which agent handled it. Phase 1 establishes the coordination plane: a persistent data model, a REST API, a connector to copilot-bridge, and a board UI to tie them together.

## Users

- **Human operator**: creates threads, assigns Bobs, reads results, advances thread status
- **CopilotBridgeBob**: receives dispatched runs, posts results back via internal callback

## User Stories

1. As a human operator, I can create a thread with a title and description so that I can track a unit of work.
2. As a human operator, I can assign a Bob to a thread so that work can be dispatched.
3. As a human operator, I can post a message to a thread so that the assigned Bob receives it and acts on it.
4. As a human operator, I can see the Bob's response in the thread history so that I know what was done.
5. As a human operator, I can see a list of all threads with their current status so that I have an overview of all work.
6. As a human operator, I can view a Bob's registration and status so that I know which agents are available.

## Success Criteria

- A thread can be created, updated, and listed via the REST API.
- A CopilotBridgeBob can be registered and its status queried.
- Posting a message to a thread with an assigned Bob creates and dispatches a Run.
- The Bob's result comes back via the internal callback endpoint and appears as a message in the thread.
- The Moot UI shows the thread board and thread detail without errors.
- The server starts from a clean database with no manual setup beyond configuration.

## Non-Goals for Phase 1

- Real-time SSE updates (Phase 2)
- Authentication / access control
- Multiple Bob harness types (Claude Code, Subprocess, A2A) - Phase 3
- Parallel dispatch or thread branching - Phase 4
- Bob management UI (registration is API-only in Phase 1)

## Constraints

- TypeScript monorepo: `packages/server` (Fastify + SQLite), `packages/ui` (React + Vite)
- No TanStack (no react-query, no TanStack Router or Table)
- UI borrows visual structure and component patterns from `raykao/copilot-bridge-kanban` - layout, shadcn/ui components, Tailwind CSS v4, react-router-dom v7, zustand for state, fetch for data fetching
- SQLite via better-sqlite3 (synchronous, no ORM)
- No authentication in Phase 1
