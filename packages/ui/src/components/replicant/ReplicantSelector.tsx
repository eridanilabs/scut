import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReplicantStatusIndicator } from '@/components/replicant/ReplicantStatusIndicator';
import type { Replicant } from '@/api/types';

interface ReplicantSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  replicants: Replicant[];
  className?: string;
}

export function ReplicantSelector({ value, onChange, replicants, className }: ReplicantSelectorProps) {
  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(val) => onChange(val === '__none__' ? null : val)}
    >
      <SelectTrigger className={cn('h-8 text-sm', className)}>
        <SelectValue placeholder="No replicant assigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {replicants.map((replicant) => (
          <SelectItem key={replicant.id} value={replicant.id}>
            <span className="flex items-center gap-2">
              <ReplicantStatusIndicator status={replicant.status} />
              {replicant.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
