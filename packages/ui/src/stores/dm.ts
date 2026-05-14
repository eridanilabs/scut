import { create } from 'zustand';
import { dmApi } from '@/api/dm';
import type { DmSession, DmMessage } from '@/api/types';

interface DmState {
  sessions: Record<string, DmSession[]>;
  messages: Record<string, DmMessage[]>;
  loadingSessions: boolean;
  loadingMessages: boolean;
  fetchSessions(agentId: string): Promise<void>;
  createSession(agentId: string): Promise<DmSession>;
  renameSession(sessionId: string, title: string): Promise<void>;
  fetchMessages(sessionId: string): Promise<void>;
  sendMessage(sessionId: string, content: string): Promise<DmMessage>;
}

export const useDmStore = create<DmState>((set, get) => ({
  sessions: {},
  messages: {},
  loadingSessions: false,
  loadingMessages: false,

  async fetchSessions(agentId) {
    set({ loadingSessions: true });
    const sessions = await dmApi.listSessions(agentId);
    set(s => ({ sessions: { ...s.sessions, [agentId]: sessions }, loadingSessions: false }));
  },

  async createSession(agentId) {
    const session = await dmApi.createSession(agentId);
    set(s => ({
      sessions: { ...s.sessions, [agentId]: [session, ...(s.sessions[agentId] ?? [])] },
      messages: { ...s.messages, [session.id]: [] },
    }));
    return session;
  },

  async renameSession(sessionId, title) {
    await dmApi.renameSession(sessionId, title);
    set(s => {
      const newSessions = { ...s.sessions };
      for (const agentId of Object.keys(newSessions)) {
        newSessions[agentId] = newSessions[agentId].map(sess =>
          sess.id === sessionId ? { ...sess, title } : sess
        );
      }
      return { sessions: newSessions };
    });
  },

  async fetchMessages(sessionId) {
    set({ loadingMessages: true });
    const messages = await dmApi.listMessages(sessionId);
    set(s => ({ messages: { ...s.messages, [sessionId]: messages }, loadingMessages: false }));
  },

  async sendMessage(sessionId, content) {
    const msg = await dmApi.sendMessage(sessionId, content);
    set(s => ({
      messages: { ...s.messages, [sessionId]: [...(s.messages[sessionId] ?? []), msg] },
    }));
    // Also refresh sessions for all agents to update preview
    const allAgentIds = Object.keys(get().sessions);
    for (const agentId of allAgentIds) {
      void dmApi.listSessions(agentId).then(sessions => {
        set(s => ({ sessions: { ...s.sessions, [agentId]: sessions } }));
      });
    }
    return msg;
  },
}));
