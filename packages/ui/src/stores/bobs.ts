import { create } from 'zustand';
import { bobsApi } from '@/api/bobs';
import type { Bob } from '@/api/types';

interface BobsState {
  bobs: Bob[];
  loading: boolean;
  error: string | null;
  fetch(): Promise<void>;
}

export const useBobsStore = create<BobsState>((set) => ({
  bobs: [],
  loading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const bobs = await bobsApi.list();
      set({ bobs, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
