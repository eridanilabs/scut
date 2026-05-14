import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadStatus } from '@/api/types';

const statusClassMap: Record<ThreadStatus, string> = {
  idea: 'border-dashed text-muted-foreground',
  refining: 'bg-secondary text-secondary-foreground',
  ready: 'bg-emerald-600 text-white hover:bg-emerald-600',
  in_progress: 'bg-sky-600 text-white hover:bg-sky-600',
  blocked: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  done: 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300',
  archived: 'text-muted-foreground',
};

function formatStatus(status: ThreadStatus): string {
  return status.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

interface ThreadStatusBadgeProps {
  status: ThreadStatus;
  className?: string;
}

export function ThreadStatusBadge({ status, className }: ThreadStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 capitalize', statusClassMap[status], className)}
    >
      {formatStatus(status)}
    </Badge>
  );
}
