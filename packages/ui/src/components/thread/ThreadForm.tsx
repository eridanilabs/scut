import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { threadsApi } from '@/api/threads';
import { useBobsStore } from '@/stores/bobs';
import { BobSelector } from '@/components/bob/BobSelector';
import type { Thread } from '@/api/types';

interface ThreadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: (thread: Thread) => void;
}

export function ThreadForm({ open, onOpenChange, projectId, onCreated }: ThreadFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bobId, setBobId] = useState<string | null>(null);
  const { bobs, fetch: fetchBobs } = useBobsStore();

  useEffect(() => {
    fetchBobs();
  }, [fetchBobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const thread = await threadsApi.create({
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        bob_id: bobId,
      });
      onCreated(thread);
      setTitle('');
      setDescription('');
      setBobId(null);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create thread');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Thread</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-description">Description</Label>
            <Textarea
              id="thread-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-bob">Assigned Bob</Label>
            <BobSelector value={bobId} onChange={setBobId} bobs={bobs} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Creating...' : 'Create Thread'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
