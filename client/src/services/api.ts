import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  AlertItem, BehaviorPattern, ChatMessage, DashboardData, EnvelopeData,
  FISData, FMIRecord, Goal, IncomeFlowData, IncomeRecord,
  Transaction, WeeklyReport
} from '../types';

export interface NewTransaction {
  amount:       number;
  category:     string;
  sentiment?:   string;
  description?: string;
  type?:        'Need' | 'Want' | 'Investment';
  confidenceScore?: number;
  timestamp?:   string; // ISO-8601 device timestamp
}

export interface NewGoalPayload {
  name:                string;
  emoji?:              string;
  targetAmount:        number;
  targetDate?:         string;
  monthlyContribution?: number;
}

export interface NewIncomePayload {
  amount:       number;
  source:       'salary' | 'gig' | 'freelance' | 'other';
  description?: string;
}

// ── Base URL ─────────────────────────────────────────────────

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Expo provides various host identifiers depending on environment and SDK.
  // Try common fields (expoConfig.hostUri, expoGoConfig.debuggerHost, manifest.debuggerHost)
  const hostUri =
    (Constants as any).expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri && typeof hostUri === 'string') {
    const expoHost = hostUri
      .replace(/^exp:\/\//, '')
      .replace(/^http:\/\//, '')
      .split(':')[0];
    if (expoHost && expoHost !== 'localhost') return `http://${expoHost}:4000`;
  }

  // Android emulator uses 10.0.2.2 to reach host machine
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  // iOS simulator can use localhost
  if (Platform.OS === 'ios') return 'http://localhost:4000';
  // default to localhost for web and other environments
  return 'http://localhost:4000';
}

const api = axios.create({ baseURL: getApiBaseUrl(), timeout: 10000 });

// ── Dashboard ─────────────────────────────────────────────────
export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/api/dashboard');
  return data;
}

// ── Transactions ──────────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const { data } = await api.get('/api/transactions');
  return data;
}

export async function addTransaction(payload: NewTransaction): Promise<Transaction> {
  const { data } = await api.post('/api/transactions', payload);
  return data;
}

