import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ThreadStatusBadge } from './ThreadStatusBadge';
import { BobBadge } from '@/components/bob/BobBadge';
import type { Thread, Bob } from '@/api/types';

interface ThreadCardProps {
  thread: Thread;
  bob?: Bob;
  onClick: () => void;
}

export function ThreadCard({ thread, bob, onClick }: ThreadCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{thread.title}</p>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <ThreadStatusBadge status={thread.status} />
          {bob && <BobBadge bob={bob} />}
        </div>
      </CardContent>
    </Card>
  );
}
