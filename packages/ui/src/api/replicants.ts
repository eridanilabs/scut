import type { Replicant } from './types';
import { mockFetch } from './client';
import { getMockReplicants, mockReplicants, createMockReplicant } from './mock';

export const replicantsApi = {
  list(): Promise<Replicant[]> {
    return mockFetch(() => getMockReplicants());
  },

  get(id: string): Promise<Replicant | null> {
    return mockFetch(() => mockReplicants.find((r) => r.id === id) ?? null);
  },

  create(input: { name: string; harness: string }): Promise<Replicant> {
    return mockFetch(() => createMockReplicant(input));
  },
};
