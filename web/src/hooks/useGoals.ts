import { useState, useEffect, useCallback, useMemo } from 'react';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../services/api';
import type { Goal } from '../types';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoalsList = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const res = await getGoals();
      setGoals(res || []);
    } catch (err: any) {
      console.error('Failed to load goals:', err);
      setError(err?.message || 'Failed to load financial goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchGoalsList(false);
    }
    void loadData();
  }, [fetchGoalsList]);

  // Correction #3: Single atomic create request using verified backend schema
  const addGoal = useCallback(
    async (payload: {
      name: string;
      emoji?: string;
      targetAmount: number;
      targetDate?: string;
      monthlyContribution?: number;
    }) => {
      const created = await createGoal(payload);
      setGoals((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const editGoal = useCallback(async (id: string, payload: Partial<Goal>) => {
    const updated = await updateGoal(id, payload);
    setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    return updated;
  }, []);

  const removeGoal = useCallback(async (id: string) => {
    await deleteGoal(id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  // Aggregated totals
  const totalTargetAmount = useMemo(() => {
    return goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  }, [goals]);

  const totalSavedAmount = useMemo(() => {
    return goals.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0);
  }, [goals]);

  const overallProgressPercentage = useMemo(() => {
    if (totalTargetAmount <= 0) return 0;
    return Math.min(100, Math.round((totalSavedAmount / totalTargetAmount) * 100));
  }, [totalSavedAmount, totalTargetAmount]);

  return {
    goals,
    loading,
    error,
    refresh: fetchGoalsList,
    addGoal,
    editGoal,
    removeGoal,
    totalTargetAmount,
    totalSavedAmount,
    overallProgressPercentage,
  };
}
