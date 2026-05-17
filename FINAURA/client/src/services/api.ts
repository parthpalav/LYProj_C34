import axios from 'axios';
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

export const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 8000 });

export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export async function registerUser(payload: { name: string; email: string; password: string }) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function loginUser(payload: { email: string; password: string }) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function submitOnboarding(payload: any) {
  const { data } = await api.post('/user/onboarding', payload);
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/user/profile');
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
