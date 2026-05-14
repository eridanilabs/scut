import type { Bob } from './types';
import { mockFetch } from './client';
import { getMockBobs, mockBobs, createMockBob } from './mock';

export const bobsApi = {
  list(): Promise<Bob[]> {
    return mockFetch(() => getMockBobs());
  },

  get(id: string): Promise<Bob | null> {
    return mockFetch(() => mockBobs.find((b) => b.id === id) ?? null);
  },

  create(input: { name: string; harness: string }): Promise<Bob> {
    return mockFetch(() => createMockBob(input));
  },
};
