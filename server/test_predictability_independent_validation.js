/**
 * server/test_predictability_independent_validation.js
 * 
 * Independent Numerical Validation Suite for the FINAURA Predictability Engine.
 * 
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * This script DOES NOT rely on production financialMath/PredictabilityService functions
 * to compute its expected values. Expected values are computed using independent, first-principles
 * closed-form equations and discrete monthly simulation loops, then compared against production output.
 */

import assert from 'assert';
import {
  realReturn,
  monthlyRateFromAnnual,
  futureValueLumpSum,
  futureValueRealConstantContributions,
  futureValueNominalFlatContributions,
  futureValueRealConstant,
  futureValueNominalFlat,
  requiredRealConstantContribution,
  requiredNominalFlatContribution,
  calculateFireCorpus,
  corpusGoalDifference,
  calculateInvestableCorpus,
  projectedCorpusAtRetirement,
  monthsToTarget,
  calculateEmergencyFundTarget,
  calculateEmergencyFundCoverage,
  amortizeLiability,
  CONTRIBUTION_MODE
} from './utils/financialMath.js';
import { buildPredictabilitySnapshot } from './services/PredictabilityService.js';

// ============================================================================
// 1. INDEPENDENT REFERENCE IMPLEMENTATION (FROM FIRST PRINCIPLES)
// ============================================================================

const TOLERANCE_CURRENCY = 1.0; // ₹1 absolute tolerance
const TOLERANCE_RATE = 1e-8;    // 1e-8 for interest / return rates

function assertClose(actual, expected, tol = TOLERANCE_CURRENCY, msg = '') {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  assert.ok(
    diff <= tol || relDiff <= 1e-4,
    `${msg} | Expected ${expected}, got ${actual} (diff: ${diff}, relDiff: ${relDiff}, tol: ${tol})`
  );
}

// Fisher equation
function refFisherRealReturn(nom, inf) {
  return (1 + nom) / (1 + inf) - 1;
}

// Effective Monthly Rate
function refEffectiveMonthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

// Lump sum FV
function refFvLumpSum(principal, annualRate, months) {
  if (months === 0 || principal === 0) return principal;
  const rm = refEffectiveMonthlyRate(annualRate);
  return principal * Math.pow(1 + rm, months);
}

// Step-by-step monthly accumulator for REAL_CONSTANT
function refAccumulateRealConstant(P, C, rRealAnnual, months) {
  const rm = refEffectiveMonthlyRate(rRealAnnual);
  let balance = P;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + rm) + C;
  }
  return balance;
}

// Step-by-step monthly accumulator for NOMINAL_FLAT
function refAccumulateNominalFlat(P, C, rNomAnnual, inflAnnual, months) {
  const rNomM = refEffectiveMonthlyRate(rNomAnnual);
  let nominalBalance = P;
  for (let m = 1; m <= months; m++) {
    nominalBalance = nominalBalance * (1 + rNomM) + C;
  }
  const deflator = Math.pow(1 + inflAnnual, months / 12);
  return {
    nominal: nominalBalance,
    real: nominalBalance / deflator
  };
}

// Independent FIRE Corpus calculator
function refFireCorpus(annualSpend, lifestyleRatio, swr) {
  const adjustedSpend = annualSpend * lifestyleRatio;
  return adjustedSpend / swr;
}

// Independent Reverse Contribution Solver (Nominal Flat)
function refRequiredNominalFlatPmt(P, targetReal, rNomAnnual, inflAnnual, months) {
  if (months <= 0) return 0;
  const targetNominal = targetReal * Math.pow(1 + inflAnnual, months / 12);
  const grownPrincipalNominal = refFvLumpSum(P, rNomAnnual, months);
  const shortfallNominal = targetNominal - grownPrincipalNominal;
  if (shortfallNominal <= 0) return 0;

  const rNomM = refEffectiveMonthlyRate(rNomAnnual);
  if (Math.abs(rNomM) < 1e-9) {
    return shortfallNominal / months;
  }
  return (shortfallNominal * rNomM) / (Math.pow(1 + rNomM, months) - 1);
}

