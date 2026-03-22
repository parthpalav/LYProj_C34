import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AlertItem, ChatMessage, DashboardData, EnvelopeData, FMIRecord, Transaction } from '../types';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const debuggerHost =
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;

  const expoHost =
    (debuggerHost ? debuggerHost.split(':')[0] : undefined) ||
    (hostUri ? hostUri.split(':')[0] : undefined);

  if (expoHost) {
    return `http://${expoHost}:4000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000
});

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/api/dashboard');
  return data;
}

export async function getTransactions(): Promise<Transaction[]> {
  const { data } = await api.get('/api/transactions');
  return data;
}

export async function getFMI(): Promise<{ current: FMIRecord; history: FMIRecord[] }> {
  const [currentRes, historyRes] = await Promise.all([
    api.get('/api/fmi'),
    api.get('/api/fmi/history')
  ]);

  return {
    current: currentRes.data,
    history: historyRes.data
  };
}

export async function getEnvelopes(): Promise<EnvelopeData> {
  const { data } = await api.get('/api/envelopes');
  return data;
}

export async function getAlerts(): Promise<AlertItem[]> {
  const { data } = await api.get('/api/alerts');
  return data;
}

export async function sendMessageToAgent(
  message: string,
  context: Record<string, unknown>
): Promise<ChatMessage> {
  const { data } = await api.post('/api/agent/chat', { message, context });
  return data;
}

export async function simulateMicroSavings(): Promise<{ message: string }> {
  const { data } = await api.post('/api/envelopes/update');
  return data;
}
