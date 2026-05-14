import type {
  Project,
  Board,
  Column,
  Bob,
  Thread,
  Message,
  Run,
  MessageAuthor,
  ThreadStatus,
  DmSession,
  DmMessage,
} from './types';

// ---- Seed data ----

const NOW = new Date().toISOString();
const PAST = (minusMs: number) => new Date(Date.now() - minusMs).toISOString();

export const mockProjects: Project[] = [
  {
    id: 'proj-alpha',
    name: 'Project Alpha',
    description: 'Primary coordination project for the Scut platform.',
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000),
  },
  {
    id: 'proj-beta',
    name: 'Project Beta',
    description: 'Experimental sandbox for testing multi-agent workflows.',
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(3_600_000),
  },
];

export const mockBoards: Board[] = [
  {
    id: 'board-alpha',
    project_id: 'proj-alpha',
    name: 'Alpha Board',
    description: 'Main task board for Project Alpha.',
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000),
  },
  {
    id: 'board-beta',
    project_id: 'proj-beta',
    name: 'Beta Board',
    description: 'Main task board for Project Beta.',
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(3_600_000),
  },
];

export const mockColumns: Column[] = [
  // Alpha board columns
  {
    id: 'col-alpha-1',
    board_id: 'board-alpha',
    name: 'Ideas',
    position: 0,
    filter_rule: { status: 'idea' },
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000 * 7),
  },
  {
    id: 'col-alpha-2',
    board_id: 'board-alpha',
    name: 'In Progress',
    position: 1,
    filter_rule: { status: 'in_progress' },
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000 * 7),
  },
  {
    id: 'col-alpha-3',
    board_id: 'board-alpha',
    name: 'Blocked',
    position: 2,
    filter_rule: { status: 'blocked' },
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000 * 7),
  },
  {
    id: 'col-alpha-4',
    board_id: 'board-alpha',
    name: 'Done',
    position: 3,
    filter_rule: { status: 'done' },
    metadata: {},
    created_at: PAST(86_400_000 * 7),
    updated_at: PAST(86_400_000 * 7),
  },
  // Beta board columns
  {
    id: 'col-beta-1',
    board_id: 'board-beta',
    name: 'Ideas',
    position: 0,
    filter_rule: { status: 'idea' },
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(86_400_000 * 3),
  },
  {
    id: 'col-beta-2',
    board_id: 'board-beta',
    name: 'In Progress',
    position: 1,
    filter_rule: { status: 'in_progress' },
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(86_400_000 * 3),
  },
  {
    id: 'col-beta-3',
    board_id: 'board-beta',
    name: 'Blocked',
    position: 2,
    filter_rule: { status: 'blocked' },
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(86_400_000 * 3),
  },
  {
    id: 'col-beta-4',
    board_id: 'board-beta',
    name: 'Done',
    position: 3,
    filter_rule: { status: 'done' },
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(86_400_000 * 3),
  },
];

export const mockBobs: Bob[] = [
  {
    id: 'bob-bridge',
    name: 'Bridge Bob',
    harness: 'copilot-bridge',
    config: { model: 'gpt-4o' },
    status: 'online',
    metadata: {},
    created_at: PAST(86_400_000 * 10),
    updated_at: PAST(3_600_000),
  },
  {
    id: 'bob-claude',
    name: 'Claude Bob',
    harness: 'claude-code',
    config: { model: 'claude-3-5-sonnet' },
    status: 'offline',
    metadata: {},
    created_at: PAST(86_400_000 * 5),
    updated_at: PAST(86_400_000),
  },
];

