import { useCallback, useEffect, useState } from 'react';
import { getPaymentMethods } from '../services/api';
import type { PaymentMethod } from '../types';

/** All saved payment methods, archived included (needed to label old transactions). */
export function usePaymentMethods(enabled = true) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMethods(await getPaymentMethods());
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load payment methods.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  return { methods, active: methods.filter((m) => m.status === 'active'), isLoading, error, refetch };
}
