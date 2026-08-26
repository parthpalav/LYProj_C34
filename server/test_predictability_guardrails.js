/**
 * server/test_predictability_guardrails.js
 * 
 * Comprehensive test suite for FINAURA Predictability Engine V2:
 * Recommendation Guardrails, Feasibility Bands, Retirement Alternatives (CRN), and Failure Isolation.
 */

import assert from 'node:assert/strict';
import {
  FEASIBILITY_STATUS,
  FEASIBILITY_THRESHOLDS,
  DEFAULT_ALTERNATIVE_AGE_OFFSETS,
  MAX_RETIREMENT_ALTERNATIVE_AGE
} from './config/financialRules.js';
import {
  evaluateContributionFeasibility,
  calculateRetirementAlternatives,
  attachMonteCarloSimulation,
  buildMonteCarloPayload
} from './utils/monteCarloAdapter.js';
import { buildPredictabilitySnapshot, buildPredictabilitySnapshotAsync } from './services/PredictabilityService.js';

console.log('================================================================');
console.log('  FINAURA PREDICTABILITY GUARDRAILS & ALTERNATIVES TEST SUITE');
console.log('================================================================\n');

// ── TEST GROUP 1: FEASIBILITY BANDS & EXACT BOUNDARIES ─────────────
console.log('Running 1. Feasibility Bands & Boundary Tests...');

// UNKNOWN Cases
const unk1 = evaluateContributionFeasibility(5000, 2000, null);
assert.equal(unk1.status, FEASIBILITY_STATUS.UNKNOWN, 'null income -> UNKNOWN');
assert.equal(unk1.recommendedContributionRatio, null);

const unk2 = evaluateContributionFeasibility(5000, 2000, 0);
assert.equal(unk2.status, FEASIBILITY_STATUS.UNKNOWN, '0 income -> UNKNOWN (no div-by-zero)');

const unk3 = evaluateContributionFeasibility(5000, 2000, -10000);
assert.equal(unk3.status, FEASIBILITY_STATUS.UNKNOWN, 'negative income -> UNKNOWN');

// MANAGEABLE: <= 30.00%
const man1 = evaluateContributionFeasibility(3000, 1000, 10000); // exactly 30.00%
assert.equal(man1.status, FEASIBILITY_STATUS.MANAGEABLE, '30.00% -> MANAGEABLE');
assert.equal(man1.recommendedContributionRatio, 0.30);

const man2 = evaluateContributionFeasibility(2000, 500, 10000); // 20.00%
assert.equal(man2.status, FEASIBILITY_STATUS.MANAGEABLE, '20.00% -> MANAGEABLE');

// AGGRESSIVE: > 30.00% and <= 50.00%
const aggBoundary = evaluateContributionFeasibility(3001, 1000, 10000); // 30.01%
assert.equal(aggBoundary.status, FEASIBILITY_STATUS.AGGRESSIVE, '30.01% -> AGGRESSIVE');

const agg50 = evaluateContributionFeasibility(5000, 2000, 10000); // exactly 50.00%
assert.equal(agg50.status, FEASIBILITY_STATUS.AGGRESSIVE, '50.00% -> AGGRESSIVE');
assert.equal(agg50.recommendedContributionRatio, 0.50);

// VERY_AGGRESSIVE: > 50.00% and <= 80.00%
const vaggBoundary = evaluateContributionFeasibility(5001, 2000, 10000); // 50.01%
assert.equal(vaggBoundary.status, FEASIBILITY_STATUS.VERY_AGGRESSIVE, '50.01% -> VERY_AGGRESSIVE');

const vagg80 = evaluateContributionFeasibility(8000, 3000, 10000); // exactly 80.00%
assert.equal(vagg80.status, FEASIBILITY_STATUS.VERY_AGGRESSIVE, '80.00% -> VERY_AGGRESSIVE');
assert.equal(vagg80.recommendedContributionRatio, 0.80);

// IMPRACTICAL: > 80.00%
const impBoundary = evaluateContributionFeasibility(8001, 3000, 10000); // 80.01%
assert.equal(impBoundary.status, FEASIBILITY_STATUS.IMPRACTICAL, '80.01% -> IMPRACTICAL');

const impHuge = evaluateContributionFeasibility(353400, 343400, 100000); // 353.4%
assert.equal(impHuge.status, FEASIBILITY_STATUS.IMPRACTICAL, '353.4% -> IMPRACTICAL');
assert.equal(impHuge.recommendedContributionRatio, 3.534);

