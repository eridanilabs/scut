import type { Board, Column } from './types';
import { mockFetch } from './client';
import { getMockBoards, getMockColumns, mockBoards } from './mock';

export const boardsApi = {
  listByProject(projectId: string): Promise<Board[]> {
    return mockFetch(() => getMockBoards(projectId));
  },

  getWithColumns(boardId: string): Promise<{ board: Board; columns: Column[] }> {
    return mockFetch(() => {
      const board = mockBoards.find((b) => b.id === boardId);
      if (!board) {
        throw new Error(`Board ${boardId} not found`);
      }
      const columns = getMockColumns(boardId);
      return { board, columns };
    });
  },
};
