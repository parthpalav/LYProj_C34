/**
 * server/test_financial_math.js
 * 
 * Comprehensive, isolated unit test suite for FINAURA financial mathematics library.
 * No MongoDB connections, no network calls, fully deterministic.
 */

import assert from 'assert';
import {
  realReturn,
  monthlyRateFromAnnual,
  futureValueLumpSum,
  futureValueRealConstantContributions,
  futureValueNominalFlatContributions,
  futureValueContributions,
  futureValueRealConstant,
  futureValueNominalFlat,
  futureValue,
  requiredRealConstantContribution,
  requiredNominalFlatContribution,
  requiredMonthlyContribution,
  calculateFireCorpus,
  corpusGoalDifference,
  calculateInvestableCorpus,
  projectedCorpusAtRetirement,
  monthsToTarget,
  projectedAge,
  calculateEmergencyFundTarget,
  calculateEmergencyFundCoverage,
  amortizeLiability,
  CONTRIBUTION_MODE
} from './utils/financialMath.js';

// Precision assertion helpers
function assertCloseRate(actual, expected, message = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff < 1e-7,
    `${message || 'Rate mismatch'}: expected ${expected}, got ${actual} (diff: ${diff})`
  );
}

function assertCloseMoney(actual, expected, message = '') {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  // Allow within 1 paisa (0.01) or 0.001% relative error for multi-million numbers
  assert.ok(
    diff < 0.01 || relDiff < 1e-5,
    `${message || 'Money mismatch'}: expected ${expected}, got ${actual} (diff: ${diff}, relDiff: ${relDiff})`
  );
}

