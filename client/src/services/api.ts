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
}

export interface RegisterPayload {
  name:        string;
  incomeType:  string;
  goals?:      string[];
}

export interface RegisterResponse {
  id:         string;
  name:       string;
  incomeType: string;
  goals:      string[];
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

  const hostUri      = Constants.expoConfig?.hostUri;
  const debuggerHost = (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const expoHost =
    (debuggerHost ? debuggerHost.split(':')[0] : undefined) ||
    (hostUri      ? hostUri.split(':')[0]      : undefined);

  if (expoHost) return `http://${expoHost}:4000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

const api = axios.create({ baseURL: getApiBaseUrl(), timeout: 8000 });

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
export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post('/api/user/register', payload);
  return data;
}

export async function getUserProfile(): Promise<{ id: string; name: string; incomeType: string; goals: string[] }> {
  const { data } = await api.get('/api/user/profile');
  return data;
}
