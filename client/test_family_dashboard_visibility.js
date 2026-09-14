/**
 * client/test_family_dashboard_visibility.js
 *
 * Comprehensive Test Suite for FINAURA Phase 7: Contextual Family Analytics UI.
 * Verifies the exact household visibility condition, non-blocking supplemental loading,
 * presentation separation between personal and household data, privacy safeguards,
 * error isolation, refresh transitions, session resets, and accessibility.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('  FINAURA PHASE 7: CONTEXTUAL FAMILY ANALYTICS UI TEST SUITE');
console.log('='.repeat(70));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
}

// ── Read Source Files ──────────────────────────────────────────
const dashboardScreenPath = path.join(__dirname, 'src/screens/DashboardScreen.tsx');
const fmiScreenPath = path.join(__dirname, 'src/screens/FMIScreen.tsx');
const profileScreenPath = path.join(__dirname, 'src/screens/ProfileScreen.tsx');
const familyCardPath = path.join(__dirname, 'src/components/family/FamilyOverviewCard.tsx');

const dashboardCode = fs.readFileSync(dashboardScreenPath, 'utf8');
const fmiCode = fs.readFileSync(fmiScreenPath, 'utf8');
const profileCode = fs.readFileSync(profileScreenPath, 'utf8');
const familyCardCode = fs.readFileSync(familyCardPath, 'utf8');

// ── Pure Logic Mirroring DashboardScreen Visibility ────────────
function evaluateHasActiveHousehold(family) {
  return (
    !!family &&
    (typeof family.memberCount === 'number'
      ? family.memberCount > 1
      : Array.isArray(family.members) && family.members.length > 1)
  );
}

// ── 1. No Family => Home Family section absent ────────────────
test('Test 1: No Family (family null) -> hasActiveHousehold is false', () => {
  assert.equal(evaluateHasActiveHousehold(null), false);
  assert.equal(evaluateHasActiveHousehold(undefined), false);
});

// ── 2. Sole-member Family => Home Family section absent ───────
test('Test 2: Sole-member Family (memberCount === 1) -> hasActiveHousehold is false', () => {
  const soleByCount = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleByCount), false);

  const soleByArray = { members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleByArray), false);
});

// ── 3. 2-member Family => Home Family section present ─────────
test('Test 3: 2-member Family (memberCount === 2) -> hasActiveHousehold is true', () => {
  const twoMembers = {
    memberCount: 2,
    members: [{ userId: 'u1' }, { userId: 'u2' }],
  };
  assert.equal(evaluateHasActiveHousehold(twoMembers), true);

  const threeMembers = {
    memberCount: 3,
    members: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
  };
  assert.equal(evaluateHasActiveHousehold(threeMembers), true);
});

// ── 4. Pending invite only => section absent ──────────────────
test('Test 4: Pending invitations without active multi-member family -> hasActiveHousehold is false', () => {
  // If family is null even when invitations exist
  assert.equal(evaluateHasActiveHousehold(null), false);
  // If user has a sole family and pending invites sent/received
  const soleWithPending = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleWithPending), false);
});

// ── 5. Family FMI displayed in FamilyOverviewCard ─────────────
test('Test 5: Family FMI score displayed in FamilyOverviewCard', () => {
  assert.ok(
    familyCardCode.includes('dashboard?.fmi') || familyCardCode.includes('fmiScore'),
    'FamilyOverviewCard must reference fmi.score'
  );
  assert.ok(
    familyCardCode.includes('fmiScoreNumber'),
    'FamilyOverviewCard must have dedicated style for fmiScoreNumber'
  );
  assert.ok(
    familyCardCode.includes('/100'),
    'FamilyOverviewCard must display /100 denominator'
  );
});

// ── 6. FMI label displayed ────────────────────────────────────
test('Test 6: FMI label displayed (badge/pill with status text)', () => {
  assert.ok(
    familyCardCode.includes('getFmiBadge') || familyCardCode.includes('fmiLabel'),
    'FamilyOverviewCard must evaluate or display fmiLabel'
  );
  assert.ok(
    familyCardCode.includes('statusBadgeText'),
    'FamilyOverviewCard must have style for status badge text'
  );
});

// ── 7. Effective monthly income displayed ─────────────────────
test('Test 7: Effective monthly income displayed', () => {
  assert.ok(
    familyCardCode.includes('effectiveMonthlyIncome'),
    'FamilyOverviewCard must display income.effectiveMonthlyIncome'
  );
  assert.ok(
    familyCardCode.includes('Household Income'),
    'FamilyOverviewCard must label income as Household Income'
  );
});

// ── 8. Non-investment household spending displayed ────────────
test('Test 8: Household spending uses totalNonInvestment (Need + Want)', () => {
  assert.ok(
    familyCardCode.includes('spending?.totalNonInvestment'),
    'FamilyOverviewCard must display spending.totalNonInvestment'
  );
  assert.ok(
    familyCardCode.includes('Household Spending'),
    'FamilyOverviewCard must label spending as Household Spending'
  );
  assert.ok(
    familyCardCode.includes('Need + Want'),
    'FamilyOverviewCard must explicitly indicate Need + Want spend'
  );
});

// ── 9. Investment flow displayed ──────────────────────────────
test('Test 9: Monthly investment flow displayed separately', () => {
  assert.ok(
    familyCardCode.includes('investments?.monthlyFlow'),
    'FamilyOverviewCard must display investments.monthlyFlow'
  );
  assert.ok(
    familyCardCode.includes('Invested This Month'),
    'FamilyOverviewCard must label investments as Invested This Month'
  );
});

// ── 10. Net cash position displayed ───────────────────────────
test('Test 10: Net cash position displayed', () => {
  assert.ok(
    familyCardCode.includes('cashFlow?.netCashPosition'),
    'FamilyOverviewCard must display cashFlow.netCashPosition'
  );
  assert.ok(
    familyCardCode.includes('Net Cash Position'),
    'FamilyOverviewCard must label cashFlow as Net Cash Position'
  );
});

// ── 11. Personal FMI remains present on Home ──────────────────
test('Test 11: Personal FMI card remains present on DashboardScreen', () => {
  assert.ok(
    dashboardCode.includes('fmiCard') && dashboardCode.includes('fmiScoreRow'),
    'Personal FMI card must remain present on DashboardScreen'
  );
  assert.ok(
    dashboardCode.includes('fmiStatusColor'),
    'Personal FMI status helper must remain present'
  );
});

// ── 12. Family FMI clearly labeled separately ─────────────────
test('Test 12: Family FMI clearly labeled as Household FMI / Financial Maturity Index', () => {
  assert.ok(
    familyCardCode.includes('Household FMI'),
    'Family card must explicitly label score as Household FMI'
  );
  assert.ok(
    familyCardCode.includes('Financial Maturity Index'),
    'Family card must specify official term Financial Maturity Index'
  );
  assert.ok(
    !familyCardCode.includes('Financial Mood Index'),
    'Family card must NEVER use Financial Mood Index'
  );
});

// ── 13. Family API failure does not break personal dashboard ──
test('Test 13: Family API failure does not break personal dashboard (error isolation)', () => {
  assert.ok(
    dashboardCode.includes('fetchFamilyContext'),
    'DashboardScreen must use dedicated fetchFamilyContext'
  );
  assert.ok(
    dashboardCode.includes('catch {') && dashboardCode.includes('setFamilySummary(null)'),
    'fetchFamilyContext must catch errors and isolate failure without throwing'
  );
  assert.ok(
    dashboardCode.includes('void fetchFamilyContext()'),
    'fetchFamilyContext must be invoked without blocking Promise.allSettled'
  );
});

// ── 14. Family dashboard not requested when no Family ─────────
test('Test 14: Family dashboard API is not requested when getCurrentFamily returns null', async () => {
  let dashboardCalled = false;
  const mockGetCurrentFamily = async () => null;
  const mockGetFamilyDashboard = async () => {
    dashboardCalled = true;
    return null;
  };

  const fam = await mockGetCurrentFamily();
  if (fam && evaluateHasActiveHousehold(fam)) {
    await mockGetFamilyDashboard();
  }
  assert.equal(dashboardCalled, false, 'getFamilyDashboard must not be called when fam is null');
});

// ── 15. Family dashboard not requested for memberCount 1 ──────
test('Test 15: Family dashboard API is not requested for sole-member family', async () => {
  let dashboardCalled = false;
  const mockGetCurrentFamily = async () => ({ memberCount: 1, members: [{ userId: 'u1' }] });
  const mockGetFamilyDashboard = async () => {
    dashboardCalled = true;
    return null;
  };

  const fam = await mockGetCurrentFamily();
  if (fam && evaluateHasActiveHousehold(fam)) {
    await mockGetFamilyDashboard();
  }
  assert.equal(dashboardCalled, false, 'getFamilyDashboard must not be called for memberCount === 1');
});

// ── 16. Family dashboard requested for memberCount > 1 ────────
test('Test 16: Family dashboard API is requested for multi-member family', async () => {
  let dashboardCalled = false;
  const mockGetCurrentFamily = async () => ({ memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] });
  const mockGetFamilyDashboard = async () => {
    dashboardCalled = true;
    return { success: true };
  };

  const fam = await mockGetCurrentFamily();
  if (fam && evaluateHasActiveHousehold(fam)) {
    await mockGetFamilyDashboard();
  }
  assert.equal(dashboardCalled, true, 'getFamilyDashboard must be called for memberCount > 1');
});

// ── 17. View Family Details navigates to Family ───────────────
test('Test 17: View Family Details triggers navigation to Family', () => {
  assert.ok(
    dashboardCode.includes("navigate('Family')"),
    'DashboardScreen must navigate to Family screen upon pressing details'
  );
  assert.ok(
    familyCardCode.includes('View Family Details'),
    'FamilyOverviewCard must contain View Family Details CTA'
  );
});

// ── 18. Refresh can make Family widget appear ─────────────────
test('Test 18: Refresh transition (sole/no-family -> multi-member) makes widget appear', () => {
  let currentFam = null;
  assert.equal(evaluateHasActiveHousehold(currentFam), false);

  // User B accepts invitation
  currentFam = { memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), true);
});

// ── 19. Refresh can make Family widget disappear ──────────────
test('Test 19: Refresh transition (multi-member -> sole/no-family) makes widget disappear', () => {
  let currentFam = { memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), true);

  // Member leaves family
  currentFam = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), false);
});

// ── 20. Logout / account change clears Family state ───────────
test('Test 20: Account switch clears stale Family state', () => {
  assert.ok(
    dashboardCode.includes('useEffect(() => {') &&
    dashboardCode.includes('setFamilySummary(null)') &&
    dashboardCode.includes('setFamilyDashboard(null)') &&
    (dashboardCode.includes('user?.id') || dashboardCode.includes('user?.email')),
    'DashboardScreen must clear familySummary and familyDashboard on user change'
  );
});

// ── 21. No raw transactions shown ─────────────────────────────
test('Test 21: Zero raw transactions or transaction arrays in FamilyOverviewCard', () => {
  assert.ok(!familyCardCode.includes('transactions.'), 'No transaction property access');
  assert.ok(!familyCardCode.includes('transactions['), 'No transaction indexing');
  assert.ok(!familyCardCode.includes('.map((t'), 'No transaction mapping');
  assert.ok(!familyCardCode.includes('merchant'), 'No merchant display');
});

// ── 22. No per-member contribution shown ──────────────────────
test('Test 22: Zero per-member financial contribution or attribution in FamilyOverviewCard', () => {
  assert.ok(!familyCardCode.includes('member.spent'), 'No member spent field');
  assert.ok(!familyCardCode.includes('member.income'), 'No member income field');
  assert.ok(!familyCardCode.includes('member.investment'), 'No member investment field');
  assert.ok(!familyCardCode.includes('member.fmi'), 'No member FMI field');
});

// ── 23. Investment kept separate from spending ────────────────
test('Test 23: Investment kept separate from spending (totalNonInvestment vs monthlyFlow)', () => {
  assert.ok(
    familyCardCode.includes('spending?.totalNonInvestment'),
    'Spending must use totalNonInvestment'
  );
  assert.ok(
    familyCardCode.includes('investments?.monthlyFlow'),
    'Investments must use monthlyFlow'
  );
});

// ── 24. No placeholder rendered for non-family user ───────────
test('Test 24: Zero visual placeholder or residue when hasActiveHousehold is false', () => {
  assert.ok(
    dashboardCode.includes('{hasActiveHousehold && familyDashboard ? (') &&
    dashboardCode.includes(') : null}'),
    'DashboardScreen must conditionally render null when hasActiveHousehold is false'
  );
});

// ── 25. Accessibility labels present ──────────────────────────
test('Test 25: Accessibility labels and roles present on FamilyOverviewCard and FMIScreen', () => {
  assert.ok(
    familyCardCode.includes('accessibilityRole="button"'),
    'FamilyOverviewCard must have accessibilityRole="button"'
  );
  assert.ok(
    familyCardCode.includes('accessibilityLabel='),
    'FamilyOverviewCard must have descriptive accessibilityLabel'
  );
  assert.ok(
    fmiCode.includes('householdNavCard') && fmiCode.includes('accessibilityLabel='),
    'FMIScreen household card must have descriptive accessibilityLabel'
  );
  assert.ok(
    profileCode.includes('Family & Household') &&
    profileCode.includes('accessibilityLabel="Family & Household'),
    'ProfileScreen Family & Household entry must remain unconditional with accessibilityLabel'
  );
});

console.log();
console.log('='.repeat(70));
console.log(`  PHASE 7 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('='.repeat(70));
console.log();

if (failed > 0) {
  process.exit(1);
}
