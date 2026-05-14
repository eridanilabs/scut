import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadStatus } from '@/api/types';

interface ThreadStatusBadgeProps {
  status: ThreadStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ThreadStatus, { label: string; className: string }> = {
  idea: { label: 'Idea', className: 'bg-secondary text-secondary-foreground' },
  refining: { label: 'Refining', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  ready: { label: 'Ready', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  blocked: { label: 'Blocked', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  done: { label: 'Done', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
};

export function ThreadStatusBadge({ status, className }: ThreadStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idea;
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
