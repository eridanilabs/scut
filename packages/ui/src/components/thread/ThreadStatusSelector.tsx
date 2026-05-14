import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ThreadStatus } from '@/api/types';

const THREAD_STATUSES: ThreadStatus[] = [
  'idea',
  'refining',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'archived',
];

const STATUS_LABELS: Record<ThreadStatus, string> = {
  idea: 'Idea',
  refining: 'Refining',
  ready: 'Ready',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  archived: 'Archived',
};

interface ThreadStatusSelectorProps {
  value: ThreadStatus;
  onChange: (status: ThreadStatus) => void;
  className?: string;
}

export function ThreadStatusSelector({ value, onChange, className }: ThreadStatusSelectorProps) {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as ThreadStatus)}>
      <SelectTrigger className={cn('h-8 text-sm', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {THREAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
