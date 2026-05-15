import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useThreadsStore } from '@/stores/threads';
import { useReplicantsStore } from '@/stores/replicants';
import { ThreadStatusBadge } from '@/components/thread/ThreadStatusBadge';
import { RunStatusBadge } from '@/components/run/RunStatusBadge';
import { ReplicantSelector } from '@/components/replicant/ReplicantSelector';
import { ThreadStatusSelector } from '@/components/thread/ThreadStatusSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/utils';

export function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { selected, messages, runs, loading, sending, error, fetchDetail, update, sendMessage } =
    useThreadsStore();
  const { replicants, fetch: fetchReplicants } = useReplicantsStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadId) return;
    fetchDetail(threadId);
    fetchReplicants();
  }, [threadId, fetchDetail, fetchReplicants]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || sending) return;
    const content = input.trim();
    setInput('');
    await sendMessage(threadId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !selected) {
    return (
      <div className="px-6 py-6">
        <ErrorState title="Thread not found" description={error ?? 'This thread does not exist.'} onRetry={() => threadId && fetchDetail(threadId)} />
      </div>
    );
  }

  const runMap = Object.fromEntries(runs.map((r) => [r.id, r]));

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Left panel - thread info */}
      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-sidebar p-4 md:flex">
        <div>
          <h2 className="text-lg font-semibold leading-snug">{selected.title}</h2>
          {selected.description && (
            <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <ThreadStatusSelector
              value={selected.status}
              onChange={(val) => threadId && update(threadId, { status: val })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Assigned Replicant</label>
            <ReplicantSelector
              value={selected.replicant_id}
              onChange={(val) => threadId && update(threadId, { replicant_id: val })}
              replicants={replicants}
            />
          </div>
        </div>

        <Separator />

        {/* Run history */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Run History</h3>
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...runs].reverse().map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <RunStatusBadge status={run.status} />
                    <span className="text-muted-foreground">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">
                    {run.input.slice(0, 80)}{run.input.length > 80 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right panel - messages */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 overflow-hidden bg-muted/5">
          <div className="p-4">
            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No messages yet. Send one to start the thread.
                </p>
              ) : (
                messages.map((msg) => {
                  const run = msg.run_id ? runMap[msg.run_id] : null;

                  if (msg.author === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="mx-auto rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  const isHuman = msg.author === 'human';
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex flex-col gap-1', isHuman ? 'items-end' : 'items-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                          isHuman
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-muted text-foreground',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {run && <RunStatusBadge status={run.status} />}
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>

        <form className="shrink-0 border-t bg-background p-4" onSubmit={handleSend}>
          <div className="flex items-end gap-2">
            <Textarea
              className="min-h-[2.5rem] flex-1 resize-none"
              rows={2}
              placeholder="Send a message... (Ctrl+Enter)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <Button type="submit" size="icon" className="shrink-0" disabled={sending || !input.trim()}>
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