function runTests() {
  console.log('============================================================');
  console.log('  FINAURA FINANCIAL MATH COMPREHENSIVE TEST SUITE');
  console.log('============================================================\n');

  // -----------------------------------------------------------------
  // 1. REAL RETURN TESTS (FISHER EQUATION)
  // -----------------------------------------------------------------
  console.log('Running Real Return Tests...');
  // T1.1: 8% nominal, 6% inflation gives 0.018867924528301886
  assertCloseRate(realReturn(0.08, 0.06), 0.018867924528301886, 'Fisher 8% nom, 6% inf');
  // T1.2: 11% nominal, 6% inflation gives 0.04716981132075477
  assertCloseRate(realReturn(0.11, 0.06), 0.04716981132075477, 'Fisher 11% nom, 6% inf');
  // T1.3: 7% nominal, 9% inflation gives -0.018348623853211075
  assertCloseRate(realReturn(0.07, 0.09), -0.018348623853211075, 'Fisher 7% nom, 9% inf');
  // T1.4: 0% nominal, 0% inflation gives 0
  assert.strictEqual(realReturn(0, 0), 0);
  // T1.5: Inflation <= -100% (-1.0) is rejected
  assert.throws(() => realReturn(0.08, -1.0), RangeError);
  assert.throws(() => realReturn(0.08, -1.5), RangeError);
  console.log('  ✅ Real Return verified');

  // -----------------------------------------------------------------
  // 2. MONTHLY CONVERSION TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Monthly Rate Conversion Tests...');
  // T2.1: Annual 8% converted and compounded 12 times reconstructs 8%
  const rate8 = monthlyRateFromAnnual(0.08);
  assertCloseRate(Math.pow(1 + rate8, 12) - 1, 0.08);
  // T2.2: 0% annual rate gives 0% monthly
  assert.strictEqual(monthlyRateFromAnnual(0), 0);
  // T2.3: Negative annual rate compounding works (-10%)
  const negRate = monthlyRateFromAnnual(-0.10);
  assertCloseRate(Math.pow(1 + negRate, 12) - 1, -0.10);
  // T2.4: Invalid annual rates <= -100% rejected
  assert.throws(() => monthlyRateFromAnnual(-1.0), RangeError);
  console.log('  ✅ Monthly Conversion verified');

  // -----------------------------------------------------------------
  // 3. LUMP SUM FUTURE VALUE TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Lump-Sum Future Value Tests...');
  // T3.1: Zero months returns principal
  assert.strictEqual(futureValueLumpSum(5000, 0.08, 0), 5000);
  // T3.2: Zero return rate returns principal
  assert.strictEqual(futureValueLumpSum(5000, 0, 120), 5000);
  // T3.3: Positive return rate (100k, 8%, 120 months = 10 years -> 100k * 1.08^10)
  const expectedLumpA = 100000 * Math.pow(1.08, 10);
  assertCloseMoney(futureValueLumpSum(100000, 0.08, 120), expectedLumpA, 'Lump-Sum Case A');
  // T3.4: Case B (800k, 4.71698113%, 204 months = 17 years -> 800k * 1.0471698113^17)
  const expectedLumpB = 800000 * Math.pow(1 + 0.0471698113, 17);
  assertCloseMoney(futureValueLumpSum(800000, 0.0471698113, 204), expectedLumpB, 'Lump-Sum Case B');
  // T3.5: Negative return rate (1000, -5%, 12 months -> 950)
  assertCloseMoney(futureValueLumpSum(1000, -0.05, 12), 950, 'Lump-Sum Negative');
  console.log('  ✅ Lump-Sum FV verified');

  // -----------------------------------------------------------------
  // 4. REAL_CONSTANT VS NOMINAL_FLAT CONTRIBUTION TESTS (MANDATORY TESTS A-J)
  // -----------------------------------------------------------------
  console.log('\nRunning Contribution Mode Tests (Real-Constant vs Nominal-Flat)...');

  // Test A — Same Inputs, Different Meaning:
  // monthlyContribution = 20,000, nominal return = 8%, inflation = 6%, months = 180
  const rRealA = realReturn(0.08, 0.06); // ~1.88679%
  const fvRealConstA = futureValueRealConstantContributions({
    monthlyContribution: 20000,
    realAnnualReturn: rRealA,
    months: 180
  });
  const fvNomFlatA = futureValueNominalFlatContributions({
    monthlyContribution: 20000,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.06,
    months: 180
  });

  // REAL_CONSTANT real FV must be strictly greater than NOMINAL_FLAT real FV
  assert.ok(
    fvRealConstA > fvNomFlatA,
    `REAL_CONSTANT FV (${fvRealConstA}) must exceed NOMINAL_FLAT FV (${fvNomFlatA})`
  );
  console.log(`  ✅ Test A: Real-Constant FV (₹${fvRealConstA.toFixed(2)}) > Nominal-Flat FV (₹${fvNomFlatA.toFixed(2)})`);

  // Test B — Zero Inflation Equivalence:
  // With inflation = 0 and nominal = real, REAL_CONSTANT === NOMINAL_FLAT
  const fvRealConstZeroInf = futureValueRealConstantContributions({
    monthlyContribution: 25000,
    realAnnualReturn: 0.08,
    months: 120
  });
  const fvNomFlatZeroInf = futureValueNominalFlatContributions({
    monthlyContribution: 25000,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.0,
    months: 120
  });
  assertCloseMoney(fvRealConstZeroInf, fvNomFlatZeroInf, 'Test B: Zero-inflation equivalence');
  console.log('  ✅ Test B: Zero-inflation equivalence verified');

  // Test C — Nominal Flat Independent Calculation:
  // 20,000/mo, 8% nominal, 6% inflation, 15 years (180 months)
  // Independent FV_nominal = 20000 * ((1 + r_m_nom)^180 - 1) / r_m_nom
  // where r_m_nom = 1.08^(1/12) - 1
  const rMNom = Math.pow(1.08, 1 / 12) - 1;
  const fvNominalIndep = 20000 * (Math.pow(1.08, 15) - 1) / rMNom;
  const fvRealFromNomIndep = fvNominalIndep / Math.pow(1.06, 15);
  assertCloseMoney(fvNomFlatA, fvRealFromNomIndep, 'Test C: Nominal Flat independent verification');
  console.log(`  ✅ Test C: Nominal Flat matches independent derivation (₹${fvRealFromNomIndep.toFixed(2)})`);

  // Test D — Real Constant Independent Calculation:
  // Independent FV_real = 20000 * ((1 + r_m_real)^180 - 1) / r_m_real
  // where r_m_real = (1.08/1.06)^(1/12) - 1
  const rMReal = Math.pow(1.08 / 1.06, 1 / 12) - 1;
  const fvRealConstIndep = 20000 * (Math.pow(1.08 / 1.06, 15) - 1) / rMReal;
  assertCloseMoney(fvRealConstA, fvRealConstIndep, 'Test D: Real Constant independent verification');
  console.log(`  ✅ Test D: Real Constant matches independent derivation (₹${fvRealConstIndep.toFixed(2)})`);

  // Test E — Required Contribution Difference:
  // For the SAME real target (₹5,000,000) over 180 months at nominal 8% and inflation 6%:
  // required REAL_CONSTANT contribution must be LOWER than initial fixed NOMINAL_FLAT contribution
  const reqRealConst = requiredRealConstantContribution({
    currentPrincipal: 500000,
    targetFutureValueReal: 5000000,
    realAnnualReturn: rRealA,
    months: 180
  });
  const reqNomFlat = requiredNominalFlatContribution({
    currentPrincipal: 500000,
    targetFutureValueReal: 5000000,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.06,
    months: 180
  });
  assert.ok(
    reqRealConst < reqNomFlat,
    `Required Real-Constant PMT (₹${reqRealConst}) must be lower than required Nominal-Flat PMT (₹${reqNomFlat})`
  );
  console.log(`  ✅ Test E: Required Real-Constant PMT (₹${reqRealConst.toFixed(2)}) < Nominal-Flat PMT (₹${reqNomFlat.toFixed(2)})`);

  // Test F — Zero Inflation Reverse Solver Equivalence:
  const reqRealZeroInf = requiredRealConstantContribution({
    currentPrincipal: 200000,
    targetFutureValueReal: 2000000,
    realAnnualReturn: 0.08,
    months: 120
  });
  const reqNomZeroInf = requiredNominalFlatContribution({
    currentPrincipal: 200000,
    targetFutureValueReal: 2000000,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.0,
    months: 120
  });
  assertCloseMoney(reqRealZeroInf, reqNomZeroInf, 'Test F: Zero-inflation reverse solver equivalence');
  console.log('  ✅ Test F: Zero-inflation reverse solver equivalence verified');

  // Test G — Current Principal Consistency:
  // Principal grown at real return equals principal grown at nominal return deflated by inflation
  const principalTest = 1000000;
  const pReal = futureValueLumpSum(principalTest, rRealA, 180);
  const pNomDeflated = futureValueLumpSum(principalTest, 0.08, 180) / Math.pow(1.06, 15);
  assertCloseMoney(pReal, pNomDeflated, 'Test G: Principal real/nominal growth consistency');
  console.log('  ✅ Test G: Principal growth consistency verified');

  // Test H — Target Already Achieved:
  assert.strictEqual(
    requiredRealConstantContribution({
      currentPrincipal: 5000000,
      targetFutureValueReal: 4000000,
      realAnnualReturn: 0.08,
      months: 60
    }),
    0,
    'Real-constant returns 0 when target already met'
  );
  assert.strictEqual(
    requiredNominalFlatContribution({
      currentPrincipal: 5000000,
      targetFutureValueReal: 4000000,
      nominalAnnualReturn: 0.08,
      inflationRate: 0.06,
      months: 60
    }),
    0,
    'Nominal-flat returns 0 when target already met'
  );
  console.log('  ✅ Test H: Target already achieved returns 0 in both modes');

  // Test I — Negative Real Return:
  // e.g. nominal 5%, inflation 8% -> real return = (1.05/1.08) - 1 ≈ -0.0277778
  const negRealRate = realReturn(0.05, 0.08);
  const fvNegReal = futureValueRealConstantContributions({
    monthlyContribution: 10000,
    realAnnualReturn: negRealRate,
    months: 60
  });
  assert.ok(fvNegReal > 0 && fvNegReal < 10000 * 60, 'Negative real return results in real loss');
  console.log(`  ✅ Test I: Negative real return evaluated correctly (₹${fvNegReal.toFixed(2)} vs ₹600,000 principal saved)`);

  // Test J — Nominal Return Below Inflation (Nominal-Flat mode):
  const fvNomBelowInf = futureValueNominalFlatContributions({
    monthlyContribution: 10000,
    nominalAnnualReturn: 0.05,
    inflationRate: 0.08,
    months: 60
  });
  assert.ok(fvNomBelowInf > 0 && fvNomBelowInf < 10000 * 60, 'Nominal flat below inflation purchasing power shrinks');
  console.log(`  ✅ Test J: Nominal return below inflation evaluated correctly (₹${fvNomBelowInf.toFixed(2)})`);

  // -----------------------------------------------------------------
  // 5. ANNUITY DUE (BEGINNING-OF-MONTH) TIMING TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Annuity Due Timing Tests...');
  const fvOrdinary12 = futureValueRealConstantContributions({
    monthlyContribution: 1000,
    realAnnualReturn: 0.08,
    months: 12,
    isBeginningOfMonth: false
  });
  const fvDue12 = futureValueRealConstantContributions({
    monthlyContribution: 1000,
    realAnnualReturn: 0.08,
    months: 12,
    isBeginningOfMonth: true
  });
  const rM8 = monthlyRateFromAnnual(0.08);
  assertCloseMoney(fvDue12, fvOrdinary12 * (1 + rM8), 'Annuity due must equal ordinary * (1 + r_m)');
  console.log('  ✅ Annuity Due (Beginning-of-Month) timing verified');

  // -----------------------------------------------------------------
  // 6. FIRE CORPUS SEMANTICS TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning FIRE Corpus Calculation Tests...');
  // T6.1: Lifestyle spending of 480,000, lifestyle ratio 0.8, SWR 4% -> 9.6M
  const fire1 = calculateFireCorpus({
    currentAnnualLifestyleSpending: 480000,
    lifestyleAdjustmentRatio: 0.8,
    safeWithdrawalRate: 0.04
  });
  assert.strictEqual(fire1.retirementAnnualSpending, 384000);
  assert.strictEqual(fire1.fireCorpus, 9600000);

  // T6.2: Backwards-compatible alias currentAnnualEssentialSpending
  const fireLegacy = calculateFireCorpus({
    currentAnnualEssentialSpending: 480000,
    lifestyleAdjustmentRatio: 0.8,
    safeWithdrawalRate: 0.04
  });
  assert.strictEqual(fireLegacy.fireCorpus, 9600000);
  console.log('  ✅ FIRE Corpus semantics and calculations verified');

  // -----------------------------------------------------------------
  // 7. CORPUS SEPARATION & ASSET AGGREGATION TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Assets Aggregation & Goal Separation Tests...');
  const diff = corpusGoalDifference(12000000, 9600000);
  assert.strictEqual(diff.difference, 2400000);
  assert.strictEqual(diff.percentageDifference, 25);

  const assets = [
    { name: 'Mutual Fund', assetClass: 'FIRE_INVESTABLE', currentValue: 50000, includedInFireCorpus: true },
    { name: 'Crypto', assetClass: 'FIRE_INVESTABLE', currentValue: 10000, includedInFireCorpus: false },
    { name: 'EPF', assetClass: 'SEMI_LIQUID', currentValue: 30000, includedInFireCorpus: true },
    { name: 'Car', assetClass: 'NON_INVESTABLE', currentValue: 25000, includedInFireCorpus: true }
  ];
  const agg = calculateInvestableCorpus(assets);
  assert.strictEqual(agg.includedTotal, 80000); // 50k + 30k
  assert.strictEqual(agg.excludedTotal, 35000); // 10k + 25k
  assert.strictEqual(assets.length, 4, 'Input array must not be mutated');
  console.log('  ✅ Asset Aggregation and Goal separation verified');

  // -----------------------------------------------------------------
  // 8. MONTHS TO TARGET TESTS (REAL & NOMINAL MODES)
  // -----------------------------------------------------------------
  console.log('\nRunning Months to Target Tests...');
  // T8.1: Target already reached -> 0 months
  const reached0 = monthsToTarget({
    currentPrincipal: 100000,
    monthlyContribution: 1000,
    realAnnualReturn: 0.08,
    targetFutureValue: 80000
  });
  assert.strictEqual(reached0.reached, true);
  assert.strictEqual(reached0.months, 0);

  // T8.2: REAL_CONSTANT mode target reached
  const mttReal = monthsToTarget({
    currentPrincipal: 10000,
    monthlyContribution: 2000,
    mode: CONTRIBUTION_MODE.REAL_CONSTANT,
    realAnnualReturn: 0.08,
    targetFutureValue: 25000,
    maxMonths: 24
  });
  assert.strictEqual(mttReal.reached, true);
  assert.strictEqual(mttReal.months, 8);

  // T8.3: NOMINAL_FLAT mode target reached
  const mttNom = monthsToTarget({
    currentPrincipal: 10000,
    monthlyContribution: 2000,
    mode: CONTRIBUTION_MODE.NOMINAL_FLAT,
    nominalAnnualReturn: 0.08,
    inflationRate: 0.06,
    targetFutureValue: 25000,
    maxMonths: 24
  });
  assert.strictEqual(mttNom.reached, true);
  assert.strictEqual(mttNom.months, 8);
  console.log('  ✅ Months to Target search in both modes verified');

  // -----------------------------------------------------------------
  // 9. EMERGENCY FUND TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Emergency Fund Tests...');
  const efTarget = calculateEmergencyFundTarget({
    monthlyEssentialSpending: 40000,
    targetMonths: 6
  });
  assert.strictEqual(efTarget.targetAmount, 240000);

  const efCov = calculateEmergencyFundCoverage({
    emergencyLiquidAssets: 120000,
    monthlyEssentialSpending: 40000
  });
  assert.strictEqual(efCov.coverageMonths, 3);

  const efZero = calculateEmergencyFundCoverage({
    emergencyLiquidAssets: 120000,
    monthlyEssentialSpending: 0
  });
  assert.strictEqual(efZero.coverageMonths, null);
  assert.strictEqual(efZero.noEssentialSpending, true);
  console.log('  ✅ Emergency Fund targets and coverage verified');

  // -----------------------------------------------------------------
  // 10. LIABILITY AMORTIZATION TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Liability Amortization Tests...');
  const amort = amortizeLiability({
    outstandingPrincipal: 12000,
    annualInterestRate: 0.12,
    monthlyPayment: 1100
  });
  assert.strictEqual(amort.paidOff, true);
  assert.strictEqual(amort.monthsUsed, 12);
  assertCloseMoney(amort.totalInterest, 771.15);
  assertCloseMoney(amort.totalPaid, 12771.15);
  assert.strictEqual(amort.schedule[11].closingPrincipal, 0);

  // Negative amortization error check
  assert.throws(
    () => amortizeLiability({ outstandingPrincipal: 10000, annualInterestRate: 0.12, monthlyPayment: 90 }),
    RangeError
  );
  console.log('  ✅ Liability Amortization schedule engine verified');

  // -----------------------------------------------------------------
  // 11. INVALID INPUTS TESTS
  // -----------------------------------------------------------------
  console.log('\nRunning Invalid Inputs Validation Tests...');
  assert.throws(() => realReturn(NaN, 0.05), TypeError);
  assert.throws(() => futureValueLumpSum(-100, 0.08, 12), TypeError);
  assert.throws(() => futureValueRealConstantContributions({ monthlyContribution: -10, realAnnualReturn: 0.08, months: 12 }), TypeError);
  assert.throws(() => requiredNominalFlatContribution({ currentPrincipal: 100, targetFutureValueReal: 1000, nominalAnnualReturn: NaN, inflationRate: 0.06, months: 12 }), TypeError);
  console.log('  ✅ Invalid input type & bounds checks verified');

  console.log('\n============================================================');
  console.log('  ALL FINANCIAL MATH TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('\n❌ UNIT TEST FAILED:', err);
  process.exit(1);
}
