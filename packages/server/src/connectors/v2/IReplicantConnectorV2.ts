import type { CommentDispatchRow } from '../../db/CommentDispatchRepo.js';

export type AgentTaskHandle = string;

export type AgentTaskStatus = {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  detail?: string;
};

export type AgentEvent =
  | { kind: 'token'; text: string }
  | { kind: 'tool_call'; name: string; args: unknown; result?: unknown }
  | { kind: 'message'; content: string }
  | { kind: 'error'; error: string }
  | { kind: 'status'; status: AgentTaskStatus };

// AssembledPrompt is a stub for this task; IPromptAssembler is not yet
// implemented (separate task). For now, AcpConnector accepts a plain
// text prompt under `text`. Do not expand this shape in this PR.
export type AssembledPrompt = {
  text: string;
};

export type ThreadView = {
  id: string;
  projectId?: string;
  title: string;
  description: string;
};

export type CommentView = {
  id: string;
  threadId: string;
  content: string;
};

export interface IReplicantConnectorV2 {
  dispatch(args: {
    dispatch: CommentDispatchRow;
    thread: ThreadView;
    triggeringComment: CommentView | null;
    prompt: AssembledPrompt;
  }): Promise<AgentTaskHandle>;

  cancel(handle: AgentTaskHandle): Promise<void>;

  status(handle: AgentTaskHandle): Promise<AgentTaskStatus>;
}
