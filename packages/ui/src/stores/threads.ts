import { create } from 'zustand';
import { threadsApi } from '@/api/threads';
import { messagesApi } from '@/api/messages';
import { runsApi } from '@/api/runs';
import type { Thread, Message, Run } from '@/api/types';

interface ThreadsState {
  threads: Thread[];
  selected: Thread | null;
  messages: Message[];
  runs: Run[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  fetchByProject(projectId: string, filters?: { status?: string; bob_id?: string }): Promise<void>;
  fetchDetail(threadId: string): Promise<void>;
  create(input: { project_id: string; title: string; description: string }): Promise<Thread>;
  update(id: string, patch: { status?: string; bob_id?: string | null }): Promise<void>;
  sendMessage(threadId: string, content: string): Promise<void>;
}

export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  selected: null,
  messages: [],
  runs: [],
  loading: false,
  sending: false,
  error: null,

  async fetchByProject(projectId, filters) {
    set({ loading: true, error: null });
    try {
      const threads = await threadsApi.listByProject(projectId, filters);
      set({ threads, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async fetchDetail(threadId) {
    set({ loading: true, error: null });
    try {
      const [thread, messages, runs] = await Promise.all([
        threadsApi.get(threadId),
        messagesApi.list(threadId),
        runsApi.listByThread(threadId),
      ]);
      set({ selected: thread, messages, runs, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async create(input) {
    const thread = await threadsApi.create(input);
    set((s) => ({ threads: [...s.threads, thread] }));
    return thread;
  },

  async update(id, patch) {
    const thread = await threadsApi.update(id, patch);
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? thread : t)),
      selected: s.selected?.id === id ? thread : s.selected,
    }));
  },

  async sendMessage(threadId, content) {
    set({ sending: true });
    try {
      const { message, run } = await messagesApi.create(threadId, content);
      set((s) => ({
        messages: [...s.messages, message],
        runs: run ? [...s.runs, run] : s.runs,
        sending: false,
      }));

      // Poll for bob reply after delay
      if (run) {
        setTimeout(async () => {
          const [messages, runs] = await Promise.all([
            messagesApi.list(threadId),
            runsApi.listByThread(threadId),
          ]);
          const current = get();
          // Only update if we're still viewing the same thread
          if (current.selected?.id === threadId) {
            set({ messages, runs });
          }
        }, 1000);
      }
    } catch (e) {
      set({ error: String(e), sending: false });
    }
  },
}));
