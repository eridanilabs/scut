import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useDmStore } from '@/stores/dm';
import { useBobsStore } from '@/stores/bobs';
import { cn } from '@/lib/utils';

const EMPTY_SESSIONS: never[] = [];

export function SessionsListPanel() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId?: string }>();
  const navigate = useNavigate();
  const bobs = useBobsStore(s => s.bobs);
  const fetchBobs = useBobsStore(s => s.fetch);
  const sessionsMap = useDmStore(s => s.sessions);
  const sessions = agentId ? (sessionsMap[agentId] ?? EMPTY_SESSIONS) : EMPTY_SESSIONS;
  const fetchSessions = useDmStore(s => s.fetchSessions);
  const createSession = useDmStore(s => s.createSession);
  const renameSession = useDmStore(s => s.renameSession);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const agent = bobs.find(b => b.id === agentId);

  useEffect(() => {
    if (agentId) {
      fetchBobs();
      fetchSessions(agentId);
    }
  }, [agentId, fetchBobs, fetchSessions]);

  async function handleNewSession() {
    if (!agentId) return;
    const session = await createSession(agentId);
    navigate(`/messages/${agentId}/${session.id}`);
  }

  function startRename(id: string, currentTitle: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameSession(id, trimmed);
    }
    setRenamingId(null);
  }

  function formatTimeAgo(isoDate: string | null): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-sidebar-border px-3 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/messages')}
          className="flex items-center justify-center size-8 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
          aria-label="Back to agents"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-sidebar-foreground flex-1 truncate">
          {agent?.name ?? agentId}
        </span>
        <button
          onClick={handleNewSession}
          className="flex items-center justify-center size-8 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
          aria-label="New session"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No sessions yet</p>
        )}
        {sessions.map(session => {
          const active = sessionId === session.id;
          return (
            <button
              key={session.id}
              onClick={() => navigate(`/messages/${agentId}/${session.id}`)}
              className={cn(
                'group flex items-start gap-2 px-3 py-3 cursor-pointer rounded-lg mx-2 w-[calc(100%-16px)] text-left',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <div className="min-w-0 flex-1">
                {renamingId === session.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(session.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename(session.id);
                      }
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-sm bg-transparent border-b border-sidebar-foreground outline-none"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{session.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(session.last_message_at)}
                      </span>
                      <button
                        onClick={e => startRename(session.id, session.title, e)}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center size-5 rounded hover:bg-sidebar-accent text-muted-foreground"
                        aria-label="Rename session"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {session.last_message_preview ?? 'No messages yet'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
