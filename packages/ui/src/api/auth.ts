import { mockFetch } from './client';

export interface AuthResult {
  token: string;
}

export const authApi = {
  login(username: string, password: string): Promise<AuthResult> {
    return mockFetch(() => {
      if (!username.trim() || !password.trim()) {
        throw new Error('Invalid credentials');
      }
      return { token: `mock-token-${username}` };
    });
  },
};