export const mockThreads: Thread[] = [
  {
    id: 'thread-1',
    project_id: 'proj-alpha',
    title: 'Design the API schema for thread management',
    description: 'Define REST endpoints and data shapes for thread CRUD operations.',
    status: 'done',
    bob_id: 'bob-bridge',
    metadata: {},
    created_at: PAST(86_400_000 * 6),
    updated_at: PAST(86_400_000 * 2),
  },
  {
    id: 'thread-2',
    project_id: 'proj-alpha',
    title: 'Implement Kanban board drag-and-drop',
    description: 'Add dnd-kit based drag-and-drop for moving threads between columns.',
    status: 'in_progress',
    bob_id: 'bob-bridge',
    metadata: {},
    created_at: PAST(86_400_000 * 4),
    updated_at: PAST(7_200_000),
  },
  {
    id: 'thread-3',
    project_id: 'proj-alpha',
    title: 'Set up CI pipeline for the monorepo',
    description: 'Configure GitHub Actions workflows for build, test, and lint.',
    status: 'blocked',
    bob_id: null,
    metadata: {},
    created_at: PAST(86_400_000 * 3),
    updated_at: PAST(86_400_000),
  },
  {
    id: 'thread-4',
    project_id: 'proj-alpha',
    title: 'Explore real-time message streaming via SSE',
    description: 'Investigate server-sent events for live message delivery.',
    status: 'idea',
    bob_id: null,
    metadata: {},
    created_at: PAST(86_400_000 * 2),
    updated_at: PAST(86_400_000 * 2),
  },
  {
    id: 'thread-5',
    project_id: 'proj-beta',
    title: 'Prototype A2A agent communication protocol',
    description: 'Build a minimal working prototype of the agent-to-agent harness.',
    status: 'in_progress',
    bob_id: 'bob-claude',
    metadata: {},
    created_at: PAST(86_400_000 * 2),
    updated_at: PAST(3_600_000),
  },
  {
    id: 'thread-6',
    project_id: 'proj-beta',
    title: 'Document ACP harness configuration options',
    description: 'Write reference documentation for all ACP harness config keys.',
    status: 'idea',
    bob_id: null,
    metadata: {},
    created_at: PAST(86_400_000),
    updated_at: PAST(86_400_000),
  },
];

export const mockMessages: Record<string, Message[]> = {
  'thread-1': [
    {
      id: 'msg-1-1',
      thread_id: 'thread-1',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'Can you draft an initial API schema for thread management? Focus on REST conventions.',
      metadata: {},
      created_at: PAST(86_400_000 * 6),
    },
    {
      id: 'msg-1-2',
      thread_id: 'thread-1',
      run_id: 'run-1-1',
      author: 'bob',
      author_id: 'bob-bridge',
      content:
        'Here is a proposed schema:\n\n- GET /threads - list threads\n- POST /threads - create thread\n- GET /threads/:id - get thread\n- PATCH /threads/:id - update thread\n- DELETE /threads/:id - delete thread\n\nEach thread has: id, project_id, title, description, status, bob_id, metadata, created_at, updated_at.',
      metadata: {},
      created_at: PAST(86_400_000 * 6 - 60_000),
    },
    {
      id: 'msg-1-3',
      thread_id: 'thread-1',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'Looks good. Add message and run sub-resources too.',
      metadata: {},
      created_at: PAST(86_400_000 * 5),
    },
    {
      id: 'msg-1-4',
      thread_id: 'thread-1',
      run_id: 'run-1-2',
      author: 'bob',
      author_id: 'bob-bridge',
      content:
        'Added:\n\n- GET /threads/:id/messages\n- POST /threads/:id/messages\n- GET /threads/:id/runs\n\nRuns are created automatically when a message is sent to a thread with an assigned bob.',
      metadata: {},
      created_at: PAST(86_400_000 * 5 - 60_000),
    },
    {
      id: 'msg-1-5',
      thread_id: 'thread-1',
      run_id: null,
      author: 'system',
      author_id: null,
      content: 'Thread status changed to done.',
      metadata: {},
      created_at: PAST(86_400_000 * 2),
    },
  ],
  'thread-2': [
    {
      id: 'msg-2-1',
      thread_id: 'thread-2',
      run_id: null,
      author: 'human',
      author_id: null,
      content:
        'I need drag-and-drop for the kanban board. Threads should be movable between columns by dragging.',
      metadata: {},
      created_at: PAST(86_400_000 * 4),
    },
    {
      id: 'msg-2-2',
      thread_id: 'thread-2',
      run_id: 'run-2-1',
      author: 'bob',
      author_id: 'bob-bridge',
      content:
        'I recommend dnd-kit for this. It is lightweight, accessible, and works well with React. I will implement the DndContext, SortableContext, and useSortable hooks to enable column-to-column thread movement.',
      metadata: {},
      created_at: PAST(86_400_000 * 4 - 60_000),
    },
    {
      id: 'msg-2-3',
      thread_id: 'thread-2',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'Go ahead. Make sure thread status updates when moved to a different column.',
      metadata: {},
      created_at: PAST(7_200_000 + 600_000),
    },
    {
      id: 'msg-2-4',
      thread_id: 'thread-2',
      run_id: 'run-2-2',
      author: 'bob',
      author_id: 'bob-bridge',
      content:
        'Understood. I will wire the onDragEnd handler to call PATCH /threads/:id with the new status derived from the destination column filter_rule.',
      metadata: {},
      created_at: PAST(7_200_000),
    },
  ],
  'thread-3': [
    {
      id: 'msg-3-1',
      thread_id: 'thread-3',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'We need a CI pipeline. Can you set up GitHub Actions for build, test, and lint?',
      metadata: {},
      created_at: PAST(86_400_000 * 3),
    },
    {
      id: 'msg-3-2',
      thread_id: 'thread-3',
      run_id: null,
      author: 'system',
      author_id: null,
      content: 'Thread status changed to blocked.',
      metadata: {},
      created_at: PAST(86_400_000),
    },
  ],
  'thread-4': [
    {
      id: 'msg-4-1',
      thread_id: 'thread-4',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'Could SSE work for streaming bob responses to the UI? Worth exploring.',
      metadata: {},
      created_at: PAST(86_400_000 * 2),
    },
  ],
  'thread-5': [
    {
      id: 'msg-5-1',
      thread_id: 'thread-5',
      run_id: null,
      author: 'human',
      author_id: null,
      content:
        'Start building the A2A prototype. Two agents should be able to exchange structured messages.',
      metadata: {},
      created_at: PAST(86_400_000 * 2),
    },
    {
      id: 'msg-5-2',
      thread_id: 'thread-5',
      run_id: 'run-5-1',
      author: 'bob',
      author_id: 'bob-claude',
      content:
        'Starting prototype. I will implement a minimal message envelope format and a simple routing layer that dispatches to registered agent handlers.',
      metadata: {},
      created_at: PAST(86_400_000 * 2 - 60_000),
    },
    {
      id: 'msg-5-3',
      thread_id: 'thread-5',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'Great. Include a trace log so we can debug message flows.',
      metadata: {},
      created_at: PAST(3_600_000),
    },
  ],
  'thread-6': [
    {
      id: 'msg-6-1',
      thread_id: 'thread-6',
      run_id: null,
      author: 'human',
      author_id: null,
      content: 'We need docs for the ACP harness config. What keys does it support?',
      metadata: {},
      created_at: PAST(86_400_000),
    },
  ],
};

