import { useState, useEffect, useMemo, useCallback } from 'react';
import { getFMI } from '../services/api';
import type { FMIResponse, FMIRecord } from '../types';
import { getAppTimezone } from '../utils/timezone';
import { inRange, type DateRange } from '../utils/dateRange';

export function useFmiInsights(range: DateRange) {
  const [currentFmi, setCurrentFmi] = useState<FMIResponse | null>(null);
  const [history, setHistory] = useState<FMIRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFmiData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const data = await getFMI();
      setCurrentFmi(data.current);
      // Sort history chronologically
      const sortedHistory = [...data.history].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setHistory(sortedHistory);
    } catch (err: any) {
      console.error('Failed to load FMI data:', err);
      setError(err?.message || 'Failed to load FMI analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchFmiData();
    }
    void loadData();
  }, [fetchFmiData]);

  // History points inside the selected range
  const filteredHistory = useMemo(
    () => history.filter((h) => inRange(new Date(h.timestamp), range)),
    [history, range],
  );

  // Format historical chart data
  const chartData = useMemo(() => {
    return filteredHistory.map((item) => {
      const d = new Date(item.timestamp);
      return {
        date: item.timestamp,
        dateLabel: d.toLocaleDateString('en-IN', { timeZone: getAppTimezone(), month: 'short', day: 'numeric' }),
        fullDate: d.toLocaleDateString('en-IN', { timeZone: getAppTimezone(), day: 'numeric', month: 'short', year: 'numeric' }),
        score: item.score,
      };
    });
  }, [filteredHistory]);

  // Delta comparison between current and previous snapshot
  const deltaSummary = useMemo(() => {
    if (history.length < 2 || !currentFmi) {
      return {
        hasComparison: false,
        scoreDelta: 0,
        previousScore: null,
        currentScore: currentFmi?.score ?? currentFmi?.FMI ?? null,
        hasHistoricalPillars: false,
        d1Delta: null,
        d2Delta: null,
        d3Delta: null,
        pillarsUnavailableMessage: 'Need at least two historical records for comparison.',
      };
    }

    // Latest snapshot is last in array; previous is second to last
    const prevSnapshot = history[history.length - 2];
    const prevScore = prevSnapshot.score;
    const curScore = currentFmi.score ?? currentFmi.FMI ?? 0;
    const scoreDelta = curScore - prevScore;

    // Check whether previous snapshot has pillars recorded
    const prevPillars = prevSnapshot.pillars;
    const curPillars = currentFmi.pillars;

    if (
      prevPillars &&
      prevPillars.D1_savingDiscipline &&
      prevPillars.D2_spendingControl &&
      prevPillars.D3_behavioralRisk &&
      curPillars &&
      curPillars.D1_savingDiscipline &&
      curPillars.D2_spendingControl &&
      curPillars.D3_behavioralRisk
    ) {
      return {
        hasComparison: true,
        scoreDelta,
        previousScore: prevScore,
        currentScore: curScore,
        hasHistoricalPillars: true,
        d1Delta: curPillars.D1_savingDiscipline.score - prevPillars.D1_savingDiscipline.score,
        d2Delta: curPillars.D2_spendingControl.score - prevPillars.D2_spendingControl.score,
        d3Delta: curPillars.D3_behavioralRisk.score - prevPillars.D3_behavioralRisk.score,
        pillarsUnavailableMessage: null,
      };
    }

    return {
      hasComparison: true,
      scoreDelta,
      previousScore: prevScore,
      currentScore: curScore,
      hasHistoricalPillars: false,
      d1Delta: null,
      d2Delta: null,
      d3Delta: null,
      pillarsUnavailableMessage: 'Detailed pillar history unavailable for this snapshot.',
    };
  }, [history, currentFmi]);

  // Neutral factors list per Correction #2
  const neutralFactors = useMemo(() => {
    return currentFmi?.factors || [];
  }, [currentFmi]);

  // Insights list from backend
  const backendInsights = useMemo(() => {
    return currentFmi?.insights || [];
  }, [currentFmi]);

  return {
    currentFmi,
    history,
    loading,
    error,
    refresh: fetchFmiData,
    chartData,
    deltaSummary,
    neutralFactors,
    backendInsights,
  };
}
