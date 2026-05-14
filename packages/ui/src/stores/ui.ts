import { create } from 'zustand';

interface UiState {
  selectedProjectId: string | null;
  selectedBoardId: string | null;
  createProjectOpen: boolean;
  createThreadOpen: boolean;
  setSelectedProject: (id: string | null) => void;
  setSelectedBoard: (id: string | null) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setCreateThreadOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedProjectId: null,
  selectedBoardId: null,
  createProjectOpen: false,
  createThreadOpen: false,

  setSelectedProject: (id) => set({ selectedProjectId: id }),
  setSelectedBoard: (id) => set({ selectedBoardId: id }),
  setCreateProjectOpen: (open) => set({ createProjectOpen: open }),
  setCreateThreadOpen: (open) => set({ createThreadOpen: open }),
}));
