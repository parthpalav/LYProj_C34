/**
 * server/test_proactive_saving_guidance.js
 * 
 * Comprehensive test suite for Proactive Saving Intervention & Actionable Forecast Guidance (Point 8).
 * Tests all status, priority, provenance, feasibility, and resilience rules.
 */

import assert from 'node:assert/strict';
import {
  buildProactiveGuidance,
  PROACTIVE_STATUS,
  PROACTIVE_PRIORITY,
  attachMonteCarloSimulation
} from './utils/monteCarloAdapter.js';
import { FEASIBILITY_STATUS } from './config/financialRules.js';

console.log('================================================================');
console.log('  FINAURA PREDICTABILITY — PROACTIVE GUIDANCE TEST SUITE (POINT 8)');
console.log('================================================================\n');

// ── TEST 1: ON_TRACK STATUS (p >= 0.75) ───────────────────────────
console.log('Running Test 1: ON_TRACK Status & LOW Priority when currentProbability >= 0.75...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.82 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 15000,
        recommendedMonthlyContribution: 15000,
        additionalMonthlyContributionRequired: 0,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 15000 },
    retirement: { monthlyContributionUsed: 15000 },
    income: { coefficientOfVariation: 0.15 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.ON_TRACK);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.LOW);
  assert.equal(guidance.actionType, 'NONE');
  assert.equal(guidance.currentProbability, 0.82);
  assert.match(guidance.headline, /On Track/i);
  assert.match(guidance.explanation, /already meets/i);
  console.log('  ✓ Correctly derived ON_TRACK and LOW priority');
}

// ── TEST 2: IMPROVEMENT_RECOMMENDED WITH MANAGEABLE FEASIBILITY ──
console.log('Running Test 2: IMPROVEMENT_RECOMMENDED & MEDIUM Priority (MANAGEABLE feasibility)...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.45 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 8000,
        recommendedMonthlyContribution: 12000,
        additionalMonthlyContributionRequired: 4000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE, recommendedContributionRatio: 0.20 }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 8000 },
    retirement: { monthlyContributionUsed: 8000 },
    income: { coefficientOfVariation: 0.10 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.IMPROVEMENT_RECOMMENDED);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.MEDIUM);
  assert.equal(guidance.actionType, 'INCREASE_CONTRIBUTION');
  assert.equal(guidance.additionalMonthlyContribution, 4000);
  assert.equal(guidance.feasibilityStatus, FEASIBILITY_STATUS.MANAGEABLE);
  assert.match(guidance.headline, /Manageable Increase/i);
  console.log('  ✓ Correctly derived IMPROVEMENT_RECOMMENDED and MEDIUM priority for MANAGEABLE');
}

// ── TEST 3: IMPROVEMENT_RECOMMENDED WITH AGGRESSIVE FEASIBILITY ───
console.log('Running Test 3: IMPROVEMENT_RECOMMENDED & HIGH Priority (AGGRESSIVE feasibility)...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.35 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 10000,
        recommendedMonthlyContribution: 25000,
        additionalMonthlyContributionRequired: 15000,
        feasibility: { status: FEASIBILITY_STATUS.AGGRESSIVE, recommendedContributionRatio: 0.45 }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 10000 },
    retirement: { monthlyContributionUsed: 10000 },
    income: { coefficientOfVariation: 0.20 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.IMPROVEMENT_RECOMMENDED);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.HIGH);
  assert.equal(guidance.actionType, 'INCREASE_CONTRIBUTION');
  assert.equal(guidance.feasibilityStatus, FEASIBILITY_STATUS.AGGRESSIVE);
  assert.ok(guidance.reasons.some(r => r.includes('significant commitment')));
  console.log('  ✓ Correctly derived IMPROVEMENT_RECOMMENDED and HIGH priority for AGGRESSIVE');
}

// ── TEST 4: ACTION_NEEDED WITH VERY_AGGRESSIVE FEASIBILITY ────────
console.log('Running Test 4: ACTION_NEEDED & HIGH Priority (VERY_AGGRESSIVE feasibility)...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.20 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 5000,
        recommendedMonthlyContribution: 35000,
        additionalMonthlyContributionRequired: 30000,
        feasibility: { status: FEASIBILITY_STATUS.VERY_AGGRESSIVE, recommendedContributionRatio: 0.65 }
      },
      retirementAlternatives: [
        { targetAge: 62, yearsExtended: 2, recommendedMonthlyContribution: 22000 }
      ]
    },
    currentState: { observedAverageMonthlyInvestment: 5000 },
    retirement: { monthlyContributionUsed: 5000 },
    income: { coefficientOfVariation: 0.15 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.ACTION_NEEDED);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.HIGH);
  assert.equal(guidance.actionType, 'EXTEND_TIMELINE');
  assert.equal(guidance.retirementAlternativeAvailable, true);
  assert.match(guidance.headline, /Large Savings Increase/i);
  console.log('  ✓ Correctly derived ACTION_NEEDED for VERY_AGGRESSIVE');
}

