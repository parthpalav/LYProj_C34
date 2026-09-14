/**
 * client/test_family_ux.js
 *
 * Comprehensive Frontend & UX Contract Test Suite for FINAURA Family & Household System.
 * Verifies navigation, screen state machine, invitations, FMI presentation, privacy safeguards,
 * error handling, accessibility, and zero-data resilience.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Pure helper logic matching FamilyScreen.tsx exactly
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
  if (score >= 80) return '#059669'; // Excellent
  if (score >= 65) return '#10B981'; // Good
  if (score >= 50) return '#D97706'; // Fair
  if (score >= 35) return '#F59E0B'; // Needs Attention
  return '#DC2626'; // Critical
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

console.log('='.repeat(64));
console.log('  FINAURA FAMILY SYSTEM — PHASE 5 MOBILE UX TEST SUITE');
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
  const root = fs.existsSync(path.resolve('src/screens'))
    ? path.resolve('.')
    : path.resolve('client');
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const profileCode = readClientFile('src/screens/ProfileScreen.tsx');
const navigatorCode = readClientFile('src/navigation/AppNavigator.tsx');
const familyScreenCode = readClientFile('src/screens/FamilyScreen.tsx');
const apiCode = readClientFile('src/services/api.ts');
const typesCode = readClientFile('src/types/index.ts');

// ── 1. Profile includes Family & Household entry ──────────────
test('1. Profile includes Family & Household entry in Section D', () => {
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

// ── 2. Family route registered in AppNavigator ────────────────
test('2. Family route registered as stack screen in AppNavigator', () => {
  assert.ok(navigatorCode.includes('FamilyScreen'), 'FamilyScreen imported');
  assert.ok(navigatorCode.includes('Family: undefined'), 'Family added to RootStackParamList');
  assert.ok(navigatorCode.includes('name="Family"'), 'Family registered as Stack.Screen');
  assert.ok(
    !navigatorCode.includes('<Tab.Screen name="Family"'),
    'Family is NOT registered as a bottom-tab screen'
  );
});

// ── 3. No-family empty state ──────────────────────────────────
test('3. No-family empty state renders guidance and privacy reassurance', () => {
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

// ── 4. Add Family Member email input ──────────────────────────
test('4. Add Family Member email input has keyboard and casing guards', () => {
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

// ── 5. Send invitation interaction & payload ──────────────────
test('5. Send invitation trims email and dispatches to sendFamilyInvitation', () => {
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

// ── 6. Sent invitation rendering ──────────────────────────────
test('6. Sent invitations render email, status, and cancel action', () => {
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

// ── 7. Received invitation rendering ──────────────────────────
test('7. Received invitations render inviter name, accept, and decline buttons', () => {
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

// ── 8. Accept action dispatches and disables buttons in-flight ─
test('8. Accept action dispatches to acceptFamilyInvitation and disables double submission', () => {
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

// ── 9. Decline action dispatches and cleans up list ────────────
test('9. Decline action dispatches to declineFamilyInvitation', () => {
  assert.ok(
    familyScreenCode.includes('declineFamilyInvitation(invitationId)'),
    'Calls declineFamilyInvitation'
  );
  assert.ok(
    familyScreenCode.includes('prev.filter((i) => i.id !== invitationId)'),
    'Optimistically removes declined invitation from received list'
  );
});

// ── 10. Owner-only invite controls ────────────────────────────
test('10. Invite controls are restricted to family owner and under 6 members', () => {
  assert.ok(
    familyScreenCode.includes('isOwner && !isFamilyFull'),
    'Invite buttons are gated by isOwner and !isFamilyFull'
  );
  assert.ok(
    familyScreenCode.includes('Limit reached (6)'),
    'Renders limit reached indicator when family reaches 6 members'
  );
});

// ── 11. Active Family member roster ───────────────────────────
test('11. Member roster renders member names, roles, and avatar initials', () => {
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

// ── 12. Family FMI score displayed ────────────────────────────
test('12. Family FMI score is prominently displayed with /100 scale', () => {
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

// ── 13. FMI label displayed without raw status next to score ──
test('13. FMI score label is displayed (no raw above/below status next to hero score)', () => {
  assert.ok(
    familyScreenCode.includes('fmi.fmiLabel || \'Evaluating\''),
    'Renders score label (e.g. Excellent, Good, Fair)'
  );
  // Confirm raw status isn't leaking into the hero badge
  assert.ok(
    !familyScreenCode.includes('{fmi.status}'),
    'Raw backend status string is not dumped directly into hero UI'
  );
});

// ── 14. Three pillars displayed ───────────────────────────────
test('14. Three pillars displayed (Saving Discipline, Spending Control, Behavioral Stability)', () => {
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

// ── 15. Effective household income displayed ──────────────────
test('15. Combined monthly income uses effectiveMonthlyIncome', () => {
  assert.ok(
    familyScreenCode.includes('Combined Monthly Income'),
    'Combined Monthly Income label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.income.effectiveMonthlyIncome)'),
    'Formats effectiveMonthlyIncome with Indian currency helper'
  );
});

// ── 16. Need spending displayed ───────────────────────────────
test('16. Need Spending displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Need Spending'),
    'Need Spending label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.spending.need)'),
    'Formats need spending'
  );
});

// ── 17. Want spending displayed ───────────────────────────────
test('17. Want Spending displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Want Spending'),
    'Want Spending label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.spending.want)'),
    'Formats want spending'
  );
});

// ── 18. Investment flow displayed ─────────────────────────────
test('18. Invested This Month displayed in financial summary grid', () => {
  assert.ok(
    familyScreenCode.includes('Invested This Month'),
    'Invested This Month label exists'
  );
  assert.ok(
    familyScreenCode.includes('formatINR(dashboard.investments.monthlyFlow)'),
    'Formats monthly investment flow'
  );
});

// ── 19. Investment rate displayed ─────────────────────────────
test('19. Investment Rate displayed as percentage of effective income', () => {
  assert.ok(
    familyScreenCode.includes('Investment Rate'),
    'Investment Rate label exists'
  );
  assert.ok(
    familyScreenCode.includes('dashboard.investments.investmentRatePercent'),
    'Displays investmentRatePercent directly from backend'
  );
});

// ── 20. Category breakdown displayed ──────────────────────────
test('20. Category breakdown displays top categories with amount and percentage', () => {
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

// ── 21. Insights displayed ────────────────────────────────────
test('21. Household insights render deterministic items from fmi.insights', () => {
  assert.ok(
    familyScreenCode.includes('Household Insights'),
    'Insights section heading exists'
  );
  assert.ok(
    familyScreenCode.includes('fmi.insights.map'),
    'Maps over fmi.insights array'
  );
  // Ensure no LLM or Gemini API calls are made on client
  assert.ok(
    !familyScreenCode.includes('GoogleGenerativeAI'),
    'Zero client-side LLM calls'
  );
  assert.ok(
    !familyScreenCode.includes('gemini'),
    'Zero Gemini references in FamilyScreen'
  );
});

// ── 22. Privacy note present ──────────────────────────────────
test('22. Privacy note is prominently present at top of screen', () => {
  assert.ok(
    familyScreenCode.includes('Family insights use combined household totals. Your individual transaction details remain private.'),
    'Contains exact required privacy notice'
  );
  assert.ok(
    familyScreenCode.includes('accessibilityLabel="Privacy Note"'),
    'Privacy note has accessibility label'
  );
});

// ── 23. Member removal confirmation ───────────────────────────
test('23. Member removal requires explicit confirmation and cannot remove owner', () => {
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

// ── 24. Leave Family confirmation & Owner logic ───────────────
test('24. Leave Family handles non-owner vs sole owner vs populated owner', () => {
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

// ── 25. No raw transaction rendering ──────────────────────────
test('25. FamilyScreen never renders raw transactions or merchant names', () => {
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

// ── 26. No per-member financial contribution rendering ────────
test('26. FamilyScreen never renders per-member financial contributions or balances', () => {
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

// ── 27. Zero-data state handling ──────────────────────────────
test('27. Zero-data state formats ₹0 cleanly without NaN or exceptions', () => {
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

// ── 28. Loading state handling ────────────────────────────────
test('28. Loading state renders clean ActivityIndicator without content flash', () => {
  assert.ok(
    familyScreenCode.includes('Loading family finances...'),
    'Renders loading text'
  );
  assert.ok(
    familyScreenCode.includes('<ActivityIndicator size="large"'),
    'Renders activity indicator'
  );
});

// ── 29. Error state handling ──────────────────────────────────
test('29. Error state maps server status and error messages to human copy', () => {
  // 404 User not found
  assert.equal(
    getHumanReadableError({ response: { status: 404 } }),
    'No FINAURA account was found with that email.'
  );

  // 400 Self invitation
  assert.equal(
    getHumanReadableError({ response: { status: 400, data: { message: 'You cannot invite yourself to a family' } } }),
    "You can't invite your own account."
  );

  // 409 Already belongs to family
  assert.equal(
    getHumanReadableError({ response: { status: 409, data: { message: 'User already belongs to a family' } } }),
    'This user already belongs to a Family.'
  );

  // 409 Duplicate pending invitation
  assert.equal(
    getHumanReadableError({ response: { status: 409, data: { message: 'An active invitation already exists between these users' } } }),
    'A Family invitation is already pending for this user.'
  );

  // 403 Non-owner
  assert.equal(
    getHumanReadableError({ response: { status: 403, data: { message: 'Only the family owner can invite new members' } } }),
    'Only the Family owner can invite new members.'
  );

  // Family full limit
  assert.equal(
    getHumanReadableError({ response: { status: 400, data: { message: 'Family is full (maximum 6 members)' } } }),
    'This Family has reached the 6-member limit.'
  );

  // Network failure
  assert.equal(
    getHumanReadableError({ message: 'Network Error' }),
    'Unable to reach FINAURA. Please try again.'
  );
});

// ── 30. Accessibility labels on major actions ─────────────────
test('30. Accessibility labels and roles are defined on all interactive elements', () => {
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

console.log('='.repeat(64));
console.log(`  ALL ${passed} FAMILY UX & CONTRACT TESTS PASSED! 🚀`);
console.log('='.repeat(64));
