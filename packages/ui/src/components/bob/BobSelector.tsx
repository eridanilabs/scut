import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BobStatusIndicator } from '@/components/bob/BobStatusIndicator';
import type { Bob } from '@/api/types';

interface BobSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  bobs: Bob[];
  className?: string;
}

export function BobSelector({ value, onChange, bobs, className }: BobSelectorProps) {
  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(val) => onChange(val === '__none__' ? null : val)}
    >
      <SelectTrigger className={cn('h-8 text-sm', className)}>
        <SelectValue placeholder="No bob assigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {bobs.map((bob) => (
          <SelectItem key={bob.id} value={bob.id}>
            <span className="flex items-center gap-2">
              <BobStatusIndicator status={bob.status} />
              {bob.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
