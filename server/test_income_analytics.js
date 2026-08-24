/**
 * server/test_income_analytics.js
 * 
 * Pure unit test suite for FINAURA irregular-income analytics module.
 * Completely isolated, no MongoDB connections, no network calls.
 */

import assert from 'assert';
import {
  normalizeIncomeEvents,
  aggregateMonthlyIncome,
  calculateMeanMonthlyIncome,
  calculateMedianMonthlyIncome,
  calculateStdDevMonthlyIncome,
  calculateCVMonthlyIncome,
  calculatePercentile,
  calculateReliableMonthlyIncome,
  calculateWorstRollingQuarter,
  calculateIncomeGaps,
  analyzeZeroIncomeMonths,
  calculateBaselineDeviation,
  calculateEssentialCoverage,
  calculateBufferRunway,
  evaluateDataQuality,
  analyzeIncomeResilience,
  DATA_QUALITY_LEVEL
} from './utils/incomeAnalytics.js';

function assertCloseRate(actual, expected, message = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff < 1e-6,
    `${message || 'Rate mismatch'}: expected ${expected}, got ${actual} (diff: ${diff})`
  );
}

function assertCloseMoney(actual, expected, message = '') {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  assert.ok(
    diff < 0.05 || relDiff < 1e-4,
    `${message || 'Money mismatch'}: expected ${expected}, got ${actual} (diff: ${diff}, relDiff: ${relDiff})`
  );
}

