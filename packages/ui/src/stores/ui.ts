import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  selectedProjectId: string | null;
  selectedBoardId: string | null;
  createProjectOpen: boolean;
  createThreadOpen: boolean;
  sidebarCollapsed: boolean;
  setSelectedProject: (id: string | null) => void;
  setSelectedBoard: (id: string | null) => void;
  setCreateProjectOpen: (open: boolean) => void;
  setCreateThreadOpen: (open: boolean) => void;
  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedBoardId: null,
      createProjectOpen: false,
      createThreadOpen: false,
      sidebarCollapsed: false,

      setSelectedProject: (id) => set({ selectedProjectId: id }),
      setSelectedBoard: (id) => set({ selectedBoardId: id }),
      setCreateProjectOpen: (open) => set({ createProjectOpen: open }),
      setCreateThreadOpen: (open) => set({ createThreadOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'scut-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
