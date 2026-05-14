import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/api/types';

const runStatusClassMap: Record<RunStatus, string> = {
  created: 'text-muted-foreground border-dashed',
  queued: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  running: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200 animate-pulse',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  cancelled: 'text-muted-foreground',
};

function formatRunStatus(status: RunStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge variant="outline" className={cn('shrink-0 text-[10px]', runStatusClassMap[status])}>
      {formatRunStatus(status)}
    </Badge>
  );
}
