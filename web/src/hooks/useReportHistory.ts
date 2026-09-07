/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import type { HistoricalMonthSummary } from '../types';
import { getTransactions, getIncomes, getFMIHistory } from '../services/api';

export type HistoryRange = '6M' | '12M' | 'YTD';

export function useReportHistory() {
  const [range, setRange] = useState<HistoryRange>('6M');
  const [summaries, setSummaries] = useState<HistoricalMonthSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [txsRes, incsRes, fmiRes] = await Promise.allSettled([
        getTransactions(),
        getIncomes(),
        getFMIHistory()
      ]);

      const transactions = txsRes.status === 'fulfilled' && Array.isArray(txsRes.value) ? txsRes.value : [];
      const incomes = incsRes.status === 'fulfilled' && Array.isArray(incsRes.value) ? incsRes.value : [];
      const fmiHistory = fmiRes.status === 'fulfilled' && Array.isArray(fmiRes.value) ? fmiRes.value : [];

      const now = new Date();
      let monthsCount = 6;
      if (range === '12M') monthsCount = 12;
      else if (range === 'YTD') monthsCount = now.getUTCMonth() + 1;

      // Build target months in chronological order
      const targetMonths: { year: number; month: number; period: string; label: string }[] = [];
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const pKey = `${y}-${String(m).padStart(2, '0')}`;
        targetMonths.push({
          year: y,
          month: m,
          period: pKey,
          label: `${monthNames[m - 1].slice(0, 3)} ${y}`
        });
      }

      // Group records into target months
      const monthMap = new Map<string, HistoricalMonthSummary>();
      for (const tm of targetMonths) {
        monthMap.set(tm.period, {
          period: tm.period,
          periodLabel: tm.label,
          year: tm.year,
          month: tm.month,
          totalIncome: 0,
          totalExpenses: 0,
          netCashFlow: 0,
          savingsRate: 0,
          needsSpend: 0,
          wantsSpend: 0,
          investmentsSpend: 0,
          fmiAverage: null,
          transactionCount: 0,
          incomeCount: 0
        });
      }

      // Populate income
      for (const inc of incomes) {
        if (!inc.timestamp) continue;
        const d = new Date(inc.timestamp);
        const pKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const entry = monthMap.get(pKey);
        if (entry) {
          entry.totalIncome += Number(inc.amount) || 0;
          entry.incomeCount += 1;
        }
      }

      // Populate expenses
      for (const tx of transactions) {
        if (!tx.timestamp) continue;
        const d = new Date(tx.timestamp);
        const pKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const entry = monthMap.get(pKey);
        if (entry) {
          const amt = Number(tx.amount) || 0;
          entry.totalExpenses += amt;
          entry.transactionCount += 1;
          const tType = tx.type || 'Need';
          if (tType === 'Want') entry.wantsSpend += amt;
          else if (tType === 'Investment') entry.investmentsSpend += amt;
          else entry.needsSpend += amt;
        }
      }

      // FMI scores per month
      const fmiScoresMap = new Map<string, number[]>();
      for (const fmi of fmiHistory) {
        if (!fmi.timestamp) continue;
        const d = new Date(fmi.timestamp);
        const pKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (monthMap.has(pKey)) {
          const arr = fmiScoresMap.get(pKey) || [];
          arr.push(Number(fmi.score) || 0);
          fmiScoresMap.set(pKey, arr);
        }
      }

      // Finalize aggregates
      for (const [pKey, entry] of monthMap.entries()) {
        entry.totalIncome = Math.round(entry.totalIncome);
        entry.totalExpenses = Math.round(entry.totalExpenses);
        entry.netCashFlow = entry.totalIncome - entry.totalExpenses;
        entry.savingsRate = entry.totalIncome > 0
          ? Math.max(0, Math.round(((entry.totalIncome - entry.totalExpenses) / entry.totalIncome) * 100))
          : 0;
        entry.needsSpend = Math.round(entry.needsSpend);
        entry.wantsSpend = Math.round(entry.wantsSpend);
        entry.investmentsSpend = Math.round(entry.investmentsSpend);

        const fmiScores = fmiScoresMap.get(pKey);
        if (fmiScores && fmiScores.length > 0) {
          entry.fmiAverage = Math.round(fmiScores.reduce((s, sc) => s + sc, 0) / fmiScores.length);
        } else {
          entry.fmiAverage = null;
        }
      }

      setSummaries(Array.from(monthMap.values()));
    } catch {
      setError('Unable to aggregate historical monthly reports.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    summaries,
    range,
    setRange,
    loading,
    error,
    refresh: fetchHistory
  };
}
