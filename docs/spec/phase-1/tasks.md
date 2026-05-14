# SCUT Phase 1 - Tasks

> Human-readable task list for Phase 1 MVP.
> Agent tracking is in Beads. This file reflects current state at last agent update.
> GitHub issue: https://github.com/eridanilabs/scut/issues/1

## Beads Block IDs

| Block | Beads ID | Title |
|-------|----------|-------|
| P1-A | bill-0kg | DB Layer |
| P1-B | bill-s9h | Auth |
| P1-C | bill-bjl | Core API Routes |
| P1-D | bill-qhs | Checklist API Routes |
| P1-E | bill-38g | UI Scaffold |
| P1-F | bill-ol2 | Board UI |
| P1-G | bill-anr | Thread Detail UI |
| P1-H | bill-h7j | Seed Script |

## Status Key

- `pending` — not started
- `in_progress` — actively being worked
- `done` — complete and merged
- `blocked` — waiting on something external

---

## P1-A: DB Layer

| ID | Task | Status |
|----|------|--------|
| P1-A-01 | Write `schema.sql` with all Phase 1 tables (`projects`, `users`, `boards`, `columns`, `threads`, `comments`, `checklists`, `checklist_items`) plus `replicants` and `runs` as Phase 2 stubs with a comment | pending |
| P1-A-02 | Write `migrate.ts` (idempotent, runs on startup, reads `schema.sql`) | pending |
| P1-A-03 | Define `IRepository` root interface and all sub-interfaces in `db/interfaces/IRepository.ts` | pending |
| P1-A-04 | Define shared types in `db/interfaces/types.ts` (all input/filter/output types for all Phase 1 entities) | pending |
| P1-A-05 | Implement `SQLiteRepository` for projects in `db/adapters/sqlite/projects.ts` | pending |
| P1-A-06 | Implement `SQLiteRepository` for boards in `db/adapters/sqlite/boards.ts` | pending |
| P1-A-07 | Implement `SQLiteRepository` for columns in `db/adapters/sqlite/columns.ts` (including `filter_rule` evaluation in `findByColumn`) | pending |
| P1-A-08 | Implement `SQLiteRepository` for users in `db/adapters/sqlite/users.ts` | pending |
| P1-A-09 | Implement `SQLiteRepository` for threads in `db/adapters/sqlite/threads.ts` (including filter support: `status`, `assignee_type`, `assignee_id`) | pending |
| P1-A-10 | Implement `SQLiteRepository` for comments in `db/adapters/sqlite/comments.ts` | pending |
| P1-A-11 | Implement `SQLiteRepository` for checklists in `db/adapters/sqlite/checklists.ts` | pending |
| P1-A-12 | Implement `SQLiteRepository` for checklist items in `db/adapters/sqlite/checklist_items.ts` (including `promote()` method) | pending |
| P1-A-13 | Write `db/adapters/sqlite/index.ts` (`SQLiteRepository` root, composes all modules) | pending |
| P1-A-14 | Write `db/index.ts` factory (`createRepository(driver) -> IRepository`) | pending |

---

## P1-B: Auth

| ID | Task | Status |
|----|------|--------|
| P1-B-01 | Write `middleware/auth.ts` (Fastify `preHandler` that verifies JWT and attaches user to `request`) | pending |
| P1-B-02 | `POST /api/auth/register` (create user, bcrypt hash password, return JWT + user) | pending |
| P1-B-03 | `POST /api/auth/login` (verify credentials, return JWT + user) | pending |
| P1-B-04 | `GET /api/auth/me` (return current user from JWT) | pending |
| P1-B-05 | `PATCH /api/auth/me` (update `display_name`, `avatar_url`, or `password`) | pending |

---

## P1-C: Core API Routes

