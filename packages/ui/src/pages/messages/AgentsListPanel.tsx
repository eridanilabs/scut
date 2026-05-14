import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBobsStore } from '@/stores/bobs';
import { dmApi } from '@/api/dm';
import { BobStatusIndicator } from '@/components/bob/BobStatusIndicator';
import { cn } from '@/lib/utils';
import type { DmSession } from '@/api/types';

export function AgentsListPanel() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();
  const bobs = useBobsStore(s => s.bobs);
  const fetchBobs = useBobsStore(s => s.fetch);
  const [allSessions, setAllSessions] = useState<DmSession[]>([]);

  useEffect(() => {
    fetchBobs();
    dmApi.allSessions().then(setAllSessions);
  }, [fetchBobs]);

  function getLastPreview(bobId: string): { preview: string | null; at: string | null } {
    const agentSessions = allSessions
      .filter(s => s.agent_id === bobId)
      .sort((a, b) =>
        new Date(b.last_message_at ?? b.created_at).getTime() -
        new Date(a.last_message_at ?? a.created_at).getTime()
      );
    if (agentSessions.length === 0) return { preview: null, at: null };
    return {
      preview: agentSessions[0].last_message_preview,
      at: agentSessions[0].last_message_at,
    };
  }

  function formatTime(isoDate: string | null): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 text-sm font-semibold text-sidebar-foreground border-b border-sidebar-border shrink-0">
        Messages
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {bobs.map(bob => {
          const { preview, at } = getLastPreview(bob.id);
          const active = agentId === bob.id;
          return (
            <button
              key={bob.id}
              onClick={() => navigate(`/messages/${bob.id}`)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg mx-2 w-[calc(100%-16px)] text-left',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <BobStatusIndicator status={bob.status} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium truncate">{bob.name}</span>
                  {at && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatTime(at)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {preview ?? 'No messages yet'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
