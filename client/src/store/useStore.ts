import { create } from 'zustand';
import {
  AlertItem, BehaviorPattern, ChatMessage, DashboardData,
  FISData, FMIRecord, Goal, IncomeRecord, Transaction, WeeklyReport
} from '../types';

export interface User {
  id: string;
  name: string;
  email: string;
  dateOfBirth?: Date | string | null;
  retirementAge?: number | null;
  monthlyIncome?: number | null;
  onboardingComplete?: boolean;
  incomeType?: string;
  goals?: string[];
  currentBalance?: number;
}

interface AppState {
  user:         User | null;
  dashboard:    DashboardData | null;
  transactions: Transaction[];
  fmi:          FMIRecord[];
  alerts:       AlertItem[];
  chatHistory:  ChatMessage[];
  goals:        Goal[];
  incomes:      IncomeRecord[];
  fis:          FISData | null;
  patterns:     BehaviorPattern[];
  weeklyReport: WeeklyReport | null;

  setUser:         (user: User | null) => void;
  setDashboard:    (dashboard: DashboardData) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setFmi:          (fmi: FMIRecord[]) => void;
  setAlerts:       (alerts: AlertItem[]) => void;
  addChatMessage:  (message: ChatMessage) => void;
  setChatHistory:  (history: ChatMessage[]) => void;
  addTransaction:  (transaction: Transaction) => void;
  setGoals:        (goals: Goal[]) => void;
  addGoal:         (goal: Goal) => void;
  removeGoal:      (id: string) => void;
  updateGoal:      (id: string, updates: Partial<Goal>) => void;
  setIncomes:      (incomes: IncomeRecord[]) => void;
  addIncome:       (income: IncomeRecord) => void;
  setFIS:          (fis: FISData) => void;
  setPatterns:     (patterns: BehaviorPattern[]) => void;
  setWeeklyReport: (report: WeeklyReport) => void;
}

export const useStore = create<AppState>((set) => ({
  user:         null,
  dashboard:    null,
  transactions: [],
  fmi:          [],
  alerts:       [],
  chatHistory:  [],
  goals:        [],
  incomes:      [],
  fis:          null,
  patterns:     [],
  weeklyReport: null,

  setUser:         (user)         => set({ user }),
  setDashboard:    (dashboard)    => set({ dashboard }),
  setTransactions: (transactions) => set({ transactions }),
  setFmi:          (fmi)          => set({ fmi }),
  setAlerts:       (alerts)       => set({ alerts }),
  setChatHistory:  (chatHistory)  => set({ chatHistory }),
  addChatMessage:  (message)      => set((state) => ({ chatHistory: [...state.chatHistory, message] })),
  addTransaction:  (transaction)  => set((state) => ({ transactions: [transaction, ...state.transactions] })),
  setGoals:        (goals)        => set({ goals }),
  addGoal:         (goal)         => set((state) => ({ goals: [...state.goals, goal] })),
  removeGoal:      (id)           => set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),
  updateGoal:      (id, updates)  => set((state) => ({
    goals: state.goals.map((g) => g.id === id ? { ...g, ...updates } : g)
  })),
  setIncomes:      (incomes)      => set({ incomes }),
  addIncome:       (income)       => set((state) => ({ incomes: [income, ...state.incomes] })),
  setFIS:          (fis)          => set({ fis }),
  setPatterns:     (patterns)     => set({ patterns }),
  setWeeklyReport: (weeklyReport) => set({ weeklyReport }),
}));
