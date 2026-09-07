import { useState, useEffect, useCallback } from 'react';
import {
  getDashboard,
  getTransactions,
  getLiabilities,
  getIncome,
  getFMI,
  getAlerts,
  getPredictability,
} from '../services/api';
import {
  buildCashFlowHistory,
  calculateCurrentMonthSavingsRate,
} from '../services/dashboard';
import type {
  DashboardData,
  Transaction,
  Liability,
  IncomeRecord,
  FMIResponse,
  FMIRecord,
  AlertItem,
  PredictabilitySnapshot,
  CashFlowMonth,
} from '../types';
import { getTransactionDate } from '../utils/formatters';

export interface OverviewState {
  dashboard: DashboardData | null;
  fmi: FMIResponse | null;
  fmiHistory: FMIRecord[];
  fmiScoreChange: number | null;
  alerts: AlertItem[];
  liabilities: Liability[];
  transactions: Transaction[];
  incomes: IncomeRecord[];
  predictability: PredictabilitySnapshot | null;
  cashFlowHistory: CashFlowMonth[];
  currentMonthIncome: number;
  currentMonthSpending: number;
  currentMonthNetFlow: number;
  savingsRate: number | null;
}

export interface SectionErrors {
  dashboard?: boolean;
  fmi?: boolean;
  alerts?: boolean;
  liabilities?: boolean;
  transactions?: boolean;
  income?: boolean;
  predictability?: boolean;
}

export function useOverview() {
  const [data, setData] = useState<OverviewState>({
    dashboard: null,
    fmi: null,
    fmiHistory: [],
    fmiScoreChange: null,
    alerts: [],
    liabilities: [],
    transactions: [],
    incomes: [],
    predictability: null,
    cashFlowHistory: [],
    currentMonthIncome: 0,
    currentMonthSpending: 0,
    currentMonthNetFlow: 0,
    savingsRate: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOverviewData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
      setError(null);
    }

    // Resilient parallel fetching using Promise.allSettled
    const results = await Promise.allSettled([
      getDashboard(),
      getFMI(),
      getAlerts(),
      getLiabilities(),
      getTransactions(),
      getIncome(),
      getPredictability(),
    ]);

    const errors: SectionErrors = {};

    // 1. Dashboard
    let dashboardData: DashboardData | null = null;
    if (results[0].status === 'fulfilled') {
      dashboardData = results[0].value;
    } else {
      errors.dashboard = true;
      console.warn('Dashboard summary endpoint failed:', results[0].reason);
    }

    // 2. FMI
    let fmiData: FMIResponse | null = null;
    let fmiHistory: FMIRecord[] = [];
    let fmiScoreChange: number | null = null;
    if (results[1].status === 'fulfilled') {
      fmiData = results[1].value.current;
      fmiHistory = results[1].value.history || [];
      if (fmiHistory.length >= 2) {
        const latest = fmiHistory[fmiHistory.length - 1];
        const previous = fmiHistory[fmiHistory.length - 2];
        if (typeof latest.score === 'number' && typeof previous.score === 'number') {
          fmiScoreChange = latest.score - previous.score;
        }
      }
    } else {
      errors.fmi = true;
      console.warn('FMI endpoint failed:', results[1].reason);
    }

    // 3. Alerts
    let alertsData: AlertItem[] = [];
    if (results[2].status === 'fulfilled') {
      alertsData = results[2].value;
    } else {
      errors.alerts = true;
      console.warn('Alerts endpoint failed:', results[2].reason);
    }

    // 4. Liabilities
    let liabilitiesData: Liability[] = [];
    if (results[3].status === 'fulfilled') {
      liabilitiesData = results[3].value;
    } else {
      errors.liabilities = true;
      console.warn('Liabilities endpoint failed:', results[3].reason);
    }

    // 5. Transactions
    let txData: Transaction[] = [];
    if (results[4].status === 'fulfilled') {
      txData = results[4].value;
    } else {
      errors.transactions = true;
      console.warn('Transactions endpoint failed:', results[4].reason);
    }

    // 6. Income
    let incomeData: IncomeRecord[] = [];
    if (results[5].status === 'fulfilled') {
      incomeData = results[5].value;
    } else {
      errors.income = true;
      console.warn('Income endpoint failed:', results[5].reason);
    }

    // 7. Predictability
    let predictabilityData: PredictabilitySnapshot | null = null;
    if (results[6].status === 'fulfilled') {
      predictabilityData = results[6].value;
    } else {
      errors.predictability = true;
      console.warn('Predictability endpoint failed:', results[6].reason);
    }

    // Compute presentation aggregates:
    // Cash Flow 6-month history
    const cashFlowHistory = buildCashFlowHistory(txData, incomeData, 6);

    // Current month income & expenses
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthIncome = incomeData
      .filter((inc) => {
        const d = inc.timestamp ? new Date(inc.timestamp) : null;
        return d && !isNaN(d.getTime()) && d >= startOfCurrentMonth && d <= endOfCurrentMonth;
      })
      .reduce((sum, inc) => sum + Math.abs(Number(inc.amount) || 0), 0);

    const currentMonthSpending = txData
      .filter((tx) => {
        const d = getTransactionDate(tx);
        return d >= startOfCurrentMonth && d <= endOfCurrentMonth;
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);

    const currentMonthNetFlow = currentMonthIncome - currentMonthSpending;

    // Current month savings rate
    const savingsRate = calculateCurrentMonthSavingsRate(currentMonthIncome, currentMonthSpending);

    setData({
      dashboard: dashboardData,
      fmi: fmiData,
      fmiHistory,
      fmiScoreChange,
      alerts: alertsData,
      liabilities: liabilitiesData,
      transactions: txData,
      incomes: incomeData,
      predictability: predictabilityData,
      cashFlowHistory,
      currentMonthIncome,
      currentMonthSpending,
      currentMonthNetFlow,
      savingsRate,
    });

    setSectionErrors(errors);
    setLastUpdated(new Date());
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchOverviewData();
    }
    void loadData();
  }, [fetchOverviewData]);

  const refetch = useCallback(() => {
    return fetchOverviewData(true);
  }, [fetchOverviewData]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    sectionErrors,
    lastUpdated,
    refetch,
  };
}