export const mockRuns: Record<string, Run[]> = {
  'thread-1': [
    {
      id: 'run-1-1',
      thread_id: 'thread-1',
      bob_id: 'bob-bridge',
      status: 'completed',
      input: 'Draft an initial API schema for thread management.',
      output: 'GET /threads, POST /threads, GET /threads/:id, PATCH /threads/:id, DELETE /threads/:id',
      error: null,
      started_at: PAST(86_400_000 * 6 - 1_000),
      completed_at: PAST(86_400_000 * 6 - 60_000),
      metadata: {},
      created_at: PAST(86_400_000 * 6),
      updated_at: PAST(86_400_000 * 6 - 60_000),
    },
    {
      id: 'run-1-2',
      thread_id: 'thread-1',
      bob_id: 'bob-bridge',
      status: 'completed',
      input: 'Add message and run sub-resources.',
      output: 'GET /threads/:id/messages, POST /threads/:id/messages, GET /threads/:id/runs',
      error: null,
      started_at: PAST(86_400_000 * 5 - 1_000),
      completed_at: PAST(86_400_000 * 5 - 60_000),
      metadata: {},
      created_at: PAST(86_400_000 * 5),
      updated_at: PAST(86_400_000 * 5 - 60_000),
    },
  ],
  'thread-2': [
    {
      id: 'run-2-1',
      thread_id: 'thread-2',
      bob_id: 'bob-bridge',
      status: 'completed',
      input: 'Implement kanban drag-and-drop using dnd-kit.',
      output: 'DndContext and SortableContext setup complete.',
      error: null,
      started_at: PAST(86_400_000 * 4 - 1_000),
      completed_at: PAST(86_400_000 * 4 - 60_000),
      metadata: {},
      created_at: PAST(86_400_000 * 4),
      updated_at: PAST(86_400_000 * 4 - 60_000),
    },
    {
      id: 'run-2-2',
      thread_id: 'thread-2',
      bob_id: 'bob-bridge',
      status: 'running',
      input: 'Wire onDragEnd to PATCH /threads/:id with new status.',
      output: null,
      error: null,
      started_at: PAST(7_200_000),
      completed_at: null,
      metadata: {},
      created_at: PAST(7_200_000),
      updated_at: PAST(7_200_000),
    },
  ],
  'thread-5': [
    {
      id: 'run-5-1',
      thread_id: 'thread-5',
      bob_id: 'bob-claude',
      status: 'running',
      input: 'Build A2A prototype with message envelope and routing layer.',
      output: null,
      error: null,
      started_at: PAST(86_400_000 * 2 - 1_000),
      completed_at: null,
      metadata: {},
      created_at: PAST(86_400_000 * 2),
      updated_at: PAST(3_600_000),
    },
  ],
};

