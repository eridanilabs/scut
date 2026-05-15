import type { Message, Run } from './types';
import { mockFetch } from './client';
import {
  getMockMessages,
  createMockMessage,
  getMockThread,
  createMockRun,
  updateMockRun,
} from './mock';

const REPLICANT_REPLY_DELAY = 800;

export const messagesApi = {
  list(threadId: string): Promise<Message[]> {
    return mockFetch(() => getMockMessages(threadId));
  },

  async create(
    threadId: string,
    content: string,
  ): Promise<{ message: Message; run: Run | null }> {
    await new Promise((r) => setTimeout(r, 50));

    const humanMessage = createMockMessage({
      thread_id: threadId,
      author: 'human',
      content,
    });

    const thread = getMockThread(threadId);

    if (!thread?.replicant_id) {
      return { message: humanMessage, run: null };
    }

    // Create a run in 'created' status to return immediately
    const run = createMockRun({
      thread_id: threadId,
      replicant_id: thread.replicant_id,
      status: 'created',
      input_text: content,
    });

    // Simulate replicant reply after delay
    setTimeout(() => {
      const completedRun = updateMockRun(run.id, threadId, {
        status: 'completed',
        output: `Replicant has processed your request: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
        completed_at: new Date().toISOString(),
      });

      createMockMessage({
        thread_id: threadId,
        author: 'replicant',
        content:
          completedRun?.output ??
          `I have received your message and am working on it.`,
        run_id: run.id,
      });
    }, REPLICANT_REPLY_DELAY);

    return { message: humanMessage, run };
  },
};
