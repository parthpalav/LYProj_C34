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
  snapshotDate?: string | null;
  pillars?: {
    D1_savingDiscipline?: FMIPillar;
    D2_spendingControl?: FMIPillar;
    D3_behavioralRisk?: FMIPillar;
  } | null;
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

export interface Goal {
  id: string;
  userId?: string;
  name: string;
  emoji?: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
  monthlyContribution?: number;
  createdAt?: string;
}

export interface ScenarioProjection {
  id: string;
  label: string;
  currentAge: number | null;
  retirementAge: number | null;
  monthsUntilRetirement: number | null;
  assumptions: {
    nominalReturn: number;
    inflation: number;
    realReturn: number;
    withdrawalRate: number;
    lifestyleAdjustmentRatio: number;
    contributionMode: string;
    annualContributionGrowthRate?: number;
  };
  currentAnnualLifestyleSpending: number;
  estimatedFireCorpus: number;
  userGoalCorpus: number;
  goalDifference?: number | null;
  monthlyContributionUsed: number;
  projectedCorpusAtRetirement: number | null;
  requiredMonthlyContributionForEstimatedFire: number | null;
  requiredMonthlyContributionForUserGoal: number | null;
  contributionGap: number | null;
  projectedFire: {
    reached: boolean;
    months: number | null;
    projectedAge: number | null;
  };
}

export interface ProbabilisticSection {
  available: boolean;
  engineVersion?: string;
  simulationCount?: number;
  dataQuality?: string;
  warnings?: string[];
  reason?: string;
  assumptions?: {
    expectedReturnRate?: number;
    expectedInflationRate?: number;
    portfolioVolatility?: number;
    volatilitySource?: string;
    contributionMode?: string;
    annualContributionGrowthRate?: number | null;
    seed?: number;
  };
  estimatedFire?: {
    targetAmountReal?: number;
    probabilityFundedAtTargetAge?: number | null;
    probabilityReachedFireByTargetAge?: number | null;
    corpusPercentiles?: {
      p10?: number;
      p25?: number;
      p50?: number;
      p75?: number;
      p90?: number;
    } | null;
    fundedAge50?: { reached: boolean; ageYears?: number; monthsFromNow?: number } | null;
    fundedAge75?: { reached: boolean; ageYears?: number; monthsFromNow?: number } | null;
  } | null;
  contributionRecommendation?: {
    solved?: boolean;
    targetProbability?: number;
    currentMonthlyContribution?: number;
    currentProbabilityFunded?: number;
    recommendedMonthlyContribution?: number;
    additionalMonthlyContributionRequired?: number;
    achievedProbabilityFunded?: number;
    feasibility?: {
      status?: string;
      recommendedContributionRatio?: number | null;
    } | null;
  } | null;
}

export interface ScenarioOverrides {
  monthlyContribution?: number;
  retirementAge?: number;
  expectedReturnRate?: number;
  expectedInflationRate?: number;
  annualContributionGrowthRate?: number;
  contributionMode?: 'NOMINAL_FLAT' | 'REAL_CONSTANT' | 'STEP_UP';
}

export interface PredictabilitySnapshot {
  generatedAt?: string;
  forecastStatus?: {
    available: boolean;
    status?: string;
    warnings?: string[];
    missingInputs?: string[];
    dataQuality?: string;
  };
  currentState?: {
    currentBalance?: number;
    averageMonthlyNeeds?: number;
    averageMonthlyWants?: number;
    needsConsumption?: number;
    liabilityService?: number;
    totalEssentialSpending?: number;
    observedAverageMonthlyInvestment?: number;
  };
  income?: {
    meanMonthlyIncome?: number;
    medianMonthlyIncome?: number;
    reliableMonthlyIncome?: number;
    percentileUsed?: number;
    standardDeviation?: number;
    coefficientOfVariation?: number;
    zeroIncomeMonthsCount?: number;
    zeroIncomeMonthRatio?: number;
    longestConsecutiveZeroIncomeMonths?: number;
    worstRollingQuarter?: {
      worstQuarterSum?: number;
      worstQuarterMonths?: string[];
      worstQuarterEventCount?: number;
      worstQuarterMonthlyAverage?: number;
    } | null;
    gapAnalysis?: {
      maxGapDays?: number;
      medianGapDays?: number;
      averageGapDays?: number;
      gapCount?: number;
    };
  };
  assets?: {
    totalAssetValue?: number;
    fireInvestableCorpus?: number;
    liquidBuffer?: number;
    knownNetWorth?: number;
    includedCount?: number;
    excludedCount?: number;
    includedAssets?: Asset[];
    excludedAssets?: Asset[];
  };
  liabilities?: {
    activeCount?: number;
    monthlyLiabilityService?: number;
    knownOutstandingPrincipal?: number;
    unknownPrincipalCount?: number;
    liabilitiesSummary?: Array<{
      id: string;
      name: string;
      monthlyAmount: number;
      frequency: string;
      outstandingBalance?: number | null;
      interestRate?: number | null;
      remainingTermMonths?: number | null;
    }>;
  };
  retirement?: ScenarioProjection | null;
  scenarios?: {
    conservative?: ScenarioProjection;
    base?: ScenarioProjection;
    optimistic?: ScenarioProjection;
  } | null;
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
  probabilistic?: ProbabilisticSection | null;
  explanationFacts?: Array<{
    code: string;
    metric?: string;
    value: any;
  }>;
  limitations?: string[];
}

