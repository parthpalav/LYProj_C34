import { create } from 'zustand';
import { loginUser, registerUser, setAuthToken, submitOnboarding } from '../services/api';
import { User } from '../types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  onboardingCompleted: boolean;
  loading: boolean;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  completeOnboarding: (payload: any) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  onboardingCompleted: false,
  loading: false,

  register: async (payload) => {
    set({ loading: true });
    const res = await registerUser(payload);
    setAuthToken(res.token);
    set({ user: res.user, token: res.token, onboardingCompleted: !!res.user?.onboardingCompleted, loading: false });
  },

  login: async (payload) => {
    set({ loading: true });
    const res = await loginUser(payload);
    setAuthToken(res.token);
    set({ user: res.user, token: res.token, onboardingCompleted: !!res.user?.onboardingCompleted, loading: false });
  },

  logout: () => {
    setAuthToken(undefined);
    set({ user: null, token: null, onboardingCompleted: false });
  },

  completeOnboarding: async (payload) => {
    const res = await submitOnboarding(payload);
    const user = res.user || get().user;
    set({ user, onboardingCompleted: true });
  }
}));
