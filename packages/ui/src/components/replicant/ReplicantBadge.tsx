import { Bot } from 'lucide-react';
import type { Replicant } from '@/api/types';
import { ReplicantStatusIndicator } from './ReplicantStatusIndicator';
import { cn } from '@/lib/utils';

export function ReplicantBadge({ replicant, className }: { replicant: Replicant; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
      className
    )}>
      <Bot className="size-3 shrink-0" />
      <span className="truncate max-w-[120px]">{replicant.name}</span>
      <ReplicantStatusIndicator status={replicant.status} />
    </span>
  );
}
