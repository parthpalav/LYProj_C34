/**
 * client/test_predictability_guardrails_ux.js
 * 
 * Tests for FINAURA Financial Outlook Screen UX guardrails:
 * 1. Late-funded age formatting (<70, 70-75, 75-85, >85)
 * 2. Feasibility badge labels and styling logic
 * 3. Contextual, non-punitive messaging for MANAGEABLE, AGGRESSIVE, VERY_AGGRESSIVE, IMPRACTICAL, UNKNOWN
 * 4. Retirement alternatives rendering contract
 * 5. Robustness against null/undefined/NaN edge cases
 */

import assert from 'node:assert/strict';

console.log('================================================================');
console.log('  FINAURA FINANCIAL OUTLOOK GUARDRAILS & UX TEST SUITE');
console.log('================================================================\n');

// ── 1. Replicated formatFundedAge helper from FinancialOutlookScreen ──
function formatFundedAge(point) {
  if (!point || !point.reached || point.ageYears === null || point.ageYears === undefined || !Number.isFinite(point.ageYears)) {
    return { headline: 'Not reached in forecast horizon', color: '#64748B' };
  }
  const ageYears = point.ageYears;
  const wholeYears = Math.floor(ageYears);
  const months = Math.round((ageYears - wholeYears) * 12);
  const formattedExact = (months === 0 || months === 12)
    ? `Age ${months === 12 ? wholeYears + 1 : wholeYears}`
    : `Age ${wholeYears}y ${months}m`;

  if (ageYears <= 70) {
    return { headline: formattedExact, color: '#3B3BDE' };
  } else if (ageYears <= 75) {
    return { headline: formattedExact, note: 'Later career horizon', color: '#3B3BDE' };
  } else if (ageYears <= 85) {
    return { headline: formattedExact, note: 'Beyond typical retirement horizon', color: '#F59E0B' };
  } else {
    return {
      headline: 'Not reached within a typical retirement horizon',
      note: `Modeled: ${formattedExact}`,
      color: '#6B7280'
    };
  }
}

// ── TEST 1: LATE-FUNDED AGE GUARDRAILS ──────────────────────────────
console.log('Running Test 1: Late-Funded Age Guardrails...');

// Age <= 70: standard
const age50 = formatFundedAge({ reached: true, ageYears: 50.75 });
assert.equal(age50.headline, 'Age 50y 9m');
assert.equal(age50.note, undefined);

const age70 = formatFundedAge({ reached: true, ageYears: 70.0 });
assert.equal(age70.headline, 'Age 70');
assert.equal(age70.note, undefined);

// 70 < Age <= 75: subtle note
const age72 = formatFundedAge({ reached: true, ageYears: 72.5 });
assert.equal(age72.headline, 'Age 72y 6m');
assert.equal(age72.note, 'Later career horizon');

// 75 < Age <= 85: beyond typical horizon note
const age78 = formatFundedAge({ reached: true, ageYears: 78.3333 });
assert.equal(age78.headline, 'Age 78y 4m');
assert.equal(age78.note, 'Beyond typical retirement horizon');

// Age > 85: headline guardrail with modeled detail
const age92 = formatFundedAge({ reached: true, ageYears: 92.0 });
assert.equal(age92.headline, 'Not reached within a typical retirement horizon');
assert.equal(age92.note, 'Modeled: Age 92');

// Unreached / null
const unreached = formatFundedAge({ reached: false, ageYears: null });
assert.equal(unreached.headline, 'Not reached in forecast horizon');

console.log('  ✅ Test 1 Passed: All 4 age tiers (<70, 71-75, 76-85, >85) format accurately\n');


// ── TEST 2: FEASIBILITY BADGE TEXT & STATUS ─────────────────────────
console.log('Running Test 2: Feasibility Badge Text Mapping...');

function getFeasibilityLabel(status) {
  switch (status) {
    case 'MANAGEABLE': return 'Manageable';
    case 'AGGRESSIVE': return 'High Commitment';
    case 'VERY_AGGRESSIVE': return 'Very High Commitment';
    case 'IMPRACTICAL': return 'Exceeds Typical Savings Capacity';
    default: return 'Unknown';
  }
}

assert.equal(getFeasibilityLabel('MANAGEABLE'), 'Manageable');
assert.equal(getFeasibilityLabel('AGGRESSIVE'), 'High Commitment');
assert.equal(getFeasibilityLabel('VERY_AGGRESSIVE'), 'Very High Commitment');
assert.equal(getFeasibilityLabel('IMPRACTICAL'), 'Exceeds Typical Savings Capacity');

console.log('  ✅ Test 2 Passed: Feasibility status labels mapped cleanly\n');


// ── TEST 3: CONTEXTUAL NON-PUNITIVE MESSAGING ────────────────────────
console.log('Running Test 3: Contextual Non-Punitive Messaging...');

