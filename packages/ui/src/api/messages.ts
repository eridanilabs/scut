import type { Message, Run } from './types';
import { mockFetch } from './client';
import {
  getMockMessages,
  createMockMessage,
  getMockThread,
  createMockRun,
  updateMockRun,
} from './mock';

const BOB_REPLY_DELAY = 800;

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

    if (!thread?.bob_id) {
      return { message: humanMessage, run: null };
    }

    // Create a run in 'created' status to return immediately
    const run = createMockRun({
      thread_id: threadId,
      bob_id: thread.bob_id,
      status: 'created',
      input_text: content,
    });

    // Simulate bob reply after delay
    setTimeout(() => {
      const completedRun = updateMockRun(run.id, threadId, {
        status: 'completed',
        output: `Bob has processed your request: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
        completed_at: new Date().toISOString(),
      });

      createMockMessage({
        thread_id: threadId,
        author: 'bob',
        content:
          completedRun?.output ??
          `I have received your message and am working on it.`,
        run_id: run.id,
      });
    }, BOB_REPLY_DELAY);

    return { message: humanMessage, run };
  },
};
