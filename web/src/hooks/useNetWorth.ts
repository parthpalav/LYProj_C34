import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPredictability, getAssets, getLiabilities } from '../services/api';
import type { PredictabilitySnapshot, Asset, Liability } from '../types';

export function useNetWorth() {
  const [snapshot, setSnapshot] = useState<PredictabilitySnapshot | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNetWorthData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const [predRes, assetsRes, liabRes] = await Promise.all([
        getPredictability().catch(() => null),
        getAssets().catch(() => []),
        getLiabilities().catch(() => []),
      ]);

      setSnapshot(predRes);
      setAssets(assetsRes);
      setLiabilities(liabRes.filter((l) => l.status !== 'deleted'));
    } catch (err: any) {
      console.error('Failed to load net worth data:', err);
      setError(err?.message || 'Failed to load net worth data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchNetWorthData(false);
    }
    void loadData();
  }, [fetchNetWorthData]);

  // Correction #1: Direct authoritative knownNetWorth from backend
  const knownNetWorth = useMemo(() => {
    return snapshot?.assets?.knownNetWorth ?? 0;
  }, [snapshot]);

  const totalAssetValue = useMemo(() => {
    return snapshot?.assets?.totalAssetValue ?? 0;
  }, [snapshot]);

  const totalLiabilities = useMemo(() => {
    return snapshot?.liabilities?.knownOutstandingPrincipal ?? 0;
  }, [snapshot]);

  // Correction #2: Operational cash balance is distinct and not added into totalAssetValue
  const operationalCash = useMemo(() => {
    return snapshot?.currentState?.currentBalance ?? 0;
  }, [snapshot]);

  const fireInvestableCorpus = useMemo(() => {
    return snapshot?.assets?.fireInvestableCorpus ?? 0;
  }, [snapshot]);

  const liquidBuffer = useMemo(() => {
    return snapshot?.assets?.liquidBuffer ?? 0;
  }, [snapshot]);

  // Asset breakdown by class
  const assetClassBreakdown = useMemo(() => {
    const classMap = new Map<string, number>();
    assets.forEach((a) => {
      const cls = a.assetClass || 'OTHER';
      classMap.set(cls, (classMap.get(cls) || 0) + (Number(a.currentValue) || 0));
    });
    return Array.from(classMap.entries()).map(([cls, amount]) => ({
      assetClass: cls,
      amount: Math.round(amount),
      percentage: totalAssetValue > 0 ? Math.round((amount / totalAssetValue) * 100) : 0,
    }));
  }, [assets, totalAssetValue]);

  // Liabilities summary
  const liabilitiesBreakdown = useMemo(() => {
    return liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      amount: l.amount,
      frequency: l.frequency,
      outstandingBalance: l.outstandingBalance ?? null,
      interestRate: l.interestRate ?? null,
    }));
  }, [liabilities]);

  return {
    snapshot,
    assets,
    liabilities,
    loading,
    error,
    refresh: fetchNetWorthData,
    knownNetWorth,
    totalAssetValue,
    totalLiabilities,
    operationalCash,
    fireInvestableCorpus,
    liquidBuffer,
    assetClassBreakdown,
    liabilitiesBreakdown,
  };
}