// ── TEST 5: ACTION_NEEDED WITH IMPRACTICAL FEASIBILITY ─────────────
console.log('Running Test 5: ACTION_NEEDED & HIGH Priority (IMPRACTICAL feasibility)...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.10 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 2000,
        recommendedMonthlyContribution: 60000,
        additionalMonthlyContributionRequired: 58000,
        feasibility: { status: FEASIBILITY_STATUS.IMPRACTICAL, recommendedContributionRatio: 1.20 }
      },
      retirementAlternatives: [
        { targetAge: 65, yearsExtended: 5, recommendedMonthlyContribution: 18000 }
      ]
    },
    currentState: { observedAverageMonthlyInvestment: 2000 },
    retirement: { monthlyContributionUsed: 2000 },
    income: { coefficientOfVariation: 0.10 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.ACTION_NEEDED);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.HIGH);
  assert.equal(guidance.actionType, 'EXTEND_TIMELINE');
  assert.match(guidance.headline, /Timeline Adjustment/i);
  assert.ok(guidance.reasons.some(r => r.includes('exceeds practical savings capacity')));
  console.log('  ✓ Correctly derived ACTION_NEEDED for IMPRACTICAL with timeline emphasis');
}

// ── TEST 6: ACTION_NEEDED WHEN SOLVER IS UNSOLVED ─────────────────
console.log('Running Test 6: ACTION_NEEDED when solver is unsolved...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.05 },
      contributionRecommendation: {
        solved: false,
        currentMonthlyContribution: 1000,
        recommendedMonthlyContribution: null,
        additionalMonthlyContributionRequired: null,
        feasibility: null
      }
    },
    currentState: { observedAverageMonthlyInvestment: 1000 },
    retirement: { monthlyContributionUsed: 1000 },
    income: { coefficientOfVariation: 0.10 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.ACTION_NEEDED);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.HIGH);
  assert.equal(guidance.actionType, 'EXTEND_TIMELINE');
  assert.match(guidance.headline, /Consider Alternative Approaches/i);
  console.log('  ✓ Correctly derived ACTION_NEEDED when solver cannot find a solution');
}

// ── TEST 7: LIMITED_DATA (forecastStatus.available === false) ──────
console.log('Running Test 7: LIMITED_DATA when forecastStatus.available === false...');
{
  const snapshot = {
    forecastStatus: {
      available: false,
      missingInputs: ['INSUFFICIENT_SPENDING_HISTORY', 'MISSING_INVESTMENT_BASELINE']
    },
    probabilistic: { available: false, reason: 'FORECAST_INPUTS_UNAVAILABLE' },
    currentState: { observedAverageMonthlyInvestment: null },
    retirement: null,
    income: { coefficientOfVariation: null }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.LIMITED_DATA);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.MEDIUM);
  assert.equal(guidance.actionType, 'ADD_DATA');
  assert.match(guidance.headline, /More Financial History Needed/i);
  assert.match(guidance.explanation, /before we can suggest a saving target/i);
  assert.ok(guidance.reasons.length >= 2);
  console.log('  ✓ Correctly derived LIMITED_DATA with explicit user data guidance');
}

// ── TEST 8: TEMPORARILY_UNAVAILABLE (simulation service down) ─────
console.log('Running Test 8: TEMPORARILY_UNAVAILABLE when forecast available but simulation down...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: { available: false, reason: 'SIMULATION_SERVICE_UNAVAILABLE' },
    currentState: { observedAverageMonthlyInvestment: 10000 },
    retirement: {
      monthlyContributionUsed: 10000,
      projectedCorpusAtRetirement: 15000000,
      estimatedFireCorpus: 20000000
    },
    income: { coefficientOfVariation: 0.15 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.status, PROACTIVE_STATUS.TEMPORARILY_UNAVAILABLE);
  assert.equal(guidance.priority, PROACTIVE_PRIORITY.LOW);
  assert.equal(guidance.actionType, 'NONE');
  assert.match(guidance.headline, /Temporarily Unavailable/i);
  assert.match(guidance.explanation, /Your baseline forecast remains available/i);
  // Crucial invariant: does not blame user data
  assert.ok(!guidance.explanation.includes('history'));
  console.log('  ✓ Correctly distinguished TEMPORARILY_UNAVAILABLE from LIMITED_DATA');
}

// ── TEST 9: INVESTMENT BASELINE: KNOWN_ZERO ───────────────────────
console.log('Running Test 9: Investment baseline KNOWN_ZERO when spending exists but investment is 0...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.25 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 0,
        recommendedMonthlyContribution: 8000,
        additionalMonthlyContributionRequired: 8000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 0 },
    dataQuality: { transactionMonthsObserved: 6 },
    retirement: { monthlyContributionUsed: 0 },
    income: { coefficientOfVariation: 0.10 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.investmentBaseline, 'KNOWN_ZERO');
  assert.match(guidance.headline, /Start Building Your Retirement Path/i);
  assert.match(guidance.explanation, /not currently making regular investments/i);
  console.log('  ✓ Correctly handled KNOWN_ZERO baseline with tailored starter copy');
}

