export type ThreadStatus =
  | 'idea'
  | 'refining'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'archived';

export type RunStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BobStatus = 'online' | 'offline' | 'busy' | 'unknown';

export type MessageAuthor = 'human' | 'bob' | 'system';

export interface Project {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  filter_rule: { status?: ThreadStatus; labels?: string[]; bob_id?: string };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Bob {
  id: string;
  name: string;
  harness: string;
  config: Record<string, unknown>;
  status: BobStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: ThreadStatus;
  bob_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  run_id: string | null;
  author: MessageAuthor;
  author_id: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Run {
  id: string;
  thread_id: string;
  bob_id: string;
  status: RunStatus;
  input: string;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DmSession {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
}

export interface DmMessage {
  id: string;
  session_id: string;
  author: 'human' | 'agent' | 'system';
  content: string;
  created_at: string;
}