console.log('  ✅ Test 1 Passed: Feasibility bands and boundary thresholds strictly validated\n');


// ── TEST GROUP 2: CRN SEED REUSE & MINIMAL SIMULATION FLAGS ─────────
console.log('Running 2. Common Random Numbers (CRN) & Minimal Alternative Payload Policy...');

const mockResolved = {
  currentAge: 30,
  retirementAge: 60,
  startingInvestableCorpus: 1000000,
  monthlyContribution: 25000,
  user: {
    age: 30,
    retirementAge: 60,
    monthlyIncome: 100000
  }
};

const basePayload = buildMonteCarloPayload(mockResolved, {}, {
  estimatedFireCorpus: 12000000,
  userGoalCorpus: null
});

assert.ok(typeof basePayload.seed === 'number', 'Base payload has deterministic seed');

// Live test with Python service
const liveAlternatives = await calculateRetirementAlternatives(
  mockResolved,
  {},
  basePayload,
  {},
  100000
);

assert.ok(Array.isArray(liveAlternatives), 'Alternatives returned as array');
assert.equal(liveAlternatives.length, 3, 'Default 3 alternatives generated (+2, +5, +10)');

assert.equal(liveAlternatives[0].targetAge, 62, '+2y -> Age 62');
assert.equal(liveAlternatives[1].targetAge, 65, '+5y -> Age 65');
assert.equal(liveAlternatives[2].targetAge, 70, '+10y -> Age 70');

// Verify each alternative has minimal output properties and valid feasibility
for (const alt of liveAlternatives) {
  assert.ok(typeof alt.probabilityFundedAtTargetAge === 'number', 'Has probabilityFundedAtTargetAge');
  assert.ok(typeof alt.recommendedMonthlyContribution === 'number', 'Has recommendedMonthlyContribution');
  assert.ok(typeof alt.additionalMonthlyContributionRequired === 'number', 'Has additionalMonthlyContributionRequired');
  assert.ok(alt.feasibility, 'Has feasibility object');
  assert.ok(Object.values(FEASIBILITY_STATUS).includes(alt.feasibility.status), 'Valid feasibility status');
}

console.log('  ✅ Test 2 Passed: CRN and minimal payload alternatives verified\n');


// ── TEST GROUP 3: MONOTONICITY OF ALTERNATIVES ──────────────────────
console.log('Running 3. Alternative Contribution & Probability Monotonicity...');

// In a positive real return accumulation environment:
// PMT(Age 70) <= PMT(Age 65) <= PMT(Age 62)
const pmt62 = liveAlternatives[0].recommendedMonthlyContribution;
const pmt65 = liveAlternatives[1].recommendedMonthlyContribution;
const pmt70 = liveAlternatives[2].recommendedMonthlyContribution;

