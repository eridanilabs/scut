import { cn } from '@/lib/utils';
import type { BobStatus } from '@/api/types';

interface BobStatusIndicatorProps {
  status: BobStatus;
  className?: string;
}

const STATUS_COLORS: Record<BobStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  busy: 'bg-yellow-500',
  unknown: 'bg-muted-foreground',
};

export function BobStatusIndicator({ status, className }: BobStatusIndicatorProps) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', STATUS_COLORS[status], className)}
      aria-label={status}
      title={status}
    />
  );
}
