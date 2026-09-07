import { useState, useEffect, useMemo, useCallback } from 'react';
import { getBehavior, getTransactions } from '../services/api';
import type { BehaviorPattern, Transaction } from '../types';

export interface DynamicSignalCounter {
  type: string;
  label: string;
  emoji: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export function useBehaviorInsights() {
  const [patterns, setPatterns] = useState<BehaviorPattern[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBehaviorData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const [behaviorRes, txRes] = await Promise.all([
        getBehavior(),
        getTransactions(),
      ]);

      setPatterns(behaviorRes.patterns || []);
      setAnalyzedCount(behaviorRes.analyzedCount || 0);
      setTransactions(txRes || []);
    } catch (err: any) {
      console.error('Failed to load behavior insights:', err);
      setError(err?.message || 'Failed to load behavioural patterns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchBehaviorData(false);
    }
    void loadData();
  }, [fetchBehaviorData]);

  // Anomalous transactions list (isAnomaly === true)
  const anomalousTransactions = useMemo(() => {
    return transactions.filter((t) => Boolean(t.isAnomaly));
  }, [transactions]);

  // Derive displayed signal types dynamically from verified pattern.type values (Correction #1)
  const dynamicSignalCounters = useMemo<DynamicSignalCounter[]>(() => {
    const formatLabel = (type: string) => {
      switch (type) {
        case 'late_night':
          return 'Late-Night Purchases';
        case 'food_spike':
          return 'Food Spending Spike';
        case 'impulse_shopping':
          return 'High-Frequency Shopping';
        case 'anomaly_cluster':
          return 'Spending Anomalies';
        default:
          return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
    };

    return patterns.map((p) => {
      // Extract count from message if available (e.g. "3 late-night purchases detected")
      const match = p.message.match(/(\d+)/);
      const count = match ? parseInt(match[1], 10) : 1;

      return {
        type: p.type,
        label: formatLabel(p.type),
        emoji: p.emoji || '⚡',
        count,
        severity: p.severity || 'medium',
        message: p.message,
      };
    });
  }, [patterns]);

  return {
    patterns,
    analyzedCount,
    dynamicSignalCounters,
    anomalousTransactions,
    loading,
    error,
    refresh: fetchBehaviorData,
  };
}
