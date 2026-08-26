export type RiskLevel = 'low' | 'medium' | 'high';

export interface MicroAction {
  id: string;
  type: 'no-spend' | 'daily-cap' | 'roundup' | string;
  title: string;
  description: string;
  actionText: string;
  impact: string;
}

export interface WantsNeedsBreakdown {
  needs: { amount: number; pct: number };
  wants: { amount: number; pct: number };
  investments: { amount: number; pct: number };
  total: number;
}

export interface DashboardData {
  fmiScore: number;
  balance: number;
  spendingSeries: number[];
  risk: RiskLevel;
  insights: string[];
  fis?: number;
  fisGrade?: string;
  fisComponents?: { savingsConsistency: number; fmiStability: number; behaviorScore: number };
  patterns?: BehaviorPattern[];
  totalIncome?: number;
  microActions?: MicroAction[];
  goals?: Goal[];
  categoryBreakdown?: Array<{ label: string; pct: number }>;
  budgetMetrics?: Array<{ label: string; val: number; color: string }>;
  wantsNeedsBreakdown?: WantsNeedsBreakdown;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface LiabilityPaymentSummary {
  paymentCount: number;
  totalPaid: number;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
}

export interface LiabilityPaymentHistoryResponse {
  liability: Partial<Liability>;
  transactions: Transaction[];
  summary: LiabilityPaymentSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FMIRecord {
  score: number;
  factors: string[];
  timestamp: string;
}

export interface FMIPillar {
  score: number;
  weight: number;
  detail: string;
}

export interface FMIAlert {
  type: 'warning' | 'nudge' | 'critical';
  severity: 'low' | 'medium' | 'high';
  message: string;
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
  fmiLabel: string;
  pillars: {
    D1_savingDiscipline: FMIPillar;
    D2_spendingControl: FMIPillar;
    D3_behavioralRisk: FMIPillar;
  };
  insights: string[];
  alerts: FMIAlert[];
  factors: string[];
  prediction: {
    daysPassed: number;
    daysInMonth: number;
    avgDailySpend: number;
    predictedMonthlySpend: number;
  };
  goalDetail: {
    retirementGoal: number;
    remainingGoal: number;
    monthsLeft: number;
    yearsLeft: number;
  };
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

export interface Goal {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
  monthlyContribution: number;
  createdAt?: string;
}

export interface IncomeRecord {
  id: string;
  userId: string;
  amount: number;
  source: 'salary' | 'gig' | 'freelance' | 'other';
  description: string;
  timestamp: string;
}

export interface FISData {
  fis: number;
  grade: string;
  components: {
    savingsConsistency: number;
    fmiStability: number;
    behaviorScore: number;
  };
  timestamp?: string;
}

export interface BehaviorPattern {
  type: string;
  emoji: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface IncomeFlowData {
  total: number;
  dailySmoothed: number;
  allocation: {
    essentials: number;
    goals: number;
    emergency: number;
  };
  sources: Record<string, number>;
  timeline: Array<{ id: string; amount: number; source: string; description?: string; timestamp: string }>;
  volatility: number;
  incomeCount: number;
}

export interface WeeklyReport {
  totalSpend: number;
  totalIncome: number;
  topCategories: Array<{ category: string; amount: number; pct: number }>;
  fmiAvg: number;
  savingsRate: number;
  anomalyCount: number;
  patterns: BehaviorPattern[];
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  isEmailVerified?: boolean;
  dateOfBirth?: string | null;
  age?: number | null;
  retirementAge?: number | null;
  monthlyIncome?: number | null;
  income?: number;
  incomeType?: string;
  retirementCorpusGoal?: number;
  currentBalance?: number;
  goals?: string[];
  onboardingComplete?: boolean;
  onboardingCompleted?: boolean;
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
  };
  currentAnnualLifestyleSpending: number;
  estimatedFireCorpus: number;
  userGoalCorpus: number;
  goalDifference: {
    userGoalCorpus: number;
    estimatedFireCorpus: number;
    difference: number;
    percentageDifference: number;
  } | null;
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

export interface PredictabilitySnapshot {
  generatedAt: string;
  forecastStatus: {
    available: boolean;
    missingInputs: string[];
    warnings: string[];
    dataQuality: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
  };
  dataQuality: {
    incomeDataQuality: {
      dataQualityLevel: 'INSUFFICIENT' | 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH';
      monthsObserved: number;
      limitations: string[];
    };
    transactionMonthsObserved: number;
    assetsRecorded: number;
    liabilitiesRecorded: number;
  };
  currentState: {
    currentBalance: number;
    averageMonthlyNeeds: number;
    averageMonthlyWants: number;
    needsConsumption: number;
    liabilityService: number;
    totalEssentialSpending: number;
    observedAverageMonthlyInvestment: number;
  };
  income: {
    meanMonthlyIncome: number;
    medianMonthlyIncome: number;
    reliableMonthlyIncome: number;
    percentileUsed: number;
    standardDeviation: number;
    coefficientOfVariation: number | null;
    zeroIncomeMonthsCount: number;
    zeroIncomeMonthRatio: number;
    longestConsecutiveZeroIncomeMonths: number;
    worstRollingQuarter: {
      available: boolean;
      amount: number | null;
      startMonth?: string | null;
      endMonth?: string | null;
    };
    gapAnalysis: {
      numberOfIncomeEvents: number;
      averageGapDays: number | null;
      medianGapDays: number | null;
      longestGapDays: number | null;
      gapStdDevDays: number | null;
    };
  };
  resilience: {
    essentialCoverageRatio: number | null;
    isCoverageAdequate: boolean | null;
    bufferRunwayMonths: number | null;
    liquidBuffer: number;
  };
  assets: {
    totalAssetValue: number;
    fireInvestableCorpus: number;
    liquidBuffer: number;
    knownNetWorth: number;
    includedCount: number;
    excludedCount: number;
    includedAssets: any[];
    excludedAssets: any[];
  };
  liabilities: {
    activeCount: number;
    monthlyLiabilityService: number;
    knownOutstandingPrincipal: number;
    unknownPrincipalCount: number;
    liabilitiesSummary: any[];
  };
  emergencyFund: {
    targetMonths: number;
    targetAmount: number;
    knownLiquidEmergencyAssets: number;
    coverageMonths: number | null;
    fundingGap: number;
  };
  retirement: ScenarioProjection | null;
  scenarios: {
    conservative: ScenarioProjection;
    base: ScenarioProjection;
    optimistic: ScenarioProjection;
  } | null;
  probabilistic?: MonteCarloSection;
  explanationFacts: Array<{
    code: string;
    metric?: string;
    value: number | string | boolean;
  }>;
  limitations: string[];
}

export interface MonteCarloAssumptions {
  expectedReturnRate: number;
  expectedInflationRate: number;
  portfolioVolatility: number;
  volatilitySource: 'RETURN_DERIVED' | 'SYSTEM_DEFAULT' | string;
  contributionMode: 'NOMINAL_FLAT' | 'REAL_CONSTANT' | string;
  seed: number;
}

export interface MonteCarloFundedAgePoint {
  reached: boolean;
  ageYears: number | null;
  monthsFromNow: number | null;
  probabilityAtAge?: number | null;
}

export interface MonteCarloPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MonteCarloFirstCrossing {
  percentCrossed: number;
  p25Month: number | null;
  p50Month: number | null;
  p75Month: number | null;
}

export interface MonteCarloEstimatedFire {
  targetAmountReal: number;
  probabilityFundedAtTargetAge: number | null;
  probabilityReachedFireByTargetAge: number | null;
  corpusPercentiles: MonteCarloPercentiles | null;
  fundedAge50: MonteCarloFundedAgePoint | null;
  fundedAge75: MonteCarloFundedAgePoint | null;
  firstCrossing: MonteCarloFirstCrossing | null;
}

export interface MonteCarloUserGoal {
  targetAmountReal: number;
  probabilityFundedAtTargetAge: number | null;
  probabilityReachedByTargetAge: number | null;
  fundedAge50: MonteCarloFundedAgePoint | null;
  fundedAge75: MonteCarloFundedAgePoint | null;
}

export type MonteCarloFeasibilityStatus = 'MANAGEABLE' | 'AGGRESSIVE' | 'VERY_AGGRESSIVE' | 'IMPRACTICAL' | 'UNKNOWN';

export interface MonteCarloContributionFeasibility {
  status: MonteCarloFeasibilityStatus;
  recommendedContributionRatio: number | null;
  additionalContributionRatio: number | null;
  reliableMonthlyIncome: number | null;
}

export interface MonteCarloRetirementAlternative {
  targetAge: number;
  yearsExtended: number;
  monthsUntilRetirement: number;
  probabilityFundedAtTargetAge: number | null;
  recommendedMonthlyContribution: number | null;
  additionalMonthlyContributionRequired: number | null;
  achievedProbabilityFunded: number | null;
  targetProbability: number;
  solved: boolean;
  feasibility?: MonteCarloContributionFeasibility | null;
}

export interface MonteCarloContributionRecommendation {
  solved: boolean;
  targetProbability: number;
  currentMonthlyContribution: number;
  currentProbabilityFunded: number;
  recommendedMonthlyContribution: number;
  additionalMonthlyContributionRequired: number;
  achievedProbabilityFunded: number;
  recommendationIncrement: number;
  feasibility?: MonteCarloContributionFeasibility | null;
}

export interface MonteCarloSection {
  available: boolean;
  reason?: string;
  engineVersion?: string;
  simulationCount?: number;
  dataQuality?: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
  warnings?: string[];
  assumptions?: MonteCarloAssumptions;
  estimatedFire?: MonteCarloEstimatedFire;
  userGoal?: MonteCarloUserGoal | null;
  contributionRecommendation?: MonteCarloContributionRecommendation | null;
  retirementAlternatives?: MonteCarloRetirementAlternative[] | null;
  missingInputs?: string[];
  details?: string;
}

export interface PredictabilityResponse {
  success: boolean;
  data: PredictabilitySnapshot;
}