export async function updateTransaction(id: string, payload: Partial<NewTransaction>): Promise<Transaction> {
  const { data } = await api.put(`/api/transactions/${id}`, payload);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/transactions/${id}`);
}

// ── FMI ──────────────────────────────────────────────────────
export async function getFMI(): Promise<{ current: FMIRecord; history: FMIRecord[] }> {
  const [currentRes, historyRes] = await Promise.all([
    api.get('/api/fmi'),
    api.get('/api/fmi/history')
  ]);
  return { current: currentRes.data, history: historyRes.data };
}

// ── Envelopes ─────────────────────────────────────────────────
export async function getEnvelopes(): Promise<EnvelopeData> {
  const { data } = await api.get('/api/envelopes');
  return data;
}

export async function getRoundupPreview(): Promise<{ amount: number, previewText: string }> {
  const { data } = await api.get('/api/envelopes/roundup-preview');
  return data;
}

export async function simulateMicroSavings(amount: number): Promise<{ message: string }> {
  const { data } = await api.post('/api/envelopes/update', { amount });
  return data;
}

// ── Alerts ────────────────────────────────────────────────────
export async function getAlerts(): Promise<AlertItem[]> {
  const { data } = await api.get('/api/alerts');
  return data;
}

// ── Chat ──────────────────────────────────────────────────────
export async function sendMessageToAgent(
  message: string,
  context: Record<string, unknown>
): Promise<ChatMessage> {
  const { data } = await api.post('/api/agent/chat', { message, context });
  return data;
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  const { data } = await api.get('/api/agent/history');
  return data;
}

// ── Goals ─────────────────────────────────────────────────────
export async function getGoals(): Promise<Goal[]> {
  const { data } = await api.get('/api/goals');
  return data;
}

export async function createGoal(payload: NewGoalPayload): Promise<Goal> {
  const { data } = await api.post('/api/goals', payload);
  return data;
}

export async function updateGoal(id: string, payload: Partial<Goal>): Promise<Goal> {
  const { data } = await api.put(`/api/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/api/goals/${id}`);
}

// ── Income ────────────────────────────────────────────────────
export async function getIncome(): Promise<IncomeRecord[]> {
  const { data } = await api.get('/api/income');
  return data;
}

export async function addIncome(payload: NewIncomePayload): Promise<IncomeRecord> {
  const { data } = await api.post('/api/income', payload);
  return data;
}

export async function updateIncome(id: string, payload: Partial<NewIncomePayload>): Promise<IncomeRecord> {
  const { data } = await api.put(`/api/income/${id}`, payload);
  return data;
}

export async function deleteIncome(id: string): Promise<void> {
  await api.delete(`/api/income/${id}`);
}

export async function getIncomeFlow(): Promise<IncomeFlowData> {
  const { data } = await api.get('/api/income/flow');
  return data;
}

// ── FIS ───────────────────────────────────────────────────────
export async function getFIS(): Promise<FISData> {
  const { data } = await api.get('/api/fis');
  return data;
}

// ── Behavior ──────────────────────────────────────────────────
export async function getBehaviorPatterns(): Promise<{ patterns: BehaviorPattern[]; analyzedCount: number }> {
  const { data } = await api.get('/api/behavior');
  return data;
}

// ── Reports ───────────────────────────────────────────────────
export async function getWeeklyReport(): Promise<WeeklyReport> {
  const { data } = await api.get('/api/reports/weekly');
  return data;
}

// ── User ──────────────────────────────────────────────────────
export async function updateUserDOB(userId: string, dateOfBirth: Date): Promise<{ success: boolean }> {
  const { data } = await api.put(`/api/user/${userId}/dob`, { dateOfBirth });
  return data;
}

export async function updateUserRetirementAge(userId: string, retirementAge: number): Promise<{ success: boolean }> {
  const { data } = await api.put(`/api/user/${userId}/retirement-age`, { retirementAge });
  return data;
}

export async function updateUserMonthlyIncome(userId: string, monthlyIncome: number): Promise<{ success: boolean }> {
  const { data } = await api.put(`/api/user/${userId}/monthly-income`, { monthlyIncome });
  return data;
}

export async function completeOnboarding(
  userId: string,
  dateOfBirth: Date,
  retirementAge: number,
  monthlyIncome: number
): Promise<{ success: boolean; user: any }> {
  const { data } = await api.put(`/api/user/${userId}/onboarding-complete`, {
    dateOfBirth,
    retirementAge,
    monthlyIncome,
  });
  return data;
}

export async function getUserProfile(): Promise<{ id: string; name: string; incomeType: string; goals: string[] }> {
  const { data } = await api.get('/api/user/profile');
  return data;
}

// ── ML Expense Classifier ─────────────────────────────────────
export interface ClassifyResult {
  category:        string;
  confidence:      number;
  all_probs:       Record<string, number>;
  sentiment?:      string;
  sentiment_emoji?: string;
  sentiment_label?: string;
  verdict?:        string;
  offline?:        boolean;
  type?:           'Need' | 'Want' | 'Investment';
  confidenceScore?: number;
}

export async function classifyExpense(text: string): Promise<ClassifyResult> {
  const { data } = await api.post('/api/classify', { text });
  return data;
}

export async function getPacing(): Promise<{ Needs: { actual: number; limit: number }; Wants: { actual: number; limit: number }; Investments: { actual: number; limit: number } }> {
  const { data } = await api.get('/api/reports/pacing');
  return data;
}

export async function getHeatmap(): Promise<Array<{ date: string; totalAmount: number }>> {
  const { data } = await api.get('/api/reports/heatmap');
  return data;
}

export async function updateCurrentBalance(
  userId: string,
  operation: 'credit' | 'debit',
  amount: number
): Promise<{ success: boolean; currentBalance: number }> {
  const { data } = await api.put(`/api/user/${userId}/current-balance`, { operation, amount });
  return data;
}

// ── Auth ──────────────────────────────────────────────────────

export function setAuthToken(token?: string): void {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export async function loginUser(payload: { email: string; password: string }): Promise<{ token: string; user: any }> {
  const { data } = await api.post('/api/auth/login', payload);
  return data;
}

export async function registerUser(payload: { name: string; email: string; password: string }): Promise<{ token: string; user: any }> {
  const { data } = await api.post('/api/auth/register', payload);
  return data;
}
