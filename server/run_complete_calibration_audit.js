/**
 * server/run_complete_calibration_audit.js
 * 
 * Master execution script for FINAURA Predictability Engine V2 & Monte Carlo V1 Audit.
 * Executes all 20 personas, comparative invariant suites, sensitivity sweeps,
 * reconciliation checks, and performance benchmarks.
 */

import { performance } from 'node:perf_hooks';
import { CANONICAL_PERSONAS, runFullPersonaAudit } from './test_predictability_personas.js';
import { buildPredictabilitySnapshot, buildPredictabilitySnapshotAsync } from './services/PredictabilityService.js';
import { derivePortfolioVolatility, deriveMonteCarloSeed, buildMonteCarloPayload, callMonteCarloSimulation } from './utils/monteCarloAdapter.js';
import { projectedCorpusAtRetirement, requiredNominalFlatContribution, calculateFireCorpus, realReturn } from './utils/financialMath.js';
import { DEFAULT_RETURN_RATE, DEFAULT_INFLATION_RATE, DEFAULT_WITHDRAWAL_RATE, DEFAULT_LIFESTYLE_RATIO } from './config/financialRules.js';

function formatINR(val, compact = false) {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (compact) {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatPct(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'N/A';
  return `${(val * 100).toFixed(1)}%`;
}

function formatAge(point) {
  if (!point || !point.reached || point.ageYears === null) return 'Unreached';
  const whole = Math.floor(point.ageYears);
  const m = Math.round((point.ageYears - whole) * 12);
  if (m === 0 || m === 12) return `Age ${m === 12 ? whole + 1 : whole}`;
  return `Age ${whole}y ${m}m`;
}

// ---------------------------------------------------------------------------
// 1. EXECUTE AND FORMAT 20 CANONICAL PERSONAS
// ---------------------------------------------------------------------------
async function auditPersonas() {
  console.log('=== AUDITING 20 CANONICAL PERSONAS ===');
  const personaRuns = await runFullPersonaAudit();
  
  const formattedResults = [];

  for (const run of personaRuns) {
    const s = run.snapshot;
    const ef = s.probabilistic?.estimatedFire;
    const rec = s.probabilistic?.contributionRecommendation;
    const ug = s.probabilistic?.userGoal;
    const ret = s.retirement;

    formattedResults.push({
      id: run.personaId,
      name: run.name,
      estimatedFire: ret ? ret.estimatedFireCorpus : null,
      userGoal: ret ? (ret.userGoalCorpus > 0 ? ret.userGoalCorpus : null) : null,
      deterministicCorpus: ret ? ret.projectedCorpusAtRetirement : null,
      probFunded: ef ? ef.probabilityFundedAtTargetAge : null,
      p10: ef?.corpusPercentiles ? ef.corpusPercentiles.p10 : null,
      p50: ef?.corpusPercentiles ? ef.corpusPercentiles.p50 : null,
      p90: ef?.corpusPercentiles ? ef.corpusPercentiles.p90 : null,
      fundedAge50: ef?.fundedAge50 ? formatAge(ef.fundedAge50) : 'N/A',
      fundedAge75: ef?.fundedAge75 ? formatAge(ef.fundedAge75) : 'N/A',
      currentContrib: ret ? ret.monthlyContributionUsed : null,
      recContrib: rec?.solved ? rec.recommendedMonthlyContribution : (rec ? 'Unsolved' : 'N/A'),
      additionalContrib: rec?.solved ? rec.additionalMonthlyContributionRequired : 'N/A',
      dataQuality: s.forecastStatus.dataQuality,
      warnings: s.forecastStatus.warnings.concat(s.probabilistic?.warnings || []),
      durationMs: run.durationMs
    });
  }

  return { personaRuns, formattedResults };
}

// ---------------------------------------------------------------------------
// 2. COMPARATIVE INVARIANTS TEST SUITE
// ---------------------------------------------------------------------------
async function auditComparativeInvariants() {
  console.log('\n=== AUDITING COMPARATIVE INVARIANTS ===');
  const results = [];

  // Base template for comparative tests
  const baseProfile = {
    user: {
      id: 'inv_user',
      age: 30,
      retirementAge: 60,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.80
    },
    assets: [{ currentValue: 1000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
    liabilities: [],
    transactions: [
      { amount: 35000, type: 'Need', timestamp: new Date('2026-05-10') },
      { amount: 15000, type: 'Want', timestamp: new Date('2026-05-10') },
      { amount: 25000, type: 'Investment', timestamp: new Date('2026-05-10') }
    ]
  };

  // Invariant A: Higher starting corpus -> probability must not decrease
  console.log('Testing Invariant A: Higher Starting Corpus...');
  const profA1 = JSON.parse(JSON.stringify(baseProfile));
  profA1.assets[0].currentValue = 500000;
  const resA1 = await buildPredictabilitySnapshotAsync(profA1);

  const profA2 = JSON.parse(JSON.stringify(baseProfile));
  profA2.assets[0].currentValue = 2000000;
  const resA2 = await buildPredictabilitySnapshotAsync(profA2);

  const passA = resA2.probabilistic.estimatedFire.probabilityFundedAtTargetAge >= resA1.probabilistic.estimatedFire.probabilityFundedAtTargetAge;
  results.push({
    name: 'Invariant A: Starting Corpus Monotonicity (₹5L vs ₹20L)',
    val1: formatPct(resA1.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    val2: formatPct(resA2.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    passed: passA
  });

  // Invariant B: Higher monthly contribution -> probability must not decrease
  console.log('Testing Invariant B: Higher Monthly Contribution...');
  const profB1 = JSON.parse(JSON.stringify(baseProfile));
  profB1.transactions = [
    { amount: 35000, type: 'Need', timestamp: new Date('2026-05-10') },
    { amount: 15000, type: 'Want', timestamp: new Date('2026-05-10') },
    { amount: 10000, type: 'Investment', timestamp: new Date('2026-05-10') }
  ];
  const resB1 = await buildPredictabilitySnapshotAsync(profB1);

  const profB2 = JSON.parse(JSON.stringify(baseProfile));
  profB2.transactions = [
    { amount: 35000, type: 'Need', timestamp: new Date('2026-05-10') },
    { amount: 15000, type: 'Want', timestamp: new Date('2026-05-10') },
    { amount: 50000, type: 'Investment', timestamp: new Date('2026-05-10') }
  ];
  const resB2 = await buildPredictabilitySnapshotAsync(profB2);

  const passB = resB2.probabilistic.estimatedFire.probabilityFundedAtTargetAge >= resB1.probabilistic.estimatedFire.probabilityFundedAtTargetAge;
  results.push({
    name: 'Invariant B: Contribution Monotonicity (₹10k/mo vs ₹50k/mo)',
    val1: formatPct(resB1.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    val2: formatPct(resB2.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    passed: passB
  });

  // Invariant C: Higher FIRE target -> probability must not increase
  console.log('Testing Invariant C: Higher Spending / Higher FIRE Target...');
  const profC1 = JSON.parse(JSON.stringify(baseProfile)); // Spend ₹50k -> Target ₹1.2Cr
  const resC1 = await buildPredictabilitySnapshotAsync(profC1);

  const profC2 = JSON.parse(JSON.stringify(baseProfile)); // Spend ₹1L -> Target ₹2.4Cr
  profC2.transactions = [
    { amount: 70000, type: 'Need', timestamp: new Date('2026-05-10') },
    { amount: 30000, type: 'Want', timestamp: new Date('2026-05-10') },
    { amount: 25000, type: 'Investment', timestamp: new Date('2026-05-10') }
  ];
  const resC2 = await buildPredictabilitySnapshotAsync(profC2);

  const passC = resC2.probabilistic.estimatedFire.probabilityFundedAtTargetAge <= resC1.probabilistic.estimatedFire.probabilityFundedAtTargetAge;
  results.push({
    name: 'Invariant C: FIRE Target Monotonicity (Target ₹1.2Cr vs ₹2.4Cr)',
    val1: formatPct(resC1.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    val2: formatPct(resC2.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    passed: passC
  });

  // Invariant D: Higher spending -> estimated FIRE requirement must not decrease
  const passD = resC2.retirement.estimatedFireCorpus >= resC1.retirement.estimatedFireCorpus;
  results.push({
    name: 'Invariant D: Spending vs Target Monotonicity (₹50k spend vs ₹100k spend)',
    val1: formatINR(resC1.retirement.estimatedFireCorpus),
    val2: formatINR(resC2.retirement.estimatedFireCorpus),
    passed: passD
  });

  // Invariant E: Lower spending -> FIRE outlook should improve
  results.push({
    name: 'Invariant E: Lower Spending Outlook Improvement',
    val1: formatPct(resC1.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    val2: formatPct(resC2.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    passed: resC1.probabilistic.estimatedFire.probabilityFundedAtTargetAge > resC2.probabilistic.estimatedFire.probabilityFundedAtTargetAge
  });

  // Invariant F: Debt ending before retirement vs after -> post-retirement debt must produce greater/equal required corpus
  console.log('Testing Invariant F: Debt Timing and Overhang...');
  const profF1 = JSON.parse(JSON.stringify(baseProfile));
  profF1.liabilities = [{
    id: 'l_early',
    name: 'Early Loan',
    amount: 30000,
    frequency: 'monthly',
    outstandingBalance: 1500000,
    interestRate: 0.09,
    remainingTermMonths: 60 // Ends in 5 yrs (Age 35 < 60)
  }];
  const resF1 = await buildPredictabilitySnapshotAsync(profF1);

  const profF2 = JSON.parse(JSON.stringify(baseProfile));
  profF2.liabilities = [{
    id: 'l_late',
    name: 'Late Loan',
    amount: 30000,
    frequency: 'monthly',
    outstandingBalance: 3500000,
    interestRate: 0.09,
    remainingTermMonths: 480 // 40 years, extends 10 yrs past retirement
  }];
  const resF2 = await buildPredictabilitySnapshotAsync(profF2);

  const passF = resF2.retirement.estimatedFireCorpus > resF1.retirement.estimatedFireCorpus;
  results.push({
    name: 'Invariant F: Debt Overhang at Retirement (Pre-ret vs Post-ret)',
    val1: `Overhang: ${formatINR(resF1.retirement.estimatedFireCorpus - 12000000)}`,
    val2: `Overhang: ${formatINR(resF2.retirement.estimatedFireCorpus - 12000000)}`,
    passed: passF
  });

  // Invariant G: Longer accumulation horizon improves funding under positive real growth
  console.log('Testing Invariant G: Accumulation Horizon (Age 50 vs Age 30)...');
  const profG1 = JSON.parse(JSON.stringify(baseProfile));
  profG1.user.age = 50; // 10-yr horizon to 60
  const resG1 = await buildPredictabilitySnapshotAsync(profG1);

  const profG2 = JSON.parse(JSON.stringify(baseProfile));
  profG2.user.age = 30; // 30-yr horizon to 60
  const resG2 = await buildPredictabilitySnapshotAsync(profG2);

  const passG = resG2.probabilistic.estimatedFire.probabilityFundedAtTargetAge > resG1.probabilistic.estimatedFire.probabilityFundedAtTargetAge;
  results.push({
    name: 'Invariant G: Horizon Length (10 yrs vs 30 yrs)',
    val1: formatPct(resG1.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    val2: formatPct(resG2.probabilistic.estimatedFire.probabilityFundedAtTargetAge),
    passed: passG
  });

  // Invariant H: Personal goal changes MUST NOT alter estimatedFireCorpus
  console.log('Testing Invariant H: Personal Goal Independence...');
  const profH1 = JSON.parse(JSON.stringify(baseProfile));
  profH1.user.retirementCorpusGoal = 5000000;
  const resH1 = await buildPredictabilitySnapshotAsync(profH1);

  const profH2 = JSON.parse(JSON.stringify(baseProfile));
  profH2.user.retirementCorpusGoal = 50000000;
  const resH2 = await buildPredictabilitySnapshotAsync(profH2);

  const passH = resH1.retirement.estimatedFireCorpus === resH2.retirement.estimatedFireCorpus;
  results.push({
    name: 'Invariant H: Estimated FIRE Independence from Personal Goal (₹50L vs ₹5Cr)',
    val1: formatINR(resH1.retirement.estimatedFireCorpus),
    val2: formatINR(resH2.retirement.estimatedFireCorpus),
    passed: passH
  });

  // Invariant I: Personal goal changes MUST alter personal-goal probability appropriately
  const passI = resH1.probabilistic.userGoal.probabilityFundedAtTargetAge > resH2.probabilistic.userGoal.probabilityFundedAtTargetAge;
  results.push({
    name: 'Invariant I: Personal Goal Probability Sensitivity (Goal ₹50L vs ₹5Cr)',
    val1: formatPct(resH1.probabilistic.userGoal.probabilityFundedAtTargetAge),
    val2: formatPct(resH2.probabilistic.userGoal.probabilityFundedAtTargetAge),
    passed: passI
  });

  // Invariant J: Same inputs -> same seed and same probabilistic outputs
  console.log('Testing Invariant J: Deterministic Reproducibility...');
  const resJ1 = await buildPredictabilitySnapshotAsync(baseProfile, { seed: undefined });
  const resJ2 = await buildPredictabilitySnapshotAsync(baseProfile, { seed: undefined });

  const passJ = resJ1.probabilistic.assumptions.seed === resJ2.probabilistic.assumptions.seed &&
    resJ1.probabilistic.estimatedFire.probabilityFundedAtTargetAge === resJ2.probabilistic.estimatedFire.probabilityFundedAtTargetAge &&
    resJ1.probabilistic.estimatedFire.corpusPercentiles.p50 === resJ2.probabilistic.estimatedFire.corpusPercentiles.p50;
  results.push({
    name: 'Invariant J: Deterministic Seed & Output Reproducibility',
    val1: `Seed: ${resJ1.probabilistic.assumptions.seed}, P: ${formatPct(resJ1.probabilistic.estimatedFire.probabilityFundedAtTargetAge)}`,
    val2: `Seed: ${resJ2.probabilistic.assumptions.seed}, P: ${formatPct(resJ2.probabilistic.estimatedFire.probabilityFundedAtTargetAge)}`,
    passed: passJ
  });

  // Invariant K: Financially relevant input change -> seed changes
  console.log('Testing Invariant K: Seed Sensitivity to Financial Inputs...');
  const profK = JSON.parse(JSON.stringify(baseProfile));
  profK.user.expectedReturnRate = 0.09;
  const resK = await buildPredictabilitySnapshotAsync(profK, { seed: undefined });

  const passK = resJ1.probabilistic.assumptions.seed !== resK.probabilistic.assumptions.seed;
  results.push({
    name: 'Invariant K: Seed Sensitivity to Return Rate (8% vs 9%)',
    val1: `Seed 8%: ${resJ1.probabilistic.assumptions.seed}`,
    val2: `Seed 9%: ${resK.probabilistic.assumptions.seed}`,
    passed: passK
  });

  return results;
}

// ---------------------------------------------------------------------------
// 3. DETERMINISTIC VS MONTE CARLO RECONCILIATION
// ---------------------------------------------------------------------------
async function auditReconciliation() {
  console.log('\n=== AUDITING DETERMINISTIC VS MONTE CARLO RECONCILIATION ===');

  const reconciliationData = [];
  const testPersonas = [
    CANONICAL_PERSONAS[0], // P1
    CANONICAL_PERSONAS[1], // P2
    CANONICAL_PERSONAS[3], // P4
    CANONICAL_PERSONAS[7], // P8
    CANONICAL_PERSONAS[8]  // P9
  ];

  for (const p of testPersonas) {
    const snapshotBase = buildPredictabilitySnapshot(p);
    const detCorpus = snapshotBase.retirement?.projectedCorpusAtRetirement;

    // Run Monte Carlo with production volatility
    const prodSnapshot = await buildPredictabilitySnapshotAsync(p, { simulationCount: 10000 });
    const mcP50Prod = prodSnapshot.probabilistic?.estimatedFire?.corpusPercentiles?.p50;

    // Run Monte Carlo with zero volatility
    const resolved = { ...snapshotBase.retirement, fireInvestableCorpus: snapshotBase.assets.fireInvestableCorpus, monthlyContributionUsed: snapshotBase.retirement.monthlyContributionUsed, currentAge: snapshotBase.retirement.currentAge, monthsUntilRetirement: snapshotBase.retirement.monthsUntilRetirement, estimatedFireCorpus: snapshotBase.retirement.estimatedFireCorpus };
    const zeroVolPayload = buildMonteCarloPayload(resolved, { simulationCount: 1000, portfolioVolatility: 0.0 });
    zeroVolPayload.portfolioVolatility = 0.0; // enforce zero vol
    const zeroVolRes = await callMonteCarloSimulation(zeroVolPayload);
    const zeroVolP50 = zeroVolRes.simulation?.corpusPercentiles?.p50;
    const zeroVolCentral = zeroVolRes.simulation?.centralPath?.finalCorpusReal;

    const zeroVolDelta = Math.abs(detCorpus - zeroVolP50);
    const prodVolDelta = Math.abs(detCorpus - mcP50Prod);
    const prodVolPctDiff = (prodVolDelta / detCorpus) * 100;

    reconciliationData.push({
      persona: p.name,
      detCorpus,
      zeroVolP50,
      zeroVolDelta,
      mcP50Prod,
      prodVolDelta,
      prodVolPctDiff: `${prodVolPctDiff.toFixed(2)}%`,
      zeroVolExactParity: zeroVolDelta < 1.0
    });
  }

  return reconciliationData;
}

// ---------------------------------------------------------------------------
// 4. SENSITIVITY ANALYSIS (MULTI-DIMENSIONAL SWEEPS)
// ---------------------------------------------------------------------------
async function auditSensitivity() {
  console.log('\n=== AUDITING SENSITIVITY SWEEPS ===');

  const baseProfile = {
    user: {
      id: 'sens_user',
      age: 30,
      retirementAge: 60,
      expectedReturnRate: 0.08,
      expectedInflationRate: 0.06,
      expectedWithdrawalRate: 0.04,
      lifestyleAdjustmentRatio: 0.80
    },
    assets: [{ currentValue: 1000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
    liabilities: [],
    transactions: [
      { amount: 35000, type: 'Need', timestamp: new Date('2026-05-10') },
      { amount: 15000, type: 'Want', timestamp: new Date('2026-05-10') },
      { amount: 25000, type: 'Investment', timestamp: new Date('2026-05-10') }
    ]
  };

  const sweeps = {};

  // Sweep 1: Expected Return (4%, 6%, 8%, 10%, 12%)
  console.log('Running Return Rate Sweep...');
  const returnRates = [0.04, 0.06, 0.08, 0.10, 0.12];
  sweeps.returnSweep = [];
  for (const r of returnRates) {
    const prof = JSON.parse(JSON.stringify(baseProfile));
    prof.user.expectedReturnRate = r;
    const res = await buildPredictabilitySnapshotAsync(prof, { simulationCount: 10000 });
    const ef = res.probabilistic?.estimatedFire;
    const rec = res.probabilistic?.contributionRecommendation;
    sweeps.returnSweep.push({
      expectedReturn: formatPct(r),
      volatility: formatPct(res.probabilistic?.assumptions?.portfolioVolatility),
      fireTarget: formatINR(res.retirement?.estimatedFireCorpus, true),
      probFunded: formatPct(ef?.probabilityFundedAtTargetAge),
      p50Corpus: formatINR(ef?.corpusPercentiles?.p50, true),
      fundedAge50: formatAge(ef?.fundedAge50),
      fundedAge75: formatAge(ef?.fundedAge75),
      recContrib: rec?.solved ? formatINR(rec.recommendedMonthlyContribution) : 'Unsolved'
    });
  }

  // Sweep 2: Inflation Rate (3%, 4%, 5%, 6%, 7%, 8%)
  console.log('Running Inflation Rate Sweep...');
  const inflationRates = [0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
  sweeps.inflationSweep = [];
  for (const inf of inflationRates) {
    const prof = JSON.parse(JSON.stringify(baseProfile));
    prof.user.expectedInflationRate = inf;
    const res = await buildPredictabilitySnapshotAsync(prof, { simulationCount: 10000 });
    const ef = res.probabilistic?.estimatedFire;
    const rec = res.probabilistic?.contributionRecommendation;
    sweeps.inflationSweep.push({
      expectedInflation: formatPct(inf),
      fireTarget: formatINR(res.retirement?.estimatedFireCorpus, true),
      probFunded: formatPct(ef?.probabilityFundedAtTargetAge),
      p50Corpus: formatINR(ef?.corpusPercentiles?.p50, true),
      fundedAge50: formatAge(ef?.fundedAge50),
      fundedAge75: formatAge(ef?.fundedAge75),
      recContrib: rec?.solved ? formatINR(rec.recommendedMonthlyContribution) : 'Unsolved'
    });
  }

  // Sweep 3: Monthly Contribution (₹0, ₹10k, ₹25k, ₹50k, ₹75k, ₹1L)
  console.log('Running Monthly Contribution Sweep...');
  const contributions = [0, 10000, 25000, 50000, 75000, 100000];
  sweeps.contributionSweep = [];
  for (const c of contributions) {
    const prof = JSON.parse(JSON.stringify(baseProfile));
    prof.transactions = [
      { amount: 35000, type: 'Need', timestamp: new Date('2026-05-10') },
      { amount: 15000, type: 'Want', timestamp: new Date('2026-05-10') },
      { amount: c, type: 'Investment', timestamp: new Date('2026-05-10') }
    ];
    const res = await buildPredictabilitySnapshotAsync(prof, { simulationCount: 10000 });
    const ef = res.probabilistic?.estimatedFire;
    const rec = res.probabilistic?.contributionRecommendation;
    sweeps.contributionSweep.push({
      monthlyContribution: formatINR(c),
      probFunded: formatPct(ef?.probabilityFundedAtTargetAge),
      p50Corpus: formatINR(ef?.corpusPercentiles?.p50, true),
      fundedAge50: formatAge(ef?.fundedAge50),
      fundedAge75: formatAge(ef?.fundedAge75),
      recContrib: rec?.solved ? formatINR(rec.recommendedMonthlyContribution) : 'Unsolved'
    });
  }

  // Sweep 4: Starting Corpus (₹0, ₹5L, ₹10L, ₹25L, ₹50L, ₹1Cr)
  console.log('Running Starting Corpus Sweep...');
  const corpuses = [0, 500000, 1000000, 2500000, 5000000, 10000000];
  sweeps.corpusSweep = [];
  for (const corp of corpuses) {
    const prof = JSON.parse(JSON.stringify(baseProfile));
    prof.assets = corp > 0 ? [{ currentValue: corp, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }] : [];
    const res = await buildPredictabilitySnapshotAsync(prof, { simulationCount: 10000 });
    const ef = res.probabilistic?.estimatedFire;
    const rec = res.probabilistic?.contributionRecommendation;
    sweeps.corpusSweep.push({
      startingCorpus: formatINR(corp),
      probFunded: formatPct(ef?.probabilityFundedAtTargetAge),
      p50Corpus: formatINR(ef?.corpusPercentiles?.p50, true),
      fundedAge50: formatAge(ef?.fundedAge50),
      fundedAge75: formatAge(ef?.fundedAge75),
      recContrib: rec?.solved ? formatINR(rec.recommendedMonthlyContribution) : 'Unsolved'
    });
  }

  // Sweep 5: Retirement Horizon (5, 10, 20, 30, 40 years)
  console.log('Running Horizon Sweep...');
  const horizonsYears = [5, 10, 20, 30, 40];
  sweeps.horizonSweep = [];
  for (const h of horizonsYears) {
    const prof = JSON.parse(JSON.stringify(baseProfile));
    prof.user.age = 60 - h;
    prof.user.retirementAge = 60;
    const res = await buildPredictabilitySnapshotAsync(prof, { simulationCount: 10000 });
    const ef = res.probabilistic?.estimatedFire;
    const rec = res.probabilistic?.contributionRecommendation;
    sweeps.horizonSweep.push({
      horizonYears: `${h} yrs (Age ${60 - h} → 60)`,
      probFunded: formatPct(ef?.probabilityFundedAtTargetAge),
      p50Corpus: formatINR(ef?.corpusPercentiles?.p50, true),
      fundedAge50: formatAge(ef?.fundedAge50),
      fundedAge75: formatAge(ef?.fundedAge75),
      recContrib: rec?.solved ? formatINR(rec.recommendedMonthlyContribution) : 'Unsolved'
    });
  }

  return sweeps;
}

// ---------------------------------------------------------------------------
// 5. VOLATILITY POLICY AUDIT
// ---------------------------------------------------------------------------
function auditVolatilityPolicy() {
  console.log('\n=== AUDITING VOLATILITY POLICY ===');
  const returnGrid = [0.00, 0.02, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.14, 0.15, 0.18, 0.20];
  const volData = [];

  for (const r of returnGrid) {
    const derived = derivePortfolioVolatility(r);
    const rawFormula = -0.04 + 2.0 * r;
    const isClamped = rawFormula < 0.06 || rawFormula > 0.22;
    volData.push({
      expectedReturnRate: formatPct(r),
      rawFormulaValue: formatPct(rawFormula),
      clampedVolatility: formatPct(derived.portfolioVolatility),
      clampedStatus: isClamped ? (rawFormula < 0.06 ? 'CLAMPED_MIN (6%)' : 'CLAMPED_MAX (22%)') : 'LINEAR'
    });
  }

  return volData;
}

// ---------------------------------------------------------------------------
// 6. PERFORMANCE BENCHMARKING (MULTIPLE ITERATIONS)
// ---------------------------------------------------------------------------
async function auditPerformance() {
  console.log('\n=== AUDITING PERFORMANCE (10,000 PATHS) ===');
  const iterations = 10;
  const latencies = [];

  const testProfile = CANONICAL_PERSONAS[0]; // Young starter

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const snapshot = await buildPredictabilitySnapshotAsync(testProfile, { simulationCount: 10000 });
    const ms = performance.now() - t0;
    latencies.push(ms);
  }

  latencies.sort((a, b) => a - b);
  const minMs = latencies[0];
  const maxMs = latencies[latencies.length - 1];
  const medianMs = latencies[Math.floor(latencies.length / 2)];
  const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  return {
    iterations,
    minMs: minMs.toFixed(1),
    medianMs: medianMs.toFixed(1),
    maxMs: maxMs.toFixed(1),
    avgMs: avgMs.toFixed(1),
    allLatencies: latencies.map(l => l.toFixed(1))
  };
}

// ---------------------------------------------------------------------------
// MASTER AUDIT RUNNER
// ---------------------------------------------------------------------------
async function runCompleteAudit() {
  const tStart = performance.now();

  const personas = await auditPersonas();
  const invariants = await auditComparativeInvariants();
  const reconciliation = await auditReconciliation();
  const sensitivity = await auditSensitivity();
  const volatility = auditVolatilityPolicy();
  const performanceStats = await auditPerformance();

  const totalTimeSec = ((performance.now() - tStart) / 1000).toFixed(2);
  console.log(`\n================================================================`);
  console.log(`  COMPLETE AUDIT FINISHED IN ${totalTimeSec} SECONDS`);
  console.log(`================================================================\n`);

  return {
    personas,
    invariants,
    reconciliation,
    sensitivity,
    volatility,
    performanceStats
  };
}

runCompleteAudit().then(auditData => {
  // Output a structured JSON artifact to scratch/ for deep report analysis
  import('node:fs').then(fs => {
    fs.writeFileSync('./server/scratch_audit_results.json', JSON.stringify(auditData, null, 2));
    console.log('Saved raw structured audit results to ./server/scratch_audit_results.json');
  });
}).catch(err => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
