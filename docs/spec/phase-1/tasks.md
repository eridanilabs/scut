# SCUT Phase 1 - Tasks

> Human-readable task list for Phase 1 MVP.
> Agent tracking is in Beads. This file reflects current state at last agent update.
> GitHub issue: https://github.com/eridanilabs/scut/issues/1

## Beads Block IDs

| Block | Beads ID | Title |
|-------|----------|-------|
| 1 | bill-0kg | DB layer |
| 2 | bill-s9h | API routes |
| 3 | bill-bjl | IBobConnector + Phase 1 reference connector |
| 4 | bill-qhs | Seed script |
| 5 | bill-38g | UI scaffold |
| 6 | bill-ol2 | Moot board UI |
| 7 | bill-anr | Thread detail UI |
| 8 | bill-h7j | Bobs page UI |

## Status Key

- `pending` - not started
- `in_progress` - actively being worked
- `done` - complete and merged
- `blocked` - waiting on something external

---

## Block 1: DB Layer

| ID | Task | Status |
|----|------|--------|
| P1-01 | Write `schema.sql` (bobs, threads, messages, runs tables) | pending |
| P1-02 | Write `migrate.ts` (idempotent, runs on startup) | pending |
| P1-03 | Write typed query modules (bobs.ts, threads.ts, messages.ts, runs.ts) | pending |

## Block 2: API Routes

| ID | Task | Status |
|----|------|--------|
| P1-04 | `GET /api/bobs`, `POST /api/bobs` | pending |
| P1-05 | `GET /api/threads`, `POST /api/threads` | pending |
| P1-06 | `GET /api/threads/:id`, `PATCH /api/threads/:id`, `DELETE /api/threads/:id` | pending |
| P1-07 | `POST /api/threads/:id/messages` with auto-dispatch logic | pending |
| P1-08 | `GET /api/threads/:id/runs` | pending |
| P1-09 | `POST /api/internal/runs/:id/result` callback endpoint | pending |

## Block 3: Connector Interface + Phase 1 Reference Connector (CopilotBridgeBob)

| ID | Task | Status |
|----|------|--------|
| P1-10 | Write `IBobConnector` interface and shared types | pending |
| P1-11 | Implement `CopilotBridgeBob` connector | pending |
| P1-12 | Write connector `registry.ts` (startup init from bobs table) | pending |

## Block 4: Seed Script

| ID | Task | Status |
|----|------|--------|
| P1-13 | Write `seed.ts` (upsert default Bob connector from env vars, harness=copilot-bridge) | pending |

## Block 5: UI Scaffold

| ID | Task | Status |
|----|------|--------|
| P1-14 | Port Tailwind v4 config, shadcn setup, index.css from copilot-bridge-kanban | pending |
| P1-15 | Port layout components (AppShell, Sidebar, Header) | pending |
| P1-16 | Port shadcn/ui primitives (Button, Card, Badge, Dialog, etc.) | pending |
| P1-17 | Port ErrorBoundary, ErrorState, theme store | pending |
| P1-18 | Write fetch-based API client (`packages/ui/src/api/`) | pending |
| P1-19 | Write zustand stores (threads, bobs, ui state) | pending |

## Block 6: Moot Board (Thread List)

| ID | Task | Status |
|----|------|--------|
| P1-20 | `MootPage.tsx` - thread list grouped by status | pending |
| P1-21 | `ThreadCard.tsx` component | pending |
| P1-22 | Create thread modal + form | pending |

## Block 7: Thread Detail

| ID | Task | Status |
|----|------|--------|
| P1-23 | `ThreadDetailPage.tsx` - messages + run history | pending |
| P1-24 | Message input form + POST to API | pending |
| P1-25 | Bob assignment selector + PATCH thread | pending |
| P1-26 | Thread status selector + PATCH thread | pending |

## Block 8: Bobs Page

| ID | Task | Status |
|----|------|--------|
| P1-27 | `BobsPage.tsx` - list bobs with status indicators | pending |

---

## Notes

- Blocks 1-4 are backend only and can be implemented before any UI work.
- Block 5 (UI scaffold) can be done in parallel with Blocks 2-4.
- Blocks 6-8 depend on Blocks 1-5.
- No TanStack dependencies. Use fetch + zustand only.
- Borrow visual components from `raykao/copilot-bridge-kanban` - do not fork the repo, port selectively.
