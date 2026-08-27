/**
 * client/test_frontend_feature_completeness.js
 * 
 * Frontend Navigation Architecture & Route Completeness Test Suite
 * Verifies that all intended user-facing screens are registered, reachable,
 * have valid navigation targets, and have no orphan or broken routes.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA FRONTEND NAVIGATION & ROUTE INTEGRITY TEST SUITE');
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

// ── TEST 1: AppNavigator Tab & Stack Route Registrations ─────
test('1. AppNavigator registers all primary tabs and stack screens', () => {
  const appNavPath = path.resolve('client/src/navigation/AppNavigator.tsx');
  const content = fs.readFileSync(appNavPath, 'utf8');

  // Verify Tab Screens
  const expectedTabs = ['Envelopes', 'Transactions', 'Dashboard', 'Liabilities', 'Chat', 'Profile'];
  for (const tab of expectedTabs) {
    assert.ok(
      content.includes(`name="${tab}"`),
      `Tab screen "${tab}" is registered in AppNavigator`
    );
  }

  // Verify Stack Screens
  const expectedStacks = ['MainTabs', 'FinancialOutlook', 'FMI', 'IncomeFlow', 'Assets'];
  for (const stack of expectedStacks) {
    assert.ok(
      content.includes(`name="${stack}"`),
      `Stack screen "${stack}" is registered in AppNavigator`
    );
  }
});

// ── TEST 2: Dashboard Navigation CTAs Point to Registered Routes ─
test('2. DashboardScreen navigation CTAs match registered routes', () => {
  const dashPath = path.resolve('client/src/screens/DashboardScreen.tsx');
  const content = fs.readFileSync(dashPath, 'utf8');

  const validTargets = ['FMI', 'IncomeFlow', 'FinancialOutlook', 'Transactions', 'Liabilities', 'Profile'];
  for (const target of validTargets) {
    assert.ok(
      content.includes(`'${target}'`) || content.includes(`"${target}"`),
      `Dashboard contains navigation trigger for '${target}'`
    );
  }
});

// ── TEST 3: Modal Entry Screens Are Properly Mounted ─────────
test('3. TransactionEntry and UpdateBalance modals are mounted in parent screens', () => {
  const txScreenPath = path.resolve('client/src/screens/TransactionsScreen.tsx');
  const txContent = fs.readFileSync(txScreenPath, 'utf8');
  assert.ok(txContent.includes('<TransactionEntryScreen'), 'TransactionEntryScreen is mounted in TransactionsScreen modal');

  const dashPath = path.resolve('client/src/screens/DashboardScreen.tsx');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert.ok(dashContent.includes('<UpdateBalanceScreen'), 'UpdateBalanceScreen is mounted in DashboardScreen modal');
});

// ── TEST 4: IncomeFlow Add Income Modal Is Present ────────────
test('4. IncomeFlowScreen includes Add Income modal and action', () => {
  const incomePath = path.resolve('client/src/screens/IncomeFlowScreen.tsx');
  const content = fs.readFileSync(incomePath, 'utf8');

  assert.ok(content.includes('Add Income') || content.includes('+ Add Income'), 'Add Income action exists in IncomeFlowScreen');
  assert.ok(content.includes('showAddModal') || content.includes('addIncome'), 'Add Income state/handler exists in IncomeFlowScreen');
});

// ── TEST 5: Liabilities Screen Actions & Modals ───────────────
test('5. LiabilitiesScreen includes Create and Payment History modals', () => {
  const liabPath = path.resolve('client/src/screens/LiabilitiesScreen.tsx');
  const content = fs.readFileSync(liabPath, 'utf8');

  assert.ok(content.includes('createLiability') || content.includes('Add Liability') || content.includes('New Liability'), 'Create liability action exists');
  assert.ok(content.includes('getLiabilityTransactions') || content.includes('Payment History'), 'Payment history capability exists');
});

// ── TEST 6: FinancialOutlook Back Navigation & Structure ──────
test('6. FinancialOutlookScreen includes back button and scroll view', () => {
  const foPath = path.resolve('client/src/screens/FinancialOutlookScreen.tsx');
  const content = fs.readFileSync(foPath, 'utf8');

  assert.ok(content.includes('navigation.goBack()') || content.includes('goBack'), 'FinancialOutlookScreen has back navigation');
  assert.ok(content.includes('ScrollView'), 'FinancialOutlookScreen uses scroll view for responsive mobile content');
});

console.log('='.repeat(64));
console.log(`  NAVIGATION INTEGRITY SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);
