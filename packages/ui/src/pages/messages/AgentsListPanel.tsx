import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReplicantsStore } from '@/stores/replicants';
import { dmApi } from '@/api/dm';
import { ReplicantStatusIndicator } from '@/components/replicant/ReplicantStatusIndicator';
import { cn } from '@/lib/utils';
import type { DmSession } from '@/api/types';

export function AgentsListPanel() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();
  const replicants = useReplicantsStore(s => s.replicants);
  const fetchReplicants = useReplicantsStore(s => s.fetch);
  const [allSessions, setAllSessions] = useState<DmSession[]>([]);

  useEffect(() => {
    fetchReplicants();
    dmApi.allSessions().then(setAllSessions);
  }, [fetchReplicants]);

  function getLastPreview(replicantId: string): { preview: string | null; at: string | null } {
    const agentSessions = allSessions
      .filter(s => s.agent_id === replicantId)
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
        {replicants.map(replicant => {
          const { preview, at } = getLastPreview(replicant.id);
          const active = agentId === replicant.id;
          return (
            <button
              key={replicant.id}
              onClick={() => navigate(`/messages/${replicant.id}`)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg mx-2 w-[calc(100%-16px)] text-left',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <ReplicantStatusIndicator status={replicant.status} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium truncate">{replicant.name}</span>
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
