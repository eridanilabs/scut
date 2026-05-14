import { create } from 'zustand';
import { authApi } from '@/api/auth';

const TOKEN_KEY = 'scut_token';

interface AuthState {
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  error: null,
  loading: false,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const { token } = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ isAuthenticated: true, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Login failed',
        loading: false,
      });
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    set({ isAuthenticated: false });
  },
}));
