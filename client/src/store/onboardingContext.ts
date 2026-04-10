import { create } from 'zustand';

interface OnboardingData {
  dateOfBirth: Date | null;
  retirementAge: number | null;
  monthlyIncome: number | null;
}

interface OnboardingStore {
  onboardingData: OnboardingData;
  setDateOfBirth: (date: Date) => void;
  setRetirementAge: (age: number) => void;
  setMonthlyIncome: (income: number) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  onboardingData: {
    dateOfBirth: null,
    retirementAge: null,
    monthlyIncome: null,
  },
  setDateOfBirth: (date: Date) =>
    set((state) => ({
      onboardingData: { ...state.onboardingData, dateOfBirth: date },
    })),
  setRetirementAge: (age: number) =>
    set((state) => ({
      onboardingData: { ...state.onboardingData, retirementAge: age },
    })),
  setMonthlyIncome: (income: number) =>
    set((state) => ({
      onboardingData: { ...state.onboardingData, monthlyIncome: income },
    })),
  reset: () =>
    set({
      onboardingData: {
        dateOfBirth: null,
        retirementAge: null,
        monthlyIncome: null,
      },
    }),
}));
