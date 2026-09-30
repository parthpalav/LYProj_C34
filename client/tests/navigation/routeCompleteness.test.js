/**
 * client/tests/navigation/routeCompleteness.test.js
 * 
 * Consolidated Frontend Navigation & Feature Representation Test Suite.
 * Combines UI feature representation checks and navigation architecture/route completeness audits.
 * 
 * Preserves all 22 checks from:
 *  - client/test_feature_representation.js (10 tests)
 *  - client/test_frontend_feature_completeness.js (12 tests)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '../..');

console.log('='.repeat(64));
console.log('  FINAURA ROUTE COMPLETENESS & FEATURE REPRESENTATION SUITE');
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

function readClientFile(relPath) {
  return fs.readFileSync(path.join(clientRoot, relPath), 'utf8');
}

function readScreen(name) {
  return fs.readFileSync(path.join(clientRoot, 'src/screens', name), 'utf8');
}

// ============================================================
// PART A: FEATURE REPRESENTATION & UI MAPPING (10 TESTS)
// ============================================================

test('Feature Representation 1: FmiScreen represents Score, 3 Pillars, Insights, and Factors', () => {
  const code = readScreen('FMIScreen.tsx');
  assert.ok(code.includes('Saving Discipline') || code.includes('D1'), 'Saving Discipline pillar represented');
  assert.ok(code.includes('Spending Control') || code.includes('D2'), 'Spending Control pillar represented');
  assert.ok(code.includes('Behavioral') || code.includes('D3'), 'Behavioral Risk pillar represented');
  assert.ok(code.includes('insights') || code.includes('factors'), 'Insights & factors represented');
});

test('Feature Representation 2: TransactionEntryScreen represents ML suggestion, Confidence, Manual Override, and Type selection', () => {
  const code = readScreen('TransactionEntryScreen.tsx');
  assert.ok(code.includes('Need') && code.includes('Want') && code.includes('Investment'), 'All 3 types selectable');
  assert.ok(code.includes('Suggested') || code.includes('classifyExpense') || code.includes('confidenceScore'), 'ML classification suggestion represented');
  assert.ok(code.includes('needsReview') || code.includes('Review') || code.includes('Low Confidence'), 'Low confidence state handled');
  assert.ok(code.includes('liabilityId') || code.includes('Liability'), 'Optional liability linking represented');
});

test('Feature Representation 3: IncomeFlowScreen represents Multi-Source, Timeline, and Add Income', () => {
  const code = readScreen('IncomeFlowScreen.tsx');
  assert.ok(code.includes('timeline') || code.includes('Income Timeline') || code.includes('History'), 'Income timeline represented');
  assert.ok(code.includes('sources') || code.includes('Source Breakdown'), 'Multi-source breakdown represented');
  assert.ok(code.includes('addIncome') || code.includes('New Income') || code.includes('+ Add Income'), 'Add Income action represented');
});

test('Feature Representation 4: LiabilitiesScreen represents Schedules, Auto-Deduct, Mark-Paid, and Payment History', () => {
  const code = readScreen('LiabilitiesScreen.tsx');
  assert.ok(code.includes('autoDeduct') || code.includes('Auto Deduct'), 'Auto-Deduct feature represented');
  assert.ok(code.includes('nextDueDate') || code.includes('Due Date') || code.includes('Upcoming'), 'Due date schedule represented');
  assert.ok(code.includes('getLiabilityTransactions') || code.includes('Payment History'), 'Payment history represented');
});

test('Feature Representation 5: ProfileScreen represents Editable Planning Assumptions and Personal Goals', () => {
  const code = readScreen('ProfileScreen.tsx');
  assert.ok(code.includes('monthlyIncome') || code.includes('Declared Monthly Income'), 'Declared income represented');
  assert.ok(code.includes('retirementAge') || code.includes('Retirement Age'), 'Retirement age represented');
  assert.ok(code.includes('expectedReturnRate') || code.includes('Expected Annual Return'), 'Return rate assumption represented');
  assert.ok(code.includes('expectedInflationRate') || code.includes('Expected Inflation Rate'), 'Inflation assumption represented');
  assert.ok(code.includes('expectedWithdrawalRate') || code.includes('Safe Withdrawal Rate'), 'Withdrawal assumption represented');
  assert.ok(code.includes('retirementCorpusGoal') || code.includes('Personal Corpus Goal'), 'Corpus goal represented');
});

test('Feature Representation 6: FinancialOutlookScreen represents Deterministic, Monte Carlo, and Percentiles', () => {
  const code = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(code.includes('probabilityFundedAtTargetAge') || code.includes('Modeled Probability') || code.includes('Funding Probability'), 'Headline probability represented');
  assert.ok(code.includes('corpusPercentiles') || code.includes('p50') || code.includes('Middle 50%'), 'Outcome percentiles represented');
  assert.ok(code.includes('fundedAge50') || code.includes('fundedAge75') || code.includes('Funded Age'), 'Funded ages represented');
  assert.ok(code.includes('estimatedFire') || code.includes('FIRE Target') || code.includes('FIRE Requirement'), 'FIRE target represented');
  assert.ok(code.includes('conservative') && code.includes('optimistic'), 'Scenario comparison represented');
});

test('Feature Representation 7: FinancialOutlookScreen represents Contribution Solver, Feasibility, Alternatives, and Step-Up', () => {
  const code = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(code.includes('contributionRecommendation') || code.includes('To Reach a 75%') || code.includes('recommendedMonthlyContribution'), 'Contribution recommendation represented');
  assert.ok(code.includes('feasibility') || code.includes('MANAGEABLE') || code.includes('AGGRESSIVE'), 'Feasibility badges represented');
  assert.ok(code.includes('retirementAlternatives') || code.includes('Timeline Alternatives') || code.includes('Retirement Age Alternatives'), 'Retirement alternatives represented');
  assert.ok(code.includes('STEP_UP') || code.includes('step-up') || code.includes('Step-up'), 'Step-Up contribution escalation represented');
});

test('Feature Representation 8: Dashboard and Outlook represent Proactive Guidance contracts cleanly', () => {
  const dashCode = readScreen('DashboardScreen.tsx');
  assert.ok(dashCode.includes('smartAction') && dashCode.includes('proactiveGuidance'), 'Dashboard smartAction consumes proactiveGuidance');

  const foCode = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(foCode.includes('What You Can Do') && foCode.includes('proactiveGuidance'), 'Financial Outlook renders What You Can Do section');
});

test('Feature Representation 9: AssetsScreen and Profile represent financial asset holdings and FIRE treatment', () => {
  const assetCode = readScreen('AssetsScreen.tsx');
  assert.ok(assetCode.includes('Total Recorded Assets'), 'Total assets metric present');
  assert.ok(assetCode.includes('FIRE Corpus'), 'FIRE corpus metric present');
  assert.ok(assetCode.includes('Liquid Buffer'), 'Liquid buffer metric present');
  assert.ok(assetCode.includes('Fixed Deposit'), 'FD preset present');
  assert.ok(assetCode.includes('Mutual Fund'), 'Mutual Fund preset present');

  const profCode = readScreen('ProfileScreen.tsx');
  assert.ok(profCode.includes("navigate('Assets')"), 'Profile links to Assets screen');
});

test('Feature Representation 10: FinancialOutlookScreen represents interactive Strategy Selector and Presets', () => {
  const foCode = readScreen('FinancialOutlookScreen.tsx');
  assert.ok(foCode.includes('Investment Strategy'), 'Strategy selector present');
  assert.ok(foCode.includes('Constant SIP'), 'Constant SIP toggle present');
  assert.ok(foCode.includes('Step-Up SIP'), 'Step-Up SIP toggle present');
  assert.ok(foCode.includes('Annual Contribution Increase Rate'), 'Annual rate controls present');
  assert.ok(foCode.includes('Custom'), 'Custom rate input present');
});

// ============================================================
// PART B: ROUTE INTEGRITY & NAVIGATION ARCHITECTURE (12 TESTS)
// ============================================================

test('Route Integrity 1: AppNavigator registers all primary tabs and stack screens', () => {
  const content = readClientFile('src/navigation/AppNavigator.tsx');

  const expectedTabs = ['Transactions', 'Dashboard', 'Liabilities', 'Chat', 'Profile'];
  for (const tab of expectedTabs) {
    assert.ok(
      content.includes(`name="${tab}"`),
      `Tab screen "${tab}" is registered in AppNavigator`
    );
  }

  const expectedStacks = ['MainTabs', 'FinancialOutlook', 'FMI', 'IncomeFlow', 'Assets', 'Family'];
  for (const stack of expectedStacks) {
    assert.ok(
      content.includes(`name="${stack}"`),
      `Stack screen "${stack}" is registered in AppNavigator`
    );
  }
});

test('Route Integrity 2: Envelopes is NOT a primary tab destination', () => {
  const content = readClientFile('src/navigation/AppNavigator.tsx');

  assert.ok(
    !content.includes('name="Envelopes"'),
    'Envelopes is NOT registered as a tab screen'
  );

  assert.ok(
    !content.includes('Envelopes: undefined'),
    'Envelopes is NOT in RootTabParamList'
  );
});

test('Route Integrity 3: Chat remains available in primary navigation', () => {
  const content = readClientFile('src/navigation/AppNavigator.tsx');

  assert.ok(
    content.includes('name="Chat"'),
    'Chat is registered as a tab screen'
  );
  assert.ok(
    content.includes('ChatScreen'),
    'ChatScreen component is imported and used'
  );
});

test('Route Integrity 4: Assets can be reached directly from Home (Dashboard)', () => {
  const content = readClientFile('src/screens/DashboardScreen.tsx');

  assert.ok(
    content.includes("navigate('Assets')"),
    'Dashboard has direct navigation to Assets screen'
  );
  assert.ok(
    content.includes('Financial Assets'),
    'Dashboard includes Financial Assets card'
  );
});

test('Route Integrity 5: Profile → Assets link is preserved', () => {
  const content = readClientFile('src/screens/ProfileScreen.tsx');

  assert.ok(
    content.includes("navigate('Assets')"),
    'Profile still links to Assets screen'
  );
});

test('Route Integrity 6: Profile does NOT link to Envelopes', () => {
  const content = readClientFile('src/screens/ProfileScreen.tsx');

  assert.ok(
    !content.includes("navigate('Envelopes')"),
    'Profile does NOT navigate to Envelopes'
  );
});

test('Route Integrity 7: DashboardScreen navigation CTAs match registered routes', () => {
  const content = readClientFile('src/screens/DashboardScreen.tsx');

  const validTargets = ['FMI', 'IncomeFlow', 'FinancialOutlook', 'Transactions', 'Liabilities', 'Profile', 'Assets'];
  for (const target of validTargets) {
    assert.ok(
      content.includes(`'${target}'`) || content.includes(`"${target}"`),
      `Dashboard contains navigation trigger for '${target}'`
    );
  }
});

test('Route Integrity 8: TransactionEntry and UpdateBalance modals are mounted in parent screens', () => {
  const txContent = readClientFile('src/screens/TransactionsScreen.tsx');
  assert.ok(txContent.includes('<TransactionEntryScreen'), 'TransactionEntryScreen is mounted in TransactionsScreen modal');

  const dashContent = readClientFile('src/screens/DashboardScreen.tsx');
  assert.ok(dashContent.includes('<UpdateBalanceScreen'), 'UpdateBalanceScreen is mounted in DashboardScreen modal');
});

test('Route Integrity 9: IncomeFlowScreen includes Add Income modal and action', () => {
  const content = readClientFile('src/screens/IncomeFlowScreen.tsx');

  assert.ok(content.includes('Add Income') || content.includes('+ Add Income'), 'Add Income action exists in IncomeFlowScreen');
  assert.ok(content.includes('showAddModal') || content.includes('addIncome'), 'Add Income state/handler exists in IncomeFlowScreen');
});

test('Route Integrity 10: LiabilitiesScreen includes Create and Payment History modals', () => {
  const content = readClientFile('src/screens/LiabilitiesScreen.tsx');

  assert.ok(content.includes('createLiability') || content.includes('Add Liability') || content.includes('New Liability'), 'Create liability action exists');
  assert.ok(content.includes('getLiabilityTransactions') || content.includes('Payment History'), 'Payment history capability exists');
});

test('Route Integrity 11: FinancialOutlookScreen Manage Assets link is preserved', () => {
  const content = readClientFile('src/screens/FinancialOutlookScreen.tsx');

  assert.ok(
    content.includes("navigate('Assets')"),
    'Financial Outlook still has Manage Assets navigation'
  );
  assert.ok(content.includes('Manage Assets'), 'Manage Assets label exists');
});

test('Route Integrity 12: FinancialOutlookScreen includes back button and scroll view', () => {
  const content = readClientFile('src/screens/FinancialOutlookScreen.tsx');

  assert.ok(content.includes('navigation.goBack()') || content.includes('goBack'), 'FinancialOutlookScreen has back navigation');
  assert.ok(content.includes('ScrollView'), 'FinancialOutlookScreen uses scroll view for responsive mobile content');
});

// ── Execution Summary ───────────────────────────────────────
console.log('='.repeat(64));
if (failed === 0) {
  console.log(`  ALL ${passed} ROUTE COMPLETENESS & FEATURE TESTS PASSED 🚀`);
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log('='.repeat(64));

if (failed > 0) {
  process.exit(1);
}