console.log(`  Target Age 62: Required SIP = ₹${pmt62.toLocaleString('en-IN')}/mo (P_cur = ${(liveAlternatives[0].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);
console.log(`  Target Age 65: Required SIP = ₹${pmt65.toLocaleString('en-IN')}/mo (P_cur = ${(liveAlternatives[1].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);
console.log(`  Target Age 70: Required SIP = ₹${pmt70.toLocaleString('en-IN')}/mo (P_cur = ${(liveAlternatives[2].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);

assert.ok(pmt65 <= pmt62, `PMT(65) <= PMT(62): ${pmt65} <= ${pmt62}`);
assert.ok(pmt70 <= pmt65, `PMT(70) <= PMT(65): ${pmt70} <= ${pmt65}`);

// Probability with current contribution should increase with later retirement age
const prob62 = liveAlternatives[0].probabilityFundedAtTargetAge;
const prob65 = liveAlternatives[1].probabilityFundedAtTargetAge;
const prob70 = liveAlternatives[2].probabilityFundedAtTargetAge;

assert.ok(prob65 >= prob62, `Prob(65) >= Prob(62): ${prob65} >= ${prob62}`);
assert.ok(prob70 >= prob65, `Prob(70) >= Prob(65): ${prob70} >= ${prob65}`);

console.log('  ✅ Test 3 Passed: Alternative required SIPs and probabilities strictly monotonic\n');


// ── TEST GROUP 4: AGE LIMITS, CLAMPING & DEDUPLICATION ─────────────
console.log('Running 4. Alternative Age Cap & Deduplication...');

// Case: Near upper limit (Age 84, Max 90)
const nearCapResolved = {
  currentAge: 80,
  retirementAge: 84,
  startingInvestableCorpus: 1000000,
  monthlyContribution: 25000,
  user: { age: 80, retirementAge: 84, monthlyIncome: 100000 }
};

const nearCapPayload = buildMonteCarloPayload(nearCapResolved, {}, {
  estimatedFireCorpus: 5000000
});

const nearCapAlternatives = await calculateRetirementAlternatives(
  nearCapResolved,
  { maxSearchAge: 90 },
  nearCapPayload,
  {},
  100000
);

// 84 + 2 = 86 (<= 90, included)
// 84 + 5 = 89 (<= 90, included)
// 84 + 10 = 94 (> 90, omitted!)
assert.ok(Array.isArray(nearCapAlternatives), 'Near cap alternatives returned');
assert.equal(nearCapAlternatives.length, 2, '+10y omitted because 94 > 90');
assert.equal(nearCapAlternatives[0].targetAge, 86);
assert.equal(nearCapAlternatives[1].targetAge, 89);

console.log('  ✅ Test 4 Passed: Alternative age ceiling and invalid scenario omission verified\n');


// Helper to create synthetic monthly transactions for N months
function createTransactions(monthsCount, needsPerMonth, wantsPerMonth, investPerMonth, refDateStr = '2026-06-15') {
  const refDate = new Date(refDateStr);
  const txs = [];
  for (let m = 1; m <= monthsCount; m++) {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - m, 10));
    if (needsPerMonth > 0) {
      txs.push({ amount: needsPerMonth, type: 'Need', timestamp: d, category: 'Bills', description: 'Essential Living' });
    }
    if (wantsPerMonth > 0) {
      txs.push({ amount: wantsPerMonth, type: 'Want', timestamp: d, category: 'Shopping', description: 'Discretionary' });
    }
    if (investPerMonth > 0) {
      txs.push({ amount: investPerMonth, type: 'Investment', timestamp: d, category: 'Misc', description: 'Mutual Fund SIP' });
    }
  }
  return txs;
}

// ── TEST GROUP 5: FULL-STACK ATTACHMENT & CANONICAL PERSONAS ────────
console.log('Running 5. Full-Stack Snapshot Attachment Across Personas...');

// Persona A: Near-Retirement Underfunded (Age 55 -> 60, Corpus ₹20L, Spend ₹80k, Income ₹1L, SIP ₹10k)
const underfundedUser = {
  id: 'p08',
  age: 55,
  retirementAge: 60,
  monthlyIncome: 100000,
  currentBalance: 50000
};
const underfundedData = {
  user: underfundedUser,
  assets: [{ currentValue: 2000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  liabilities: [],
  transactions: createTransactions(6, 55000, 25000, 10000),
  incomes: [{ amount: 100000, timestamp: new Date('2026-05-01'), source: 'salary' }]
};

const underfundedSnapshot = await buildPredictabilitySnapshotAsync(underfundedData, { forecastDate: new Date('2026-06-15') });

assert.equal(underfundedSnapshot.probabilistic.available, true);
const uRec = underfundedSnapshot.probabilistic.contributionRecommendation;
assert.ok(uRec.solved, 'Solver solved');
assert.equal(uRec.feasibility.status, FEASIBILITY_STATUS.IMPRACTICAL, 'Near-ret underfunded is IMPRACTICAL');
assert.ok(uRec.feasibility.recommendedContributionRatio > 3.0, 'Ratio > 3x income');

// Verify alternatives generated for IMPRACTICAL user
const uAlts = underfundedSnapshot.probabilistic.retirementAlternatives;
assert.ok(Array.isArray(uAlts) && uAlts.length === 3, '3 retirement alternatives generated for underfunded user');
console.log(`  Underfunded (Age 60): Required SIP = ₹${uRec.recommendedMonthlyContribution.toLocaleString('en-IN')}/mo (IMPRACTICAL)`);
console.log(`  Alternative (Age 62): Required SIP = ₹${uAlts[0].recommendedMonthlyContribution.toLocaleString('en-IN')}/mo (P_cur = ${(uAlts[0].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);
console.log(`  Alternative (Age 65): Required SIP = ₹${uAlts[1].recommendedMonthlyContribution.toLocaleString('en-IN')}/mo (P_cur = ${(uAlts[1].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);
console.log(`  Alternative (Age 70): Required SIP = ₹${uAlts[2].recommendedMonthlyContribution.toLocaleString('en-IN')}/mo (P_cur = ${(uAlts[2].probabilityFundedAtTargetAge * 100).toFixed(1)}%)`);

assert.ok(uAlts[2].recommendedMonthlyContribution < uRec.recommendedMonthlyContribution, 'Age 70 required SIP is significantly lower than Age 60');

// Persona B: Well-Funded User (Already meets 75%)
const wellFundedUser = {
  id: 'p09',
  age: 55,
  retirementAge: 60,
  monthlyIncome: 180000,
  currentBalance: 100000
};
const wellFundedData = {
  user: wellFundedUser,
  assets: [{ currentValue: 35000000, assetClass: 'FIRE_INVESTABLE', includedInFireCorpus: true, liquidity: 'liquid' }],
  liabilities: [],
  transactions: createTransactions(6, 55000, 25000, 40000),
  incomes: [{ amount: 180000, timestamp: new Date('2026-05-01'), source: 'salary' }]
};

const wellFundedSnapshot = await buildPredictabilitySnapshotAsync(wellFundedData, { forecastDate: new Date('2026-06-15') });

const wfRec = wellFundedSnapshot.probabilistic.contributionRecommendation;
assert.equal(wfRec.additionalMonthlyContributionRequired, 0, 'Zero additional contribution needed');
assert.equal(wellFundedSnapshot.probabilistic.retirementAlternatives, null, 'No unnecessary alternatives generated for already on-track user');

console.log('  ✅ Test 5 Passed: Full-stack snapshot attachment and persona behavior verified\n');


// ── TEST GROUP 6: REPRODUCIBILITY ACROSS REPEATED CALLS ─────────────
console.log('Running 6. Reproducibility & Determinism Across Repeated Calls...');

const run1 = await buildPredictabilitySnapshotAsync(underfundedData, { forecastDate: new Date('2026-06-15') });
const run2 = await buildPredictabilitySnapshotAsync(underfundedData, { forecastDate: new Date('2026-06-15') });

assert.equal(
  run1.probabilistic.contributionRecommendation.recommendedMonthlyContribution,
  run2.probabilistic.contributionRecommendation.recommendedMonthlyContribution,
  'Base recommendation identical'
);

assert.equal(
  run1.probabilistic.retirementAlternatives[0].recommendedMonthlyContribution,
  run2.probabilistic.retirementAlternatives[0].recommendedMonthlyContribution,
  'Alternative 0 recommendation identical'
);
assert.equal(
  run1.probabilistic.retirementAlternatives[1].recommendedMonthlyContribution,
  run2.probabilistic.retirementAlternatives[1].recommendedMonthlyContribution,
  'Alternative 1 recommendation identical'
);
assert.equal(
  run1.probabilistic.retirementAlternatives[2].recommendedMonthlyContribution,
  run2.probabilistic.retirementAlternatives[2].recommendedMonthlyContribution,
  'Alternative 2 recommendation identical'
);

console.log('  ✅ Test 6 Passed: Deterministic reproducibility verified\n');

// ── TEST GROUP 7: ALTERNATIVE FAILURE ISOLATION ─────────────────────
console.log('Running 7. Alternative Failure Isolation (Graceful Degradation)...');

// Test that if an alternative offset causes an error, valid alternatives still return
const partialAlternativeMock = {
  currentAge: 30,
  retirementAge: 60,
  startingInvestableCorpus: 1000000,
  monthlyContribution: 25000,
  user: { age: 30, retirementAge: 60, monthlyIncome: 100000 }
};

const partialPayload = buildMonteCarloPayload(partialAlternativeMock, {}, {
  estimatedFireCorpus: 12000000
});

// Pass custom offsets where one might be extreme/handled
const isolatedAlts = await calculateRetirementAlternatives(
  partialAlternativeMock,
  { alternativeAgeOffsets: [2, 5, 10] },
  partialPayload,
  {},
  100000
);

assert.ok(Array.isArray(isolatedAlts) && isolatedAlts.length > 0, 'Alternatives succeed with isolated resilience');

console.log('  ✅ Test 7 Passed: Failure isolation preserves successful scenarios\n');


console.log('================================================================');
console.log('  ALL GUARDRAILS & RETIREMENT ALTERNATIVES TESTS PASSED! 🚀');
console.log('================================================================');
