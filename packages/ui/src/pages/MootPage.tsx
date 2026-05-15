import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects';
import { useBoardsStore } from '@/stores/boards';
import { useThreadsStore } from '@/stores/threads';
import { useReplicantsStore } from '@/stores/replicants';
import { ThreadCard } from '@/components/thread/ThreadCard';
import { ThreadForm } from '@/components/thread/ThreadForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ErrorState';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Column, Thread, Replicant } from '@/api/types';

function ColumnSkeleton() {
  return (
    <div className="flex w-72 flex-shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-20 w-full rounded-md" />
    </div>
  );
}

interface BoardColumnProps {
  column: Column;
  threads: Thread[];
  replicants: Replicant[];
  onThreadClick: (threadId: string) => void;
}

function BoardColumn({ column, threads, replicants, onThreadClick }: BoardColumnProps) {
  const columnThreads = threads.filter(
    (t) => !column.filter_rule.status || t.status === column.filter_rule.status,
  );
  const replicantMap = Object.fromEntries(replicants.map((r) => [r.id, r]));

  return (
    <div className="flex h-full min-w-[280px] w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-muted/30 transition-colors sm:w-72 md:snap-none">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          {columnThreads.length}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 space-y-3 p-3">
          {columnThreads.length === 0 ? (
            <Card className="border border-dashed border-border/80 bg-background/60 shadow-none">
              <CardContent className="flex items-center justify-center py-6">
                <p className="text-xs text-muted-foreground">No threads</p>
              </CardContent>
            </Card>
          ) : (
            columnThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                replicant={thread.replicant_id ? replicantMap[thread.replicant_id] : undefined}
                onClick={() => onThreadClick(thread.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function MootPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { projects, fetch: fetchProjects } = useProjectsStore();
  const { boards, columns, loading: boardsLoading, fetchForProject, fetchWithColumns } = useBoardsStore();
  const { threads, loading: threadsLoading, fetchByProject, create: createThread } = useThreadsStore();
  const { replicants, fetch: fetchReplicants } = useReplicantsStore();
  const [createThreadOpen, setCreateThreadOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!projectId) return;
    fetchProjects();
    fetchReplicants();
    fetchForProject(projectId).then(() => {
      // Will trigger board column load after boards are fetched
    });
    fetchByProject(projectId);
  }, [projectId, fetchProjects, fetchReplicants, fetchForProject, fetchByProject]);

  // Load columns once boards are available
  useEffect(() => {
    if (boards.length > 0 && projectId) {
      const projectBoard = boards.find((b) => b.project_id === projectId);
      if (projectBoard) {
        fetchWithColumns(projectBoard.id);
      }
    }
  }, [boards, projectId, fetchWithColumns]);

  const loading = boardsLoading || threadsLoading;

  if (!projectId) {
    return <ErrorState title="No project selected" description="Please select a project." />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board header bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-6 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{project?.name ?? 'Board'}</h2>
          {project?.description && (
            <p className="truncate text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateThreadOpen(true)}>
          <Plus className="mr-1.5 size-4" /> New Thread
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-4 pb-2 md:snap-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm">No board configured for this project.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-4 pb-2 md:snap-none">
          {columns
            .filter((c) => boards.some((b) => b.id === c.board_id && b.project_id === projectId))
            .map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                threads={threads}
                replicants={replicants}
                onThreadClick={(id) => navigate(`/threads/${id}`)}
              />
            ))}
        </div>
      )}

      <ThreadForm
        open={createThreadOpen}
        onOpenChange={setCreateThreadOpen}
        projectId={projectId}
        onCreated={(thread) => {
          // threads store already updated by ThreadForm; navigate to new thread
          navigate(`/threads/${thread.id}`);
        }}
      />
    </div>
  );
}
