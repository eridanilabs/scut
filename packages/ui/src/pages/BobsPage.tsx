import { useEffect, useState } from 'react';
import { Bot, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useBobsStore } from '@/stores/bobs';
import { BobStatusIndicator } from '@/components/bob/BobStatusIndicator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function AddReplicantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useBobsStore((s) => s.create);
  const [name, setName] = useState('');
  const [harness, setHarness] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setHarness('');
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !harness.trim()) return;
    setSubmitting(true);
    try {
      await create({ name: name.trim(), harness: harness.trim() });
      toast.success(`Replicant "${name.trim()}" added.`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Failed to add replicant.');
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Replicant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rep-name">Name</Label>
            <Input
              id="rep-name"
              placeholder="e.g. Bob"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rep-harness">Harness</Label>
            <Input
              id="rep-harness"
              placeholder="e.g. Copilot"
              value={harness}
              onChange={(e) => setHarness(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The connector type used to communicate with this replicant.
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim() || !harness.trim()}>
              {submitting ? 'Adding...' : 'Add Replicant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BobsPage() {
  const { bobs, loading, error, fetch } = useBobsStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (error) {
    return (
      <div className="px-6 py-6">
        <ErrorState description={error} onRetry={fetch} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="size-6" />
            Replicants
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Registered agent connectors.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New Replicant
        </Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : bobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replicants configured.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Harness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bobs.map((bob) => (
                <TableRow key={bob.id}>
                  <TableCell className="font-medium">{bob.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {bob.harness}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm">
                      <BobStatusIndicator status={bob.status} />
                      <span className="capitalize">{bob.status}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(bob.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddReplicantDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
