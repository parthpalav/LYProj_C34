/* oxlint-disable react/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import type { WeeklyReport, PacingReport } from '../types';
import { getWeeklyReport, getPacingReport } from '../services/api';

export function useWeeklyReport() {
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [pacingReport, setPacingReport] = useState<PacingReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, pacing] = await Promise.allSettled([
        getWeeklyReport(),
        getPacingReport()
      ]);

      if (weekly.status === 'fulfilled') {
        setWeeklyReport(weekly.value);
      } else {
        setError('Failed to load weekly financial report.');
      }

      if (pacing.status === 'fulfilled') {
        setPacingReport(pacing.value);
      }
    } catch {
      setError('An unexpected error occurred while loading the weekly report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    weeklyReport,
    pacingReport,
    loading,
    error,
    refresh: fetchReport
  };
}
