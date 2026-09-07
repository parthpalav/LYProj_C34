import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPredictability } from '../services/api';
import type { PredictabilitySnapshot } from '../types';

export function useFirePlan() {
  const [snapshot, setSnapshot] = useState<PredictabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFireData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);
      const res = await getPredictability();
      setSnapshot(res);
    } catch (err: any) {
      console.error('Failed to load FIRE plan:', err);
      setError(err?.message || 'Failed to load FIRE projections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await fetchFireData(false);
    }
    void loadData();
  }, [fetchFireData]);

  const retirement = snapshot?.retirement ?? null;
  const scenarios = snapshot?.scenarios ?? null;
  const emergencyFund = snapshot?.emergencyFund ?? null;
  const probabilistic = snapshot?.probabilistic ?? null;
  const forecastStatus = snapshot?.forecastStatus ?? null;

  // Core metrics
  const targetFireCorpus = retirement?.estimatedFireCorpus ?? 0;
  const currentFireCorpus = snapshot?.assets?.fireInvestableCorpus ?? 0;
  const currentAge = retirement?.currentAge ?? null;
  const targetRetirementAge = retirement?.retirementAge ?? null;
  const projectedFireAge = retirement?.projectedFire?.projectedAge ?? null;
  const isFireReached = retirement?.projectedFire?.reached ?? false;
  const projectedCorpusAtRetirement = retirement?.projectedCorpusAtRetirement ?? null;

  // Correction #6: Presentation math for progress bar (safe when target <= 0)
  const fireProgressPercentage = useMemo(() => {
    if (targetFireCorpus <= 0) return 0;
    return Math.min(100, Math.round((currentFireCorpus / targetFireCorpus) * 100));
  }, [currentFireCorpus, targetFireCorpus]);

  // Contribution requirements
  const requiredMonthlyContribution = retirement?.requiredMonthlyContributionForEstimatedFire ?? null;
  const currentMonthlyContribution = retirement?.monthlyContributionUsed ?? 0;
  const contributionGap = retirement?.contributionGap ?? null;

  // Correction #8: Only display Liability Overhang if directly exposed in backend explanationFacts
  const liabilityOverhang = useMemo(() => {
    const facts = snapshot?.explanationFacts || [];
    const fact = facts.find((f) => f.code === 'LIABILITY_OVERHANG_INCLUDED');
    if (fact && typeof fact.value === 'number' && fact.value > 0) {
      return fact.value;
    }
    return null;
  }, [snapshot]);

  // Correction #7: Verified probabilistic response fields
  const probabilityFunded = probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;
  const corpusPercentiles = probabilistic?.estimatedFire?.corpusPercentiles ?? null;
  const fundedAge50 = probabilistic?.estimatedFire?.fundedAge50 ?? null;
  const fundedAge75 = probabilistic?.estimatedFire?.fundedAge75 ?? null;
  const contributionRecommendation = probabilistic?.contributionRecommendation ?? null;

  return {
    snapshot,
    retirement,
    scenarios,
    emergencyFund,
    probabilistic,
    forecastStatus,
    loading,
    error,
    refresh: fetchFireData,
    targetFireCorpus,
    currentFireCorpus,
    currentAge,
    targetRetirementAge,
    projectedFireAge,
    isFireReached,
    projectedCorpusAtRetirement,
    fireProgressPercentage,
    requiredMonthlyContribution,
    currentMonthlyContribution,
    contributionGap,
    liabilityOverhang,
    probabilityFunded,
    corpusPercentiles,
    fundedAge50,
    fundedAge75,
    contributionRecommendation,
  };
}