// ---- Mutable state ----

const _projects: Project[] = [...mockProjects];
const _boards: Board[] = [...mockBoards];
const _columns: Column[] = [...mockColumns];
const _bobs: Bob[] = [...mockBobs];
const _threads: Thread[] = [...mockThreads];
const _messages: Record<string, Message[]> = Object.fromEntries(
  Object.entries(mockMessages).map(([k, v]) => [k, [...v]]),
);
const _runs: Record<string, Run[]> = Object.fromEntries(
  Object.entries(mockRuns).map(([k, v]) => [k, [...v]]),
);

// ---- State functions ----

export function getMockProjects(): Project[] {
  return [..._projects];
}

export function createMockProject(input: { name: string; description: string }): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  _projects.push(project);
  return project;
}

export function getMockBoards(projectId: string): Board[] {
  return _boards.filter((b) => b.project_id === projectId);
}

export function getMockColumns(boardId: string): Column[] {
  return _columns
    .filter((c) => c.board_id === boardId)
    .sort((a, b) => a.position - b.position);
}

export function getMockBobs(): Bob[] {
  return [..._bobs];
}

export function createMockBob(input: { name: string; harness: string }): Bob {
  const now = new Date().toISOString();
  const bob: Bob = {
    id: crypto.randomUUID(),
    name: input.name,
    harness: input.harness,
    config: {},
    status: 'offline',
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  _bobs.push(bob);
  return bob;
}

export function getMockThreads(
  projectId: string,
  filters?: { status?: string; bob_id?: string },
): Thread[] {
  return _threads.filter((t) => {
    if (t.project_id !== projectId) return false;
    if (filters?.status && t.status !== filters.status) return false;
    if (filters?.bob_id && t.bob_id !== filters.bob_id) return false;
    return true;
  });
}

export function getMockThread(id: string): Thread | null {
  return _threads.find((t) => t.id === id) ?? null;
}

export function createMockThread(input: {
  project_id: string;
  title: string;
  description: string;
  bob_id?: string | null;
}): Thread {
  const now = new Date().toISOString();
  const thread: Thread = {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    title: input.title,
    description: input.description,
    status: 'idea',
    bob_id: input.bob_id ?? null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  _threads.push(thread);
  _messages[thread.id] = [];
  _runs[thread.id] = [];
  return thread;
}

export function updateMockThread(id: string, patch: Partial<Thread>): Thread | null {
  const idx = _threads.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated: Thread = {
    ..._threads[idx],
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  };
  _threads[idx] = updated;
  return updated;
}

export function getMockMessages(threadId: string): Message[] {
  return [...(_messages[threadId] ?? [])];
}

export function createMockMessage(input: {
  thread_id: string;
  author: MessageAuthor;
  content: string;
  run_id?: string | null;
}): Message {
  const message: Message = {
    id: crypto.randomUUID(),
    thread_id: input.thread_id,
    run_id: input.run_id ?? null,
    author: input.author,
    author_id: input.author === 'bob' ? null : null,
    content: input.content,
    metadata: {},
    created_at: new Date().toISOString(),
  };
  if (!_messages[input.thread_id]) {
    _messages[input.thread_id] = [];
  }
  _messages[input.thread_id].push(message);
  return message;
}

export function getMockRuns(threadId: string): Run[] {
  return [...(_runs[threadId] ?? [])];
}

export function createMockRun(input: {
  thread_id: string;
  bob_id: string;
  status: 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  input_text: string;
  output?: string | null;
}): Run {
  const now = new Date().toISOString();
  const run: Run = {
    id: crypto.randomUUID(),
    thread_id: input.thread_id,
    bob_id: input.bob_id,
    status: input.status,
    input: input.input_text,
    output: input.output ?? null,
    error: null,
    started_at: input.status !== 'created' ? now : null,
    completed_at: input.status === 'completed' ? now : null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  if (!_runs[input.thread_id]) {
    _runs[input.thread_id] = [];
  }
  _runs[input.thread_id].push(run);
  return run;
}

export function updateMockRun(id: string, threadId: string, patch: Partial<Run>): Run | null {
  const list = _runs[threadId];
  if (!list) return null;
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...patch, updated_at: new Date().toISOString() };
  list[idx] = updated;
  return updated;
}

// ---- DM seed data ----

export function formatSessionTitle(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const mockDmSessions: DmSession[] = [
  {
    id: 'dm-session-1',
    agent_id: 'bob-bridge',
    title: formatSessionTitle(PAST(86_400_000 * 2)),
    last_message_preview: 'Sure, I can help with that.',
    last_message_at: PAST(86_400_000 * 2),
    created_at: PAST(86_400_000 * 2),
    updated_at: PAST(86_400_000 * 2),
  },
  {
    id: 'dm-session-2',
    agent_id: 'bob-bridge',
    title: formatSessionTitle(PAST(3_600_000)),
    last_message_preview: 'The schema looks good to me.',
    last_message_at: PAST(3_600_000),
    created_at: PAST(3_600_000),
    updated_at: PAST(3_600_000),
  },
  {
    id: 'dm-session-3',
    agent_id: 'bob-claude',
    title: formatSessionTitle(PAST(86_400_000)),
    last_message_preview: 'Let me think about that...',
    last_message_at: PAST(86_400_000),
    created_at: PAST(86_400_000),
    updated_at: PAST(86_400_000),
  },
];

export const mockDmMessages: Record<string, DmMessage[]> = {
  'dm-session-1': [
    { id: 'dm-msg-1', session_id: 'dm-session-1', author: 'human', content: 'Hey, can you help me set up the API routes?', created_at: PAST(86_400_000 * 2 + 5000) },
    { id: 'dm-msg-2', session_id: 'dm-session-1', author: 'agent', content: 'Sure, I can help with that.', created_at: PAST(86_400_000 * 2) },
  ],
  'dm-session-2': [
    { id: 'dm-msg-3', session_id: 'dm-session-2', author: 'human', content: 'Can you review the DB schema I drafted?', created_at: PAST(3_600_000 + 5000) },
    { id: 'dm-msg-4', session_id: 'dm-session-2', author: 'agent', content: 'The schema looks good to me.', created_at: PAST(3_600_000) },
  ],
  'dm-session-3': [
    { id: 'dm-msg-5', session_id: 'dm-session-3', author: 'human', content: 'What is the best way to handle session context?', created_at: PAST(86_400_000 + 5000) },
    { id: 'dm-msg-6', session_id: 'dm-session-3', author: 'agent', content: 'Let me think about that...', created_at: PAST(86_400_000) },
  ],
};

// ---- DM mutable state ----

const _dmSessions: DmSession[] = [...mockDmSessions];
const _dmMessages: Record<string, DmMessage[]> = Object.fromEntries(
  Object.entries(mockDmMessages).map(([k, v]) => [k, [...v]])
);

export function getMockDmSessions(agentId: string): DmSession[] {
  return _dmSessions.filter(s => s.agent_id === agentId).sort((a, b) =>
    new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime()
  );
}

export function getAllMockDmSessions(): DmSession[] {
  return [..._dmSessions];
}

export function createMockDmSession(agentId: string): DmSession {
  const now = new Date().toISOString();
  const session: DmSession = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    title: formatSessionTitle(now),
    last_message_preview: null,
    last_message_at: null,
    created_at: now,
    updated_at: now,
  };
  _dmSessions.push(session);
  _dmMessages[session.id] = [];
  return session;
}

export function renameMockDmSession(sessionId: string, title: string): void {
  const s = _dmSessions.find(s => s.id === sessionId);
  if (s) s.title = title;
}

export function getMockDmMessages(sessionId: string): DmMessage[] {
  return [...(_dmMessages[sessionId] ?? [])];
}

export function addMockDmMessage(sessionId: string, content: string): DmMessage {
  const now = new Date().toISOString();
  const msg: DmMessage = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    author: 'human',
    content,
    created_at: now,
  };
  if (!_dmMessages[sessionId]) _dmMessages[sessionId] = [];
  _dmMessages[sessionId].push(msg);
  const session = _dmSessions.find(s => s.id === sessionId);
  if (session) {
    session.last_message_preview = content.slice(0, 80);
    session.last_message_at = now;
    session.updated_at = now;
  }
  return msg;
}
