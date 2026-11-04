import { useCallback, useEffect, useState } from 'react';
import { getPurchasePredictions } from '../services/api';
import type { PurchasePredictions } from '../types';

export function usePurchasePredictions() {
  const [data, setData] = useState<PurchasePredictions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getPurchasePredictions());
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchase predictions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
