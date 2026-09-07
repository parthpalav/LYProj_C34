import React, { useState, useEffect, useCallback } from 'react';
import type { User, LoginPayload, RegisterPayload } from '../types';
import { AuthContext } from './auth-context-base';
import {
  tokenStorage,
  setAuthToken,
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from '../services/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        tokenStorage.clearTokens();
        setAuthToken(null);
        setUser(null);
      }
    } catch {
      tokenStorage.clearTokens();
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      const accessToken = tokenStorage.getAccessToken();
      const refreshToken = tokenStorage.getRefreshToken();

      // If neither token is present, we are definitely unauthenticated
      if (!accessToken && !refreshToken) {
        setIsLoading(false);
        return;
      }

      // Attach token and attempt verification
      setAuthToken(accessToken);
      try {
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, [refreshUser]);

  const login = async (payload: LoginPayload) => {
    const response = await loginUser(payload);
    if (response.success) {
      const access = response.accessToken || response.token!;
      tokenStorage.setTokens(access, response.refreshToken);
      setAuthToken(access);
      setUser(response.user);
    }
  };

  const register = async (payload: RegisterPayload) => {
    const response = await registerUser(payload);
    if (response.success) {
      const access = response.accessToken || response.token!;
      tokenStorage.setTokens(access, response.refreshToken);
      setAuthToken(access);
      setUser(response.user);
    }
  };

  const logout = async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
    } catch {
      // Gracefully ignore network errors on logout to never trap the user
    } finally {
      tokenStorage.clearTokens();
      setAuthToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
