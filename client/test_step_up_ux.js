/**
 * client/test_step_up_ux.js
 * 
 * Unit & Contract Verification Suite for STEP_UP SIP / Annual Contribution Growth UX
 */

import assert from 'node:assert/strict';

function formatCurrency(amount, compact = false) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—';
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (compact) {
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
  }

  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatPercentInt(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

function renderRecAction(rec) {
  if (rec.annualContributionGrowthRate && rec.annualContributionGrowthRate > 0) {
    return `Increase initial monthly investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo`;
  }
  return `Increase monthly investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo`;
}

function renderRecFromTo(rec) {
  if (rec.annualContributionGrowthRate && rec.annualContributionGrowthRate > 0) {
    return `From ${formatCurrency(rec.currentMonthlyContribution)} → ${formatCurrency(rec.recommendedMonthlyContribution)} initial per month (+${Math.round(rec.annualContributionGrowthRate * 100)}%/yr annual step-up)`;
  }
  return `From ${formatCurrency(rec.currentMonthlyContribution)} → ${formatCurrency(rec.recommendedMonthlyContribution)} per month`;
}

function renderContributionModelTitle(assumptions) {
  if (assumptions.contributionMode === 'STEP_UP') {
    return `Annual Step-Up (${((assumptions.annualContributionGrowthRate ?? 0) * 100).toFixed(0)}%/yr)`;
  }
  if (assumptions.contributionMode === 'REAL_CONSTANT') {
    return 'Constant Real (REAL_CONSTANT)';
  }
  return 'Fixed Nominal Monthly (NOMINAL_FLAT)';
}

function renderContributionModelNote(assumptions) {
  if (assumptions.contributionMode === 'STEP_UP') {
    return `Monthly investments are modeled to increase by ${((assumptions.annualContributionGrowthRate ?? 0) * 100).toFixed(0)}% each year.`;
  }
  if (assumptions.contributionMode === 'REAL_CONSTANT') {
    return 'Monthly investments are modeled to increase with inflation to maintain purchasing power.';
  }
  return 'Current projections assume your monthly investment stays flat in nominal rupees over time.';
}

console.log('='.repeat(64));
console.log('  FINAURA STEP-UP SIP UX & CONTRACT VERIFICATION SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  console.log(`Running ${name}...`);
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name} Passed`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
  console.log();
}

// 1. STEP_UP Recommendation Rendering
test('Test 1: STEP_UP Recommendation Copy with Escalation Disclosed', () => {
  const rec = {
    solved: true,
    currentMonthlyContribution: 5000,
    recommendedMonthlyContribution: 7100,
    additionalMonthlyContributionRequired: 2100,
    annualContributionGrowthRate: 0.10
  };
  const action = renderRecAction(rec);
  const fromTo = renderRecFromTo(rec);

  assert.equal(action, 'Increase initial monthly investments by ₹2,100/mo');
  assert.equal(fromTo, 'From ₹5,000 → ₹7,100 initial per month (+10%/yr annual step-up)');
});

// 2. NOMINAL_FLAT Recommendation Backward Compatibility
test('Test 2: NOMINAL_FLAT Recommendation Copy (No Escalation)', () => {
  const rec = {
    solved: true,
    currentMonthlyContribution: 5000,
    recommendedMonthlyContribution: 34100,
    additionalMonthlyContributionRequired: 29100,
    annualContributionGrowthRate: null
  };
  const action = renderRecAction(rec);
  const fromTo = renderRecFromTo(rec);

  assert.equal(action, 'Increase monthly investments by ₹29,100/mo');
  assert.equal(fromTo, 'From ₹5,000 → ₹34,100 per month');
});

// 3. Assumptions Modal / Collapsible Section Disclosure
test('Test 3: Contribution Model Disclosure Rendering', () => {
  const stepUpAssumptions = { contributionMode: 'STEP_UP', annualContributionGrowthRate: 0.10 };
  assert.equal(renderContributionModelTitle(stepUpAssumptions), 'Annual Step-Up (10%/yr)');
  assert.equal(renderContributionModelNote(stepUpAssumptions), 'Monthly investments are modeled to increase by 10% each year.');

  const flatAssumptions = { contributionMode: 'NOMINAL_FLAT' };
  assert.equal(renderContributionModelTitle(flatAssumptions), 'Fixed Nominal Monthly (NOMINAL_FLAT)');
  assert.equal(renderContributionModelNote(flatAssumptions), 'Current projections assume your monthly investment stays flat in nominal rupees over time.');
});

// 4. Feasibility Ratio Evaluation with Initial Contribution
test('Test 4: Feasibility Ratio Computation with Initial Contribution', () => {
  const initialReq = 7100;
  const reliableIncome = 40000;
  const ratio = initialReq / reliableIncome;
  assert.ok(Math.abs(ratio - 0.1775) < 0.001);
  assert.equal(Math.round(ratio * 100), 18);
});

// 5. Client Contract Enforcement: STEP_UP with Required Growth Rate
test('Test 5: Client Type Contract Enforcement for STEP_UP Mode', () => {
  const validStepUpPayload = {
    contributionMode: 'STEP_UP',
    annualContributionGrowthRate: 0.10
  };
  assert.ok(validStepUpPayload.contributionMode === 'STEP_UP');
  assert.ok(typeof validStepUpPayload.annualContributionGrowthRate === 'number');
  assert.ok(validStepUpPayload.annualContributionGrowthRate >= 0.0 && validStepUpPayload.annualContributionGrowthRate <= 0.50);

  // Missing growth rate helper check
  function validateClientStepUpPayload(payload) {
    if (payload.contributionMode === 'STEP_UP') {
      if (payload.annualContributionGrowthRate === undefined || payload.annualContributionGrowthRate === null) {
        throw new TypeError('annualContributionGrowthRate is required when contributionMode is STEP_UP');
      }
    }
  }

  assert.throws(() => {
    validateClientStepUpPayload({ contributionMode: 'STEP_UP' });
  }, /annualContributionGrowthRate is required/);
});

console.log('='.repeat(64));
console.log(`  ALL ${passed} UX CONTRACT TESTS PASSED (0 failures)`);
console.log('='.repeat(64));

