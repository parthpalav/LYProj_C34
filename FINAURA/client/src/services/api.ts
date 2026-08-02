import axios from 'axios';
import { Platform } from 'react-native';
import { secureStorage } from '../utils/secureStorage';

import Constants from 'expo-constants';

// For physical devices using Expo Go, localhost will refer to the device itself.
// We dynamically resolve the dev machine IP that Metro is running on.
const hostUri = Constants.expoConfig?.hostUri;
const localIp = hostUri ? hostUri.split(':')[0] : '192.168.1.113'; 

const BASE_URL = Platform.OS === 'android' && !hostUri
  ? 'http://10.0.2.2:4000'
  : `http://${localIp}:4000`;

export const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 10000 });

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Automatic 401 Refresh Token Interceptor
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await secureStorage.getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken: storedRefreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data;

        await secureStorage.saveTokens(accessToken, newRefreshToken);
        setAuthToken(accessToken);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await secureStorage.clearTokens();
        setAuthToken(undefined);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth Endpoints
export async function registerUser(payload: { name: string; email: string; password: string }) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function loginUser(payload: { email: string; password: string }) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function logoutUser(refreshToken?: string) {
  const { data } = await api.post('/auth/logout', { refreshToken });
  return data;
}

export async function forgotPasswordUser(email: string) {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPasswordUser(payload: { token: string; password: string }) {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
}

export async function verifyEmailUser(token: string) {
  const { data } = await api.post('/auth/verify-email', { token });
  return data;
}

export async function resendVerificationUser(email: string) {
  const { data } = await api.post('/auth/resend-verification', { email });
  return data;
}

export async function getMeUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Existing Application Endpoints
export async function submitOnboarding(payload: any) {
  const { data } = await api.post('/user/onboarding', payload);
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/user/profile');
  return data;
}

export async function updateUserProfileApi(payload: any) {
  const { data } = await api.put('/user/profile', payload);
  return data;
}

export async function updateBalance(currentBalance: number) {
  const { data } = await api.put('/user/balance', { currentBalance });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get('/dashboard');
  return data;
}

export async function getExpenses() {
  const { data } = await api.get('/expenses');
  return data;
}

export async function createExpense(payload: any) {
  const { data } = await api.post('/expenses', payload);
  return data;
}

export async function getMonthlySummary() {
  const { data } = await api.get('/expenses/monthly-summary');
  return data;
}

export async function getFmi() {
  const { data } = await api.get('/fmi');
  return data;
}

export async function getFmiHistory() {
  const { data } = await api.get('/fmi/history');
  return data;
}

export async function sendChatMessage(message: string) {
  const { data } = await api.post('/chatbot/message', { message });
  return data;
}