// Independent Reverse Contribution Solver (Real Constant)
function refRequiredRealConstantPmt(P, targetReal, rRealAnnual, months) {
  if (months <= 0) return 0;
  const grownPrincipalReal = refFvLumpSum(P, rRealAnnual, months);
  const shortfallReal = targetReal - grownPrincipalReal;
  if (shortfallReal <= 0) return 0;

  const rRealM = refEffectiveMonthlyRate(rRealAnnual);
  if (Math.abs(rRealM) < 1e-9) {
    return shortfallReal / months;
  }
  return (shortfallReal * rRealM) / (Math.pow(1 + rRealM, months) - 1);
}

// ============================================================================
// 2. RUN AUDIT TEST SUITES
// ============================================================================

function runIndependentValidation() {
  console.log('============================================================');
  console.log('  FINAURA INDEPENDENT NUMERICAL VALIDATION SUITE');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION A: REAL RETURN (FISHER RELATION)
  // --------------------------------------------------------------------------
  console.log('--- 1. Validating Fisher Real Return ---');
  const returnCases = [
    { nom: 0.10, inf: 0.05, desc: 'nominal > inflation (10% vs 5%)' },
    { nom: 0.06, inf: 0.06, desc: 'nominal == inflation (6% vs 6%)' },
    { nom: 0.05, inf: 0.08, desc: 'nominal < inflation (5% vs 8%)' },
    { nom: 0.08, inf: 0.00, desc: 'zero inflation (8% vs 0%)' },
    { nom: 0.00, inf: 0.06, desc: 'zero return with inflation (0% vs 6%)' },
    { nom: -0.05, inf: 0.05, desc: 'negative return (-5% vs 5%)' }
  ];

  for (const c of returnCases) {
    const expected = refFisherRealReturn(c.nom, c.inf);
    const actual = realReturn(c.nom, c.inf);
    assertClose(actual, expected, TOLERANCE_RATE, `Fisher check: ${c.desc}`);
    console.log(`  ✅ ${c.desc}: Expected ${(expected * 100).toFixed(4)}%, Got ${(actual * 100).toFixed(4)}%`);
  }

  // --------------------------------------------------------------------------
  // SECTION B: FIRE CORPUS DERIVATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Validating FIRE Corpus Calculations ---');
  const fireCases = [
    { spendMonthly: 50000, ratio: 1.0, swr: 0.04, desc: '₹50k/mo @ 4% SWR (100% lifestyle)' },
    { spendMonthly: 50000, ratio: 1.0, swr: 0.035, desc: '₹50k/mo @ 3.5% SWR' },
    { spendMonthly: 50000, ratio: 1.0, swr: 0.03, desc: '₹50k/mo @ 3% SWR' },
    { spendMonthly: 60000, ratio: 0.8, swr: 0.04, desc: '₹60k/mo with 80% lifestyle adjustment @ 4% SWR' },
    { spendMonthly: 100000, ratio: 0.75, swr: 0.035, desc: '₹100k/mo with 75% lifestyle @ 3.5% SWR' }
  ];

  for (const c of fireCases) {
    const annualSpend = c.spendMonthly * 12;
    const expected = refFireCorpus(annualSpend, c.ratio, c.swr);
    const actualResult = calculateFireCorpus({
      currentAnnualLifestyleSpending: annualSpend,
      lifestyleAdjustmentRatio: c.ratio,
      safeWithdrawalRate: c.swr
    });
    assertClose(actualResult.fireCorpus, expected, 0.01, `FIRE check: ${c.desc}`);
    console.log(`  ✅ ${c.desc}: Expected ₹${expected.toLocaleString('en-IN')}, Got ₹${actualResult.fireCorpus.toLocaleString('en-IN')}`);
  }

  // --------------------------------------------------------------------------
  // SECTION C: FUTURE VALUE (LUMP SUM & CONTRIBUTIONS)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Validating Future Value (Lump Sum & Contributions) ---');
  const fvCases = [
    { P: 1000000, C: 20000, rNom: 0.08, inf: 0.06, months: 300, desc: '₹10L principal + ₹20k SIP for 25 yrs (8% nom, 6% inf)' },
    { P: 0, C: 25000, rNom: 0.10, inf: 0.05, months: 240, desc: 'Zero principal + ₹25k SIP for 20 yrs (10% nom, 5% inf)' },
    { P: 5000000, C: 0, rNom: 0.08, inf: 0.06, months: 120, desc: '₹50L lump sum + ₹0 contribution for 10 yrs' },
    { P: 500000, C: 15000, rNom: 0.06, inf: 0.06, months: 180, desc: 'Zero real return (6% nom == 6% inf)' },
    { P: 800000, C: 10000, rNom: 0.04, inf: 0.07, months: 120, desc: 'Negative real return (4% nom vs 7% inf)' }
  ];

  for (const c of fvCases) {
    // 1. Independent Step-by-Step Simulation Loop
    const refSim = refAccumulateNominalFlat(c.P, c.C, c.rNom, c.inf, c.months);

    // 2. Production Closed-Form Function
    const prodResult = futureValueNominalFlat({
      currentPrincipal: c.P,
      monthlyContribution: c.C,
      nominalAnnualReturn: c.rNom,
      inflationRate: c.inf,
      months: c.months
    });

    assertClose(prodResult.totalFutureValueReal, refSim.real, 0.01, `FV Real check: ${c.desc}`);
    assertClose(prodResult.totalFutureValueNominal, refSim.nominal, 0.01, `FV Nominal check: ${c.desc}`);
    console.log(`  ✅ ${c.desc}`);
    console.log(`     Real FV: Expected ₹${Math.round(refSim.real).toLocaleString('en-IN')}, Got ₹${Math.round(prodResult.totalFutureValueReal).toLocaleString('en-IN')}`);
    console.log(`     Nominal FV: Expected ₹${Math.round(refSim.nominal).toLocaleString('en-IN')}, Got ₹${Math.round(prodResult.totalFutureValueNominal).toLocaleString('en-IN')}`);
  }

  // --------------------------------------------------------------------------
  // SECTION D: REVERSE MONTHLY CONTRIBUTION SOLVER (ROUNDTRIP)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Validating Reverse Contribution Solver & Roundtrip ---');
  const solverCases = [
    { P: 1000000, target: 12000000, rNom: 0.08, inf: 0.06, months: 300, desc: 'Target ₹1.2 Cr in 25 yrs with ₹10L starting corpus' },
    { P: 0, target: 15000000, rNom: 0.10, inf: 0.05, months: 240, desc: 'Target ₹1.5 Cr in 20 yrs starting from ₹0' },
    { P: 5000000, target: 4000000, rNom: 0.08, inf: 0.06, months: 120, desc: 'Already achieved target (P > Target)' },
    { P: 2000000, target: 2000000, rNom: 0.08, inf: 0.06, months: 180, desc: 'Principal alone grows past target without extra SIP' }
  ];

  for (const c of solverCases) {
    const expectedPmt = refRequiredNominalFlatPmt(c.P, c.target, c.rNom, c.inf, c.months);
    const actualPmt = requiredNominalFlatContribution({
      currentPrincipal: c.P,
      targetFutureValueReal: c.target,
      nominalAnnualReturn: c.rNom,
      inflationRate: c.inf,
      months: c.months
    });

    assertClose(actualPmt, expectedPmt, 0.01, `Solver check: ${c.desc}`);

    // Roundtrip verification: plug actualPmt back into simulation and verify it hits the target!
    if (expectedPmt > 0) {
      const simulatedReal = refAccumulateNominalFlat(c.P, actualPmt, c.rNom, c.inf, c.months).real;
      assertClose(simulatedReal, c.target, 0.05, `Roundtrip target verification: ${c.desc}`);
    }

    console.log(`  ✅ ${c.desc}: Required PMT = ₹${Math.round(actualPmt).toLocaleString('en-IN')}/mo (Roundtrip verified)`);
  }

  // --------------------------------------------------------------------------
  // SECTION E: 15 COMPREHENSIVE REFERENCE FINANCIAL PERSONAS
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Validating 15 Reference Financial Personas ---');

  const personas = [
    {
      id: 'P1_YoungSalaried',
      name: '1. Young salaried user with healthy investments',
      user: { age: 25, retirementAge: 55, currentBalance: 50000, retirementCorpusGoal: 20000000, expectedReturnRate: 0.08, expectedInflationRate: 0.06, expectedWithdrawalRate: 0.04, lifestyleAdjustmentRatio: 0.8 },
      incomes: [{ amount: 80000, timestamp: '2026-01-05' }, { amount: 80000, timestamp: '2026-02-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 15000, type: 'Want', timestamp: '2026-01-15' }, { amount: 25000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 200000, includedInFireCorpus: true }, { assetClass: 'SEMI_LIQUID', assetType: 'Cash', currentValue: 150000, liquidity: 'liquid' }],
      liabilities: []
    },
    {
      id: 'P2_ZeroStartingCorpus',
      name: '2. Zero starting corpus starter',
      user: { age: 30, retirementAge: 60, currentBalance: 20000, expectedReturnRate: 0.08, expectedInflationRate: 0.06, expectedWithdrawalRate: 0.04, lifestyleAdjustmentRatio: 0.8 },
      incomes: [{ amount: 120000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 50000, type: 'Need', timestamp: '2026-01-10' }, { amount: 20000, type: 'Want', timestamp: '2026-01-15' }, { amount: 40000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [],
      liabilities: []
    },
    {
      id: 'P3_FireAlreadyAchieved',
      name: '3. FIRE already achieved user',
      user: { age: 45, retirementAge: 60, currentBalance: 200000, expectedReturnRate: 0.08, expectedInflationRate: 0.06, expectedWithdrawalRate: 0.04, lifestyleAdjustmentRatio: 0.8 },
      incomes: [{ amount: 100000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 10000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 25000000, includedInFireCorpus: true }], // 2.5 Cr > 96L FIRE Target
      liabilities: []
    },
    {
      id: 'P4_HighIncomeHighSpend',
      name: '4. High-income / high-spending executive',
      user: { age: 40, retirementAge: 55, currentBalance: 500000, expectedReturnRate: 0.09, expectedInflationRate: 0.06, expectedWithdrawalRate: 0.035, lifestyleAdjustmentRatio: 0.85 },
      incomes: [{ amount: 500000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 150000, type: 'Need', timestamp: '2026-01-10' }, { amount: 100000, type: 'Want', timestamp: '2026-01-15' }, { amount: 150000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 8000000, includedInFireCorpus: true }],
      liabilities: []
    },
    {
      id: 'P5_NegativeMonthlySurplus',
      name: '5. Negative monthly surplus / high burn user',
      user: { age: 32, retirementAge: 60, currentBalance: 10000 },
      incomes: [{ amount: 60000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 50000, type: 'Need', timestamp: '2026-01-10' }, { amount: 25000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'SEMI_LIQUID', assetType: 'Savings', currentValue: 20000, liquidity: 'liquid' }],
      liabilities: []
    },
    {
      id: 'P6_HeavyEmiBurden',
      name: '6. Heavy EMI burden user',
      user: { age: 35, retirementAge: 60, currentBalance: 40000 },
      incomes: [{ amount: 150000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 40000, type: 'Need', timestamp: '2026-01-10' }, { amount: 10000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 500000, includedInFireCorpus: true }],
      liabilities: [{ id: 'l_home', amount: 60000, frequency: 'monthly', outstandingBalance: 4500000, interestRate: 0.085, remainingTermMonths: 180, status: 'active' }]
    },
    {
      id: 'P7_ExpiringEmiIn3Years',
      name: '7. EMI ending in 3 years',
      user: { age: 30, retirementAge: 60, currentBalance: 50000 },
      incomes: [{ amount: 100000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 400000, includedInFireCorpus: true }],
      liabilities: [{ id: 'l_car', amount: 15000, frequency: 'monthly', outstandingBalance: 450000, remainingTermMonths: 36, status: 'active' }]
    },
    {
      id: 'P8_ZeroExpectedReturn',
      name: '8. Zero expected nominal return (0% return, 5% inflation)',
      user: { age: 30, retirementAge: 60, expectedReturnRate: 0.00, expectedInflationRate: 0.05 },
      incomes: [{ amount: 80000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 20000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 500000, includedInFireCorpus: true }]
    },
    {
      id: 'P9_InflationEqualsReturn',
      name: '9. Inflation equals return (6% return == 6% inflation, 0% real return)',
      user: { age: 30, retirementAge: 60, expectedReturnRate: 0.06, expectedInflationRate: 0.06 },
      incomes: [{ amount: 80000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 20000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true }]
    },
    {
      id: 'P10_InflationAboveReturn',
      name: '10. Inflation above return (5% nominal return, 8% inflation)',
      user: { age: 30, retirementAge: 50, expectedReturnRate: 0.05, expectedInflationRate: 0.08 },
      incomes: [{ amount: 80000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 15000, type: 'Investment', timestamp: '2026-01-20' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true }]
    },
    {
      id: 'P11_GoalBelowFireEstimate',
      name: '11. User goal below FIRE estimate',
      user: { age: 30, retirementAge: 60, retirementCorpusGoal: 8000000 }, // Goal 80L vs ~1.2 Cr FIRE
      incomes: [{ amount: 100000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 40000, type: 'Need', timestamp: '2026-01-10' }, { amount: 10000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 500000, includedInFireCorpus: true }]
    },
    {
      id: 'P12_GoalAboveFireEstimate',
      name: '12. User goal above FIRE estimate',
      user: { age: 30, retirementAge: 60, retirementCorpusGoal: 30000000 }, // Goal 3 Cr vs ~96L FIRE
      incomes: [{ amount: 100000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 10000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'FIRE_INVESTABLE', currentValue: 500000, includedInFireCorpus: true }]
    },
    {
      id: 'P13_LargeNonInvestableAssets',
      name: '13. Large non-investable asset base (Primary home + Car)',
      user: { age: 35, retirementAge: 60 },
      incomes: [{ amount: 120000, timestamp: '2026-01-05' }],
      transactions: [{ amount: 40000, type: 'Need', timestamp: '2026-01-10' }],
      assets: [
        { name: 'Primary Residence', assetClass: 'NON_INVESTABLE', currentValue: 20000000, includedInFireCorpus: false },
        { name: 'Car', assetClass: 'NON_INVESTABLE', currentValue: 1500000, includedInFireCorpus: false },
        { name: 'Mutual Funds', assetClass: 'FIRE_INVESTABLE', currentValue: 1000000, includedInFireCorpus: true }
      ]
    },
    {
      id: 'P14_VariableIncomeFreelancer',
      name: '14. Variable-income freelancer (high CV)',
      user: { age: 28, retirementAge: 60 },
      incomes: [
        { amount: 30000, timestamp: '2026-01-10' },
        { amount: 120000, timestamp: '2026-02-15' },
        { amount: 20000, timestamp: '2026-03-20' },
        { amount: 150000, timestamp: '2026-04-12' },
        { amount: 40000, timestamp: '2026-05-18' }
      ],
      transactions: [{ amount: 30000, type: 'Need', timestamp: '2026-01-10' }, { amount: 10000, type: 'Want', timestamp: '2026-01-15' }],
      assets: [{ assetClass: 'SEMI_LIQUID', assetType: 'Cash', currentValue: 300000, liquidity: 'liquid' }]
    },
    {
      id: 'P15_EmptyHistoryNewUser',
      name: '15. Empty history / brand new user',
      user: { id: 'u_empty', age: 24, retirementAge: 60 },
      incomes: [],
      transactions: [],
      assets: [],
      liabilities: []
    }
  ];

  for (const p of personas) {
    const snap = buildPredictabilitySnapshot(p, { referenceDate: new Date('2026-06-01') });

    // Independent checks for each persona:
    assert.ok(snap.forecastStatus.dataQuality, `${p.name}: dataQuality must exist`);
    assert.ok(snap.currentState, `${p.name}: currentState must exist`);
    
    if (snap.forecastStatus.available) {
      assert.ok(snap.retirement, `${p.name}: retirement must exist`);
      assert.ok(snap.scenarios, `${p.name}: scenarios must exist`);
    } else {
      assert.strictEqual(snap.retirement, null, `${p.name}: retirement must be null if unavailable`);
      assert.strictEqual(snap.scenarios, null, `${p.name}: scenarios must be null if unavailable`);
    }
    
    assert.ok(snap.emergencyFund, `${p.name}: emergencyFund must exist`);

    // Verify non-investable assets are strictly excluded from FIRE corpus
    if (p.id === 'P13_LargeNonInvestableAssets') {
      assert.strictEqual(snap.assets.fireInvestableCorpus, 1000000, 'Non-investable real estate must not inflate FIRE corpus');
      assert.strictEqual(snap.assets.totalAssetValue, 22500000, 'Total assets must accurately reflect all property');
    }

    // Verify single-count debt service in heavy EMI persona
    if (p.id === 'P6_HeavyEmiBurden') {
      assert.strictEqual(snap.currentState.needsConsumption, 40000);
      assert.strictEqual(snap.currentState.liabilityService, 60000);
      assert.strictEqual(snap.currentState.totalEssentialSpending, 100000);
    }

    // Verify goal separation
    if (p.id === 'P11_GoalBelowFireEstimate') {
      assert.strictEqual(snap.retirement.userGoalCorpus, 8000000);
      assert.ok(snap.retirement.estimatedFireCorpus > 10000000);
    }

    console.log(`  ✅ Persona ${p.name} verified`);
  }

  // --------------------------------------------------------------------------
  // SECTION F: ADVERSARIAL PROPERTY & INVARIANT TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Running Invariant & Monotonicity Property Tests ---');

  // Invariant 1: Higher starting principal must never increase required contribution
  const reqP1 = requiredNominalFlatContribution({ currentPrincipal: 500000, targetFutureValueReal: 10000000, nominalAnnualReturn: 0.08, inflationRate: 0.06, months: 240 });
  const reqP2 = requiredNominalFlatContribution({ currentPrincipal: 1000000, targetFutureValueReal: 10000000, nominalAnnualReturn: 0.08, inflationRate: 0.06, months: 240 });
  assert.ok(reqP2 < reqP1, 'Invariant 1 Failed: Higher principal must yield strictly lower required monthly contribution');
  console.log('  ✅ Invariant 1 Passed: Monotonicity with respect to starting principal');

  // Invariant 2: Higher contribution must never increase projected FIRE age
  const fireAge1 = monthsToTarget({ currentPrincipal: 500000, monthlyContribution: 10000, mode: CONTRIBUTION_MODE.NOMINAL_FLAT, nominalAnnualReturn: 0.08, inflationRate: 0.06, targetFutureValue: 10000000 }).months;
  const fireAge2 = monthsToTarget({ currentPrincipal: 500000, monthlyContribution: 25000, mode: CONTRIBUTION_MODE.NOMINAL_FLAT, nominalAnnualReturn: 0.08, inflationRate: 0.06, targetFutureValue: 10000000 }).months;
  assert.ok(fireAge2 < fireAge1, 'Invariant 2 Failed: Higher contribution must yield faster target achievement');
  console.log('  ✅ Invariant 2 Passed: Monotonicity with respect to monthly contribution');

  // Invariant 3: Lower Safe Withdrawal Rate must never decrease required FIRE corpus
  const fireCorpusHighSwr = calculateFireCorpus({ currentAnnualLifestyleSpending: 600000, lifestyleAdjustmentRatio: 0.8, safeWithdrawalRate: 0.04 }).fireCorpus;
  const fireCorpusLowSwr = calculateFireCorpus({ currentAnnualLifestyleSpending: 600000, lifestyleAdjustmentRatio: 0.8, safeWithdrawalRate: 0.03 }).fireCorpus;
  assert.ok(fireCorpusLowSwr > fireCorpusHighSwr, 'Invariant 3 Failed: Lower SWR must yield higher required corpus');
  console.log('  ✅ Invariant 3 Passed: Monotonicity with respect to Safe Withdrawal Rate');

  // Invariant 4: Higher inflation with constant nominal return must decrease real return
  const realRetLowInf = realReturn(0.08, 0.05);
  const realRetHighInf = realReturn(0.08, 0.07);
  assert.ok(realRetHighInf < realRetLowInf, 'Invariant 4 Failed: Higher inflation must decrease real return');
  console.log('  ✅ Invariant 4 Passed: Monotonicity of real return with respect to inflation');

  // Invariant 5: Longer horizon must never increase required monthly contribution for same target
  const reqShortHorizon = requiredNominalFlatContribution({ currentPrincipal: 500000, targetFutureValueReal: 10000000, nominalAnnualReturn: 0.08, inflationRate: 0.06, months: 180 });
  const reqLongHorizon = requiredNominalFlatContribution({ currentPrincipal: 500000, targetFutureValueReal: 10000000, nominalAnnualReturn: 0.08, inflationRate: 0.06, months: 300 });
  assert.ok(reqLongHorizon < reqShortHorizon, 'Invariant 5 Failed: Longer horizon must yield lower required monthly contribution');
  console.log('  ✅ Invariant 5 Passed: Monotonicity with respect to time horizon');

  console.log('\n============================================================');
  console.log('  ALL INDEPENDENT VALIDATION TESTS & INVARIANTS PASSED!');
  console.log('============================================================');
}

try {
  runIndependentValidation();
  process.exit(0);
} catch (err) {
  console.error('\n❌ INDEPENDENT VALIDATION FAILED:', err);
  process.exit(1);
}