export interface CashFlowMonth {
  monthKey: string;
  monthLabel: string;
  income: number;
  expenses: number;
  netFlow: number;
}

/**
 * ============================================================================
 * ACTIVITY WORKSPACE TYPES (PART 4 SPECIFICATION)
 * ============================================================================
 */

export const CANONICAL_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport & Travel',
  'Housing',
  'Utilities & Bills',
  'Debt & Loan Payments',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Personal Care',
  'Insurance',
  'Investments',
  'Misc',
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

export const VALID_TRANSACTION_TYPES = ['Need', 'Want', 'Investment'] as const;
export type TransactionType = typeof VALID_TRANSACTION_TYPES[number];

export interface TransactionPayload {
  amount: number;
  category?: string;
  type?: TransactionType;
  description?: string;
  timestamp?: string;
  classificationSource?: string;
  confidenceScore?: number;
  categorySource?: string;
  typeSource?: string;
  categoryConfidence?: number;
  typeConfidence?: number;
  needsReview?: boolean;
}

export interface ClassifierSuggestion {
  category: string;
  type: TransactionType;
  confidence: number;
  confidenceScore?: number;
  categoryConfidence?: number;
  typeConfidence?: number;
  needsReview?: boolean;
  classificationSource?: string;
  sentiment?: string;
  sentiment_label?: string;
}

export interface IncomePayload {
  amount: number;
  source: string;
  description?: string;
  timestamp?: string;
}

export interface IncomeFlowResponse {
  total: number;
  dailySmoothed: number;
  allocation?: {
    essentials: number;
    goals: number;
    emergency: number;
  };
  sources?: Record<string, number>;
  volatility: number;
  incomeCount: number;
}

export interface LiabilityPayload {
  name: string;
  amount: number;
  category: string;
  type: TransactionType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  autoDeduct: boolean;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
}

export interface LiabilityTransactionsResponse {
  liability: {
    id: string;
    name: string;
    amount: number;
    category: string;
    type: TransactionType;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    autoDeduct: boolean;
    status: 'active' | 'deleted';
  };
  transactions: Transaction[];
  summary: {
    totalPaid: number;
    paymentCount: number;
    lastPaymentAmount: number | null;
    lastPaymentDate: string | null;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LiabilitiesPaymentSummaryItem {
  paymentCount: number;
  totalPaid: number;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
}

/**
 * ============================================================================
 * INSIGHTS WORKSPACE TYPES (PART 5 SPECIFICATION)
 * ============================================================================
 */

export interface BehaviorPattern {
  type: string;
  emoji: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface BehaviorResponse {
  patterns: BehaviorPattern[];
  analyzedCount: number;
}

export type SpendingRange = '3m' | '6m' | '12m' | 'ytd';

export interface SpendingTrendPoint {
  monthKey: string;     // e.g. "2026-03"
  monthLabel: string;   // e.g. "Mar 2026"
  needs: number;
  wants: number;
  investments: number;
  total: number;
}

export interface CategorySpendSummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthOverMonthDelta {
  currentAmount: number;
  previousAmount: number;
  difference: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'flat';
}

export interface CategoryMovementItem {
  category: string;
  previousAmount: number;
  currentAmount: number;
  difference: number;
  percentageChange: number;
  direction: 'up' | 'down';
}

export interface IncomeTrendPoint {
  monthKey: string;
  monthLabel: string;
  amount: number;
  eventCount: number;
}

export interface IncomeSourceSummary {
  source: string;
  amount: number;
  percentage: number;
}

// ── Reports Workspace Types ───────────────────────────────────────────

export interface ReportCategoryItem {
  category: string;
  amount: number;
  pct: number;
}

export interface WeeklyReport {
  totalSpend: number;
  totalIncome: number;
  topCategories: ReportCategoryItem[];
  fmiAvg: number;
  savingsRate: number;
  anomalyCount: number;
  patterns: BehaviorPattern[];
}

export interface PacingBucket {
  actual: number;
  limit: number;
}

export interface PacingReport {
  Needs: PacingBucket;
  Wants: PacingBucket;
  Investments: PacingBucket;
}

export interface MonthlyReport {
  year: number;
  month: number;
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  incomeCount: number;
  totalExpenses: number;
  transactionCount: number;
  netCashFlow: number;
  savingsRate: number;
  spendingMix: {
    Needs: number;
    Wants: number;
    Investments: number;
  };
  topCategories: ReportCategoryItem[];
  fmi: {
    hasSnapshots: boolean;
    snapshotCount: number;
    average: number | null;
    first: number | null;
    last: number | null;
    change: number | null;
  };
  anomalies: {
    count: number;
    items: {
      id: string;
      description: string;
      amount: number;
      category: string;
      timestamp: string;
    }[];
  };
}

export interface HeatmapPoint {
  date: string;
  totalAmount: number;
}

export interface HistoricalMonthSummary {
  period: string;
  periodLabel: string;
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  needsSpend: number;
  wantsSpend: number;
  investmentsSpend: number;
  fmiAverage: number | null;
  transactionCount: number;
  incomeCount: number;
}
