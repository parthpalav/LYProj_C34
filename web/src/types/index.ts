/**
 * Core type definitions for FINAURA Web Application
 * Matches existing backend API contract (server) and mobile client (client/src/types).
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  avatar?: string | null;
  isEmailVerified?: boolean;
  dateOfBirth?: string | null;
  age?: number | null;
  retirementAge?: number | null;
  monthlyIncome?: number | null;
  income?: number;
  incomeType?: string;
  retirementCorpusGoal?: number;
  currentBalance?: number;
  expectedReturnRate?: number;
  expectedInflationRate?: number;
  expectedWithdrawalRate?: number;
  lifestyleAdjustmentRatio?: number;
  emergencyFundTargetMonths?: number;
  goals?: string[];
  onboardingComplete?: boolean;
  onboardingCompleted?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  incomeType?: string;
  goals?: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  tags?: string[];
  timestamp: string;
  isAnomaly?: boolean;
  description?: string;
  type?: 'Need' | 'Want' | 'Investment';
  confidenceScore?: number;
  classificationSource?: string;
  categorySource?: string;
  typeSource?: string;
  categoryConfidence?: number;
  typeConfidence?: number;
  needsReview?: boolean;
  liabilityId?: string;
  scheduledFor?: string;
}

export interface Liability {
  id: string;
  userId?: string;
  name: string;
  amount: number;
  category: string;
  type: 'Need' | 'Want' | 'Investment';
  autoDeduct: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  nextDueDate?: string | null;
  status: 'active' | 'deleted';
  outstandingBalance?: number | null;
  interestRate?: number | null;
  remainingTermMonths?: number | null;
}

export type AssetClass = 'FIRE_INVESTABLE' | 'SEMI_LIQUID' | 'NON_INVESTABLE';
export type AssetLiquidity = 'liquid' | 'locked' | 'restricted';

export interface Asset {
  id: string;
  userId?: string;
  name: string;
  assetType: string;
  assetClass: AssetClass;
  currentValue: number;
  annualReturnRate?: number | null;
  includedInFireCorpus: boolean;
  liquidity: AssetLiquidity;
  notes?: string;
}

export interface IncomeRecord {
  id: string;
  userId: string;
  amount: number;
  source: string;
  description: string;
  timestamp: string;
}

export interface FMIPillar {
  score: number;
  weight: number;
  detail: string;
}

export interface FMIResponse {
  requiredMonthlySaving: number;
  requiredThisMonth: number;
  totalSpent: number;
  totalSaved: number;
  predictedMonthlySpend: number;
  availableMoney: number;
  status: 'above' | 'on_track' | 'below';
  FMI: number;
  score: number;
  fmiLabel?: string;
  pillars?: {
    D1_savingDiscipline?: FMIPillar;
    D2_spendingControl?: FMIPillar;
    D3_behavioralRisk?: FMIPillar;
  };
  insights?: string[];
  alerts?: Array<{ type: string; severity: string; message: string }>;
  factors?: string[];
  timestamp?: string;
}

export interface FMIRecord {
  score: number;
  factors: string[];
  timestamp: string;
}

export interface AlertItem {
  id: string;
  userId?: string;
  title?: string;
  message: string;
  type: string;
  severity: string;
  timestamp?: string;
  createdAt?: string;
}

export interface DashboardData {
  fmiScore: number;
  balance: number;
  spendingSeries?: number[];
  risk?: RiskLevel;
  insights?: string[];
  totalIncome?: number;
  categoryBreakdown?: Array<{ label: string; pct: number }>;
  wantsNeedsBreakdown?: {
    needs: { amount: number; pct: number };
    wants: { amount: number; pct: number };
    investments: { amount: number; pct: number };
    total: number;
  };
}

export interface PredictabilitySnapshot {
  generatedAt?: string;
  forecastStatus?: {
    available: boolean;
    status: string;
    warnings?: string[];
    missingInputs?: string[];
  };
  currentState?: {
    currentBalance?: number;
    totalEssentialSpending?: number;
  };
  assets?: {
    totalAssetValue?: number;
    fireInvestableCorpus?: number;
    liquidBuffer?: number;
    knownNetWorth?: number;
  };
  liabilities?: {
    activeCount?: number;
    monthlyLiabilityService?: number;
    knownOutstandingPrincipal?: number;
  };
  retirement?: {
    scenarioName?: string;
    estimatedFireCorpus?: number;
    userGoalCorpus?: number;
    projectedCorpusAtRetirement?: number;
    requiredMonthlyContributionForEstimatedFire?: number;
    requiredMonthlyContributionForUserGoal?: number;
    contributionGap?: number;
    projectedFire?: {
      reached: boolean;
      months?: number | null;
      projectedAge?: number | null;
    };
  };
  emergencyFund?: {
    targetMonths?: number;
    targetAmount?: number;
    knownLiquidEmergencyAssets?: number;
    coverageMonths?: number;
    fundingGap?: number;
  };
  resilience?: {
    essentialCoverageRatio?: number | null;
    isCoverageAdequate?: boolean;
    bufferRunwayMonths?: number | null;
    liquidBuffer?: number;
  };
}

export interface CashFlowMonth {
  monthKey: string;
  monthLabel: string;
  income: number;
  expenses: number;
  netFlow: number;
}

