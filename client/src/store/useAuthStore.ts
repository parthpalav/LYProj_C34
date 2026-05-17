import { create } from 'zustand';
import { loginUser, registerUser, setAuthToken } from '../services/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  dateOfBirth?: string | null;
  retirementAge?: number | null;
  monthlyIncome?: number | null;
  onboardingComplete?: boolean;
  incomeType?: string;
  goals?: string[];
  currentBalance?: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  login: async (payload) => {
    set({ loading: true, error: null });
    try {
      const res = await loginUser(payload);
      setAuthToken(res.token);
      set({ user: res.user, token: res.token, loading: false, error: null });
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err?.message === 'Network Error'
          ? 'Unable to connect to server. Is the backend running?'
          : 'Login failed. Please try again.');
      set({ loading: false, error: message });
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const res = await registerUser(payload);
      setAuthToken(res.token);
      set({ user: res.user, token: res.token, loading: false, error: null });
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err?.message === 'Network Error'
          ? 'Unable to connect to server. Is the backend running?'
          : 'Registration failed. Please try again.');
      set({ loading: false, error: message });
    }
  },

  logout: () => {
    setAuthToken(undefined);
    set({ user: null, token: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
