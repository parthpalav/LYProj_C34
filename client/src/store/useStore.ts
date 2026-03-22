import { create } from 'zustand';
import { AlertItem, ChatMessage, FMIRecord, Transaction } from '../types';

interface AppState {
  user: { name: string } | null;
  transactions: Transaction[];
  fmi: FMIRecord[];
  alerts: AlertItem[];
  chatHistory: ChatMessage[];
  setTransactions: (transactions: Transaction[]) => void;
  setFmi: (fmi: FMIRecord[]) => void;
  setAlerts: (alerts: AlertItem[]) => void;
  addChatMessage: (message: ChatMessage) => void;
}

export const useStore = create<AppState>((set) => ({
  user: { name: 'Demo User' },
  transactions: [],
  fmi: [],
  alerts: [],
  chatHistory: [],
  setTransactions: (transactions) => set({ transactions }),
  setFmi: (fmi) => set({ fmi }),
  setAlerts: (alerts) => set({ alerts }),
  addChatMessage: (message) => set((state) => ({ chatHistory: [...state.chatHistory, message] }))
}));