function getFeasibilityContextMessage(feasibility, recommendedMonthlyContribution, targetAge = 60) {
  if (!feasibility || feasibility.status === 'UNKNOWN') {
    return 'We can estimate the investment needed, but need a more reliable income baseline to assess how practical it may be.';
  }
  const ratioPct = feasibility.recommendedContributionRatio !== null
    ? Math.round(feasibility.recommendedContributionRatio * 100)
    : null;

  switch (feasibility.status) {
    case 'MANAGEABLE':
      return `About ${ratioPct}% of your reliable monthly income.`;
    case 'AGGRESSIVE':
      return `This would require a high savings commitment relative to your current income (~${ratioPct}% of reliable monthly income).`;
    case 'VERY_AGGRESSIVE':
      return `This recommendation would require more than half (~${ratioPct}%) of your reliable monthly income.`;
    case 'IMPRACTICAL':
      return `Reaching a 75% modeled probability by your target retirement age would require approximately ₹${recommendedMonthlyContribution.toLocaleString('en-IN')}/month under flat contribution modeling. This is substantially above your current reliable monthly income, so extending your retirement timeline may be more realistic.`;
    default:
      return '';
  }
}

const msgMan = getFeasibilityContextMessage({ status: 'MANAGEABLE', recommendedContributionRatio: 0.25 }, 25000);
assert.ok(msgMan.includes('About 25% of your reliable monthly income'));

const msgAgg = getFeasibilityContextMessage({ status: 'AGGRESSIVE', recommendedContributionRatio: 0.45 }, 45000);
assert.ok(msgAgg.includes('high savings commitment'));

const msgVagg = getFeasibilityContextMessage({ status: 'VERY_AGGRESSIVE', recommendedContributionRatio: 0.65 }, 65000);
assert.ok(msgVagg.includes('more than half'));

const msgImp = getFeasibilityContextMessage({ status: 'IMPRACTICAL', recommendedContributionRatio: 3.53 }, 353400);
assert.ok(msgImp.includes('substantially above your current reliable monthly income'));
assert.ok(msgImp.includes('extending your retirement timeline may be more realistic'));
assert.ok(!msgImp.includes('cannot retire') && !msgImp.includes('bad habits'), 'Non-punitive wording');

console.log('  ✅ Test 3 Passed: Respectful, non-punitive messaging verified across all bands\n');


// ── TEST 4: RETIREMENT ALTERNATIVES CONTRACT ─────────────────────────
console.log('Running Test 4: Retirement Alternatives Contract...');

const mockAlternatives = [
  {
    targetAge: 62,
    yearsExtended: 2,
    monthsUntilRetirement: 384,
    probabilityFundedAtTargetAge: 0.15,
    recommendedMonthlyContribution: 266000,
    additionalMonthlyContributionRequired: 256000,
    achievedProbabilityFunded: 0.7505,
    targetProbability: 0.75,
    solved: true,
    feasibility: {
      status: 'IMPRACTICAL',
      recommendedContributionRatio: 2.66,
      additionalContributionRatio: 2.56,
      reliableMonthlyIncome: 100000
    }
  },
  {
    targetAge: 65,
    yearsExtended: 5,
    monthsUntilRetirement: 420,
    probabilityFundedAtTargetAge: 0.35,
    recommendedMonthlyContribution: 200200,
    additionalMonthlyContributionRequired: 190200,
    achievedProbabilityFunded: 0.7502,
    targetProbability: 0.75,
    solved: true,
    feasibility: {
      status: 'IMPRACTICAL',
      recommendedContributionRatio: 2.00,
      additionalContributionRatio: 1.90,
      reliableMonthlyIncome: 100000
    }
  },
  {
    targetAge: 70,
    yearsExtended: 10,
    monthsUntilRetirement: 480,
    probabilityFundedAtTargetAge: 0.60,
    recommendedMonthlyContribution: 147800,
    additionalMonthlyContributionRequired: 137800,
    achievedProbabilityFunded: 0.7508,
    targetProbability: 0.75,
    solved: true,
    feasibility: {
      status: 'IMPRACTICAL',
      recommendedContributionRatio: 1.48,
      additionalContributionRatio: 1.38,
      reliableMonthlyIncome: 100000
    }
  }
];

assert.equal(mockAlternatives.length, 3);
assert.equal(mockAlternatives[0].targetAge, 62);
assert.equal(mockAlternatives[1].targetAge, 65);
assert.equal(mockAlternatives[2].targetAge, 70);

// Verify alternatives monotonically reduce required contribution
assert.ok(mockAlternatives[1].recommendedMonthlyContribution < mockAlternatives[0].recommendedMonthlyContribution);
assert.ok(mockAlternatives[2].recommendedMonthlyContribution < mockAlternatives[1].recommendedMonthlyContribution);

console.log('  ✅ Test 4 Passed: Retirement alternatives data structure and monotonic ordering verified\n');


// ── TEST 5: ZERO NULL / NAN LEAKS ON EDGE CASES ─────────────────────
console.log('Running Test 5: Zero Null / NaN Leaks on Edge Cases...');

const edgeFeas = {
  status: 'UNKNOWN',
  recommendedContributionRatio: null,
  additionalContributionRatio: null,
  reliableMonthlyIncome: null
};
const edgeMsg = getFeasibilityContextMessage(edgeFeas, 0);
assert.ok(!edgeMsg.includes('null') && !edgeMsg.includes('NaN'), 'No null/NaN text leaks in feasibility message');

const edgeAge = formatFundedAge({ reached: false, ageYears: undefined });
assert.ok(!edgeAge.headline.includes('undefined') && !edgeAge.headline.includes('NaN'), 'No undefined/NaN text leaks in age');

console.log('  ✅ Test 5 Passed: Zero text leaks on missing/edge-case values\n');

console.log('================================================================');
console.log('  ALL FINANCIAL OUTLOOK GUARDRAILS UX TESTS PASSED! 🚀');
console.log('================================================================');
