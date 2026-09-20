/**
 * FINAURA Web — Family & Household Type Definitions
 * Authoritative types matching existing Express API contracts.
 * Strictly aggregates only. Zero raw member data or personal accounts.
 */

export interface FamilyMember {
  userId: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt?: string;
}

export interface FamilySummary {
  id: string;
  name: string;
  ownerUserId?: string;
  role?: 'owner' | 'member';
  memberCount?: number;
  members: FamilyMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FamilyInvitation {
  id: string;
  familyId: string | null;
  inviterUserId?: string;
  inviterName?: string;
  inviteeUserId?: string;
  inviteeEmail?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export interface FamilyFMIPillar {
  score: number;
  weight: number;
  detail: string;
}

export interface FamilyFMI {
  score: number;
  fmiLabel: string;
  status: string;
  pillars: {
    D1_savingDiscipline: FamilyFMIPillar;
    D2_spendingControl: FamilyFMIPillar;
    D3_behavioralRisk: FamilyFMIPillar;
  };
  insights: string[];
  householdGoalDetail?: {
    householdRequiredMonthlySaving: number;
    householdRequiredThisMonth: number;
    householdTotalSaved: number;
    availableMoney: number;
    predictedMonthlySpend: number;
  };
}

export interface FamilyCategoryBreakdown {
  category: string;
  amount: number;
  percentageOfOutflow: number;
  percentageOfNonInvestmentSpend: number;
}

export interface FamilyTypeBreakdown {
  need: {
    amount: number;
    percentageOfOutflow: number;
  };
  want: {
    amount: number;
    percentageOfOutflow: number;
  };
  investment: {
    amount: number;
    percentageOfOutflow: number;
  };
}

export interface FamilyDashboard {
  period: {
    month: number;
    year: number;
    startDate: string;
    endDate: string;
    daysPassed: number;
    daysInMonth: number;
  };
  family: {
    id: string;
    name: string;
    memberCount: number;
    members: FamilyMember[];
  };
  income: {
    declaredMonthlyIncome: number;
    actualIncomeThisMonth: number;
    effectiveMonthlyIncome: number;
  };
  spending: {
    need: number;
    want: number;
    totalNonInvestment: number;
  };
  investments: {
    monthlyFlow: number;
    investmentRate: number;
    investmentRatePercent: number;
  };
  cashFlow: {
    totalOutflow: number;
    netCashPosition: number;
  };
  pacing: {
    daysPassed: number;
    daysInMonth: number;
    avgDailyNonInvestmentSpend: number;
    predictedMonthlyNonInvestmentSpend: number;
  };
  typeBreakdown: FamilyTypeBreakdown;
  categoryBreakdown: FamilyCategoryBreakdown[];
  fmi: FamilyFMI;
}

export interface FamilyDashboardResponse {
  success: boolean;
  family?: FamilyDashboard['family'] | null;
  dashboard?: null;
  period?: FamilyDashboard['period'];
  income?: FamilyDashboard['income'];
  spending?: FamilyDashboard['spending'];
  investments?: FamilyDashboard['investments'];
  cashFlow?: FamilyDashboard['cashFlow'];
  pacing?: FamilyDashboard['pacing'];
  typeBreakdown?: FamilyTypeBreakdown;
  categoryBreakdown?: FamilyCategoryBreakdown[];
  fmi?: FamilyFMI;
  error?: string;
  message?: string;
}

export interface FamilyInvitationsResponse {
  success: boolean;
  data: FamilyInvitation[];
}
