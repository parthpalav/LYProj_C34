export type RiskLevel = 'low' | 'medium' | 'high';

export interface DashboardData {
  fmiScore: number;
  balance: number;
  spendingSeries: number[];
  risk: RiskLevel;
  insights: string[];
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
  isAnomaly?: boolean;
  description?: string;
}

export interface FMIRecord {
  score: number;
  factors: string[];
  timestamp: string;
}

export interface AlertItem {
  id: string;
  message: string;
  type: 'nudge' | 'warning';
  severity: 'low' | 'medium' | 'high';
}

export interface EnvelopeData {
  rent: number;
  food: number;
  savings: number;
  targetSavings: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
