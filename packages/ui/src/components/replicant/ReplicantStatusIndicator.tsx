import { cn } from '@/lib/utils';
import type { ReplicantStatus } from '@/api/types';

interface ReplicantStatusIndicatorProps {
  status: ReplicantStatus;
  className?: string;
}

const STATUS_COLORS: Record<ReplicantStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  busy: 'bg-yellow-500',
  unknown: 'bg-muted-foreground',
};

export function ReplicantStatusIndicator({ status, className }: ReplicantStatusIndicatorProps) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', STATUS_COLORS[status], className)}
      aria-label={status}
      title={status}
    />
  );
}
