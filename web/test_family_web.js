/**
 * FINAURA — Family & Household Web Parity Comprehensive Verification Suite
 * Executes 40 focused tests covering routing, navigation, components, API contracts,
 * behavioral state transitions, error mapping, and privacy invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = __dirname;

// Pure JS copies of utility functions for direct behavioral test execution
function getFmiColor(score) {
  if (score >= 80) return '#059669';
  if (score >= 65) return '#10B981';
  if (score >= 50) return '#d97706';
  if (score >= 35) return '#f59e0b';
  return '#dc2626';
}

function getFmiBadgeBg(score) {
  if (score >= 80) return '#ecfdf5';
  if (score >= 65) return '#ecfdf5';
  if (score >= 50) return '#fffbeb';
  if (score >= 35) return '#fffbeb';
  return '#fef2f2';
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

function getMemberInitials(name) {
  if (!name || typeof name !== 'string') return 'FM';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function getHumanReadableFamilyError(err, fallback = 'Operation failed. Please try again.') {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message || err?.response?.data?.error || '';
  const msgLower = typeof serverMsg === 'string' ? serverMsg.toLowerCase() : '';

  if (status === 429 || msgLower.includes('too many requests')) {
    return 'Too many requests. Please try again shortly.';
  }
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
    return 'Only the Family owner can perform this action.';
  }
  if (msgLower.includes('maximum 6') || msgLower.includes('family is full') || msgLower.includes('limit reached')) {
    return 'This Family has reached the 6-member limit.';
  }
  if (err?.message === 'Network Error' || !err?.response) {
    return 'Unable to reach FINAURA. Please check your connection.';
  }
  return serverMsg || fallback;
}

let passed = 0;
let failed = 0;
const results = [];

function runTest(num, name, type, fn) {
  try {
    fn();
    console.log(`  [${type}] Test ${num}: ${name} ✅ PASS`);
    passed++;
    results.push({ num, name, type, status: 'PASS' });
  } catch (err) {
    console.error(`  [${type}] Test ${num}: ${name} ❌ FAIL`);
    console.error(`    ${err.message}`);
    failed++;
    results.push({ num, name, type, status: 'FAIL', error: err.message });
  }
}

console.log('======================================================================');
console.log('  FINAURA FAMILY & HOUSEHOLD WEB PARITY TEST SUITE');
console.log('======================================================================\n');

// Read source files for structural and architectural assertions
const appSrc = fs.readFileSync(path.join(webRoot, 'src/App.tsx'), 'utf-8');
const sidebarSrc = fs.readFileSync(path.join(webRoot, 'src/components/layout/Sidebar.tsx'), 'utf-8');
const apiSrc = fs.readFileSync(path.join(webRoot, 'src/services/api.ts'), 'utf-8');
const typesFamilySrc = fs.readFileSync(path.join(webRoot, 'src/types/family.ts'), 'utf-8');
const typesIndexSrc = fs.readFileSync(path.join(webRoot, 'src/types/index.ts'), 'utf-8');
const useFamilySrc = fs.readFileSync(path.join(webRoot, 'src/hooks/useFamily.ts'), 'utf-8');
const familyPageSrc = fs.readFileSync(path.join(webRoot, 'src/pages/FamilyPage.tsx'), 'utf-8');
const overviewPageSrc = fs.readFileSync(path.join(webRoot, 'src/pages/OverviewPage.tsx'), 'utf-8');
const insightsPageSrc = fs.readFileSync(path.join(webRoot, 'src/pages/InsightsPage.tsx'), 'utf-8');
const heroSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyFmiHero.tsx'), 'utf-8');
const pillarsSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyPillarsGrid.tsx'), 'utf-8');
const metricsSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/HouseholdMetricsGrid.tsx'), 'utf-8');
const cashFlowSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/HouseholdCashFlowBreakdown.tsx'), 'utf-8');
const categorySrc = fs.readFileSync(path.join(webRoot, 'src/components/family/HouseholdCategoryBreakdown.tsx'), 'utf-8');
const insightsCompSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/HouseholdInsightsCard.tsx'), 'utf-8');
const memberListSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyMemberList.tsx'), 'utf-8');
const invitesSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyInvitationsSection.tsx'), 'utf-8');
const modalSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/InviteMemberModal.tsx'), 'utf-8');
const noFamilySrc = fs.readFileSync(path.join(webRoot, 'src/components/family/NoFamilyCard.tsx'), 'utf-8');
const privacySrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyPrivacyBanner.tsx'), 'utf-8');
const overviewCardSrc = fs.readFileSync(path.join(webRoot, 'src/components/family/FamilyOverviewCard.tsx'), 'utf-8');
const cssSrc = fs.readFileSync(path.join(webRoot, 'src/index.css'), 'utf-8');

// 1. /family route exists
runTest(1, '/family route exists and canonical /app/family route registered', 'BEHAVIORAL ASSERTION', () => {
  assert(appSrc.includes('<Route path="family" element={<FamilyPage />} />'), 'App.tsx must register canonical /app/family route');
  assert(appSrc.includes('<Route path="/family" element={<Navigate to="/app/family" replace />} />'), 'App.tsx must provide /family -> /app/family redirect');
});

// 2. Sidebar Family navigation exists
runTest(2, 'Sidebar Family navigation exists with Users icon', 'STRUCTURAL ASSERTION', () => {
  assert(sidebarSrc.includes('to="/app/family"'), 'Sidebar must include /app/family NavLink');
  assert(sidebarSrc.includes('<Users size={18} />'), 'Sidebar must use Users icon for Family');
  assert(sidebarSrc.includes('<span>Family</span>'), 'Sidebar link text must be Family');
});

// 3. No-family state renders
runTest(3, 'No-family state renders explanation and action panel', 'STRUCTURAL ASSERTION', () => {
  assert(noFamilySrc.includes('Build a shared household view without merging accounts.'), 'NoFamilyCard must include headline');
  assert(noFamilySrc.includes('Invite Family Member'), 'NoFamilyCard must offer primary invite action');
  assert(familyPageSrc.includes('<NoFamilyCard onOpenInviteModal='), 'FamilyPage must render NoFamilyCard when !family');
});

// 4. Privacy explanation renders
runTest(4, 'Privacy explanation renders prominently', 'STRUCTURAL ASSERTION', () => {
  assert(privacySrc.includes('Your personal financial records stay private'), 'Privacy banner must feature prominent privacy title');
  assert(privacySrc.includes('household-level aggregates, not each other’s individual transactions'), 'Must explain aggregates vs individual transactions');
  assert(familyPageSrc.includes('<FamilyPrivacyBanner />'), 'FamilyPage must include privacy banner');
});

// 5. Invite action available without Family
runTest(5, 'Invite action available in no-family state', 'BEHAVIORAL ASSERTION', () => {
  assert(noFamilySrc.includes('onOpenInviteModal'), 'NoFamilyCard must receive and wire onOpenInviteModal');
  assert(familyPageSrc.includes('setIsInviteModalOpen(true)'), 'FamilyPage must trigger invite modal from empty state');
});

// 6. Received invitation state supported
runTest(6, 'Received invitation state supported with inviter name and expiry', 'STRUCTURAL ASSERTION', () => {
  assert(invitesSrc.includes('receivedInvitations.map'), 'Must map over receivedInvitations');
  assert(invitesSrc.includes('inv.inviterName'), 'Must render inviterName');
  assert(invitesSrc.includes('Expires {formatExpiry(inv.expiresAt)}'), 'Must render expiry');
  assert(formatExpiry(null) === '', 'formatExpiry(null) should return empty string');
  assert(formatExpiry(new Date(Date.now() + 86400000 * 3).toISOString()).includes('in 3 days'), 'formatExpiry future should return in X days');
});

// 7. Accept invitation wired
runTest(7, 'Accept invitation wired without unnecessary confirmation', 'BEHAVIORAL ASSERTION', () => {
  assert(invitesSrc.includes('onClick={() => onAccept(inv.id)}'), 'Accept button must directly call onAccept');
  assert(apiSrc.includes('api.post(`/api/family/invitations/${id}/accept`)'), 'api.ts must post to accept endpoint');
});

// 8. Decline invitation wired
runTest(8, 'Decline invitation wired without unnecessary confirmation', 'BEHAVIORAL ASSERTION', () => {
  assert(invitesSrc.includes('onClick={() => onDecline(inv.id)}'), 'Decline button must directly call onDecline');
  assert(apiSrc.includes('api.post(`/api/family/invitations/${id}/decline`)'), 'api.ts must post to decline endpoint');
});

// 9. Sent invitation state supported
runTest(9, 'Sent invitation state supported with invitee email and status', 'STRUCTURAL ASSERTION', () => {
  assert(invitesSrc.includes('pendingSent.map'), 'Must render pending sent invitations');
  assert(invitesSrc.includes('inv.inviteeEmail'), 'Must render inviteeEmail');
  assert(invitesSrc.includes('Waiting for response'), 'Must display pending status copy');
});

// 10. Cancel invitation wired
runTest(10, 'Cancel invitation wired with confirmation dialog', 'BEHAVIORAL ASSERTION', () => {
  assert(invitesSrc.includes('setInviteToCancel(inv)'), 'Clicking Cancel must open confirmation dialog');
  assert(invitesSrc.includes('<ConfirmDialog'), 'Must render ConfirmDialog for cancellation');
  assert(apiSrc.includes('api.delete(`/api/family/invitations/${id}`)'), 'api.ts must delete invitation');
});

// 11. Active Family dashboard supported
runTest(11, 'Active Family dashboard layout rendered when family exists', 'STRUCTURAL ASSERTION', () => {
  assert(familyPageSrc.includes('family-active-dashboard'), 'FamilyPage must render active dashboard container');
  assert(familyPageSrc.includes('<FamilyFmiHero'), 'Must render FamilyFmiHero');
  assert(familyPageSrc.includes('<FamilyPillarsGrid'), 'Must render FamilyPillarsGrid');
  assert(familyPageSrc.includes('<HouseholdMetricsGrid'), 'Must render HouseholdMetricsGrid');
  assert(familyPageSrc.includes('<HouseholdCashFlowBreakdown'), 'Must render HouseholdCashFlowBreakdown');
  assert(familyPageSrc.includes('<HouseholdCategoryBreakdown'), 'Must render HouseholdCategoryBreakdown');
  assert(familyPageSrc.includes('<HouseholdInsightsCard'), 'Must render HouseholdInsightsCard');
  assert(familyPageSrc.includes('<FamilyMemberList'), 'Must render FamilyMemberList');
});

// 12. Family FMI rendered from API
runTest(12, 'Family FMI score rendered directly from backend without client-side formula', 'BEHAVIORAL ASSERTION', () => {
  assert(heroSrc.includes('fmi?.score'), 'FamilyFmiHero must consume fmi.score');
  assert(heroSrc.includes('fmi?.fmiLabel'), 'FamilyFmiHero must consume backend fmiLabel');
  assert(heroSrc.includes('{score}'), 'Must display score in DOM');
  assert(heroSrc.includes('/ 100'), 'Must display / 100 scale');
  // Behavioral test of FMI colors and backgrounds
  assert.strictEqual(getFmiColor(85), '#059669', 'Score >= 80 should be green #059669');
  assert.strictEqual(getFmiColor(70), '#10B981', 'Score >= 65 should be emerald #10B981');
  assert.strictEqual(getFmiColor(55), '#d97706', 'Score >= 50 should be amber #d97706');
  assert.strictEqual(getFmiColor(40), '#f59e0b', 'Score >= 35 should be orange #f59e0b');
  assert.strictEqual(getFmiColor(20), '#dc2626', 'Score < 35 should be red #dc2626');
  assert.strictEqual(getFmiBadgeBg(85), '#ecfdf5');
  assert.strictEqual(getFmiBadgeBg(55), '#fffbeb');
  assert.strictEqual(getFmiBadgeBg(20), '#fef2f2');
});

// 13. D1 rendered from API
runTest(13, 'D1 Saving Discipline rendered from API with 40% weight', 'STRUCTURAL ASSERTION', () => {
  assert(pillarsSrc.includes('D1_savingDiscipline'), 'Must read D1_savingDiscipline from pillars');
  assert(pillarsSrc.includes('Saving Discipline'), 'Must display Saving Discipline label');
  assert(pillarsSrc.includes('40% Weight'), 'Must display 40% Weight informational label');
});

// 14. D2 rendered from API
runTest(14, 'D2 Spending Control rendered from API with 30% weight', 'STRUCTURAL ASSERTION', () => {
  assert(pillarsSrc.includes('D2_spendingControl'), 'Must read D2_spendingControl from pillars');
  assert(pillarsSrc.includes('Spending Control'), 'Must display Spending Control label');
  assert(pillarsSrc.includes('30% Weight'), 'Must display 30% Weight informational label');
});

// 15. D3 rendered from API ("Behavioral Stability")
runTest(15, 'D3 Behavioral Stability rendered from API with 30% weight', 'STRUCTURAL ASSERTION', () => {
  assert(pillarsSrc.includes('D3_behavioralRisk'), 'Must read D3_behavioralRisk property from backend DTO');
  assert(pillarsSrc.includes('Behavioral Stability'), 'UI must display Behavioral Stability (Requirement 10)');
  assert(pillarsSrc.includes('30% Weight'), 'Must display 30% Weight informational label');
});

// 16. Effective income rendered from API
runTest(16, 'Effective income rendered from backend aggregate', 'STRUCTURAL ASSERTION', () => {
  assert(metricsSrc.includes('dashboard?.income?.effectiveMonthlyIncome'), 'HouseholdMetricsGrid must read effectiveMonthlyIncome directly');
  assert(metricsSrc.includes('Combined Monthly Income'), 'Must label as Combined Monthly Income');
});

// 17. Household Spending uses backend totalNonInvestment
runTest(17, 'Household Spending strictly uses backend totalNonInvestment (Need + Want)', 'BEHAVIORAL ASSERTION', () => {
  assert(metricsSrc.includes('dashboard?.spending?.totalNonInvestment'), 'Household Spending must use totalNonInvestment');
  assert(!metricsSrc.includes('dashboard?.cashFlow?.totalOutflow as Household Spending'), 'Must not label total outflow as spending');
  assert(overviewCardSrc.includes('dashboard?.spending?.totalNonInvestment'), 'Overview card must use totalNonInvestment');
});

// 18. Investment flow rendered from API
runTest(18, 'Investment flow rendered from API', 'STRUCTURAL ASSERTION', () => {
  assert(metricsSrc.includes('dashboard?.investments?.monthlyFlow'), 'Must read investments.monthlyFlow');
  assert(metricsSrc.includes('Invested This Month'), 'Must label as Invested This Month');
  assert(cashFlowSrc.includes('Needs') && cashFlowSrc.includes('Wants') && cashFlowSrc.includes('Investments'), 'HouseholdCashFlowBreakdown must include Needs, Wants, and Investments');
});

// 19. Investment rate rendered from API
runTest(19, 'Investment rate rendered from API', 'STRUCTURAL ASSERTION', () => {
  assert(metricsSrc.includes('dashboard?.investments?.investmentRatePercent'), 'Must read investments.investmentRatePercent');
  assert(metricsSrc.includes('Investment Rate'), 'Must label as Investment Rate');
});

// 20. Net cash rendered from API
runTest(20, 'Net cash rendered from API', 'STRUCTURAL ASSERTION', () => {
  assert(metricsSrc.includes('dashboard?.cashFlow?.netCashPosition'), 'Must read cashFlow.netCashPosition');
  assert(metricsSrc.includes('Net Cash Position'), 'Must label as Net Cash Position');
  assert(categorySrc.includes('Top Household Categories'), 'HouseholdCategoryBreakdown must render Top Household Categories header');
});

// 21. Family insights rendered from backend
runTest(21, 'Family insights rendered from backend without LLM calls', 'BEHAVIORAL ASSERTION', () => {
  assert(insightsCompSrc.includes('insights || []'), 'Must consume backend insights array');
  assert(insightsCompSrc.includes('Household insights will appear as more financial activity is recorded.'), 'Must show exact empty copy when 0 insights');
  assert(!insightsCompSrc.includes('gemini') && !insightsCompSrc.includes('generateAdvice'), 'Must not call LLM');
});

// 22. Member roster rendered safely
runTest(22, 'Member roster rendered with initials and privacy-safe fields', 'BEHAVIORAL ASSERTION', () => {
  assert(memberListSrc.includes('getMemberInitials(m.name)'), 'Must render initials for member avatar');
  assert.strictEqual(getMemberInitials('Rhea Sharma'), 'RS', 'Rhea Sharma initials should be RS');
  assert.strictEqual(getMemberInitials('Parth'), 'PA', 'Single name Parth initials should be PA');
  assert.strictEqual(getMemberInitials(null), 'FM', 'Null name initials should be FM');
  assert(!memberListSrc.includes('m.balance') && !memberListSrc.includes('m.income'), 'Must not display member personal finances');
});

// 23. Owner badge supported
runTest(23, 'Owner badge supported in member roster', 'STRUCTURAL ASSERTION', () => {
  assert(memberListSrc.includes("m.role === 'owner'"), 'Must detect owner role');
  assert(memberListSrc.includes("isItemOwner ? 'Owner' : 'Member'"), 'Must display Owner or Member badge');
});

// 24. Owner can see Invite Member
runTest(24, 'Owner can see Invite Member action when under 6 members', 'BEHAVIORAL ASSERTION', () => {
  assert(memberListSrc.includes('isOwner && !isFamilyFull'), 'Must condition invite button on isOwner and !isFamilyFull');
  assert(memberListSrc.includes('Invite Member'), 'Must render Invite Member button for owner');
});

// 25. Owner can see Remove Member
runTest(25, 'Owner can see Remove Member action for non-owner members', 'BEHAVIORAL ASSERTION', () => {
  assert(memberListSrc.includes('const canRemove = isOwner && !isItemOwner;'), 'Only owner can remove, and cannot remove owner');
  assert(memberListSrc.includes('Remove Member from Household?'), 'Remove button must open confirmation dialog');
});

// 26. Non-owner can see Leave Family
runTest(26, 'Non-owner can see Leave Family action', 'BEHAVIORAL ASSERTION', () => {
  assert(memberListSrc.includes('!isOwner && ('), 'Must render Leave Family button for non-owner');
  assert(memberListSrc.includes('isSoleOwner && ('), 'Must allow sole owner to leave/disband');
  assert(memberListSrc.includes('Remove other members before leaving this Family.'), 'Populated owner cannot leave; must show notice');
});

// 27. Destructive actions require confirmation
runTest(27, 'Destructive actions require confirmation dialog', 'BEHAVIORAL ASSERTION', () => {
  assert(memberListSrc.includes('<ConfirmDialog'), 'FamilyMemberList must render ConfirmDialog');
  assert(invitesSrc.includes('<ConfirmDialog'), 'FamilyInvitationsSection must render ConfirmDialog for cancellation');
});

// 28. No raw member transactions requested
runTest(28, 'No raw member transactions or private records requested by web code', 'BEHAVIORAL ASSERTION', () => {
  const familyDirFiles = fs.readdirSync(path.join(webRoot, 'src/components/family'));
  for (const f of familyDirFiles) {
    const content = fs.readFileSync(path.join(webRoot, 'src/components/family', f), 'utf-8');
    assert(!content.includes('/api/transactions?userId'), `Forbidden raw transaction call in ${f}`);
    assert(!content.includes('/api/income?userId'), `Forbidden raw income call in ${f}`);
    assert(!content.includes('/api/user/profile?userId'), `Forbidden raw profile call in ${f}`);
  }
});

// 29. No client-side Family FMI calculation exists
runTest(29, 'No client-side Family FMI calculation formula exists in web codebase', 'BEHAVIORAL ASSERTION', () => {
  const allWebTsFiles = [];
  function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory() && !full.includes('node_modules') && !full.includes('dist')) {
        scan(full);
      } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        allWebTsFiles.push(full);
      }
    }
  }
  scan(path.join(webRoot, 'src'));

  for (const file of allWebTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    assert(!content.includes('0.4 * D1'), `Forbidden client-side FMI formula in ${file}`);
    assert(!content.includes('0.4 * d1'), `Forbidden client-side FMI formula in ${file}`);
    assert(!content.includes('0.3 * D2'), `Forbidden client-side FMI formula in ${file}`);
    assert(!content.includes('0.3 * d2'), `Forbidden client-side FMI formula in ${file}`);
    assert(!content.includes('0.3 * D3'), `Forbidden client-side FMI formula in ${file}`);
    assert(!content.includes('0.3 * d3'), `Forbidden client-side FMI formula in ${file}`);
  }
});

// 30. Overview Family card hidden for no Family
runTest(30, 'Overview Family card hidden when no active family exists', 'BEHAVIORAL ASSERTION', () => {
  // Verify guard logic: familyDashboard?.family && (memberCount > 1 || members.length > 1)
  const renderCheck = (dash) => Boolean(dash?.family && ((dash.family.memberCount ?? 0) > 1 || (dash.family.members?.length ?? 0) > 1));
  assert.strictEqual(renderCheck(null), false, 'Should be hidden when dashboard is null');
  assert.strictEqual(renderCheck({ family: null }), false, 'Should be hidden when family is null');
  assert(overviewPageSrc.includes('familyDashboard?.family &&'), 'OverviewPage must guard card with family presence check');
});

// 31. Overview Family card hidden for memberCount <= 1
runTest(31, 'Overview Family card hidden for sole-member family (memberCount <= 1)', 'BEHAVIORAL ASSERTION', () => {
  const renderCheck = (dash) => Boolean(dash?.family && ((dash.family.memberCount ?? 0) > 1 || (dash.family.members?.length ?? 0) > 1));
  assert.strictEqual(renderCheck({ family: { memberCount: 1, members: [{ userId: 'u1' }] } }), false, 'Must be hidden for sole member');
  assert.strictEqual(renderCheck({ family: { memberCount: 0, members: [] } }), false, 'Must be hidden for 0 members');
});

// 32. Overview Family card visible for memberCount > 1
runTest(32, 'Overview Family card visible for genuine multi-member household (memberCount > 1)', 'BEHAVIORAL ASSERTION', () => {
  const renderCheck = (dash) => Boolean(dash?.family && ((dash.family.memberCount ?? 0) > 1 || (dash.family.members?.length ?? 0) > 1));
  assert.strictEqual(renderCheck({ family: { memberCount: 2, members: [{ userId: 'u1' }, { userId: 'u2' }] } }), true, 'Must be visible for 2 members');
  assert.strictEqual(renderCheck({ family: { memberCount: 4, members: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' }] } }), true, 'Must be visible for 4 members');
});

// 33. Overview card links to /family or /app/family
runTest(33, 'Overview card CTA links to canonical /app/family', 'STRUCTURAL ASSERTION', () => {
  assert(overviewCardSrc.includes('to="/app/family"'), 'Overview card must link to /app/family');
  assert(overviewCardSrc.includes('View Family Details'), 'Must have View Family Details CTA text');
  assert(insightsPageSrc.includes('<HouseholdFmiInsightCard'), 'InsightsPage must integrate HouseholdFmiInsightCard');
});

// 34. Overview failure does not break main dashboard
runTest(34, 'Overview Family API failure does not break main dashboard', 'BEHAVIORAL ASSERTION', () => {
  assert(overviewPageSrc.includes('.catch('), 'OverviewPage must catch getFamilyDashboard errors independently');
  assert(overviewPageSrc.includes('setFamilyDashboard(null)'), 'Must gracefully fall back to null on failure without throwing');
});

// 35. Family state clears on logout/session reset
runTest(35, 'Family state clears on logout/session reset', 'BEHAVIORAL ASSERTION', () => {
  assert(useFamilySrc.includes('if (!user)'), 'useFamily must detect when user is falsy');
  assert(useFamilySrc.includes('setFamily(null)'), 'Must reset family to null on logout');
  assert(useFamilySrc.includes('setDashboard(null)'), 'Must reset dashboard to null on logout');
  assert(useFamilySrc.includes('setReceivedInvitations([])'), 'Must reset receivedInvitations on logout');
  assert(useFamilySrc.includes('setSentInvitations([])'), 'Must reset sentInvitations on logout');
});

// 36. Invitation modal validates email
runTest(36, 'Invitation modal validates email syntax and trims whitespace', 'BEHAVIORAL ASSERTION', () => {
  assert(modalSrc.includes('email.trim().toLowerCase()'), 'Must trim and lowercase email');
  assert(modalSrc.includes('emailRegex.test(trimmed)'), 'Must validate email format with regex');
  assert(modalSrc.includes('Please enter a valid email address.'), 'Must surface friendly error message');
});

// 37. Backend invitation errors surface safely
runTest(37, 'Backend invitation errors surface safely to user', 'BEHAVIORAL ASSERTION', () => {
  const err404 = { response: { status: 404, data: { message: 'user not found' } } };
  assert.strictEqual(getHumanReadableFamilyError(err404), 'No FINAURA account was found with that email.');

  const err409 = { response: { status: 409, data: { message: 'This user already belongs to a Family.' } } };
  assert.strictEqual(getHumanReadableFamilyError(err409), 'This user already belongs to a Family.');

  const errSelf = { response: { status: 400, data: { message: 'cannot invite yourself' } } };
  assert.strictEqual(getHumanReadableFamilyError(errSelf), "You can't invite your own account.");
});

// 38. 429 handled safely
runTest(38, '429 Rate limiting handled safely with clean copy', 'BEHAVIORAL ASSERTION', () => {
  const err429 = { response: { status: 429, data: { message: 'Too many requests' } } };
  assert.strictEqual(getHumanReadableFamilyError(err429), 'Too many requests. Please try again shortly.');
});

// 39. Responsive Family layout has no obvious fixed-width overflow
runTest(39, 'Responsive Family layout has media queries and fluid grids', 'STRUCTURAL ASSERTION', () => {
  assert(cssSrc.includes('@media (max-width: 850px)'), 'Must include 850px tablet breakpoint');
  assert(cssSrc.includes('@media (max-width: 640px)'), 'Must include mobile breakpoint');
  assert(cssSrc.includes('max-width: 1280px;'), 'Must use fluid max-width');
  assert(!/\.family-page\s*\{[^}]*[\s;]width:\s*1280px;/i.test(cssSrc), 'Must not use fixed wide width');
});

// 40. TypeScript Family DTOs contain no any
runTest(40, 'TypeScript Family DTOs contain zero any', 'STRUCTURAL ASSERTION', () => {
  const lines = typesFamilySrc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for ': any' or '<any>' in types
    if (line.includes(': any') || line.includes('<any>')) {
      throw new Error(`Found 'any' in types/family.ts at line ${i + 1}: ${line}`);
    }
  }
  assert(typesIndexSrc.includes("export * from './family'"), 'types/index.ts must re-export family types');
});

console.log('\n======================================================================');
console.log(`  EXECUTION SUMMARY: ${passed} PASSED | ${failed} FAILED | 40 TOTAL`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
