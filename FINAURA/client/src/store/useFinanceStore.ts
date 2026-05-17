import { create } from 'zustand';
import { getDashboard, getExpenses, getFmi, getFmiHistory, createExpense } from '../services/api';
import { Expense } from '../types/expense';
import { FMIRecord } from '../types/fmi';

interface FinanceState {
  dashboard: any | null;
  expenses: Expense[];
  fmi: any | null;
  fmiHistory: FMIRecord[];
  loading: boolean;
  fetchDashboard: () => Promise<void>;
  fetchExpenses: () => Promise<void>;
  addExpense: (payload: any) => Promise<void>;
  fetchFmi: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  dashboard: null,
  expenses: [],
  fmi: null,
  fmiHistory: [],
  loading: false,

  fetchDashboard: async () => {
    set({ loading: true });
    const data = await getDashboard();
    set({ dashboard: data, loading: false });
  },

  fetchExpenses: async () => {
    const data = await getExpenses();
    set({ expenses: data });
  },

  addExpense: async (payload) => {
    const data = await createExpense(payload);
    set((state) => ({ expenses: [data, ...state.expenses] }));
  },

  fetchFmi: async () => {
    const current = await getFmi();
    const history = await getFmiHistory();
    set({ fmi: current, fmiHistory: history });
  }
}));
