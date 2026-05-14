import { useEffect } from 'react';
import { useBobsStore } from '@/stores/bobs';
import { BobStatusIndicator } from '@/components/bob/BobStatusIndicator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
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

export function BobsPage() {
  const { bobs, loading, error, fetch } = useBobsStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (error) {
    return <ErrorState description={error} onRetry={fetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Bobs</h2>

      {loading ? (
        <TableSkeleton />
      ) : bobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bobs configured.</p>
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
    </div>
  );
}
