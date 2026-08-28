import { create } from 'zustand';
import {
  loginUser,
  registerUser,
  logoutUser,
  setAuthToken,
  submitOnboarding,
  updateUserProfileApi,
  getMeUser,
  forgotPasswordUser,
  resetPasswordUser,
  resendVerificationUser
} from '../services/api';
import { secureStorage } from '../utils/secureStorage';
import { User } from '../types';
import {
  loginClientSchema,
  registerClientSchema,
  forgotPasswordClientSchema,
  resetPasswordClientSchema
} from '../utils/authValidation';
import { useStore } from './useStore';

interface AuthState {
  user: User | null;
  token: string | null;
  onboardingCompleted: boolean;
  showWelcome: boolean;
  loading: boolean;
  initializing: boolean;
  authError: string | null;
  fieldErrors: Record<string, string>;

  initAuth: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<boolean>;
  register: (payload: { name: string; email: string; password: string; confirmPassword: string; incomeType?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  dismissWelcome: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (payload: { token: string; password: string; confirmPassword: string }) => Promise<{ success: boolean; message: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; message: string }>;
  completeOnboarding: (payload: Partial<User>) => Promise<boolean>;
  updateUserProfile: (payload: Partial<User>) => Promise<boolean>;
  setUser: (user: User | null) => void;
  clearErrors: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  onboardingCompleted: false,
  showWelcome: false,
  loading: false,
  initializing: true,
  authError: null,
  fieldErrors: {},

  setUser: (user) => set({ user }),
  dismissWelcome: () => set({ showWelcome: false }),
  clearErrors: () => set({ authError: null, fieldErrors: {} }),

  initAuth: async () => {
    set({ initializing: true });
    try {
      const accessToken = await secureStorage.getAccessToken();
      if (accessToken) {
        setAuthToken(accessToken);
        const res = await getMeUser();
        if (res.user) {
          const isComplete = Boolean(res.user.onboardingComplete || res.user.onboardingCompleted);
          set({
            user: res.user,
            token: accessToken,
            onboardingCompleted: isComplete
          });
        }
      }
    } catch {
      await secureStorage.clearTokens();
      setAuthToken(undefined);
      useStore.getState().resetStore();
    } finally {
      set({ initializing: false });
    }
  },

  register: async (payload) => {
    set({ loading: true, authError: null, fieldErrors: {} });

    // Client-side Zod validation
    const val = registerClientSchema.safeParse(payload);
    if (!val.success) {
      const formattedErrors: Record<string, string> = {};
      val.error.issues.forEach((issue) => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return false;
    }

    try {
      const res = await registerUser({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        incomeType: payload.incomeType
      });

      const token = res.accessToken || res.token;
      await secureStorage.saveTokens(token, res.refreshToken);
      setAuthToken(token);
      const isComplete = Boolean(res.user?.onboardingComplete || res.user?.onboardingCompleted);

      set({
        user: res.user,
        token,
        onboardingCompleted: isComplete
      });
      return true;
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        set({ fieldErrors: responseData.errors });
      } else {
        set({ authError: responseData?.error || responseData?.message || 'Registration failed. Please try again.' });
      }
      return false;
    } finally {
      set({ loading: false });
    }
  },

  login: async (payload) => {
    set({ loading: true, authError: null, fieldErrors: {} });

    // Client-side Zod validation
    const val = loginClientSchema.safeParse(payload);
    if (!val.success) {
      const formattedErrors: Record<string, string> = {};
      val.error.issues.forEach((issue) => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return false;
    }

    try {
      const res = await loginUser(payload);
      const token = res.accessToken || res.token;
      await secureStorage.saveTokens(token, res.refreshToken);
      setAuthToken(token);
      const isComplete = Boolean(res.user?.onboardingComplete || res.user?.onboardingCompleted);

      set({
        user: res.user,
        token,
        onboardingCompleted: isComplete,
        showWelcome: isComplete // Explicit login triggers Welcome only if user is already onboarded
      });
      return true;
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        set({ fieldErrors: responseData.errors });
      } else {
        set({ authError: responseData?.error || responseData?.message || 'Login failed. Please verify credentials or connection.' });
      }
      return false;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await secureStorage.clearTokens();
      setAuthToken(undefined);
      useStore.getState().resetStore();
      set({
        user: null,
        token: null,
        onboardingCompleted: false,
        showWelcome: false,
        loading: false,
        authError: null,
        fieldErrors: {}
      });
    }
  },

  forgotPassword: async (email: string) => {
    set({ loading: true, authError: null, fieldErrors: {} });

    const val = forgotPasswordClientSchema.safeParse({ email });
    if (!val.success) {
      const formattedErrors: Record<string, string> = {};
      val.error.issues.forEach((issue) => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return { success: false, message: formattedErrors.email || 'Validation error' };
    }

    try {
      const res = await forgotPasswordUser(email);
      return { success: true, message: res.message };
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Password reset request failed.';
      set({ authError: message });
      return { success: false, message };
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (payload) => {
    set({ loading: true, authError: null, fieldErrors: {} });

    const val = resetPasswordClientSchema.safeParse(payload);
    if (!val.success) {
      const formattedErrors: Record<string, string> = {};
      val.error.issues.forEach((issue) => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return { success: false, message: 'Validation failed' };
    }

    try {
      const res = await resetPasswordUser({ token: payload.token, password: payload.password });
      return { success: true, message: res.message };
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Password reset failed.';
      set({ authError: message });
      return { success: false, message };
    } finally {
      set({ loading: false });
    }
  },

  resendVerification: async (email: string) => {
    set({ loading: true });
    try {
      const res = await resendVerificationUser(email);
      return { success: true, message: res.message };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'Resending email failed'
      };
    } finally {
      set({ loading: false });
    }
  },

  completeOnboarding: async (payload: Partial<User>) => {
    set({ loading: true, authError: null });
    try {
      const res = await submitOnboarding(payload);
      const user = res.user || get().user;
      set({ user, onboardingCompleted: true, showWelcome: false, loading: false });
      return true;
    } catch (error: any) {
      console.error('Onboarding submission failed:', error);
      set({ loading: false, authError: error.response?.data?.error || 'Failed to complete onboarding' });
      return false;
    }
  },

  updateUserProfile: async (payload: Partial<User>) => {
    set({ loading: true, authError: null, fieldErrors: {} });
    try {
      const res = await updateUserProfileApi(payload);
      if (res.user) {
        set({ user: res.user });
      }
      return true;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update profile details.';
      set({ authError: message });
      return false;
    } finally {
      set({ loading: false });
    }
  }
}));
