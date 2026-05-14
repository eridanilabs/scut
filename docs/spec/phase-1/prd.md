# SCUT Phase 1 - Product Requirements

## Goal

Deliver a working Kanban application where registered users can manage projects, boards, threads, checklists, and comments through a persistent, fully documented REST API and a React SPA. No agent integration in Phase 1.

## Problem Statement

There is no lightweight, API-first project management tool purpose-built for multi-agent workflows. Phase 1 establishes the coordination plane: the full project/board/thread hierarchy, a REST API, user auth, and a board UI. The data model is designed from the start to support agent integration in Phase 2 — assignees are polymorphic, threads are designed to become agent sessions — but Phase 1 ships none of that machinery.

## Users

- **Human operator**: registers an account, creates projects/boards/threads, assigns work to users, tracks status, reviews comments

## User Stories

1. As a user, I can register an account and log in so that my work is persistent and mine.
2. As a user, I can create a project so that I can group related boards and threads.
3. As a user, I can create a board within a project with named columns so that I have a structured view of work.
4. As a user, I can define column filter rules so that threads are automatically grouped by status, assignee, or label.
5. As a user, I can create a thread with a title and description so that I can track a unit of work.
6. As a user, I can assign a thread to another user so that ownership is clear.
7. As a user, I can post comments on a thread so that conversation is persistent and visible to others.
8. As a user, I can add a checklist to a thread so that I can track the steps needed to complete it.
9. As a user, I can check off checklist items so that progress is visible.
10. As a user, I can promote a checklist item to a full thread so that a sub-task gets its own tracking.
11. As a user, I can see all threads on a board organized into columns (driven by filter rules) so that I have an overview of all work.
12. As an API client (human or agent), I can call any endpoint to create, read, update, or delete any entity.

## Success Criteria

- A user can register, log in, and receive a JWT.
- A project, board, and thread can be created, updated, and listed via the REST API.
- Columns evaluate their `filter_rule` and return matching threads.
- Comments can be posted and listed on any thread.
- Checklists and checklist items can be created, updated, completed, and deleted on any thread.
- A checklist item can be promoted to a Thread via `POST /api/checklist-items/:id/promote`.
- The Moot UI shows: login/register page, project list, board view with filter-driven columns, thread detail with comments and checklists.
- The OpenAPI 3.1 spec is served at `/api/docs` and committed to `docs/api/openapi.yaml`.
- The server starts from a clean database with no manual setup beyond configuration.

## Non-Goals for Phase 1

- Agent integration / Replicant assignment (Phase 2)
- Real-time SSE updates (Phase 3)
- Multiple connector implementations (Phase 4)
- Parallel dispatch or thread branching (Phase 5)
- GitHub OAuth (future, unscheduled)
- Admin user management UI (API only in Phase 1)

## Constraints

- TypeScript monorepo: `packages/server` (Fastify + SQLite), `packages/ui` (React + Vite)
- No TanStack (no react-query, no TanStack Router or Table)
- UI borrows visual structure and component patterns from `raykao/copilot-bridge-kanban` — layout, shadcn/ui components, Tailwind CSS v4, react-router-dom v7, zustand for state, fetch for data fetching
- SQLite via better-sqlite3 (synchronous, no ORM)
- API-first: every entity is fully addressable via REST; the UI is one consumer of the API, not a privileged client
- Assignee fields use `assignee_type` + `assignee_id` (polymorphic) even in Phase 1 so Phase 2 requires no schema changes
- `JWT_SECRET` env var is required; server refuses to start without it
