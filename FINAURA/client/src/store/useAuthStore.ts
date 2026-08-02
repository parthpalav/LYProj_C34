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
import { useFinanceStore } from './useFinanceStore';
import { secureStorage } from '../utils/secureStorage';
import { User } from '../types/user';
import { loginClientSchema, registerClientSchema, forgotPasswordClientSchema, resetPasswordClientSchema } from '../utils/authValidation';

interface AuthState {
  user: User | null;
  token: string | null;
  onboardingCompleted: boolean;
  loading: boolean;
  initializing: boolean;
  authError: string | null;
  fieldErrors: Record<string, string>;
  updateUserProfile: (payload: any) => Promise<boolean>;
  
  initAuth: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<boolean>;
  register: (payload: { name: string; email: string; password: string; confirmPassword: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (payload: { token: string; password: string; confirmPassword: string }) => Promise<{ success: boolean; message: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; message: string }>;
  completeOnboarding: (payload: any) => Promise<void>;
  clearErrors: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  onboardingCompleted: false,
  loading: false,
  initializing: true,
  authError: null,
  fieldErrors: {},

  clearErrors: () => set({ authError: null, fieldErrors: {} }),

  initAuth: async () => {
    set({ initializing: true });
    try {
      const accessToken = await secureStorage.getAccessToken();
      if (accessToken) {
        setAuthToken(accessToken);
        const res = await getMeUser();
        if (res.user) {
          set({
            user: res.user,
            token: accessToken,
            onboardingCompleted: !!res.user.onboardingCompleted
          });
        }
      }
    } catch {
      await secureStorage.clearTokens();
      setAuthToken(undefined);
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
      val.error.issues.forEach(issue => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return false;
    }

    try {
      const res = await registerUser({ name: payload.name, email: payload.email, password: payload.password });
      await secureStorage.saveTokens(res.accessToken, res.refreshToken);
      setAuthToken(res.accessToken);
      set({
        user: res.user,
        token: res.accessToken,
        onboardingCompleted: !!res.user?.onboardingCompleted
      });
      return true;
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        set({ fieldErrors: responseData.errors });
      } else {
        set({ authError: responseData?.message || 'Registration failed. Please check your network connection.' });
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
      val.error.issues.forEach(issue => {
        const path = issue.path[0]?.toString() || 'general';
        formattedErrors[path] = issue.message;
      });
      set({ fieldErrors: formattedErrors, loading: false });
      return false;
    }

    try {
      const res = await loginUser(payload);
      await secureStorage.saveTokens(res.accessToken, res.refreshToken);
      setAuthToken(res.accessToken);
      set({
        user: res.user,
        token: res.accessToken,
        onboardingCompleted: !!res.user?.onboardingCompleted
      });
      return true;
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        set({ fieldErrors: responseData.errors });
      } else {
        set({ authError: responseData?.message || 'Login failed. Please verify credentials or connection.' });
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
      set({ user: null, token: null, onboardingCompleted: false, loading: false, authError: null, fieldErrors: {} });
    }
  },

  forgotPassword: async (email: string) => {
    set({ loading: true, authError: null, fieldErrors: {} });

    const val = forgotPasswordClientSchema.safeParse({ email });
    if (!val.success) {
      const formattedErrors: Record<string, string> = {};
      val.error.issues.forEach(issue => {
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
      const message = error.response?.data?.message || 'Password reset request failed.';
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
      val.error.issues.forEach(issue => {
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
      const message = error.response?.data?.message || 'Password reset failed.';
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
      return { success: false, message: error.response?.data?.message || 'Resending email failed' };
    } finally {
      set({ loading: false });
    }
  },

  completeOnboarding: async (payload: any) => {
    try {
      const res = await submitOnboarding(payload);
      const user = res.user || get().user;
      set({ user, onboardingCompleted: true });
      // Refresh downstream financial calculations
      useFinanceStore.getState().fetchDashboard();
      useFinanceStore.getState().fetchFmi();
    } catch (error: any) {
      console.error('Onboarding submission failed:', error);
    }
  },

  updateUserProfile: async (payload: any) => {
    set({ loading: true, authError: null, fieldErrors: {} });
    try {
      const res = await updateUserProfileApi(payload);
      if (res.user) {
        set({ user: res.user });
        // Immediately refresh all downstream financial metrics, dashboard & FMI
        useFinanceStore.getState().fetchDashboard();
        useFinanceStore.getState().fetchFmi();
      }
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile details.';
      set({ authError: message });
      return false;
    } finally {
      set({ loading: false });
    }
  }
}));
