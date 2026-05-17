export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  income?: number;
  incomeType?: string;
  retirementAge?: number;
  retirementCorpusGoal?: number;
  currentBalance?: number;
  fixedObligations?: Array<{ label: string; amount: number }>;
  onboardingCompleted?: boolean;
}
