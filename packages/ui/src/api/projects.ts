import type { Project } from './types';
import { mockFetch } from './client';
import { getMockProjects, createMockProject } from './mock';

export const projectsApi = {
  list(): Promise<Project[]> {
    return mockFetch(() => getMockProjects());
  },

  get(id: string): Promise<Project | null> {
    return mockFetch(() => getMockProjects().find((p) => p.id === id) ?? null);
  },

  create(input: { name: string; description: string }): Promise<Project> {
    return mockFetch(() => createMockProject(input));
  },
};
