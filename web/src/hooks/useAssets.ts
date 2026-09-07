import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../services/api';
import type { Asset, AssetClass, AssetLiquidity } from '../types';

export function getAssetClassLabel(cls: AssetClass | string): string {
  switch (cls) {
    case 'FIRE_INVESTABLE':
      return 'FIRE Investable';
    case 'SEMI_LIQUID':
      return 'Semi-Liquid';
    case 'NON_INVESTABLE':
      return 'Non-Investable';
    default:
      return cls;
  }
}

export function getAssetLiquidityLabel(liq: AssetLiquidity | string): string {
  switch (liq) {
    case 'liquid':
      return 'Liquid';
    case 'locked':
      return 'Locked';
    case 'restricted':
      return 'Restricted';
    default:
      return liq;
  }
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssetsList = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const res = await getAssets();
      setAssets(res || []);
    } catch (err: any) {
      console.error('Failed to load assets:', err);
      setError(err?.message || 'Failed to load assets list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchAssetsList(false);
    }
    void loadData();
  }, [fetchAssetsList]);

  const addAsset = useCallback(async (payload: Omit<Asset, 'id'>) => {
    // Invariant: Non-investable cannot count toward FIRE
    const sanitizedPayload = {
      ...payload,
      includedInFireCorpus: payload.assetClass === 'NON_INVESTABLE' ? false : Boolean(payload.includedInFireCorpus),
    };
    const created = await createAsset(sanitizedPayload);
    setAssets((prev) => [created, ...prev]);
    return created;
  }, []);

  const editAsset = useCallback(async (id: string, payload: Partial<Asset>) => {
    const sanitizedPayload = {
      ...payload,
      ...(payload.assetClass === 'NON_INVESTABLE' ? { includedInFireCorpus: false } : {}),
    };
    const updated = await updateAsset(id, sanitizedPayload);
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const removeAsset = useCallback(async (id: string) => {
    await deleteAsset(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const totalAssetValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  }, [assets]);

  const fireInvestableTotal = useMemo(() => {
    return assets
      .filter((a) => a.includedInFireCorpus && a.assetClass !== 'NON_INVESTABLE')
      .reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  }, [assets]);

  return {
    assets,
    loading,
    error,
    refresh: fetchAssetsList,
    addAsset,
    editAsset,
    removeAsset,
    totalAssetValue,
    fireInvestableTotal,
  };
}
