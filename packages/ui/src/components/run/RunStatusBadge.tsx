import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/api/types';

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
  created: { label: 'Created', className: 'bg-secondary text-secondary-foreground' },
  queued: { label: 'Queued', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  running: { label: 'Running', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.created;
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
