import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTransactions } from '../services/api';
import type {
  Transaction,
  SpendingTrendPoint,
  CategorySpendSummary,
  MonthOverMonthDelta,
  CategoryMovementItem,
} from '../types';
import { getTransactionDate } from '../utils/formatters';
import { daysInMonth, getAppTimezone, zdate, zparts } from '../utils/timezone';
import { bucketIndex, bucketsFor, chartStart, inRange, type Bucket, type DateRange } from '../utils/dateRange';

/** Needs / Wants / Investments outflow per bucket. */
function trendPoints(buckets: Bucket[], txs: Transaction[]): SpendingTrendPoint[] {
  const totals = buckets.map(() => ({ needs: 0, wants: 0, investments: 0, total: 0 }));
  txs.forEach((tx) => {
    const i = bucketIndex(buckets, getTransactionDate(tx));
    if (i < 0) return;
    const amt = Math.abs(Number(tx.amount) || 0);
    const type = tx.type || 'Need';
    if (type === 'Need') totals[i].needs += amt;
    else if (type === 'Want') totals[i].wants += amt;
    else if (type === 'Investment') totals[i].investments += amt;
    totals[i].total += amt;
  });
  return buckets.map((b, i) => ({
    monthKey: b.key,
    monthLabel: b.label,
    needs: Math.round(totals[i].needs),
    wants: Math.round(totals[i].wants),
    investments: Math.round(totals[i].investments),
    total: Math.round(totals[i].total),
  }));
}

export function useSpendingInsights(range: DateRange) {
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

  // Earliest transaction: where "All" starts
  const earliest = useMemo(() => {
    let min: Date | null = null;
    for (const tx of transactions) {
      const d = getTransactionDate(tx);
      if (!isNaN(d.getTime()) && (!min || d < min)) min = d;
    }
    return min;
  }, [transactions]);

  // Daily / weekly / monthly buckets depending on the span
  const buckets = useMemo(() => bucketsFor(chartStart(range, earliest), range.end), [range, earliest]);

  // Transactions filtered to selected range
  const rangeTransactions = useMemo(
    () => transactions.filter((tx) => inRange(getTransactionDate(tx), range)),
    [transactions, range],
  );

  // 1. Spending Trend
  const trendData = useMemo(() => trendPoints(buckets, rangeTransactions), [buckets, rangeTransactions]);

  // Day-by-day points inside one trend bucket, for the chart's drill-down
  const trendDays = useCallback(
    (i: number) => (buckets[i] ? trendPoints(bucketsFor(buckets[i].start, buckets[i].end, { daily: true }), rangeTransactions) : []),
    [buckets, rangeTransactions],
  );

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
    const currentYear = zparts(now).year;
    const currentMonth = zparts(now).month; // 0-indexed
    const currentDay = zparts(now).day;

    const currentMtdStart = zdate(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const currentMtdEnd = now;

    const prevMtdStart = zdate(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const daysInPrevMonth = daysInMonth(currentYear, currentMonth - 1);
    const prevCompareDay = Math.min(currentDay, daysInPrevMonth);
    const prevMtdEnd = zdate(currentYear, currentMonth - 1, prevCompareDay, 23, 59, 59, 999);

    const prevMonthName = prevMtdStart.toLocaleDateString('en-IN', { timeZone: getAppTimezone(), month: 'short' });
    const currentMonthName = currentMtdStart.toLocaleDateString('en-IN', { timeZone: getAppTimezone(), month: 'short' });

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
    const currentYear = zparts(now).year;
    const currentMonth = zparts(now).month;
    const currentDay = zparts(now).day;

    const currentMtdStart = zdate(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const currentMtdEnd = now;

    const prevMtdStart = zdate(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const daysInPrevMonth = daysInMonth(currentYear, currentMonth - 1);
    const prevCompareDay = Math.min(currentDay, daysInPrevMonth);
    const prevMtdEnd = zdate(currentYear, currentMonth - 1, prevCompareDay, 23, 59, 59, 999);

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
    transactions,
    earliest,
    loading,
    error,
    refresh: fetchSpendingData,
    trendData,
    trendDays,
    typeAnalysis,
    categoryRankings,
    momComparison,
    categoryMovements,
  };
}
