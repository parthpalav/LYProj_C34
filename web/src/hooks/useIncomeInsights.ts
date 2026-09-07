import { useState, useEffect, useMemo, useCallback } from 'react';
import { getIncome, getIncomeFlow, getPredictability } from '../services/api';
import type {
  IncomeRecord,
  IncomeFlowResponse,
  PredictabilitySnapshot,
  IncomeTrendPoint,
  IncomeSourceSummary,
} from '../types';

export type IncomeRange = '6m' | '12m' | 'all';

export function useIncomeInsights() {
  const [range, setRange] = useState<IncomeRange>('6m');
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [flowData, setFlowData] = useState<IncomeFlowResponse | null>(null);
  const [predictability, setPredictability] = useState<PredictabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomeAnalytics = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const [incList, flowRes, predRes] = await Promise.all([
        getIncome(),
        getIncomeFlow().catch(() => null),
        getPredictability().catch(() => null),
      ]);

      setIncomes(incList || []);
      setFlowData(flowRes);
      setPredictability(predRes);
    } catch (err: any) {
      console.error('Failed to load income insights:', err);
      setError(err?.message || 'Failed to load income analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchIncomeAnalytics(false);
    }
    void loadData();
  }, [fetchIncomeAnalytics]);

  // Determine months in range for income trend
  const monthsInRange = useMemo(() => {
    const now = new Date();
    const result: Array<{ key: string; label: string; year: number; month: number }> = [];

    let count = 6;
    if (range === '6m') count = 6;
    else if (range === '12m') count = 12;
    else if (range === 'all') count = 24;

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

  // Monthly income trend data
  const trendData = useMemo<IncomeTrendPoint[]>(() => {
    const map = new Map<string, { amount: number; count: number }>();
    monthsInRange.forEach((m) => {
      map.set(m.key, { amount: 0, count: 0 });
    });

    incomes.forEach((inc) => {
      const d = new Date(inc.timestamp);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const entry = map.get(key);
        if (entry) {
          entry.amount += Number(inc.amount) || 0;
          entry.count += 1;
        }
      }
    });

    return monthsInRange.map((m) => {
      const entry = map.get(m.key) || { amount: 0, count: 0 };
      return {
        monthKey: m.key,
        monthLabel: m.label,
        amount: Math.round(entry.amount),
        eventCount: entry.count,
      };
    });
  }, [monthsInRange, incomes]);

  // Average monthly income for trend reference line
  const averageMonthlyIncome = useMemo(() => {
    if (predictability?.income?.meanMonthlyIncome !== undefined && predictability.income.meanMonthlyIncome !== null) {
      return Math.round(predictability.income.meanMonthlyIncome);
    }
    if (trendData.length === 0) return 0;
    const total = trendData.reduce((s, p) => s + p.amount, 0);
    return Math.round(total / trendData.length);
  }, [predictability, trendData]);

  // Income source concentration
  const sourceConcentration = useMemo<IncomeSourceSummary[]>(() => {
    const sourceMap = new Map<string, number>();
    let grandTotal = 0;

    incomes.forEach((inc) => {
      const src = inc.source || 'Other';
      const amt = Number(inc.amount) || 0;
      sourceMap.set(src, (sourceMap.get(src) || 0) + amt);
      grandTotal += amt;
    });

    const list: IncomeSourceSummary[] = [];
    sourceMap.forEach((amount, source) => {
      list.push({
        source,
        amount: Math.round(amount),
        percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
      });
    });

    return list.sort((a, b) => b.amount - a.amount);
  }, [incomes]);

  // Authoritative Predictability Engine Statistics
  const incomeStats = useMemo(() => {
    const inc = predictability?.income;
    const percentile = inc?.percentileUsed ?? 25;

    // Volatility: format CV as percentage
    let volatilityPct: number | null = null;
    if (inc?.coefficientOfVariation !== undefined && inc.coefficientOfVariation !== null) {
      volatilityPct = Math.round(inc.coefficientOfVariation * 100);
    } else if (flowData?.volatility !== undefined && flowData.volatility !== null) {
      volatilityPct = Math.round(flowData.volatility * 100);
    }

    return {
      meanMonthlyIncome: inc?.meanMonthlyIncome !== undefined ? Math.round(inc.meanMonthlyIncome) : null,
      medianMonthlyIncome: inc?.medianMonthlyIncome !== undefined ? Math.round(inc.medianMonthlyIncome) : null,
      reliableMonthlyIncome: inc?.reliableMonthlyIncome !== undefined ? Math.round(inc.reliableMonthlyIncome) : null,
      // Correction #5: Explicit percentile context in label
      reliableIncomeLabel: `Reliable monthly income (${percentile}th percentile)`,
      percentileUsed: percentile,
      volatilityPercentage: volatilityPct,
      zeroIncomeMonthsCount: inc?.zeroIncomeMonthsCount ?? 0,
      worstRollingQuarterSum: inc?.worstRollingQuarter?.worstQuarterSum !== undefined ? Math.round(inc.worstRollingQuarter.worstQuarterSum) : null,
      worstRollingQuarterMonths: inc?.worstRollingQuarter?.worstQuarterMonths ?? [],
    };
  }, [predictability, flowData]);

  // Resilience & Runway
  const resilience = useMemo(() => {
    const r = predictability?.resilience;
    return {
      essentialCoverageRatio: r?.essentialCoverageRatio ?? null,
      isCoverageAdequate: r?.isCoverageAdequate ?? null,
      bufferRunwayMonths: r?.bufferRunwayMonths ?? null,
    };
  }, [predictability]);

  return {
    range,
    setRange,
    incomes,
    loading,
    error,
    refresh: fetchIncomeAnalytics,
    trendData,
    averageMonthlyIncome,
    sourceConcentration,
    incomeStats,
    resilience,
  };
}
