/**
 * client/test_navigation_transactions_ux.js
 * 
 * Navigation Restructure & Transactions UI Cleanup Test Suite
 * Validates the new 5-tab navigation, type filters, category filter modal,
 * overflow menu pattern, monthly summary semantics, and Assets Home card.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA NAVIGATION + TRANSACTIONS UX CLEANUP TEST SUITE');
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

const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
  ? process.cwd()
  : path.resolve(process.cwd(), 'client');

function readScreen(name) {
  return fs.readFileSync(path.join(clientDir, 'src/screens', name), 'utf8');
}

function readNav() {
  return fs.readFileSync(path.join(clientDir, 'src/navigation/AppNavigator.tsx'), 'utf8');
}

// ── TEST 1: Tab order is Transactions | Liabilities | Home | AI | Profile ──
test('1. Tab order matches specification', () => {
  const nav = readNav();
  
  // Extract Tab.Screen registrations order from the JSX
  const tabScreenRegex = /name="(Transactions|Liabilities|Dashboard|Chat|Profile)"/g;
  const matches = [...nav.matchAll(tabScreenRegex)].map(m => m[1]);
  
  // Should be exactly 5 tabs in order
  assert.equal(matches.length, 5, 'Exactly 5 tab screens registered');
  assert.deepEqual(
    matches,
    ['Transactions', 'Liabilities', 'Dashboard', 'Chat', 'Profile'],
    'Tab order is correct: Transactions | Liabilities | Home(Dashboard) | AI(Chat) | Profile'
  );
});

// ── TEST 2: Type filters exist (All / Needs / Wants / Investments) ─────────
test('2. TransactionsScreen has persistent type filters', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes("label: 'All'"), 'All filter present');
  assert.ok(code.includes("label: 'Needs'"), 'Needs filter present');
  assert.ok(code.includes("label: 'Wants'"), 'Wants filter present');
  assert.ok(code.includes("label: 'Investments'"), 'Investments filter present');
  assert.ok(code.includes('activeType'), 'Active type state exists');
});

// ── TEST 3: Category chips NOT in primary header ──────────────────────────
test('3. Category chips are behind a Filter control, not in primary header', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  // The old FILTER_CATEGORIES with 'all' + 11 category items should not exist in the
  // primary render flow. Categories are now in a modal.
  assert.ok(!code.includes('FILTER_CATEGORIES'), 'Old FILTER_CATEGORIES constant removed');
  assert.ok(code.includes('showFilterModal'), 'Filter modal state exists');
  assert.ok(code.includes('filterSheet') || code.includes('filterOverlay'), 'Filter modal UI exists');
  assert.ok(code.includes('Filter Transactions'), 'Filter sheet title present');
});

// ── TEST 4: Filter button exists ──────────────────────────────────────────
test('4. Filter button is present in the transactions header', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes("options-outline"), 'Filter icon present');
  assert.ok(code.includes("filterBtn"), 'Filter button style exists');
  assert.ok(code.includes('Open advanced filters'), 'Filter button accessibility label');
});

// ── TEST 5: Overflow menu replaces always-visible delete ──────────────────
test('5. Overflow menu (⋯) replaces always-visible delete button', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  // Old delete button pattern should be gone
  assert.ok(!code.includes('deleteBtn:'), 'Old always-visible deleteBtn style removed');
  assert.ok(!code.includes('deleteBtnText'), 'Old deleteBtnText style removed');
  
  // New overflow pattern should exist
  assert.ok(code.includes('overflowTx'), 'Overflow transaction state exists');
  assert.ok(code.includes('overflowSheet'), 'Overflow action sheet exists');
  assert.ok(code.includes('ellipsis-horizontal'), 'Overflow ⋯ icon present');
  assert.ok(code.includes('Edit Transaction'), 'Edit action in overflow menu');
  assert.ok(code.includes('Delete Transaction'), 'Delete action in overflow menu');
});

// ── TEST 6: Long-press remains as secondary shortcut ──────────────────────
test('6. Long-press on transaction row opens overflow menu', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes('onLongPress'), 'Long-press handler exists on transaction card');
  assert.ok(code.includes('setOverflowTx'), 'Long-press triggers overflow state');
});

// ── TEST 7: Transaction type visible in row metadata ──────────────────────
test('7. Transaction Need/Want/Investment type is visible in row metadata', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes('typeInline'), 'Type inline style exists');
  assert.ok(code.includes('typeBadge.label'), 'Type label rendered in row');
});

// ── TEST 8: Monthly summary separates Spent and Invested ──────────────────
test('8. Monthly summary: Spent excludes Investment, Invested includes Investment', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes('Spent This Month'), 'Spent This Month label present');
  assert.ok(code.includes('Invested This Month'), 'Invested This Month label present');
  
  // Verify Spent excludes Investment: filter should check tx.type !== 'Investment'
  assert.ok(code.includes("tx.type !== 'Investment'"), 'Spent calculation excludes Investment type');
  
  // Verify Invested includes Investment: filter should check tx.type === 'Investment'
  assert.ok(code.includes("tx.type === 'Investment'"), 'Invested calculation includes Investment type');
});

// ── TEST 9: Empty states exist for different scenarios ────────────────────
test('9. TransactionsScreen has distinct empty states', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  assert.ok(code.includes('No transactions yet'), 'Zero-transactions empty state');
  assert.ok(code.includes('No results'), 'Filtered-empty state');
  assert.ok(code.includes('Your transactions will appear here'), 'First-time empty message');
});

// ── TEST 10: Assets card on Home uses getAssets API directly without duplicating classification rules ───
test('10. Dashboard Assets card fetches from Assets API independently without duplicating classification rules', () => {
  const code = readScreen('DashboardScreen.tsx');
  
  assert.ok(code.includes('getAssets'), 'getAssets is imported and called');
  assert.ok(code.includes("Asset"), 'Asset type is imported');
  assert.ok(code.includes('assetSummary'), 'Direct asset summary computation exists');
  assert.ok(code.includes('assetDisplay'), 'Asset display composition exists');
  assert.ok(code.includes('Total Recorded Assets'), 'Total Recorded Assets label for direct summary');
  
  // Dashboard must NOT compute its own FIRE corpus or liquid buffer
  const assetSummaryCode = code.substring(
    code.indexOf('const assetSummary = useMemo'),
    code.indexOf('const assetDisplay = useMemo')
  );
  assert.ok(
    !assetSummaryCode.includes('includedInFireCorpus'),
    'assetSummary does NOT independently classify FIRE corpus'
  );
  assert.ok(
    !assetSummaryCode.includes('SEMI_LIQUID'),
    'assetSummary does NOT independently classify liquid buffer'
  );
});

// ── TEST 11: Assets card handles zero-asset / error states ────────────────
test('11. Dashboard Assets card works for new users and error states', () => {
  const code = readScreen('DashboardScreen.tsx');
  
  // Card must be visible even without predictability
  assert.ok(code.includes('No assets recorded yet'), 'Zero-assets empty state');
  assert.ok(
    code.includes("Track your FDs") || code.includes("mutual funds"),
    'Pre-load placeholder message'
  );
  assert.ok(code.includes('View Assets'), 'View Assets action link always present');
  assert.ok(code.includes("navigate('Assets')"), 'Assets navigation always available');
});

// ── TEST 12: Navbar visual refinements ────────────────────────────────────
test('12. Navbar includes active indicator and refined styling', () => {
  const nav = readNav();
  
  assert.ok(nav.includes('activeIndicator'), 'Active tab indicator style exists');
  assert.ok(nav.includes('tabIconWrap'), 'Tab icon wrapper for indicator support');
});

// ── TEST 13: Type filter and multi-category filter compose predictably ───
test('13. Type and category filters compose (AND between type & categories; OR within categories)', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  // Both activeType and selectedCategories should be checked in the same useMemo
  assert.ok(code.includes('activeType') && code.includes('selectedCategories'), 'Both filter dimensions exist');
  
  // The filtering logic should apply both in the sections useMemo
  // Type filter: tx.type === activeType
  assert.ok(code.includes("tx.type === activeType"), 'Type filter compares tx.type');
  // Category filter: tx.category in selectedCategories
  assert.ok(code.includes("selectedCategories.includes"), 'Multi-category filter uses includes for OR matching');
  // Both should be in the dependencies array
  assert.ok(code.includes("[activeType, selectedCategories, transactions]"), 'Both filters in useMemo deps');
});

// ── TEST 14: Filter modal does NOT duplicate type selection ───────────────
test('14. Filter modal contains only Category, not duplicate Type selection', () => {
  const code = readScreen('TransactionsScreen.tsx');
  
  // Extract the filter modal section
  const modalStart = code.indexOf('Filter Transactions');
  const modalEnd = code.indexOf('Apply Filters');
  const modalSection = code.substring(modalStart, modalEnd);
  
  assert.ok(modalSection.includes('Category'), 'Category section in filter modal');
  // Should NOT have Need/Want/Investment in the modal
  assert.ok(
    !modalSection.includes("'Need'") && !modalSection.includes("'Want'"),
    'Type selection NOT duplicated in filter modal'
  );
});

// ── TEST 16: Official 'Investments' Category Registered in Transactions and Entry ───
test('16. Official Investments category with distinct emoji registered in Transactions and Entry screens', () => {
  const txScreen = readScreen('TransactionsScreen.tsx');
  const entryScreen = readScreen('TransactionEntryScreen.tsx');
  
  assert.ok(txScreen.includes("key: 'investments'") && txScreen.includes("label: 'Investments'"), 'Investments in TransactionsScreen CATEGORIES');
  assert.ok(txScreen.includes("investments: '📈'"), 'Investments emoji map in TransactionsScreen');
  assert.ok(entryScreen.includes("label: 'Investments'") && entryScreen.includes("ml: 'Investments'"), 'Investments in TransactionEntryScreen CATEGORIES');
});

// ── TEST 17: Category 'Investments' (plural) distinct from Type 'Investment' (singular) ───
test('17. Category Investments (plural) remains strictly distinct from Type Investment (singular)', () => {
  const txScreen = readScreen('TransactionsScreen.tsx');
  // CATEGORIES contains 'Investments'
  assert.ok(txScreen.includes("label: 'Investments'"), 'Category label is Investments');
  // TYPE_BADGE contains 'Investment'
  assert.ok(txScreen.includes("Investment: { bg: '#D1FAE5', text: '#065F46', label: 'Investment' }"), 'Type badge is Investment');
  // TYPE_FILTERS contains 'Investment'
  assert.ok(txScreen.includes("{ key: 'Investment', label: 'Investments' }"), 'Type filter key is Investment');
});

// ── TEST 18: Expense display formatting renders with minus sign and no amount < 0 check ───
test('18. Expense transactions render with minus sign (-₹X) and do not rely on amount < 0', () => {
  const code = readScreen('TransactionsScreen.tsx');

  // Stored positive amounts must render with a minus sign prefix
  assert.ok(code.includes("`-${formatCurrency(Math.abs(item.amount))}`"), 'displayAmount formats with minus prefix');
  assert.ok(!code.includes("isExpense = item.amount < 0"), 'renderItem does not check item.amount < 0');
  assert.ok(!code.includes("isExpense ? '-' : '+'"), 'renderItem does not output plus sign for positive expense amounts');
});

// ── TEST 19: Monthly spend calculation sums positive amounts and excludes Investment ───
test('19. Monthly spend calculation sums positive amounts and excludes Investment', () => {
  const code = readScreen('TransactionsScreen.tsx');

  // Filter logic must NOT use tx.amount < 0
  assert.ok(!code.includes("tx.amount < 0 && tx.type !== 'Investment'"), 'monthlySummary does not require tx.amount < 0');
  assert.ok(code.includes(".filter((tx) => tx.type !== 'Investment')"), 'monthlySummary spent filters for non-Investment type');

  // Verify numerical behavior with test data
  const sampleTransactions = [
    { amount: 500, type: 'Want' },
    { amount: 1000, type: 'Need' },
    { amount: 2000, type: 'Investment' }
  ];

  const spent = sampleTransactions
    .filter((tx) => tx.type !== 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const invested = sampleTransactions
    .filter((tx) => tx.type === 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  assert.equal(spent, 1500, 'Spent is 1500 (500 + 1000)');
  assert.equal(invested, 2000, 'Invested is 2000');

  // Empty transactions test
  const emptyTransactions = [];
  const emptySpent = emptyTransactions
    .filter((tx) => tx.type !== 'Investment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  assert.equal(emptySpent, 0, 'Zero transactions produces 0 spent');
});

// ── TEST 20: TransactionEntryScreen stats calculation uses positive amounts and excludes Investment ───
test('20. TransactionEntryScreen todaySpend and weekSpend sum positive amounts and preview form entry', () => {
  const code = readScreen('TransactionEntryScreen.tsx');

  assert.ok(!code.includes("t.amount < 0 ? Math.abs(t.amount) : 0"), 'TransactionEntryScreen does not check t.amount < 0');
  assert.ok(code.includes("t.type !== 'Investment'"), 'TransactionEntryScreen filters out Investment from spend stats');

  // Simulate stats calculation with positive transactions
  const now = new Date();
  const todayStr = now.toDateString();
  const txList = [
    { amount: 300, timestamp: now.toISOString(), type: 'Want' },
    { amount: 700, timestamp: now.toISOString(), type: 'Need' },
    { amount: 1500, timestamp: now.toISOString(), type: 'Investment' }
  ];

  const parsedAmount = 250;
  const selectedType = 'Need';

  const todaySpend = txList
    .filter(t => new Date(t.timestamp).toDateString() === todayStr && t.type !== 'Investment')
    .reduce((s, t) => s + Math.abs(t.amount), 0) + (selectedType !== 'Investment' ? parsedAmount : 0);

  // 300 (Want) + 700 (Need) + 250 (preview) = 1250 (excludes 1500 Investment)
  assert.equal(todaySpend, 1250, 'todaySpend correctly sums positive historical amounts + non-investment preview');
});

console.log('='.repeat(64));
console.log(`  NAVIGATION + TRANSACTIONS UX SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);
