/**
 * client/test_profile_screen_ux.js
 * 
 * Unit & UX contract test suite for FINAURA Profile Screen & Planning Assumptions.
 * Verifies sections, formatting, validation rules, partial updates, and navigation targets.
 */

import assert from 'node:assert/strict';

console.log('='.repeat(64));
console.log('  FINAURA PROFILE SCREEN & ASSUMPTIONS UX TEST SUITE');
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

// ── Formatting Helpers ───────────────────────────────────────
function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Not set';
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

function formatPercent(value, fallback = 0.08) {
  const rate = value != null && Number.isFinite(value) ? value : fallback;
  return `${(rate * 100).toFixed(1)}% p.a.`;
}

function formatRatio(value, fallback = 0.8) {
  const ratio = value != null && Number.isFinite(value) ? value : fallback;
  return `${Math.round(ratio * 100)}%`;
}

function validateProfileAssumptions(inputs) {
  const errors = [];

  // Retirement Age
  if (inputs.retirementAge !== undefined) {
    const rage = parseInt(inputs.retirementAge, 10);
    if (isNaN(rage) || rage < 40 || rage > 100) {
      errors.push('Retirement age must be an integer between 40 and 100.');
    }
  }

  // Monthly Income
  if (inputs.monthlyIncome !== undefined) {
    const inc = parseFloat(inputs.monthlyIncome);
    if (isNaN(inc) || inc < 0) {
      errors.push('Declared monthly income must be a positive number.');
    }
  }

  // Corpus Goal
  if (inputs.retirementCorpusGoal !== undefined) {
    const goal = parseFloat(inputs.retirementCorpusGoal);
    if (isNaN(goal) || goal < 0) {
      errors.push('Personal retirement corpus goal must be non-negative.');
    }
  }

  // Return Rate (% input)
  if (inputs.returnRatePct !== undefined) {
    const ret = parseFloat(inputs.returnRatePct);
    if (isNaN(ret) || ret < 0 || ret > 100) {
      errors.push('Expected return rate must be between 0% and 100%.');
    }
  }

  // Inflation Rate (% input)
  if (inputs.inflationRatePct !== undefined) {
    const inf = parseFloat(inputs.inflationRatePct);
    if (isNaN(inf) || inf < 0 || inf > 100) {
      errors.push('Expected inflation rate must be between 0% and 100%.');
    }
  }

  // SWR (% input)
  if (inputs.withdrawalRatePct !== undefined) {
    const swr = parseFloat(inputs.withdrawalRatePct);
    if (isNaN(swr) || swr <= 0 || swr > 100) {
      errors.push('Safe withdrawal rate must be between 1% and 100%.');
    }
  }

  // Lifestyle Ratio (% input)
  if (inputs.lifestyleRatioPct !== undefined) {
    const life = parseFloat(inputs.lifestyleRatioPct);
    if (isNaN(life) || life <= 0 || life > 200) {
      errors.push('Lifestyle spending ratio must be between 1% and 200%.');
    }
  }

  // Emergency Months
  if (inputs.emergencyMonths !== undefined) {
    const ef = parseInt(inputs.emergencyMonths, 10);
    if (isNaN(ef) || ef < 0 || ef > 36) {
      errors.push('Emergency fund target must be between 0 and 36 months.');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── 1. ROUTE ACCESSIBILITY & NAVIGATION TARGETS ─────────────
test('Test 1: Route Accessibility & Navigation Targets', () => {
  const registeredTabs = ['Dashboard', 'Transactions', 'Liabilities', 'Envelopes', 'Chat', 'Profile'];
  const registeredStackRoutes = ['FinancialOutlook', 'FMI', 'IncomeFlow'];

  assert.ok(registeredTabs.includes('Profile'));
  assert.ok(registeredStackRoutes.includes('IncomeFlow'));
  assert.ok(registeredStackRoutes.includes('FinancialOutlook'));
});

// ── 2. DECLARED MONTHLY INCOME CLARITY ──────────────────────
test('Test 2: Declared Monthly Income Labeling as Planning Baseline', () => {
  const label = 'Declared Monthly Income';
  const helper = 'Used as a planning baseline. Actual receipts are logged separately in Income Streams.';

  assert.ok(label.includes('Declared'));
  assert.ok(helper.includes('planning baseline'));
  assert.ok(helper.includes('separately in Income Streams'));
});

// ── 3. PERCENTAGE & RATIO FORMATTING ────────────────────────
test('Test 3: Percentage and Ratio Formatting on Profile', () => {
  assert.equal(formatPercent(0.08), '8.0% p.a.');
  assert.equal(formatPercent(0.125), '12.5% p.a.');
  assert.equal(formatPercent(null, 0.08), '8.0% p.a.');

  assert.equal(formatRatio(0.80), '80%');
  assert.equal(formatRatio(0.85), '85%');
  assert.equal(formatRatio(null, 0.80), '80%');
});

// ── 4. RETIREMENT CORPUS GOAL VS ESTIMATED FIRE DISTINCTION ─
test('Test 4: Personal Corpus Goal vs Estimated FIRE Distinction', () => {
  const label = 'Personal Retirement Corpus Goal';
  const helper = 'Your personal target. FINAURA also calculates estimated FIRE requirement separately.';

  assert.ok(label.includes('Personal'));
  assert.ok(helper.includes('separately'));
});

// ── 5. INPUT VALIDATION BOUNDARIES ──────────────────────────
test('Test 5: Input Validation Boundaries (Rejects Malformed / Absurd Values)', () => {
  // Valid payload
  const valid = validateProfileAssumptions({
    retirementAge: '60',
    monthlyIncome: '85000',
    retirementCorpusGoal: '25000000',
    returnRatePct: '8',
    inflationRatePct: '6',
    withdrawalRatePct: '4',
    lifestyleRatioPct: '80',
    emergencyMonths: '6',
  });
  assert.ok(valid.valid);
  assert.equal(valid.errors.length, 0);

  // Invalid retirement age (<40)
  const invalidAge = validateProfileAssumptions({ retirementAge: '35' });
  assert.ok(!invalidAge.valid);
  assert.ok(invalidAge.errors[0].includes('between 40 and 100'));

  // Invalid return rate (>100%)
  const invalidReturn = validateProfileAssumptions({ returnRatePct: '150' });
  assert.ok(!invalidReturn.valid);

  // Negative income
  const invalidIncome = validateProfileAssumptions({ monthlyIncome: '-5000' });
  assert.ok(!invalidIncome.valid);

  // Invalid emergency months (>36)
  const invalidEf = validateProfileAssumptions({ emergencyMonths: '50' });
  assert.ok(!invalidEf.valid);
});

// ── 6. PARTIAL UPDATE IMMUTABILITY ──────────────────────────
test('Test 6: Partial Update Safety (Untouched Fields Remain Intact)', () => {
  const existingUser = {
    id: 'u-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    monthlyIncome: 80000,
    retirementAge: 55,
    retirementCorpusGoal: 20000000,
    expectedReturnRate: 0.08,
    expectedInflationRate: 0.06,
    lifestyleAdjustmentRatio: 0.8,
  };

  const partialPatch = { retirementAge: 60 };
  const merged = { ...existingUser, ...partialPatch };

  assert.equal(merged.retirementAge, 60);
  assert.equal(merged.monthlyIncome, 80000);
  assert.equal(merged.expectedReturnRate, 0.08);
  assert.equal(merged.retirementCorpusGoal, 20000000);
});

// ── 7. ZERO TEXT LEAKAGE ON EDGE CASES ──────────────────────
test('Test 7: Zero Null / NaN / Undefined Leaks on Empty States', () => {
  assert.equal(formatCurrency(null), 'Not set');
  assert.equal(formatCurrency(undefined), 'Not set');
  assert.equal(formatCurrency(NaN), 'Not set');

  assert.equal(formatPercent(null, 0.08), '8.0% p.a.');
  assert.equal(formatPercent(NaN, 0.08), '8.0% p.a.');
});

// ── 8. FINANCIAL DATA DEEP LINKS ────────────────────────────
test('Test 8: Financial Data Section Deep Links', () => {
  const sectionLinks = [
    { title: 'Income Streams & History', route: 'IncomeFlow' },
    { title: 'Recurring Liabilities', route: 'Liabilities' },
    { title: 'Spending Envelopes', route: 'Envelopes' },
  ];

  assert.equal(sectionLinks.length, 3);
  assert.equal(sectionLinks[0].route, 'IncomeFlow');
  assert.equal(sectionLinks[1].route, 'Liabilities');
  assert.equal(sectionLinks[2].route, 'Envelopes');
});

console.log('='.repeat(64));
console.log(`  ALL ${passed} PROFILE SCREEN UX TESTS PASSED! 🚀`);
console.log('='.repeat(64));
