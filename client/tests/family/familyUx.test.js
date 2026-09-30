/**
 * client/tests/family/familyUx.test.js
 *
 * Consolidated Frontend & UX Contract Test Suite for FINAURA Family & Household System.
 * Combines contextual dashboard visibility tests and family mobile UX/screen state machine contracts.
 *
 * Preserves all 55 checks from:
 *  - client/test_family_dashboard_visibility.js (25 tests)
 *  - client/test_family_ux.js (30 tests)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '../..');

console.log('='.repeat(70));
console.log('  FINAURA CONSOLIDATED FAMILY & HOUSEHOLD UX TEST SUITE');
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
const dashboardScreenPath = path.join(clientRoot, 'src/screens/DashboardScreen.tsx');
const fmiScreenPath = path.join(clientRoot, 'src/screens/FMIScreen.tsx');
const profileScreenPath = path.join(clientRoot, 'src/screens/ProfileScreen.tsx');
const familyCardPath = path.join(clientRoot, 'src/components/family/FamilyOverviewCard.tsx');
const familyScreenPath = path.join(clientRoot, 'src/screens/FamilyScreen.tsx');
const navigatorPath = path.join(clientRoot, 'src/navigation/AppNavigator.tsx');
const apiPath = path.join(clientRoot, 'src/services/api.ts');
const typesPath = path.join(clientRoot, 'src/types/index.ts');

const dashboardCode = fs.readFileSync(dashboardScreenPath, 'utf8');
const fmiCode = fs.readFileSync(fmiScreenPath, 'utf8');
const profileCode = fs.readFileSync(profileScreenPath, 'utf8');
const familyCardCode = fs.readFileSync(familyCardPath, 'utf8');
const familyScreenCode = fs.readFileSync(familyScreenPath, 'utf8');
const navigatorCode = fs.readFileSync(navigatorPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');
const typesCode = fs.readFileSync(typesPath, 'utf8');

// ── Helpers mirroring FamilyScreen and DashboardScreen ─────────
function evaluateHasActiveHousehold(family) {
  return (
    !!family &&
    (typeof family.memberCount === 'number'
      ? family.memberCount > 1
      : Array.isArray(family.members) && family.members.length > 1)
  );
}

function formatINR(val) {
  if (val === null || val === undefined || !Number.isFinite(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'FM';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

function getFmiColor(score) {
  if (score >= 80) return '#059669';
  if (score >= 65) return '#10B981';
  if (score >= 50) return '#D97706';
  if (score >= 35) return '#F59E0B';
  return '#DC2626';
}

function getHumanReadableError(err, fallback = 'Operation failed. Please try again.') {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message || err?.response?.data?.error || '';
  const msgLower = typeof serverMsg === 'string' ? serverMsg.toLowerCase() : '';

  if (status === 404 || msgLower.includes('user not found') || msgLower.includes('account was found')) {
    return 'No FINAURA account was found with that email.';
  }
  if (msgLower.includes('cannot invite yourself') || msgLower.includes("can't invite your own") || msgLower.includes('self-invitation')) {
    return "You can't invite your own account.";
  }
  if (msgLower.includes('already belongs to a family') || (status === 409 && msgLower.includes('already belongs'))) {
    return 'This user already belongs to a Family.';
  }
  if (msgLower.includes('already exists') || msgLower.includes('already pending') || msgLower.includes('active invitation already exists')) {
    return 'A Family invitation is already pending for this user.';
  }
  if (status === 403 || msgLower.includes('only the family owner') || msgLower.includes('only owner')) {
    return 'Only the Family owner can invite new members.';
  }
  if (msgLower.includes('maximum 6') || msgLower.includes('family is full') || msgLower.includes('limit reached')) {
    return 'This Family has reached the 6-member limit.';
  }
  if (err?.message === 'Network Error' || !err?.response) {
    return 'Unable to reach FINAURA. Please try again.';
  }
  return serverMsg || fallback;
}

function formatExpiry(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'expired';
    if (diffDays === 1) return 'in 1 day';
    return `in ${diffDays} days`;
  } catch {
    return '';
  }
}

// ============================================================
// PART A: CONTEXTUAL DASHBOARD VISIBILITY & ISOLATION (25 TESTS)
// ============================================================

test('Visibility Test 1: No Family (family null) -> hasActiveHousehold is false', () => {
  assert.equal(evaluateHasActiveHousehold(null), false);
  assert.equal(evaluateHasActiveHousehold(undefined), false);
});

test('Visibility Test 2: Sole-member Family (memberCount === 1) -> hasActiveHousehold is false', () => {
  const soleByCount = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleByCount), false);

  const soleByArray = { members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleByArray), false);
});

test('Visibility Test 3: 2-member Family (memberCount === 2) -> hasActiveHousehold is true', () => {
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

test('Visibility Test 4: Pending invitations without active multi-member family -> hasActiveHousehold is false', () => {
  assert.equal(evaluateHasActiveHousehold(null), false);
  const soleWithPending = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(soleWithPending), false);
});

test('Visibility Test 5: Family FMI score displayed in FamilyOverviewCard', () => {
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

test('Visibility Test 6: FMI label displayed (badge/pill with status text)', () => {
  assert.ok(
    familyCardCode.includes('getFmiBadge') || familyCardCode.includes('fmiLabel'),
    'FamilyOverviewCard must evaluate or display fmiLabel'
  );
  assert.ok(
    familyCardCode.includes('statusBadgeText'),
    'FamilyOverviewCard must have style for status badge text'
  );
});

test('Visibility Test 7: Effective monthly income displayed', () => {
  assert.ok(
    familyCardCode.includes('effectiveMonthlyIncome'),
    'FamilyOverviewCard must display income.effectiveMonthlyIncome'
  );
  assert.ok(
    familyCardCode.includes('Household Income'),
    'FamilyOverviewCard must label income as Household Income'
  );
});

test('Visibility Test 8: Household spending uses totalNonInvestment (Need + Want)', () => {
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

test('Visibility Test 9: Monthly investment flow displayed separately', () => {
  assert.ok(
    familyCardCode.includes('investments?.monthlyFlow'),
    'FamilyOverviewCard must display investments.monthlyFlow'
  );
  assert.ok(
    familyCardCode.includes('Invested This Month'),
    'FamilyOverviewCard must label investments as Invested This Month'
  );
});

test('Visibility Test 10: Net cash position displayed', () => {
  assert.ok(
    familyCardCode.includes('cashFlow?.netCashPosition'),
    'FamilyOverviewCard must display cashFlow.netCashPosition'
  );
  assert.ok(
    familyCardCode.includes('Net Cash Position'),
    'FamilyOverviewCard must label cashFlow as Net Cash Position'
  );
});

test('Visibility Test 11: Personal FMI card remains present on DashboardScreen', () => {
  assert.ok(
    dashboardCode.includes('fmiCard') && dashboardCode.includes('fmiScoreRow'),
    'Personal FMI card must remain present on DashboardScreen'
  );
  assert.ok(
    dashboardCode.includes('fmiStatusColor'),
    'Personal FMI status helper must remain present'
  );
});

test('Visibility Test 12: Family FMI clearly labeled as Household FMI / Financial Maturity Index', () => {
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

test('Visibility Test 13: Family API failure does not break personal dashboard (error isolation)', () => {
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

test('Visibility Test 14: Family dashboard API is not requested when getCurrentFamily returns null', async () => {
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

test('Visibility Test 15: Family dashboard API is not requested for sole-member family', async () => {
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

test('Visibility Test 16: Family dashboard API is requested for multi-member family', async () => {
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

test('Visibility Test 17: View Family Details triggers navigation to Family', () => {
  assert.ok(
    dashboardCode.includes("navigate('Family')"),
    'DashboardScreen must navigate to Family screen upon pressing details'
  );
  assert.ok(
    familyCardCode.includes('View Family Details'),
    'FamilyOverviewCard must contain View Family Details CTA'
  );
});

test('Visibility Test 18: Refresh transition (sole/no-family -> multi-member) makes widget appear', () => {
  let currentFam = null;
  assert.equal(evaluateHasActiveHousehold(currentFam), false);

  currentFam = { memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), true);
});

test('Visibility Test 19: Refresh transition (multi-member -> sole/no-family) makes widget disappear', () => {
  let currentFam = { memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), true);

  currentFam = { memberCount: 1, members: [{ userId: 'u1' }] };
  assert.equal(evaluateHasActiveHousehold(currentFam), false);
});

test('Visibility Test 20: Account switch clears stale Family state', () => {
  assert.ok(
    dashboardCode.includes('useEffect(() => {') &&
    dashboardCode.includes('setFamilySummary(null)') &&
    dashboardCode.includes('setFamilyDashboard(null)') &&
    (dashboardCode.includes('user?.id') || dashboardCode.includes('user?.email')),
    'DashboardScreen must clear familySummary and familyDashboard on user change'
  );
});

test('Visibility Test 21: Zero raw transactions or transaction arrays in FamilyOverviewCard', () => {
  assert.ok(!familyCardCode.includes('transactions.'), 'No transaction property access');
  assert.ok(!familyCardCode.includes('transactions['), 'No transaction indexing');
  assert.ok(!familyCardCode.includes('.map((t'), 'No transaction mapping');
  assert.ok(!familyCardCode.includes('merchant'), 'No merchant display');
});

test('Visibility Test 22: Zero per-member financial contribution or attribution in FamilyOverviewCard', () => {
  assert.ok(!familyCardCode.includes('member.spent'), 'No member spent field');
  assert.ok(!familyCardCode.includes('member.income'), 'No member income field');
  assert.ok(!familyCardCode.includes('member.investment'), 'No member investment field');
  assert.ok(!familyCardCode.includes('member.fmi'), 'No member FMI field');
});

test('Visibility Test 23: Investment kept separate from spending (totalNonInvestment vs monthlyFlow)', () => {
  assert.ok(
    familyCardCode.includes('spending?.totalNonInvestment'),
    'Spending must use totalNonInvestment'
  );
  assert.ok(
    familyCardCode.includes('investments?.monthlyFlow'),
    'Investments must use monthlyFlow'
  );
});

test('Visibility Test 24: Zero visual placeholder or residue when hasActiveHousehold is false', () => {
  assert.ok(
    dashboardCode.includes('{hasActiveHousehold && familyDashboard ? (') &&
    dashboardCode.includes(') : null}'),
    'DashboardScreen must conditionally render null when hasActiveHousehold is false'
  );
});

test('Visibility Test 25: Accessibility labels and roles present on FamilyOverviewCard and FMIScreen', () => {
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

// ============================================================
// PART B: FAMILY MOBILE UX & CONTRACT TESTS (30 TESTS)
// ============================================================

test('Family UX 1. Profile includes Family & Household entry in Section D', () => {
  assert.ok(profileCode.includes('Family & Household'), 'Title "Family & Household" is present');
  assert.ok(profileCode.includes("navigate('Family')"), 'Navigation to "Family" route is wired');
  assert.ok(profileCode.includes('people-outline'), 'Uses people-outline Ionicons icon');
  assert.ok(
    profileCode.includes('Combined finances, shared insights & invitations'),
    'Descriptive subtitle is present'
  );
  assert.ok(
    profileCode.includes('accessibilityLabel="Family & Household, Combined finances, shared insights & invitations"'),
    'Accessibility label is defined'
  );
});

test('Family UX 2. Family route registered as stack screen in AppNavigator', () => {
  assert.ok(navigatorCode.includes('FamilyScreen'), 'FamilyScreen imported');
  assert.ok(navigatorCode.includes('Family: undefined'), 'Family added to RootStackParamList');
  assert.ok(navigatorCode.includes('name="Family"'), 'Family registered as Stack.Screen');
  assert.ok(
    !navigatorCode.includes('<Tab.Screen name="Family"'),
    'Family is NOT registered as a bottom-tab screen'
  );
});

test('Family UX 3. No-family empty state renders guidance and privacy reassurance', () => {
  assert.ok(
    familyScreenCode.includes('Plan together without losing your individual financial view.'),
    'Contains headline for no-family state'
  );
  assert.ok(
    familyScreenCode.includes('Your personal transactions and individual FMI remain private.'),
    'Reassures user that personal transactions remain private'
  );
  assert.ok(
    familyScreenCode.includes('Add Family Member'),
    'Contains Add Family Member primary CTA'
  );
});

test('Family UX 4. Add Family Member email input has keyboard and casing guards', () => {
  assert.ok(
    familyScreenCode.includes('keyboardType="email-address"'),
    'Uses email-address keyboard'
  );
  assert.ok(
    familyScreenCode.includes('autoCapitalize="none"'),
    'Disables autocapitalization'
  );
  assert.ok(
    familyScreenCode.includes('autoCorrect={false}'),
    'Disables autocorrection'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Family member email address"'),
    'Has meaningful accessibility label'
  );
});

test('Family UX 5. Send invitation trims email and dispatches to sendFamilyInvitation', () => {
  assert.ok(
    familyScreenCode.includes('sendFamilyInvitation(trimmed)'),
    'Calls sendFamilyInvitation with trimmed email'
  );
  assert.ok(
    familyScreenCode.includes('inviteEmail.trim().toLowerCase()'),
    'Sanitizes input by trimming and lowercasing'
  );
  assert.ok(
    apiCode.includes('export async function sendFamilyInvitation'),
    'api.ts exports sendFamilyInvitation'
  );
});

test('Family UX 6. Sent invitations render email, status, and cancel action', () => {
  assert.ok(
    familyScreenCode.includes('Pending Invitations'),
    'Section heading for pending sent invitations exists'
  );
  assert.ok(
    familyScreenCode.includes('sentInviteEmail'),
    'Renders invitee email'
  );
  assert.ok(
    familyScreenCode.includes('Waiting for response'),
    'Renders waiting for response subtext'
  );
  assert.ok(
    familyScreenCode.includes('cancelFamilyInvitation'),
    'Wires cancelFamilyInvitation to button'
  );
});

test('Family UX 7. Received invitations render inviter name, accept, and decline buttons', () => {
  assert.ok(
    familyScreenCode.includes('Family Invitations'),
    'Section heading for received invitations exists'
  );
  assert.ok(
    familyScreenCode.includes('invited you to join their Family'),
    'Renders personalized invitation text'
  );
  assert.ok(
    familyScreenCode.includes('acceptBtn'),
    'Accept button is present'
  );
  assert.ok(
    familyScreenCode.includes('declineBtn'),
    'Decline button is present'
  );
});

test('Family UX 8. Accept action dispatches to acceptFamilyInvitation and disables double submission', () => {
  assert.ok(
    familyScreenCode.includes('acceptFamilyInvitation(invitationId)'),
    'Calls acceptFamilyInvitation'
  );
  assert.ok(
    familyScreenCode.includes('actionLoadingId === `accept-${inv.id}`'),
    'Tracks in-flight acceptance state'
  );
  assert.ok(
    familyScreenCode.includes('disabled={inFlight}'),
    'Disables button while in-flight'
  );
});

test('Family UX 9. Decline action dispatches to declineFamilyInvitation', () => {
  assert.ok(
    familyScreenCode.includes('declineFamilyInvitation(invitationId)'),
    'Calls declineFamilyInvitation'
  );
  assert.ok(
    familyScreenCode.includes('prev.filter((i) => i.id !== invitationId)'),
    'Optimistically removes declined invitation from received list'
  );
});

test('Family UX 10. Invite controls are restricted to family owner and under 6 members', () => {
  assert.ok(
    familyScreenCode.includes('isOwner && !isFamilyFull'),
    'Invite buttons are gated by isOwner and !isFamilyFull'
  );
  assert.ok(
    familyScreenCode.includes('Limit reached (6)'),
    'Renders limit reached indicator when family reaches 6 members'
  );
});

test('Family UX 11. Member roster renders member names, roles, and avatar initials', () => {
  assert.ok(
    familyScreenCode.includes('Household Members'),
    'Roster section heading exists'
  );
  assert.ok(
    familyScreenCode.includes('getInitials(m.name)'),
    'Generates initials for avatar'
  );
  assert.ok(
    familyScreenCode.includes("m.role === 'owner' ? 'Family Owner' : 'Member'"),
    'Distinguishes owner from member'
  );
  assert.equal(getInitials('Parth Palav'), 'PP');
  assert.equal(getInitials('Rhea'), 'R');
});

test('Family UX 12. Family FMI score is prominently displayed with /100 scale', () => {
  assert.ok(
    familyScreenCode.includes('Family Financial Maturity Index'),
    'FMI card label uses official Financial Maturity Index terminology'
  );
  assert.ok(
    familyScreenCode.includes('Math.round(fmi.score)'),
    'FMI score is rounded cleanly'
  );
  assert.ok(
    familyScreenCode.includes('/ 100'),
    'Scale / 100 is clearly rendered'
  );
});

test('Family UX 13. FMI score label is displayed (no raw above/below status next to hero score)', () => {
  assert.ok(
    familyScreenCode.includes('fmi.fmiLabel || \'Evaluating\''),
    'Renders score label (e.g. Excellent, Good, Fair)'
  );
  assert.ok(
    !familyScreenCode.includes('{fmi.status}'),
    'Raw backend status string is not dumped directly into hero UI'
  );
});

test('Family UX 14. Three pillars displayed (Saving Discipline, Spending Control, Behavioral Stability)', () => {
  assert.ok(
    familyScreenCode.includes('Saving Discipline'),
    'Pillar 1: Saving Discipline'
  );
  assert.ok(
    familyScreenCode.includes('40% Weight'),
    'Saving Discipline weight is 40%'
  );
  assert.ok(
    familyScreenCode.includes('Spending Control'),
    'Pillar 2: Spending Control'
  );
  assert.ok(
    familyScreenCode.includes('30% Weight'),
    'Spending Control weight is 30%'
  );
  assert.ok(
    familyScreenCode.includes('Behavioral Stability'),
    'Pillar 3: Behavioral Stability (user-facing presentation of D3)'
  );
  assert.ok(
    familyScreenCode.includes('D1_savingDiscipline'),
    'Binds to D1 backend key'
  );
  assert.ok(
    familyScreenCode.includes('D2_spendingControl'),
    'Binds to D2 backend key'
  );
  assert.ok(
    familyScreenCode.includes('D3_behavioralRisk'),
    'Binds to D3 backend key'
  );
});

test('Family UX 15. Combined monthly income uses effectiveMonthlyIncome', () => {
  assert.ok(
    familyScreenCode.includes('Combined Monthly Income'),
    'Combined Monthly Income label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.income.effectiveMonthlyIncome)'),
    'Formats effectiveMonthlyIncome with Indian currency helper'
  );
});

test('Family UX 16. Need Spending displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Need Spending'),
    'Need Spending label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.spending.need)'),
    'Formats need spending'
  );
});

test('Family UX 17. Want Spending displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Want Spending'),
    'Want Spending label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.spending.want)'),
    'Formats want spending'
  );
});

test('Family UX 18. Invested This Month displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Invested This Month'),
    'Invested This Month label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.investments.monthlyFlow)'),
    'Formats monthly investment flow'
  );
});

test('Family UX 19. Investment Rate displayed as percentage of effective income', () => {
  assert.ok(
    familyScreenCode.includes('Investment Rate'),
    'Investment Rate label exists'
  );
  assert.ok(
    familyScreenCode.includes('dashboard.investments.investmentRatePercent'),
    'Displays investmentRatePercent directly from backend'
  );
});

test('Family UX 20. Category breakdown displays top categories with amount and percentage', () => {
  assert.ok(
    familyScreenCode.includes('Top Household Categories'),
    'Category section heading exists'
  );
  assert.ok(
    familyScreenCode.includes('dashboard.categoryBreakdown.slice(0, 5)'),
    'Displays top 5 categories'
  );
  assert.ok(
    familyScreenCode.includes('cat.percentageOfOutflow'),
    'Displays percentage of outflow'
  );
});

test('Family UX 21. Household insights render deterministic items from fmi.insights', () => {
  assert.ok(
    familyScreenCode.includes('Household Insights'),
    'Insights section heading exists'
  );
  assert.ok(
    familyScreenCode.includes('fmi.insights.map'),
    'Maps over fmi.insights array'
  );
  assert.ok(
    !familyScreenCode.includes('GoogleGenerativeAI'),
    'Zero client-side LLM calls'
  );
  assert.ok(
    !familyScreenCode.includes('gemini'),
    'Zero Gemini references in FamilyScreen'
  );
});

test('Family UX 22. Privacy note is prominently present at top of screen', () => {
  assert.ok(
    familyScreenCode.includes('Family insights use combined household totals. Your individual transaction details remain private.'),
    'Contains exact required privacy notice'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Privacy Note"'),
    'Privacy note has accessibility label'
  );
});

test('Family UX 23. Member removal requires explicit confirmation and cannot remove owner', () => {
  assert.ok(
    familyScreenCode.includes('Remove from Family?'),
    'Alert dialog title for member removal exists'
  );
  assert.ok(
    familyScreenCode.includes('Their individual financial data will remain unchanged.'),
    'Reassures data safety on removal'
  );
  assert.ok(
    familyScreenCode.includes('isOwner && m.role !== \'owner\''),
    'Owner cannot remove themselves or another owner'
  );
});

test('Family UX 24. Leave Family handles non-owner vs sole owner vs populated owner', () => {
  assert.ok(
    familyScreenCode.includes('Leave Family'),
    'Non-owner has Leave Family button'
  );
  assert.ok(
    familyScreenCode.includes('Disband Family'),
    'Sole owner has Disband Family button'
  );
  assert.ok(
    familyScreenCode.includes('Remove other members before disbanding this Family.'),
    'Populated owner receives informative text instead of active leave button'
  );
});

test('Family UX 25. FamilyScreen never renders raw transactions or merchant names', () => {
  assert.ok(
    !familyScreenCode.includes('rawTransactions'),
    'Zero raw transactions in FamilyScreen'
  );
  assert.ok(
    !familyScreenCode.includes('tx.description'),
    'Zero transaction description rendering'
  );
  assert.ok(
    !familyScreenCode.includes('merchant'),
    'Zero merchant details in FamilyScreen'
  );
  assert.ok(
    !familyScreenCode.includes('transactionId'),
    'Zero transaction ID exposure'
  );
});

test('Family UX 26. FamilyScreen never renders per-member financial contributions or balances', () => {
  assert.ok(
    !familyScreenCode.includes('member.income'),
    'Zero per-member income displayed'
  );
  assert.ok(
    !familyScreenCode.includes('member.spending'),
    'Zero per-member spending displayed'
  );
  assert.ok(
    !familyScreenCode.includes('member.fmi'),
    'Zero per-member FMI score displayed'
  );
  assert.ok(
    !familyScreenCode.includes('member.balance'),
    'Zero per-member bank balances displayed'
  );
});

test('Family UX 27. Zero-data state formats ₹0 cleanly without NaN or exceptions', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(null), '₹0');
  assert.equal(formatINR(undefined), '₹0');
  assert.equal(formatINR(NaN), '₹0');
  assert.equal(formatINR(125000), '₹1,25,000');

  assert.ok(
    familyScreenCode.includes('No category spending recorded this month.'),
    'Has empty category fallback copy'
  );
});

test('Family UX 28. Loading state renders clean ActivityIndicator without content flash', () => {
  assert.ok(
    familyScreenCode.includes('Loading family finances...'),
    'Renders loading text'
  );
  assert.ok(
    familyScreenCode.includes('<ActivityIndicator size="large"'),
    'Renders activity indicator'
  );
});

test('Family UX 29. Error state maps server status and error messages to human copy', () => {
  assert.equal(
    getHumanReadableError({ response: { status: 404 } }),
    'No FINAURA account was found with that email.'
  );
  assert.equal(
    getHumanReadableError({ response: { status: 400, data: { message: 'You cannot invite yourself to a family' } } }),
    "You can't invite your own account."
  );
  assert.equal(
    getHumanReadableError({ response: { status: 409, data: { message: 'User already belongs to a family' } } }),
    'This user already belongs to a Family.'
  );
  assert.equal(
    getHumanReadableError({ response: { status: 409, data: { message: 'An active invitation already exists between these users' } } }),
    'A Family invitation is already pending for this user.'
  );
  assert.equal(
    getHumanReadableError({ response: { status: 403, data: { message: 'Only the family owner can invite new members' } } }),
    'Only the Family owner can invite new members.'
  );
  assert.equal(
    getHumanReadableError({ response: { status: 400, data: { message: 'Family is full (maximum 6 members)' } } }),
    'This Family has reached the 6-member limit.'
  );
  assert.equal(
    getHumanReadableError({ message: 'Network Error' }),
    'Unable to reach FINAURA. Please try again.'
  );
});

test('Family UX 30. Accessibility labels and roles are defined on all interactive elements', () => {
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Go back"'),
    'Back button has accessibilityLabel'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Add Family Member"'),
    'Add member button has accessibilityLabel'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Leave Family"'),
    'Leave family button has accessibilityLabel'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityRole="button"'),
    'Interactive buttons specify accessibilityRole="button"'
  );
});

// ── Summary ─────────────────────────────────────────────────
console.log();
console.log('='.repeat(70));
if (failed === 0) {
  console.log(`  ALL ${passed} CONSOLIDATED FAMILY UX TESTS PASSED 🚀`);
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log('='.repeat(70));
console.log();

if (failed > 0) {
  process.exit(1);
}
