import { BobStatusIndicator } from './BobStatusIndicator';
import type { Bob } from '@/api/types';

interface BobBadgeProps {
  bob: Bob;
}

export function BobBadge({ bob }: BobBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <BobStatusIndicator status={bob.status} />
      {bob.name}
    </span>
  );
}
