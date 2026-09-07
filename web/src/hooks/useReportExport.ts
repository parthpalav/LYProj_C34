/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import type { MonthlyCsvRow } from '../utils/csvExport';
import {
  transactionsToCsv,
  incomesToCsv,
  liabilitiesToCsv,
  monthlySummariesToCsv,
  triggerCsvDownload
} from '../utils/csvExport';
import { getTransactions, getIncomes, getLiabilities } from '../services/api';

export type ExportKind = 'transactions' | 'income' | 'liabilities' | 'monthly' | null;

export function useReportExport() {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeKind, setActiveKind] = useState<ExportKind>(null);
  const [error, setError] = useState<string | null>(null);

  // Stats for cards
  const [counts, setCounts] = useState({
    transactions: 0,
    income: 0,
    liabilities: 0
  });

  const loadCounts = useCallback(async () => {
    try {
      const [txs, incs, liabs] = await Promise.allSettled([
        getTransactions(),
        getIncomes(),
        getLiabilities()
      ]);

      setCounts({
        transactions: txs.status === 'fulfilled' && Array.isArray(txs.value) ? txs.value.length : 0,
        income: incs.status === 'fulfilled' && Array.isArray(incs.value) ? incs.value.length : 0,
        liabilities: liabs.status === 'fulfilled' && Array.isArray(liabs.value) ? liabs.value.length : 0
      });
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const exportTransactions = async () => {
    try {
      setIsExporting(true);
      setActiveKind('transactions');
      setError(null);
      const data = await getTransactions();
      if (!data || data.length === 0) {
        setError('No transactions available to export.');
        return;
      }
      const csv = transactionsToCsv(data);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerCsvDownload(`finaura_transactions_${dateStr}.csv`, csv);
    } catch {
      setError('Failed to generate transactions CSV.');
    } finally {
      setIsExporting(false);
      setActiveKind(null);
    }
  };

  const exportIncome = async () => {
    try {
      setIsExporting(true);
      setActiveKind('income');
      setError(null);
      const data = await getIncomes();
      if (!data || data.length === 0) {
        setError('No income records available to export.');
        return;
      }
      const csv = incomesToCsv(data);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerCsvDownload(`finaura_income_${dateStr}.csv`, csv);
    } catch {
      setError('Failed to generate income CSV.');
    } finally {
      setIsExporting(false);
      setActiveKind(null);
    }
  };

  const exportLiabilities = async () => {
    try {
      setIsExporting(true);
      setActiveKind('liabilities');
      setError(null);
      const data = await getLiabilities();
      if (!data || data.length === 0) {
        setError('No liabilities available to export.');
        return;
      }
      const csv = liabilitiesToCsv(data);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerCsvDownload(`finaura_liabilities_${dateStr}.csv`, csv);
    } catch {
      setError('Failed to generate liabilities CSV.');
    } finally {
      setIsExporting(false);
      setActiveKind(null);
    }
  };

  const exportMonthlySummaries = async (rows: MonthlyCsvRow[]) => {
    try {
      setIsExporting(true);
      setActiveKind('monthly');
      setError(null);
      if (!rows || rows.length === 0) {
        setError('No monthly summaries available to export.');
        return;
      }
      const csv = monthlySummariesToCsv(rows);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerCsvDownload(`finaura_monthly_summaries_${dateStr}.csv`, csv);
    } catch {
      setError('Failed to generate monthly summaries CSV.');
    } finally {
      setIsExporting(false);
      setActiveKind(null);
    }
  };

  const printReport = () => {
    window.print();
  };

  return {
    isExporting,
    activeKind,
    error,
    counts,
    exportTransactions,
    exportIncome,
    exportLiabilities,
    exportMonthlySummaries,
    printReport,
    refreshCounts: loadCounts
  };
}
