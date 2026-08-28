/**
 * client/test_feature_representation.js
 * 
 * Feature Representation & UI Mapping Test Suite
 * Verifies that all implemented capabilities have clear, robust, and accessible UI representations.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA FEATURE REPRESENTATION & UI MAPPING TEST SUITE');
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

const clientRoot = fs.existsSync(path.resolve('src/screens'))
  ? path.resolve('.')
  : path.resolve('client');

function readScreen(name) {
  return fs.readFileSync(path.join(clientRoot, 'src/screens', name), 'utf8');
}

// ── TEST 1: FMI Screen Feature Representation ────────────────
test('1. FmiScreen represents Score, 3 Pillars, Insights, and Factors', () => {
  const code = readScreen('FmiScreen.tsx');
  assert.ok(code.includes('Saving Discipline') || code.includes('D1'), 'Saving Discipline pillar represented');
  assert.ok(code.includes('Spending Control') || code.includes('D2'), 'Spending Control pillar represented');
  assert.ok(code.includes('Behavioral') || code.includes('D3'), 'Behavioral Risk pillar represented');
  assert.ok(code.includes('insights') || code.includes('factors'), 'Insights & factors represented');
});

// ── TEST 2: Transaction Entry Screen Feature Representation ──
test('2. TransactionEntryScreen represents ML suggestion, Confidence, Manual Override, and Type selection', () => {
  const code = readScreen('TransactionEntryScreen.tsx');
  assert.ok(code.includes('Need') && code.includes('Want') && code.includes('Investment'), 'All 3 types selectable');
  assert.ok(code.includes('Suggested') || code.includes('classifyExpense') || code.includes('confidenceScore'), 'ML classification suggestion represented');
  assert.ok(code.includes('needsReview') || code.includes('Review') || code.includes('Low Confidence'), 'Low confidence state handled');
  assert.ok(code.includes('liabilityId') || code.includes('Liability'), 'Optional liability linking represented');
});

// ── TEST 3: Income Flow Screen Feature Representation ────────
test('3. IncomeFlowScreen represents Multi-Source, Timeline, and Add Income', () => {
  const code = readScreen('IncomeFlowScreen.tsx');
  assert.ok(code.includes('timeline') || code.includes('Income Timeline') || code.includes('History'), 'Income timeline represented');
  assert.ok(code.includes('sources') || code.includes('Source Breakdown'), 'Multi-source breakdown represented');
  assert.ok(code.includes('addIncome') || code.includes('New Income') || code.includes('+ Add Income'), 'Add Income action represented');
});

// ── TEST 4: Liabilities Screen Feature Representation ────────
test('4. LiabilitiesScreen represents Schedules, Auto-Deduct, Mark-Paid, and Payment History', () => {
  const code = readScreen('LiabilitiesScreen.tsx');
  assert.ok(code.includes('autoDeduct') || code.includes('Auto Deduct'), 'Auto-Deduct feature represented');
  assert.ok(code.includes('nextDueDate') || code.includes('Due Date') || code.includes('Upcoming'), 'Due date schedule represented');
  assert.ok(code.includes('getLiabilityTransactions') || code.includes('Payment History'), 'Payment history represented');
});

// ── TEST 5: Profile Screen Feature Representation ────────────
test('5. ProfileScreen represents Editable Planning Assumptions and Personal Goals', () => {
  const code = readScreen('ProfileScreen.tsx');
  assert.ok(code.includes('monthlyIncome') || code.includes('Declared Monthly Income'), 'Declared income represented');
  assert.ok(code.includes('retirementAge') || code.includes('Retirement Age'), 'Retirement age represented');
  assert.ok(code.includes('expectedReturnRate') || code.includes('Expected Annual Return'), 'Return rate assumption represented');
  assert.ok(code.includes('expectedInflationRate') || code.includes('Expected Inflation Rate'), 'Inflation assumption represented');
  assert.ok(code.includes('expectedWithdrawalRate') || code.includes('Safe Withdrawal Rate'), 'Withdrawal assumption represented');
  assert.ok(code.includes('retirementCorpusGoal') || code.includes('Personal Corpus Goal'), 'Corpus goal represented');
});

// ── TEST 6: Financial Outlook Predictability & Monte Carlo ───
test('6. FinancialOutlookScreen represents Deterministic, Monte Carlo, and Percentiles', () => {
  const code = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(code.includes('probabilityFundedAtTargetAge') || code.includes('Modeled Probability') || code.includes('Funding Probability'), 'Headline probability represented');
  assert.ok(code.includes('corpusPercentiles') || code.includes('p50') || code.includes('Middle 50%'), 'Outcome percentiles represented');
  assert.ok(code.includes('fundedAge50') || code.includes('fundedAge75') || code.includes('Funded Age'), 'Funded ages represented');
  assert.ok(code.includes('estimatedFire') || code.includes('FIRE Target') || code.includes('FIRE Requirement'), 'FIRE target represented');
  assert.ok(code.includes('conservative') && code.includes('optimistic'), 'Scenario comparison represented');
});

// ── TEST 7: Prescriptive Solvers, Guardrails, and Step-Up ────
test('7. FinancialOutlookScreen represents Contribution Solver, Feasibility, Alternatives, and Step-Up', () => {
  const code = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(code.includes('contributionRecommendation') || code.includes('To Reach a 75%') || code.includes('recommendedMonthlyContribution'), 'Contribution recommendation represented');
  assert.ok(code.includes('feasibility') || code.includes('MANAGEABLE') || code.includes('AGGRESSIVE'), 'Feasibility badges represented');
  assert.ok(code.includes('retirementAlternatives') || code.includes('Timeline Alternatives') || code.includes('Retirement Age Alternatives'), 'Retirement alternatives represented');
  assert.ok(code.includes('STEP_UP') || code.includes('step-up') || code.includes('Step-up'), 'Step-Up contribution escalation represented');
});

// ── TEST 8: Proactive Guidance Representation ────────────────
test('8. Dashboard and Outlook represent Proactive Guidance contracts cleanly', () => {
  const dashCode = readScreen('DashboardScreen.tsx');
  assert.ok(dashCode.includes('smartAction') && dashCode.includes('proactiveGuidance'), 'Dashboard smartAction consumes proactiveGuidance');

  const foCode = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(foCode.includes('What You Can Do') && foCode.includes('proactiveGuidance'), 'Financial Outlook renders What You Can Do section');
});

// ── TEST 9: Financial Assets Representation ───────────────────
test('9. AssetsScreen and Profile represent financial asset holdings and FIRE treatment', () => {
  const assetCode = readScreen('AssetsScreen.tsx');
  assert.ok(assetCode.includes('Total Recorded Assets'), 'Total assets metric present');
  assert.ok(assetCode.includes('FIRE Corpus'), 'FIRE corpus metric present');
  assert.ok(assetCode.includes('Liquid Buffer'), 'Liquid buffer metric present');
  assert.ok(assetCode.includes('Fixed Deposit'), 'FD preset present');
  assert.ok(assetCode.includes('Mutual Fund'), 'Mutual Fund preset present');

  const profCode = readScreen('ProfileScreen.tsx');
  assert.ok(profCode.includes("navigate('Assets')"), 'Profile links to Assets screen');
});

// ── TEST 10: Interactive Step-Up Strategy Selector ────────────
test('10. FinancialOutlookScreen represents interactive Strategy Selector and Presets', () => {
  const foCode = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(foCode.includes('Investment Strategy'), 'Strategy selector present');
  assert.ok(foCode.includes('Constant SIP'), 'Constant SIP toggle present');
  assert.ok(foCode.includes('Step-Up SIP'), 'Step-Up SIP toggle present');
  assert.ok(foCode.includes('Annual Contribution Increase Rate'), 'Annual rate controls present');
  assert.ok(foCode.includes('Custom'), 'Custom rate input present');
});

console.log('='.repeat(64));
console.log(`  FEATURE REPRESENTATION SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);

