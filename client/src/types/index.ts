export type RiskLevel = 'low' | 'medium' | 'high';

export interface MicroAction {
  id:          string;
  type:        'no-spend' | 'daily-cap' | 'roundup' | string;
  title:       string;
  description: string;
  actionText:  string;
  impact:      string;
}

export interface WantsNeedsBreakdown {
  needs:       { amount: number; pct: number };
  wants:       { amount: number; pct: number };
  investments: { amount: number; pct: number };
  total:       number;
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
  wantsNeedsBreakdown?: WantsNeedsBreakdown;
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
  categorySource?:   string;
  typeSource?:       string;
  categoryConfidence?: number;
  typeConfidence?:   number;
  needsReview?:      boolean;
}

export interface FMIRecord {
  score:     number;
  factors:   string[];
  timestamp: string;
}

export interface FMIPillar {
  score:  number;
  weight: number;
  detail: string;
}

export interface FMIAlert {
  type:     'warning' | 'nudge' | 'critical';
  severity: 'low' | 'medium' | 'high';
  message:  string;
}

export interface FMIResponse {
  requiredMonthlySaving:  number;
  requiredThisMonth:      number;
  totalSpent:             number;
  totalSaved:             number;
  predictedMonthlySpend:  number;
  availableMoney:         number;
  status:                 'above' | 'on_track' | 'below';
  FMI:                    number;
  score:                  number;
  fmiLabel:               string;
  pillars: {
    D1_savingDiscipline: FMIPillar;
    D2_spendingControl:  FMIPillar;
    D3_behavioralRisk:   FMIPillar;
  };
  insights:  string[];
  alerts:    FMIAlert[];
  factors:   string[];
  prediction: {
    daysPassed:            number;
    daysInMonth:           number;
    avgDailySpend:         number;
    predictedMonthlySpend: number;
  };
  goalDetail: {
    retirementGoal:  number;
    remainingGoal:   number;
    monthsLeft:      number;
    yearsLeft:       number;
  };
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

export interface FixedObligation {
  label:  string;
  amount: number;
}

export interface User {
  id:                   string;
  _id?:                 string;
  name:                 string;
  email:                string;
  isEmailVerified?:     boolean;
  dateOfBirth?:         string | null;
  age?:                 number | null;
  retirementAge?:       number | null;
  monthlyIncome?:       number | null;
  income?:              number;
  incomeType?:          string;
  retirementCorpusGoal?: number;
  currentBalance?:      number;
  fixedObligations?:    FixedObligation[];
  goals?:               string[];
  onboardingComplete?:  boolean;
  onboardingCompleted?: boolean;
}
