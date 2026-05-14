import type { DmSession, DmMessage } from './types';
import { mockFetch } from './client';
import {
  getMockDmSessions,
  getAllMockDmSessions,
  createMockDmSession,
  renameMockDmSession,
  getMockDmMessages,
  addMockDmMessage,
} from './mock';

export const dmApi = {
  listSessions(agentId: string): Promise<DmSession[]> {
    return mockFetch(() => getMockDmSessions(agentId));
  },
  allSessions(): Promise<DmSession[]> {
    return mockFetch(() => getAllMockDmSessions());
  },
  createSession(agentId: string): Promise<DmSession> {
    return mockFetch(() => createMockDmSession(agentId));
  },
  renameSession(sessionId: string, title: string): Promise<void> {
    return mockFetch(() => renameMockDmSession(sessionId, title));
  },
  listMessages(sessionId: string): Promise<DmMessage[]> {
    return mockFetch(() => getMockDmMessages(sessionId));
  },
  sendMessage(sessionId: string, content: string): Promise<DmMessage> {
    return mockFetch(() => addMockDmMessage(sessionId, content));
  },
};