// ── TEST 10: INVESTMENT BASELINE: OBSERVED ────────────────────────
console.log('Running Test 10: Investment baseline OBSERVED when positive investment exists...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.55 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 12000,
        recommendedMonthlyContribution: 18000,
        additionalMonthlyContributionRequired: 6000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 12000 },
    retirement: { monthlyContributionUsed: 12000 },
    income: { coefficientOfVariation: 0.10 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.investmentBaseline, 'OBSERVED');
  assert.equal(guidance.currentMonthlyContribution, 12000);
  console.log('  ✓ Correctly identified OBSERVED investment baseline');
}

// ── TEST 11: INVESTMENT BASELINE: UNKNOWN ─────────────────────────
console.log('Running Test 11: Investment baseline UNKNOWN when baseline is null...');
{
  const snapshot = {
    forecastStatus: { available: false, missingInputs: ['INSUFFICIENT_SPENDING_HISTORY'] },
    probabilistic: { available: false },
    currentState: { observedAverageMonthlyInvestment: null },
    retirement: null,
    income: { coefficientOfVariation: null }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.investmentBaseline, 'UNKNOWN');
  console.log('  ✓ Correctly identified UNKNOWN investment baseline');
}

// ── TEST 12: VARIABLE-INCOME CONTEXTUAL NOTE ──────────────────────
console.log('Running Test 12: Variable-income note based on CV >= 0.5 (not raw multiple sources)...');
{
  // High CV (variable income)
  const variableSnapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.40 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 5000,
        recommendedMonthlyContribution: 10000,
        additionalMonthlyContributionRequired: 5000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 5000 },
    retirement: { monthlyContributionUsed: 5000 },
    income: { coefficientOfVariation: 0.65 } // Elevated variability
  };

  const varGuidance = buildProactiveGuidance(variableSnapshot);
  assert.equal(varGuidance.isVariableIncome, true);
  assert.ok(varGuidance.reasons.some(r => r.includes('average rather than a fixed monthly requirement')));

  // Low CV with multiple sources (stable income)
  const stableSnapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.40 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 5000,
        recommendedMonthlyContribution: 10000,
        additionalMonthlyContributionRequired: 5000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 5000 },
    retirement: { monthlyContributionUsed: 5000 },
    income: { coefficientOfVariation: 0.15 } // Stable despite multi-source
  };

  const stableGuidance = buildProactiveGuidance(stableSnapshot);
  assert.equal(stableGuidance.isVariableIncome, false);
  assert.ok(!stableGuidance.reasons.some(r => r.includes('average rather than a fixed monthly requirement')));
  console.log('  ✓ Correctly triggered variable-income note only on elevated CV (>= 0.5)');
}

// ── TEST 13: STEP-UP AND ALTERNATIVES FLAGS REFLECTION ────────────
console.log('Running Test 13: Step-Up & Retirement Alternatives flags...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.30 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 5000,
        recommendedMonthlyContribution: 10000,
        additionalMonthlyContributionRequired: 5000,
        annualContributionGrowthRate: 0.10, // STEP_UP escalation active
        feasibility: { status: FEASIBILITY_STATUS.AGGRESSIVE }
      },
      retirementAlternatives: [
        { targetAge: 62, yearsExtended: 2, recommendedMonthlyContribution: 7500 }
      ]
    },
    currentState: { observedAverageMonthlyInvestment: 5000 },
    retirement: {
      monthlyContributionUsed: 5000,
      assumptions: { contributionMode: 'STEP_UP' }
    },
    income: { coefficientOfVariation: 0.20 }
  };

  const guidance = buildProactiveGuidance(snapshot);
  assert.equal(guidance.stepUpAvailable, true);
  assert.equal(guidance.retirementAlternativeAvailable, true);
  console.log('  ✓ Correctly exposed stepUpAvailable and retirementAlternativeAvailable');
}

// ── TEST 14: DETERMINISM & PURITY CHECK ───────────────────────────
console.log('Running Test 14: Pure deterministic evaluation (identical input -> identical output)...');
{
  const snapshot = {
    forecastStatus: { available: true },
    probabilistic: {
      available: true,
      estimatedFire: { probabilityFundedAtTargetAge: 0.60 },
      contributionRecommendation: {
        solved: true,
        currentMonthlyContribution: 10000,
        recommendedMonthlyContribution: 14000,
        additionalMonthlyContributionRequired: 4000,
        feasibility: { status: FEASIBILITY_STATUS.MANAGEABLE }
      }
    },
    currentState: { observedAverageMonthlyInvestment: 10000 },
    retirement: { monthlyContributionUsed: 10000 },
    income: { coefficientOfVariation: 0.15 }
  };

  const g1 = buildProactiveGuidance(snapshot);
  const g2 = buildProactiveGuidance(snapshot);
  assert.deepEqual(g1, g2, 'Identical snapshot produces bitwise identical guidance');
  console.log('  ✓ Pure deterministic interpretation verified');
}

console.log('\n================================================================');
console.log('  ALL 14 PROACTIVE GUIDANCE CONTRACT TESTS PASSED (100% GREEN)');
console.log('================================================================\n');