| ID | Task | Status |
|----|------|--------|
| P1-C-01 | `GET /api/projects`, `POST /api/projects` | pending |
| P1-C-02 | `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id` | pending |
| P1-C-03 | `GET /api/projects/:id/boards`, `POST /api/projects/:id/boards` | pending |
| P1-C-04 | `GET /api/boards/:id`, `PATCH /api/boards/:id`, `DELETE /api/boards/:id` | pending |
| P1-C-05 | `GET /api/boards/:id/columns`, `POST /api/boards/:id/columns` | pending |
| P1-C-06 | `GET /api/columns/:id` (with threads matching `filter_rule`), `PATCH /api/columns/:id`, `DELETE /api/columns/:id` | pending |
| P1-C-07 | `GET /api/projects/:id/threads` (with filter query params: `status`, `assignee_type`, `assignee_id`, `label`), `POST /api/projects/:id/threads` | pending |
| P1-C-08 | `GET /api/threads/:id`, `PATCH /api/threads/:id`, `DELETE /api/threads/:id` | pending |
| P1-C-09 | `GET /api/threads/:id/comments`, `POST /api/threads/:id/comments` | pending |
| P1-C-10 | `PATCH /api/comments/:id`, `DELETE /api/comments/:id` | pending |
| P1-C-11 | `GET /api/users`, `GET /api/users/:id` | pending |
| P1-C-12 | OpenAPI 3.1 schema generation + `/api/docs` route; write `docs/api/openapi.yaml` | pending |

---

## P1-D: Checklist API Routes

| ID | Task | Status |
|----|------|--------|
| P1-D-01 | `GET /api/threads/:id/checklists`, `POST /api/threads/:id/checklists` | pending |
| P1-D-02 | `GET /api/checklists/:id`, `PATCH /api/checklists/:id`, `DELETE /api/checklists/:id` | pending |
| P1-D-03 | `GET /api/checklists/:id/items`, `POST /api/checklists/:id/items` | pending |
| P1-D-04 | `PATCH /api/checklist-items/:id`, `DELETE /api/checklist-items/:id` | pending |
| P1-D-05 | `POST /api/checklist-items/:id/promote` (create Thread with `parent_id`, set `promoted_thread_id` on item, return new Thread) | pending |

---

## P1-E: UI Scaffold

| ID | Task | Status |
|----|------|--------|
| P1-E-01 | Port Tailwind v4 config, shadcn setup, `index.css` from `raykao/copilot-bridge-kanban` | pending |
| P1-E-02 | Port layout components (`AppShell`, `Sidebar`, `Header`) | pending |
| P1-E-03 | Port shadcn/ui primitives (`Button`, `Card`, `Badge`, `Dialog`, `Input`, `Form`, etc.) | pending |
| P1-E-04 | Port `ErrorBoundary`, `ErrorState`, theme store | pending |
| P1-E-05 | Write fetch-based API client (`packages/ui/src/api/` with modules per entity) | pending |
| P1-E-06 | Write zustand stores (`projects`, `boards`, `threads`, `ui` state) | pending |
| P1-E-07 | Write auth store (zustand) and `LoginPage.tsx` / `RegisterPage.tsx` | pending |
| P1-E-08 | Set up react-router-dom v7 routes and protected route wrapper (redirect to `/login` if unauthenticated) | pending |

---

## P1-F: Board UI

| ID | Task | Status |
|----|------|--------|
| P1-F-01 | `ProjectsPage.tsx` — project list + create project modal | pending |
| P1-F-02 | `MootPage.tsx` — board view with filter-driven columns | pending |
| P1-F-03 | `ThreadCard.tsx` component (title, status badge, assignee name, comment count) | pending |
| P1-F-04 | Create thread modal + form | pending |

---

## P1-G: Thread Detail UI

| ID | Task | Status |
|----|------|--------|
| P1-G-01 | `ThreadDetailPage.tsx` — comments list + run history placeholder | pending |
| P1-G-02 | Comment input form + `POST` to API | pending |
| P1-G-03 | Checklist panel (list checklists with items, check/uncheck, add item, promote item) | pending |
| P1-G-04 | Assignee picker (users only in Phase 1) + `PATCH` thread | pending |
| P1-G-05 | Thread status selector + `PATCH` thread | pending |

---

## P1-H: Seed Script

| ID | Task | Status |
|----|------|--------|
| P1-H-01 | Write `seed.ts` — upsert default project, board with 4 columns (Todo/In Progress/Blocked/Done each with appropriate `filter_rule` on `status` field), and default admin user from env vars | pending |

---

## Notes

- Blocks P1-A through P1-D are backend only and can be implemented before any UI work.
- Block P1-E (UI scaffold) can be done in parallel with Blocks P1-B through P1-D.
- Blocks P1-F through P1-H depend on Blocks P1-A through P1-E being complete.
- No TanStack dependencies. Use fetch + zustand only.
- Borrow visual components from `raykao/copilot-bridge-kanban` — do not fork the repo, port selectively.
- API-first: every endpoint should have a Fastify JSON schema so OpenAPI docs stay current.
- Replicants and Runs tables are in `schema.sql` but not wired to any routes in Phase 1.
