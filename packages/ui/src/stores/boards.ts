import { create } from 'zustand';
import { boardsApi } from '@/api/boards';
import type { Board, Column } from '@/api/types';

interface BoardsState {
  boards: Board[];
  columns: Column[];
  loading: boolean;
  error: string | null;
  fetchForProject(projectId: string): Promise<void>;
  fetchWithColumns(boardId: string): Promise<void>;
}

export const useBoardsStore = create<BoardsState>((set) => ({
  boards: [],
  columns: [],
  loading: false,
  error: null,

  async fetchForProject(projectId: string) {
    set({ loading: true, error: null });
    try {
      const boards = await boardsApi.listByProject(projectId);
      set({ boards, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async fetchWithColumns(boardId: string) {
    set({ loading: true, error: null });
    try {
      const { board, columns } = await boardsApi.getWithColumns(boardId);
      set((s) => ({
        boards: s.boards.some((b) => b.id === board.id)
          ? s.boards.map((b) => (b.id === board.id ? board : b))
          : [...s.boards, board],
        columns,
        loading: false,
      }));
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
