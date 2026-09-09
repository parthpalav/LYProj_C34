import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTransactions } from '../services/api';
import type {
  Transaction,
  SpendingRange,
  SpendingTrendPoint,
  CategorySpendSummary,
  MonthOverMonthDelta,
  CategoryMovementItem,
} from '../types';
import { getTransactionDate } from '../utils/formatters';

export function useSpendingInsights() {
  const [range, setRange] = useState<SpendingRange>('6m');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpendingData = useCallback(async (isManual = false) => {
    if (isManual) {
      setLoading(true);
      setError(null);
    }
    try {
      const txs = await getTransactions();
      setTransactions(txs);
    } catch (err: any) {
      console.error('Failed to load transactions for spending insights:', err);
      setError(err?.message || 'Failed to load spending transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchSpendingData();
    }
    void loadData();
  }, [fetchSpendingData]);

  // Determine months to include based on selected range
  const monthsInRange = useMemo(() => {
    const now = new Date();
    const result: Array<{ key: string; label: string; year: number; month: number }> = [];

    let count = 6;
    if (range === '30d') count = 1;
    else if (range === '90d' || range === '3m') count = 3;
    else if (range === '6m') count = 6;
    else if (range === '12m') count = 12;
    else if (range === 'ytd') count = now.getMonth() + 1;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      result.push({ key, label, year, month });
    }

    return result;
  }, [range]);

  // Earliest date boundary for selected range
  const rangeStartDate = useMemo(() => {
    if (monthsInRange.length === 0) return new Date();
    const first = monthsInRange[0];
    return new Date(first.year, first.month - 1, 1, 0, 0, 0, 0);
  }, [monthsInRange]);

  // Transactions filtered to selected range
  const rangeTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const d = getTransactionDate(tx);
      return d >= rangeStartDate;
    });
  }, [transactions, rangeStartDate]);

  // 1. Monthly Spending Trend
  const trendData = useMemo<SpendingTrendPoint[]>(() => {
    const monthlyMap = new Map<
      string,
      { needs: number; wants: number; investments: number; total: number }
    >();

    monthsInRange.forEach((m) => {
      monthlyMap.set(m.key, { needs: 0, wants: 0, investments: 0, total: 0 });
    });

    rangeTransactions.forEach((tx) => {
      const d = getTransactionDate(tx);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        const amt = Math.abs(Number(tx.amount) || 0);
        const type = tx.type || 'Need';
        if (type === 'Need') entry.needs += amt;
        else if (type === 'Want') entry.wants += amt;
        else if (type === 'Investment') entry.investments += amt;
        entry.total += amt;
      }
    });

    return monthsInRange.map((m) => {
      const data = monthlyMap.get(m.key) || { needs: 0, wants: 0, investments: 0, total: 0 };
      return {
        monthKey: m.key,
        monthLabel: m.label,
        needs: Math.round(data.needs),
        wants: Math.round(data.wants),
        investments: Math.round(data.investments),
        total: Math.round(data.total),
      };
    });
  }, [monthsInRange, rangeTransactions]);

  // 2. Needs / Wants / Investments Analysis for Selected Range
  const typeAnalysis = useMemo(() => {
    let totalNeeds = 0;
    let totalWants = 0;
    let totalInvestments = 0;

    rangeTransactions.forEach((tx) => {
      const amt = Math.abs(Number(tx.amount) || 0);
      const type = tx.type || 'Need';
      if (type === 'Need') totalNeeds += amt;
      else if (type === 'Want') totalWants += amt;
      else if (type === 'Investment') totalInvestments += amt;
    });

    const totalSpend = totalNeeds + totalWants + totalInvestments;

    return {
      needs: {
        amount: Math.round(totalNeeds),
        percentage: totalSpend > 0 ? Math.round((totalNeeds / totalSpend) * 100) : 0,
      },
      wants: {
        amount: Math.round(totalWants),
        percentage: totalSpend > 0 ? Math.round((totalWants / totalSpend) * 100) : 0,
      },
      investments: {
        amount: Math.round(totalInvestments),
        percentage: totalSpend > 0 ? Math.round((totalInvestments / totalSpend) * 100) : 0,
      },
      totalSpend: Math.round(totalSpend),
    };
  }, [rangeTransactions]);

  // 3. Category Breakdown Ranked
  const categoryRankings = useMemo<CategorySpendSummary[]>(() => {
    const catMap = new Map<string, number>();

    rangeTransactions.forEach((tx) => {
      const cat = tx.category || 'Misc';
      const amt = Math.abs(Number(tx.amount) || 0);
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    });

    const totalSpend = typeAnalysis.totalSpend;
    const summaries: CategorySpendSummary[] = [];

    catMap.forEach((amount, category) => {
      summaries.push({
        category,
        amount: Math.round(amount),
        percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
      });
    });

    return summaries.sort((a, b) => b.amount - a.amount);
  }, [rangeTransactions, typeAnalysis.totalSpend]);

  // 4. Comparable-Period Month-over-Month Comparison (Correction #3)
  // Compares Month-to-date (Days 1 to currentDay) vs same days in previous month
  const momComparison = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

    const currentMtdStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const currentMtdEnd = now;

    const prevMtdStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevCompareDay = Math.min(currentDay, daysInPrevMonth);
    const prevMtdEnd = new Date(currentYear, currentMonth - 1, prevCompareDay, 23, 59, 59, 999);

    const prevMonthName = prevMtdStart.toLocaleDateString('en-IN', { month: 'short' });
    const currentMonthName = currentMtdStart.toLocaleDateString('en-IN', { month: 'short' });

    const periodLabel = `MTD (Days 1–${currentDay}) vs ${prevMonthName} 1–${prevCompareDay}`;

    const curSpend = { total: 0, needs: 0, wants: 0, investments: 0 };
    const prevSpend = { total: 0, needs: 0, wants: 0, investments: 0 };

    transactions.forEach((tx) => {
      const d = getTransactionDate(tx);
      const amt = Math.abs(Number(tx.amount) || 0);
      const type = tx.type || 'Need';

      if (d >= currentMtdStart && d <= currentMtdEnd) {
        curSpend.total += amt;
        if (type === 'Need') curSpend.needs += amt;
        else if (type === 'Want') curSpend.wants += amt;
        else if (type === 'Investment') curSpend.investments += amt;
      } else if (d >= prevMtdStart && d <= prevMtdEnd) {
        prevSpend.total += amt;
        if (type === 'Need') prevSpend.needs += amt;
        else if (type === 'Want') prevSpend.wants += amt;
        else if (type === 'Investment') prevSpend.investments += amt;
      }
    });

    const calculateDelta = (current: number, previous: number): MonthOverMonthDelta => {
      const diff = current - previous;
      let pct = 0;
      if (previous > 0) {
        pct = Math.round((diff / previous) * 100);
      } else if (current > 0) {
        pct = 100;
      }
      return {
        currentAmount: Math.round(current),
        previousAmount: Math.round(previous),
        difference: Math.round(diff),
        percentageChange: pct,
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      };
    };

    return {
      periodLabel,
      currentMonthName,
      prevMonthName,
      total: calculateDelta(curSpend.total, prevSpend.total),
      needs: calculateDelta(curSpend.needs, prevSpend.needs),
      wants: calculateDelta(curSpend.wants, prevSpend.wants),
      investments: calculateDelta(curSpend.investments, prevSpend.investments),
    };
  }, [transactions]);

  // 5. Comparable-Period Category Movement (Correction #4)
  // Identifies 3 largest category changes between the exact same comparable periods
  const categoryMovements = useMemo<CategoryMovementItem[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const currentMtdStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const currentMtdEnd = now;

    const prevMtdStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevCompareDay = Math.min(currentDay, daysInPrevMonth);
    const prevMtdEnd = new Date(currentYear, currentMonth - 1, prevCompareDay, 23, 59, 59, 999);

    const curCatMap = new Map<string, number>();
    const prevCatMap = new Map<string, number>();

    transactions.forEach((tx) => {
      const d = getTransactionDate(tx);
      const amt = Math.abs(Number(tx.amount) || 0);
      const cat = tx.category || 'Misc';

      if (d >= currentMtdStart && d <= currentMtdEnd) {
        curCatMap.set(cat, (curCatMap.get(cat) || 0) + amt);
      } else if (d >= prevMtdStart && d <= prevMtdEnd) {
        prevCatMap.set(cat, (prevCatMap.get(cat) || 0) + amt);
      }
    });

    const allCategories = new Set([...curCatMap.keys(), ...prevCatMap.keys()]);
    const items: CategoryMovementItem[] = [];

    allCategories.forEach((cat) => {
      const cur = curCatMap.get(cat) || 0;
      const prev = prevCatMap.get(cat) || 0;
      const diff = cur - prev;

      if (diff !== 0) {
        let pct = 0;
        if (prev > 0) {
          pct = Math.round((diff / prev) * 100);
        } else if (cur > 0) {
          pct = 100;
        }

        items.push({
          category: cat,
          previousAmount: Math.round(prev),
          currentAmount: Math.round(cur),
          difference: Math.round(diff),
          percentageChange: pct,
          direction: diff > 0 ? 'up' : 'down',
        });
      }
    });

    // Sort by absolute difference descending, take top 3
    return items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).slice(0, 3);
  }, [transactions]);

  return {
    range,
    setRange,
    transactions,
    loading,
    error,
    refresh: fetchSpendingData,
    trendData,
    typeAnalysis,
    categoryRankings,
    momComparison,
    categoryMovements,
  };
}
