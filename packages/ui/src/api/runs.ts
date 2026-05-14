import type { Run } from './types';
import { mockFetch } from './client';
import { getMockRuns } from './mock';

export const runsApi = {
  listByThread(threadId: string): Promise<Run[]> {
    return mockFetch(() => getMockRuns(threadId));
  },
};
