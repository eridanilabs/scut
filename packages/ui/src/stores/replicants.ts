import { create } from 'zustand';
import { replicantsApi } from '@/api/replicants';
import type { Replicant } from '@/api/types';

interface ReplicantsState {
  replicants: Replicant[];
  loading: boolean;
  error: string | null;
  fetch(): Promise<void>;
  create(input: { name: string; harness: string }): Promise<Replicant>;
}

export const useReplicantsStore = create<ReplicantsState>((set, get) => ({
  replicants: [],
  loading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const replicants = await replicantsApi.list();
      set({ replicants, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async create(input) {
    const replicant = await replicantsApi.create(input);
    set({ replicants: [...get().replicants, replicant] });
    return replicant;
  },
}));
