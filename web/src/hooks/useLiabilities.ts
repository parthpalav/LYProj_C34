import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getLiabilities,
  getLiabilitiesPaymentsSummary,
  createLiability,
  updateLiability,
  deleteLiability,
} from '../services/api';
import type { Liability, LiabilityPayload, LiabilitiesPaymentSummaryItem } from '../types';

export interface UseLiabilitiesReturn {
  liabilities: Liability[];
  paymentsSummary: Record<string, LiabilitiesPaymentSummaryItem>;
  isLoading: boolean;
  error: string | null;
  summary: {
    activeCount: number;
    dueNext30Days: number;
    nearestDueDate: string | null;
  };
  refetch: () => Promise<void>;
  add: (payload: LiabilityPayload) => Promise<Liability>;
  edit: (id: string, payload: Partial<LiabilityPayload>) => Promise<Liability>;
  remove: (id: string) => Promise<void>;
}

export function useLiabilities(): UseLiabilitiesReturn {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [paymentsSummary, setPaymentsSummary] = useState<Record<string, LiabilitiesPaymentSummaryItem>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [liabilitiesData, summaryData] = await Promise.all([
        getLiabilities(),
        getLiabilitiesPaymentsSummary().catch((err) => {
          console.warn('Could not fetch liabilities payment summary:', err);
          return {};
        }),
      ]);
      // Keep only active liabilities in primary view
      setLiabilities(liabilitiesData.filter((l) => l.status !== 'deleted'));
      setPaymentsSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to load liabilities data:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to load recurring liabilities.');
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

  // Safe summaries without arbitrary recurrence math
  const summary = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let dueNext30Days = 0;
    let nearestDueTime = Infinity;
    let nearestDueDateStr: string | null = null;

    for (const l of liabilities) {
      if (l.status === 'deleted') continue;

      if (l.nextDueDate) {
        const dueDate = new Date(l.nextDueDate);
        if (!isNaN(dueDate.getTime())) {
          // Amount due within next 30 days
          if (dueDate >= now && dueDate <= thirtyDaysFromNow) {
            dueNext30Days += Number(l.amount) || 0;
          }

          // Nearest upcoming due date
          if (dueDate >= now && dueDate.getTime() < nearestDueTime) {
            nearestDueTime = dueDate.getTime();
            nearestDueDateStr = l.nextDueDate;
          }
        }
      }
    }

    return {
      activeCount: liabilities.length,
      dueNext30Days,
      nearestDueDate: nearestDueDateStr,
    };
  }, [liabilities]);

  const add = useCallback(async (payload: LiabilityPayload): Promise<Liability> => {
    const created = await createLiability(payload);
    setLiabilities((prev) => [created, ...prev]);
    return created;
  }, []);

  const edit = useCallback(async (id: string, payload: Partial<LiabilityPayload>): Promise<Liability> => {
    const updated = await updateLiability(id, payload);
    setLiabilities((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteLiability(id);
    setLiabilities((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return {
    liabilities,
    paymentsSummary,
    isLoading,
    error,
    summary,
    refetch: fetchData,
    add,
    edit,
    remove,
  };
}
