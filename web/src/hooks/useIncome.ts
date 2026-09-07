import { useState, useEffect, useMemo, useCallback } from 'react';
import { getIncome, getIncomeFlow, createIncome, updateIncome, deleteIncome } from '../services/api';
import type { IncomeRecord, IncomePayload, IncomeFlowResponse } from '../types';

export interface UseIncomeReturn {
  incomes: IncomeRecord[];
  flow: IncomeFlowResponse | null;
  isLoading: boolean;
  error: string | null;
  summary: {
    totalIncome: number;
    thisMonthIncome: number;
    averageIncome: number;
    incomeCount: number;
    volatility: number | null;
    dailySmoothed: number;
  };
  refetch: () => Promise<void>;
  add: (payload: IncomePayload) => Promise<IncomeRecord>;
  edit: (id: string, payload: Partial<IncomePayload>) => Promise<IncomeRecord>;
  remove: (id: string) => Promise<void>;
}

export function useIncome(): UseIncomeReturn {
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [flow, setFlow] = useState<IncomeFlowResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [incomeData, flowData] = await Promise.all([
        getIncome(),
        getIncomeFlow().catch((err) => {
          console.warn('Could not fetch income flow metrics:', err);
          return null;
        }),
      ]);
      setIncomes(incomeData);
      setFlow(flowData);
    } catch (err: any) {
      console.error('Failed to load income data:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to load income records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchData();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let total = 0;
    let thisMonth = 0;

    for (const inc of incomes) {
      const amt = Number(inc.amount) || 0;
      total += amt;
      const d = new Date(inc.timestamp);
      if (!isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        thisMonth += amt;
      }
    }

    const count = incomes.length;
    const average = count > 0 ? Math.round(total / count) : 0;
    const volatility = flow?.volatility !== undefined ? flow.volatility : null;
    const dailySmoothed = flow?.dailySmoothed || Math.round(total / 30);

    return {
      totalIncome: total,
      thisMonthIncome: thisMonth,
      averageIncome: average,
      incomeCount: count,
      volatility,
      dailySmoothed,
    };
  }, [incomes, flow]);

  const add = useCallback(async (payload: IncomePayload): Promise<IncomeRecord> => {
    const created = await createIncome(payload);
    setIncomes((prev) => [created, ...prev]);
    // Refresh flow in background
    getIncomeFlow().then(setFlow).catch(() => {});
    return created;
  }, []);

  const edit = useCallback(async (id: string, payload: Partial<IncomePayload>): Promise<IncomeRecord> => {
    const updated = await updateIncome(id, payload);
    setIncomes((prev) => prev.map((i) => (i.id === id ? updated : i)));
    getIncomeFlow().then(setFlow).catch(() => {});
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteIncome(id);
    setIncomes((prev) => prev.filter((i) => i.id !== id));
    getIncomeFlow().then(setFlow).catch(() => {});
  }, []);

  return {
    incomes,
    flow,
    isLoading,
    error,
    summary,
    refetch: fetchData,
    add,
    edit,
    remove,
  };
}