function runTests() {
  console.log('============================================================');
  console.log('  FINAURA IRREGULAR-INCOME ANALYTICS UNIT TESTS');
  console.log('============================================================\n');

  // -----------------------------------------------------------------
  // 1. MONTHLY AGGREGATION & NORMALIZATION TESTS
  // -----------------------------------------------------------------
  console.log('Running Monthly Aggregation & Normalization Tests...');

  const rawEvents = [
    { amount: 15000, timestamp: '2026-01-10T10:00:00Z', source: 'freelance' },
    { amount: 10000, timestamp: '2026-01-25T10:00:00Z', source: 'gig' },
    { amount: 40000, timestamp: '2026-02-15T10:00:00Z', source: 'salary' },
    { amount: -5000, timestamp: '2026-02-20T10:00:00Z' }, // Invalid negative amount
    { amount: 'invalid', timestamp: '2026-02-21T10:00:00Z' }, // Invalid amount
    { amount: 20000, timestamp: 'invalid-date' }, // Invalid date
    { amount: 20000, timestamp: '2026-04-05T10:00:00Z', source: 'freelance' } // March missing!
  ];

  // T1.1: Normalization filters out bad records
  const normalized = normalizeIncomeEvents(rawEvents);
  assert.strictEqual(normalized.length, 4, 'Only 4 valid events should be retained');
  assert.strictEqual(rawEvents.length, 7, 'Input array must not be mutated');
  console.log('  ✅ Event normalization and input immutability verified');

  // T1.2: Aggregation combines multiple events and fills missing zero-income months
  const monthly = aggregateMonthlyIncome(rawEvents, {
    startDate: '2026-01-01',
    endDate: '2026-04-30'
  });
  assert.strictEqual(monthly.length, 4, 'Must span exactly 4 calendar months (Jan, Feb, Mar, Apr)');
  assert.strictEqual(monthly[0].yearMonth, '2026-01');
  assert.strictEqual(monthly[0].amount, 25000, 'Jan: 15k + 10k = 25k');
  assert.strictEqual(monthly[1].yearMonth, '2026-02');
  assert.strictEqual(monthly[1].amount, 40000, 'Feb: 40k');
  assert.strictEqual(monthly[2].yearMonth, '2026-03');
  assert.strictEqual(monthly[2].amount, 0, 'Mar: Missing month must be ₹0');
  assert.strictEqual(monthly[3].yearMonth, '2026-04');
  assert.strictEqual(monthly[3].amount, 20000, 'Apr: 20k');
  console.log('  ✅ Calendar month aggregation and zero-income filling verified');

  // -----------------------------------------------------------------
  // 2. CENTRAL INCOME STATISTICS (MEAN & MEDIAN)
  // -----------------------------------------------------------------
  console.log('\nRunning Mean and Median Income Tests...');

  // T2.1: Stable income mean
  const stableData = [50000, 50000, 50000, 50000];
  assert.strictEqual(calculateMeanMonthlyIncome(stableData), 50000);
  assert.strictEqual(calculateMedianMonthlyIncome(stableData), 50000);

  // T2.2: Odd count median [20k, 40k, 90k] -> median 40k
  assert.strictEqual(calculateMedianMonthlyIncome([90000, 20000, 40000]), 40000);

  // T2.3: Even count median [20k, 30k, 50k, 80k] -> (30k + 50k)/2 = 40k
  assert.strictEqual(calculateMedianMonthlyIncome([80000, 20000, 50000, 30000]), 40000);

  // T2.4: Spike robustness: [30k, 30k, 30k, 300k] -> mean = 97.5k, median = 30k
  const spikeData = [30000, 30000, 30000, 300000];
  assert.strictEqual(calculateMeanMonthlyIncome(spikeData), 97500);
  assert.strictEqual(calculateMedianMonthlyIncome(spikeData), 30000, 'Median resists extreme bonus spike');
  console.log('  ✅ Mean and spike-resistant Median verified');

  // -----------------------------------------------------------------
  // 3. STANDARD DEVIATION & COEFFICIENT OF VARIATION (CV)
  // -----------------------------------------------------------------
  console.log('\nRunning Standard Deviation and CV Tests...');

  // T3.1: Stable income -> stdDev = 0, CV = 0
  assert.strictEqual(calculateStdDevMonthlyIncome(stableData), 0);
  assert.strictEqual(calculateCVMonthlyIncome(stableData), 0);

  // T3.2: Variable income: [20k, 40k, 60k] -> mean = 40k, pop std dev = sqrt(((20k-40k)^2 + 0 + (20k)^2)/3) = sqrt(800M/3) ≈ 16329.93
  const varData = [20000, 40000, 60000];
  const expectedStdDev = Math.sqrt((400000000 + 0 + 400000000) / 3);
  assertCloseMoney(calculateStdDevMonthlyIncome(varData), expectedStdDev);
  assertCloseRate(calculateCVMonthlyIncome(varData), expectedStdDev / 40000); // ≈ 0.408248

  // T3.3: Zero mean -> CV is null (not Infinity)
  assert.strictEqual(calculateCVMonthlyIncome([0, 0, 0]), null);
  console.log('  ✅ Standard deviation and descriptive CV verified');

  // -----------------------------------------------------------------
  // 4. PERCENTILE & CONSERVATIVE INCOME (LOWER QUARTILE)
  // -----------------------------------------------------------------
  console.log('\nRunning Percentile & Conservative Income Tests...');

  // T4.1: Known 5-element array [10, 20, 30, 40, 50], 25th percentile
  // index = 4 * 0.25 = 1.0 -> sorted[1] = 20
  assert.strictEqual(calculatePercentile([10, 50, 20, 40, 30], 0.25), 20);

  // T4.2: Interpolated percentile [10, 20, 30, 40]
  // index = 3 * 0.25 = 0.75 -> 10 + 0.75 * (20 - 10) = 17.5
  assert.strictEqual(calculatePercentile([10, 20, 30, 40], 0.25), 17.5);

  // T4.3: Reliable monthly income helper
  const rel = calculateReliableMonthlyIncome([30000, 45000, 60000, 80000]);
  assert.strictEqual(rel.percentile, 0.25);
  assert.strictEqual(rel.reliableMonthlyIncome, 41250); // 30k + 0.75*(45k-30k) = 41.25k
  console.log('  ✅ 25th percentile conservative income floor verified');

  // -----------------------------------------------------------------
  // 5. WORST ROLLING QUARTER (MINIMUM 3-MONTH AVERAGE)
  // -----------------------------------------------------------------
  console.log('\nRunning Worst Rolling Quarter Tests...');

  // T5.1: 5 months: [40k, 70k, 20k, 60k, 30k]
  // Rolling averages: (40+70+20)/3 = 43.33k, (70+20+60)/3 = 50k, (20+60+30)/3 = 36.67k
  const rollData = [
    { yearMonth: '2026-01', amount: 40000 },
    { yearMonth: '2026-02', amount: 70000 },
    { yearMonth: '2026-03', amount: 20000 },
    { yearMonth: '2026-04', amount: 60000 },
    { yearMonth: '2026-05', amount: 30000 }
  ];
  const wq = calculateWorstRollingQuarter(rollData);
  assert.strictEqual(wq.available, true);
  assertCloseMoney(wq.amount, 110000 / 3);
  assert.strictEqual(wq.startMonth, '2026-03');
  assert.strictEqual(wq.endMonth, '2026-05');

  // T5.2: Fewer than 3 months -> insufficient data
  const shortRoll = calculateWorstRollingQuarter([40000, 50000]);
  assert.strictEqual(shortRoll.available, false);
  assert.strictEqual(shortRoll.amount, null);
  console.log('  ✅ Worst rolling quarter calculation verified');

  // -----------------------------------------------------------------
  // 6. PAYMENT TIMING GAP ANALYSIS
  // -----------------------------------------------------------------
  console.log('\nRunning Payment Timing Gap Analysis Tests...');

  const gapEvents = [
    { amount: 10000, timestamp: '2026-01-01T00:00:00Z' },
    { amount: 10000, timestamp: '2026-01-11T00:00:00Z' }, // 10 days
    { amount: 10000, timestamp: '2026-01-11T12:00:00Z' }, // 0.5 days (same day multiple events)
    { amount: 10000, timestamp: '2026-02-01T00:00:00Z' }  // 20.5 days
  ];
  const gaps = calculateIncomeGaps(gapEvents);
  assert.strictEqual(gaps.numberOfIncomeEvents, 4);
  assert.strictEqual(gaps.longestGapDays, 20.5);
  assert.strictEqual(gaps.medianGapDays, 10);
  assertCloseRate(gaps.averageGapDays, (10 + 0.5 + 20.5) / 3); // 10.33333... days

  // T6.2: Single event handles cleanly
  const singleGap = calculateIncomeGaps([{ amount: 10000, timestamp: '2026-01-01' }]);
  assert.strictEqual(singleGap.numberOfIncomeEvents, 1);
  assert.strictEqual(singleGap.averageGapDays, null);
  assert.strictEqual(singleGap.longestGapDays, 0);
  console.log('  ✅ Payment event gap timing analysis verified');

  // -----------------------------------------------------------------
  // 7. ZERO-INCOME MONTH ANALYSIS
  // -----------------------------------------------------------------
  console.log('\nRunning Zero-Income Months Analysis Tests...');

  // [50k, 0, 0, 70k, 0, 80k] (6 months, 3 zeros, longest run = 2)
  const zeroRunData = [50000, 0, 0, 70000, 0, 80000];
  const zeroStats = analyzeZeroIncomeMonths(zeroRunData);
  assert.strictEqual(zeroStats.totalMonths, 6);
  assert.strictEqual(zeroStats.numberOfZeroIncomeMonths, 3);
  assert.strictEqual(zeroStats.zeroIncomeMonthRatio, 0.5);
  assert.strictEqual(zeroStats.longestConsecutiveZeroIncomeMonths, 2);

  // No-zero case
  const noZero = analyzeZeroIncomeMonths([10000, 20000]);
  assert.strictEqual(noZero.numberOfZeroIncomeMonths, 0);
  assert.strictEqual(noZero.zeroIncomeMonthRatio, 0);
  assert.strictEqual(noZero.longestConsecutiveZeroIncomeMonths, 0);
  console.log('  ✅ Zero-income month runs and ratios verified');

  // -----------------------------------------------------------------
  // 8. PERSONAL BASELINE DEVIATION
  // -----------------------------------------------------------------
  console.log('\nRunning Personal Baseline Deviation Tests...');

  const baseline = [50000, 60000, 70000]; // mean = 60k, median = 60k, pop stdDev = 8164.9658
  // Current month = 30k (50% of median)
  const devHalf = calculateBaselineDeviation({
    currentMonthIncome: 30000,
    baselineMonthlyIncomes: baseline
  });
  assert.strictEqual(devHalf.currentVsMedianRatio, 0.5);
  assert.strictEqual(devHalf.currentVsMeanRatio, 0.5);
  assert.ok(devHalf.zScore < 0);

  // Current month equal to baseline
  const devSame = calculateBaselineDeviation({
    currentMonthIncome: 60000,
    baselineMonthlyIncomes: baseline
  });
  assert.strictEqual(devSame.currentVsMedianRatio, 1.0);
  assert.strictEqual(devSame.zScore, 0);

  // Zero standard deviation baseline [50k, 50k, 50k]
  const devZeroStd = calculateBaselineDeviation({
    currentMonthIncome: 50000,
    baselineMonthlyIncomes: [50000, 50000, 50000]
  });
  assert.strictEqual(devZeroStd.zScore, 0);
  console.log('  ✅ Personal baseline deviation and z-score verified');

  // -----------------------------------------------------------------
  // 9. RESILIENCE METRICS (ESSENTIAL COVERAGE & RUNWAY)
  // -----------------------------------------------------------------
  console.log('\nRunning Essential Coverage & Buffer Runway Tests...');

  // Reliable income 40k, essentials 30k -> coverage 1.3333 (adequate)
  const covAdequate = calculateEssentialCoverage({
    reliableMonthlyIncome: 40000,
    essentialMonthlySpend: 30000
  });
  assertCloseRate(covAdequate.essentialCoverageRatio, 4 / 3);
  assert.strictEqual(covAdequate.isCoverageAdequate, true);

  // Reliable income 20k, essentials 30k -> coverage 0.6667 (inadequate)
  const covInadequate = calculateEssentialCoverage({
    reliableMonthlyIncome: 20000,
    essentialMonthlySpend: 30000
  });
  assertCloseRate(covInadequate.essentialCoverageRatio, 2 / 3);
  assert.strictEqual(covInadequate.isCoverageAdequate, false);

  // Zero essential spend edge case
  const covZero = calculateEssentialCoverage({
    reliableMonthlyIncome: 20000,
    essentialMonthlySpend: 0
  });
  assert.strictEqual(covZero.essentialCoverageRatio, null);
  assert.strictEqual(covZero.noEssentialSpend, true);

  // Buffer runway: 120k liquid, 30k essentials -> 4 months
  const runway = calculateBufferRunway({
    liquidBuffer: 120000,
    essentialMonthlySpend: 30000
  });
  assert.strictEqual(runway.bufferRunwayMonths, 4);

  // Buffer runway zero essential spend
  const runwayZero = calculateBufferRunway({
    liquidBuffer: 120000,
    essentialMonthlySpend: 0
  });
  assert.strictEqual(runwayZero.bufferRunwayMonths, null);
  assert.strictEqual(runwayZero.noEssentialSpend, true);
  console.log('  ✅ Essential coverage and buffer runway verified');

  // -----------------------------------------------------------------
  // 10. DATA QUALITY & SUFFICIENCY LABELS
  // -----------------------------------------------------------------
  console.log('\nRunning Data Quality & Sufficiency Tests...');

  assert.strictEqual(evaluateDataQuality(0).dataQualityLevel, DATA_QUALITY_LEVEL.INSUFFICIENT);
  assert.strictEqual(evaluateDataQuality(2).dataQualityLevel, DATA_QUALITY_LEVEL.VERY_LOW);
  assert.strictEqual(evaluateDataQuality(4).dataQualityLevel, DATA_QUALITY_LEVEL.LOW);
  assert.strictEqual(evaluateDataQuality(8).dataQualityLevel, DATA_QUALITY_LEVEL.MODERATE);
  assert.strictEqual(evaluateDataQuality(14).dataQualityLevel, DATA_QUALITY_LEVEL.HIGH);
  console.log('  ✅ Data quality label thresholds verified');

  // -----------------------------------------------------------------
  // 11. CONTROLLED RESEARCH ARCHETYPES (A, B, C, D)
  // -----------------------------------------------------------------
  console.log('\nRunning Controlled Research Archetypes Tests...');

  // Helper to generate monthly timestamps
  const makeEvents = (amounts) => {
    return amounts.map((amt, idx) => ({
      amount: amt,
      timestamp: new Date(Date.UTC(2025, idx, 15)).toISOString()
    }));
  };

  // ARCHETYPE A: STABLE + GOOD RESILIENCE
  // Steady salaried ₹50,000 every month. Essentials ₹30,000. Buffer ₹120,000.
  const archA = analyzeIncomeResilience({
    incomeEvents: makeEvents([50000, 50000, 50000, 50000, 50000, 50000]),
    essentialMonthlySpend: 30000,
    liquidBuffer: 120000
  });
  assert.strictEqual(archA.variability.coefficientOfVariation, 0, 'Archetype A CV must be 0');
  assertCloseRate(archA.resilience.essentialCoverageRatio, 5 / 3, 'Archetype A coverage > 1');
  assert.strictEqual(archA.resilience.bufferRunwayMonths, 4, 'Archetype A runway = 4 months');
  console.log('  ✅ Archetype A (Stable + Good Resilience) verified');

  // ARCHETYPE B: STABLE + WEAK RESILIENCE
  // Steady salaried ₹30,000 every month. Essentials ₹35,000. Buffer ₹10,000.
  const archB = analyzeIncomeResilience({
    incomeEvents: makeEvents([30000, 30000, 30000, 30000, 30000, 30000]),
    essentialMonthlySpend: 35000,
    liquidBuffer: 10000
  });
  assert.strictEqual(archB.variability.coefficientOfVariation, 0, 'Archetype B CV is 0');
  assertCloseRate(archB.resilience.essentialCoverageRatio, 30 / 35, 'Archetype B coverage < 1');
  assertCloseRate(archB.resilience.bufferRunwayMonths, 10 / 35, 'Archetype B runway < 1 month');
  console.log('  ✅ Archetype B (Stable + Weak Resilience) verified');

  // ARCHETYPE C: IRREGULAR + GOOD RESILIENCE
  // Highly variable gig/freelance [40k, 80k, 30k, 90k, 45k, 75k]. Essentials ₹30,000. Buffer ₹120,000.
  const archC = analyzeIncomeResilience({
    incomeEvents: makeEvents([40000, 80000, 30000, 90000, 45000, 75000]),
    essentialMonthlySpend: 30000,
    liquidBuffer: 120000
  });
  assert.ok(archC.variability.coefficientOfVariation > 0.35, 'Archetype C has HIGH CV (~0.38)');
  // 25th percentile for [30k, 40k, 45k, 75k, 80k, 90k] -> index 5*0.25 = 1.25 -> 40k + 0.25*(45k-40k) = 41.25k
  assert.strictEqual(archC.centralIncome.reliableMonthlyIncome, 41250);
  assert.strictEqual(archC.resilience.isCoverageAdequate, true, 'Archetype C coverage is adequate');
  assertCloseRate(archC.resilience.essentialCoverageRatio, 41250 / 30000); // 1.375
  assert.strictEqual(archC.resilience.bufferRunwayMonths, 4, 'Archetype C runway = 4 months');
  console.log('  ✅ Archetype C (Irregular + Good Resilience: High CV but Adequate Coverage & Runway) verified');

  // ARCHETYPE D: IRREGULAR + WEAK RESILIENCE
  // Highly variable gig/freelance [20k, 60k, 10k, 70k, 15k, 50k]. Essentials ₹40,000. Buffer ₹15,000.
  const archD = analyzeIncomeResilience({
    incomeEvents: makeEvents([20000, 60000, 10000, 70000, 15000, 50000]),
    essentialMonthlySpend: 40000,
    liquidBuffer: 15000
  });
  assert.ok(archD.variability.coefficientOfVariation > 0.5, 'Archetype D has HIGH CV (~0.58)');
  assert.strictEqual(archD.resilience.isCoverageAdequate, false, 'Archetype D coverage is inadequate');
  assert.ok(archD.resilience.essentialCoverageRatio < 1.0);
  assert.ok(archD.resilience.bufferRunwayMonths < 1.0);
  console.log('  ✅ Archetype D (Irregular + Weak Resilience: High CV with Inadequate Coverage & Runway) verified');

  console.log('\n============================================================');
  console.log('  ALL IRREGULAR-INCOME ANALYTICS UNIT TESTS PASSED!');
  console.log('============================================================');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('\n❌ UNIT TEST FAILED:', err);
  process.exit(1);
}
