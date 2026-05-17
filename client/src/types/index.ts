export type RiskLevel = 'low' | 'medium' | 'high';

export interface MicroAction {
  id:          string;
  type:        'no-spend' | 'daily-cap' | 'roundup' | string;
  title:       string;
  description: string;
  actionText:  string;
  impact:      string;
}

export interface DashboardData {
  fmiScore:      number;
  balance:       number;
  spendingSeries: number[];
  risk:          RiskLevel;
  insights:      string[];
  fis?:          number;
  fisGrade?:     string;
  fisComponents?: { savingsConsistency: number; fmiStability: number; behaviorScore: number };
  patterns?:     BehaviorPattern[];
  totalIncome?:  number;
  microActions?: MicroAction[];
  goals?:        Goal[];
  categoryBreakdown?: Array<{ label: string; pct: number }>;
  budgetMetrics?:     Array<{ label: string; val: number; color: string }>;
}

export interface Transaction {
  id:             string;
  amount:         number;
  category:       string;
  sentiment:      'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  tags?:          string[];
  timestamp:      string;
  isAnomaly?:     boolean;
  description?:   string;
  type?:          'Need' | 'Want' | 'Investment';
  confidenceScore?: number;
}

export interface FMIRecord {
  score:     number;
  factors:   string[];
  timestamp: string;
}

export interface AlertItem {
  id:       string;
  message:  string;
  type:     'nudge' | 'warning';
  severity: 'low' | 'medium' | 'high';
}

export interface EnvelopeData {
  rent:          number;
  food:          number;
  savings:       number;
  targetSavings: number;
}

export interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: string;
}

// ── New types ────────────────────────────────────────────────

export interface Goal {
  id:                  string;
  userId:              string;
  name:                string;
  emoji:               string;
  targetAmount:        number;
  savedAmount:         number;
  targetDate:          string;
  monthlyContribution: number;
  createdAt?:          string;
}

export interface IncomeRecord {
  id:          string;
  userId:      string;
  amount:      number;
  source:      'salary' | 'gig' | 'freelance' | 'other';
  description: string;
  timestamp:   string;
}

export interface FISData {
  fis:    number;
  grade:  string;
  components: {
    savingsConsistency: number;
    fmiStability:       number;
    behaviorScore:      number;
  };
  timestamp?: string;
}

export interface BehaviorPattern {
  type:     string;
  emoji:    string;
  message:  string;
  severity: 'low' | 'medium' | 'high';
}

export interface IncomeFlowData {
  total:         number;
  dailySmoothed: number;
  allocation: {
    essentials: number;
    goals:      number;
    emergency:  number;
  };
  sources:      Record<string, number>;
  timeline:     Array<{ id: string; amount: number; source: string; description?: string; timestamp: string }>;
  volatility:   number;
  incomeCount:  number;
}

export interface WeeklyReport {
  totalSpend:     number;
  totalIncome:    number;
  topCategories:  Array<{ category: string; amount: number; pct: number }>;
  fmiAvg:         number;
  savingsRate:    number;
  anomalyCount:   number;
  patterns:       BehaviorPattern[];
}
