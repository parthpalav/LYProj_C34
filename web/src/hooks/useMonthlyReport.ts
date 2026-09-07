/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import type { MonthlyReport } from '../types';
import { getMonthlyReport, getTransactions, getIncomes } from '../services/api';

export interface AvailableMonth {
  year: number;
  month: number;
  label: string;
  period: string;
}

export function useMonthlyReport() {
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getUTCMonth() + 1);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Discover available months from user records
  const discoverMonths = useCallback(async () => {
    const now = new Date();
    try {
      const [txsRes, incsRes] = await Promise.allSettled([
        getTransactions(),
        getIncomes()
      ]);

      const periodsMap = new Map<string, AvailableMonth>();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Add current month always
      const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      periodsMap.set(currentPeriod, {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        label: `${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
        period: currentPeriod
      });

      const addDate = (dString?: string | Date) => {
        if (!dString) return;
        const d = new Date(dString);
        if (isNaN(d.getTime())) return;
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const pKey = `${y}-${String(m).padStart(2, '0')}`;
        if (!periodsMap.has(pKey)) {
          periodsMap.set(pKey, {
            year: y,
            month: m,
            label: `${monthNames[m - 1]} ${y}`,
            period: pKey
          });
        }
      };

      if (txsRes.status === 'fulfilled' && Array.isArray(txsRes.value)) {
        txsRes.value.forEach((tx) => addDate(tx.timestamp));
      }
      if (incsRes.status === 'fulfilled' && Array.isArray(incsRes.value)) {
        incsRes.value.forEach((inc) => addDate(inc.timestamp));
      }

      const sorted = Array.from(periodsMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      setAvailableMonths(sorted);
    } catch {
      // Fallback: current month
      const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      setAvailableMonths([
        {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
          label: `Current Month (${now.getUTCFullYear()})`,
          period: currentPeriod
        }
      ]);
    }
  }, []);

  // Fetch report for selected period
  const fetchReport = useCallback(async (y: number, m: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMonthlyReport(y, m);
      setReport(data);
    } catch {
      setError('Unable to load report for the selected month.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    discoverMonths();
  }, [discoverMonths]);

  useEffect(() => {
    fetchReport(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, fetchReport]);

  const selectPeriod = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  return {
    report,
    loading,
    error,
    selectedYear,
    selectedMonth,
    availableMonths,
    selectPeriod,
    refresh: () => fetchReport(selectedYear, selectedMonth)
  };
}
