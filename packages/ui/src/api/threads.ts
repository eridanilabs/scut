import type { Thread } from './types';
import { mockFetch } from './client';
import { getMockThreads, getMockThread, createMockThread, updateMockThread } from './mock';

export const threadsApi = {
  listByProject(
    projectId: string,
    filters?: { status?: string; bob_id?: string },
  ): Promise<Thread[]> {
    return mockFetch(() => getMockThreads(projectId, filters));
  },

  get(id: string): Promise<Thread | null> {
    return mockFetch(() => getMockThread(id));
  },

  create(input: {
    project_id: string;
    title: string;
    description: string;
    bob_id?: string | null;
  }): Promise<Thread> {
    return mockFetch(() => createMockThread(input));
  },

  update(id: string, patch: { status?: string; bob_id?: string | null }): Promise<Thread> {
    return mockFetch(() => {
      const updated = updateMockThread(id, patch as Partial<Thread>);
      if (!updated) throw new Error(`Thread ${id} not found`);
      return updated;
    });
  },
};
