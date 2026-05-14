import { useParams } from 'react-router-dom';
import { AgentsListPanel } from './AgentsListPanel';
import { SessionsListPanel } from './SessionsListPanel';
import { ChatPanel } from './ChatPanel';

export function MessagesPage() {
  const { agentId, sessionId } = useParams<{ agentId?: string; sessionId?: string }>();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Col 2: context panel */}
      <div className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col overflow-hidden">
        {agentId ? <SessionsListPanel /> : <AgentsListPanel />}
      </div>
      {/* Col 3: chat or empty state */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {sessionId ? (
          <ChatPanel />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a session to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
