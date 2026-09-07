import { useState, useEffect, useCallback, useMemo } from 'react';
import { getPredictability, evaluateScenario } from '../services/api';
import type { PredictabilitySnapshot, ScenarioOverrides } from '../types';

export interface ScenarioComparisonDeltas {
  projectedCorpusDelta: number | null;
  projectedCorpusDeltaPct: number | null;
  fireAgeDeltaYears: number | null;
  probabilityDeltaPoints: number | null;
  requiredContributionDelta: number | null;
}

export function useScenarioLab() {
  const [baselineSnapshot, setBaselineSnapshot] = useState<PredictabilitySnapshot | null>(null);
  const [scenarioSnapshot, setScenarioSnapshot] = useState<PredictabilitySnapshot | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for scenario overrides
  const [monthlyContribution, setMonthlyContribution] = useState<number>(0);
  const [retirementAge, setRetirementAge] = useState<number>(60);
  const [expectedReturnRate, setExpectedReturnRate] = useState<number>(0.08);
  const [expectedInflationRate, setExpectedInflationRate] = useState<number>(0.06);
  const [annualContributionGrowthRate, setAnnualContributionGrowthRate] = useState<number>(0);
  const [contributionMode, setContributionMode] = useState<'NOMINAL_FLAT' | 'REAL_CONSTANT' | 'STEP_UP'>('NOMINAL_FLAT');

  // Load baseline
  const loadBaseline = useCallback(async () => {
    try {
      setLoadingBaseline(true);
      setError(null);
      const res = await getPredictability();
      setBaselineSnapshot(res);
      setScenarioSnapshot(res); // Initially scenario matches baseline

      // Seed inputs from baseline
      const bRet = res?.retirement;
      const bAssump = bRet?.assumptions;

      const initMonthly = bRet?.monthlyContributionUsed ?? 0;
      const initRetAge = bRet?.retirementAge ?? 60;
      const initReturn = bAssump?.nominalReturn ?? 0.08;
      const initInf = bAssump?.inflation ?? 0.06;
      const initStepUp = bAssump?.annualContributionGrowthRate ?? 0;
      const initMode = (bAssump?.contributionMode as any) || 'NOMINAL_FLAT';

      setMonthlyContribution(Math.round(initMonthly));
      setRetirementAge(initRetAge);
      setExpectedReturnRate(initReturn);
      setExpectedInflationRate(initInf);
      setAnnualContributionGrowthRate(initStepUp);
      setContributionMode(initMode);
    } catch (err: any) {
      console.error('Failed to load baseline predictability:', err);
      setError(err?.message || 'Failed to load baseline data');
    } finally {
      setLoadingBaseline(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      await loadBaseline();
    }
    void loadData();
  }, [loadBaseline]);

  // Current age constraint
  const currentAge = baselineSnapshot?.retirement?.currentAge ?? null;

  // Run Scenario with in-memory overrides
  const runScenario = useCallback(
    async (overridePayload?: Partial<ScenarioOverrides>) => {
      try {
        setEvaluating(true);
        setError(null);

        const payload: ScenarioOverrides = {
          monthlyContribution,
          retirementAge,
          expectedReturnRate,
          expectedInflationRate,
          annualContributionGrowthRate,
          contributionMode,
          ...overridePayload,
        };

        const res = await evaluateScenario(payload);
        setScenarioSnapshot(res);
      } catch (err: any) {
        console.error('Failed to evaluate scenario:', err);
        setError(err?.response?.data?.error || err?.message || 'Failed to evaluate scenario');
      } finally {
        setEvaluating(false);
      }
    },
    [
      monthlyContribution,
      retirementAge,
      expectedReturnRate,
      expectedInflationRate,
      annualContributionGrowthRate,
      contributionMode,
    ]
  );

  // Correction #4: Presets modify baseline, not replace blindly
  const applyPreset = useCallback(
    (presetId: 'more_investment' | 'retire_later' | 'lower_return' | 'step_up') => {
      const bRet = baselineSnapshot?.retirement;
      const bAssump = bRet?.assumptions;

      const baseMonthly = Math.round(bRet?.monthlyContributionUsed ?? 0);
      const baseRetAge = bRet?.retirementAge ?? 60;
      const baseReturn = bAssump?.nominalReturn ?? 0.08;

      let newMonthly = monthlyContribution;
      let newRetAge = retirementAge;
      let newReturn = expectedReturnRate;
      let newInflation = expectedInflationRate;
      let newStepUp = annualContributionGrowthRate;
      let newMode = contributionMode;

      if (presetId === 'more_investment') {
        newMonthly = baseMonthly + 5000;
        setMonthlyContribution(newMonthly);
      } else if (presetId === 'retire_later') {
        newRetAge = Math.min(100, baseRetAge + 3);
        setRetirementAge(newRetAge);
      } else if (presetId === 'lower_return') {
        newReturn = Math.max(0.01, Math.round((baseReturn - 0.02) * 1000) / 1000);
        setExpectedReturnRate(newReturn);
      } else if (presetId === 'step_up') {
        newMode = 'STEP_UP';
        newStepUp = 0.10; // 10% annual step-up
        setContributionMode(newMode);
        setAnnualContributionGrowthRate(newStepUp);
      }

      void runScenario({
        monthlyContribution: newMonthly,
        retirementAge: newRetAge,
        expectedReturnRate: newReturn,
        expectedInflationRate: newInflation,
        annualContributionGrowthRate: newStepUp,
        contributionMode: newMode,
      });
    },
    [
      baselineSnapshot,
      monthlyContribution,
      retirementAge,
      expectedReturnRate,
      expectedInflationRate,
      annualContributionGrowthRate,
      contributionMode,
      runScenario,
    ]
  );

  // Reset to Baseline
  const resetToBaseline = useCallback(() => {
    const bRet = baselineSnapshot?.retirement;
    const bAssump = bRet?.assumptions;

    const baseMonthly = Math.round(bRet?.monthlyContributionUsed ?? 0);
    const baseRetAge = bRet?.retirementAge ?? 60;
    const baseReturn = bAssump?.nominalReturn ?? 0.08;
    const baseInf = bAssump?.inflation ?? 0.06;
    const baseStepUp = bAssump?.annualContributionGrowthRate ?? 0;
    const baseMode = (bAssump?.contributionMode as any) || 'NOMINAL_FLAT';

    setMonthlyContribution(baseMonthly);
    setRetirementAge(baseRetAge);
    setExpectedReturnRate(baseReturn);
    setExpectedInflationRate(baseInf);
    setAnnualContributionGrowthRate(baseStepUp);
    setContributionMode(baseMode);

    setScenarioSnapshot(baselineSnapshot);
  }, [baselineSnapshot]);

  // Correction #6: Presentation comparison deltas
  const deltas = useMemo<ScenarioComparisonDeltas>(() => {
    const baseRet = baselineSnapshot?.retirement;
    const scenRet = scenarioSnapshot?.retirement;

    const baseCorpus = baseRet?.projectedCorpusAtRetirement ?? null;
    const scenCorpus = scenRet?.projectedCorpusAtRetirement ?? null;
    let projectedCorpusDelta: number | null = null;
    let projectedCorpusDeltaPct: number | null = null;

    if (baseCorpus !== null && scenCorpus !== null) {
      projectedCorpusDelta = Math.round(scenCorpus - baseCorpus);
      projectedCorpusDeltaPct = baseCorpus > 0 ? Math.round(((scenCorpus - baseCorpus) / baseCorpus) * 100) : 0;
    }

    const baseAge = baseRet?.projectedFire?.projectedAge ?? null;
    const scenAge = scenRet?.projectedFire?.projectedAge ?? null;
    let fireAgeDeltaYears: number | null = null;
    if (baseAge !== null && scenAge !== null) {
      fireAgeDeltaYears = Math.round((scenAge - baseAge) * 10) / 10;
    }

    const baseProb = baselineSnapshot?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;
    const scenProb = scenarioSnapshot?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;
    let probabilityDeltaPoints: number | null = null;
    if (baseProb !== null && scenProb !== null) {
      probabilityDeltaPoints = Math.round((scenProb - baseProb) * 100);
    }

    const baseReq = baseRet?.requiredMonthlyContributionForEstimatedFire ?? null;
    const scenReq = scenRet?.requiredMonthlyContributionForEstimatedFire ?? null;
    let requiredContributionDelta: number | null = null;
    if (baseReq !== null && scenReq !== null) {
      requiredContributionDelta = Math.round(scenReq - baseReq);
    }

    return {
      projectedCorpusDelta,
      projectedCorpusDeltaPct,
      fireAgeDeltaYears,
      probabilityDeltaPoints,
      requiredContributionDelta,
    };
  }, [baselineSnapshot, scenarioSnapshot]);

  return {
    baselineSnapshot,
    scenarioSnapshot,
    loadingBaseline,
    evaluating,
    error,
    currentAge,
    monthlyContribution,
    setMonthlyContribution,
    retirementAge,
    setRetirementAge,
    expectedReturnRate,
    setExpectedReturnRate,
    expectedInflationRate,
    setExpectedInflationRate,
    annualContributionGrowthRate,
    setAnnualContributionGrowthRate,
    contributionMode,
    setContributionMode,
    runScenario,
    applyPreset,
    resetToBaseline,
    deltas,
  };
}
