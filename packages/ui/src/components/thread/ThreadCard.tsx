import { useMemo } from 'react';
import type { Thread, Bob } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ThreadStatusBadge } from './ThreadStatusBadge';
import { BobBadge } from '@/components/bob/BobBadge';

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'just now';
  const minute = 60_000, hour = 60 * minute, day = 24 * hour, week = 7 * day;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  return `${Math.floor(diff / week)}w ago`;
}

interface ThreadCardProps {
  thread: Thread;
  bob?: Bob;
  onClick: () => void;
}

export function ThreadCard({ thread, bob, onClick }: ThreadCardProps) {
  const relativeTime = useMemo(() => timeAgo(thread.updated_at), [thread.updated_at]);

  return (
    <Card
      className={cn(
        'min-h-[7.5rem] cursor-pointer gap-3 border border-border/70 shadow-sm transition-colors hover:bg-accent/40',
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <CardHeader className="gap-2 pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm leading-5">{thread.title}</CardTitle>
          <ThreadStatusBadge status={thread.status} />
        </div>
      </CardHeader>
      <CardContent className="mt-auto pt-2 space-y-2">
        {bob && (
          <div className="flex flex-wrap gap-1.5">
            <BobBadge bob={bob} />
          </div>
        )}
        <div className="text-xs text-muted-foreground">{relativeTime}</div>
      </CardContent>
    </Card>
  );
}
