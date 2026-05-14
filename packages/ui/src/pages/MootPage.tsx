import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects';
import { useBoardsStore } from '@/stores/boards';
import { useThreadsStore } from '@/stores/threads';
import { useBobsStore } from '@/stores/bobs';
import { ThreadCard } from '@/components/thread/ThreadCard';
import { ThreadForm } from '@/components/thread/ThreadForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ErrorState';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Column, Thread, Bob } from '@/api/types';

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
  bobs: Bob[];
  onThreadClick: (threadId: string) => void;
}

function BoardColumn({ column, threads, bobs, onThreadClick }: BoardColumnProps) {
  const columnThreads = threads.filter(
    (t) => !column.filter_rule.status || t.status === column.filter_rule.status,
  );
  const bobMap = Object.fromEntries(bobs.map((b) => [b.id, b]));

  return (
    <div className="flex w-72 flex-shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <span className="text-xs text-muted-foreground">{columnThreads.length}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 pr-2">
          {columnThreads.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No threads</p>
          ) : (
            columnThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                bob={thread.bob_id ? bobMap[thread.bob_id] : undefined}
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
  const { bobs, fetch: fetchBobs } = useBobsStore();
  const [createThreadOpen, setCreateThreadOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!projectId) return;
    fetchProjects();
    fetchBobs();
    fetchForProject(projectId).then(() => {
      // Will trigger board column load after boards are fetched
    });
    fetchByProject(projectId);
  }, [projectId, fetchProjects, fetchBobs, fetchForProject, fetchByProject]);

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{project?.name ?? 'Board'}</h2>
          {project?.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Button onClick={() => setCreateThreadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Thread
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <p>No board configured for this project.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns
            .filter((c) => boards.some((b) => b.id === c.board_id && b.project_id === projectId))
            .map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                threads={threads}
                bobs={bobs}
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
