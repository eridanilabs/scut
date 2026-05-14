import { create } from 'zustand';
import { projectsApi } from '@/api/projects';
import type { Project } from '@/api/types';

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetch(): Promise<void>;
  create(input: { name: string; description: string }): Promise<Project>;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const projects = await projectsApi.list();
      set({ projects, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async create(input) {
    const project = await projectsApi.create(input);
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },
}));
