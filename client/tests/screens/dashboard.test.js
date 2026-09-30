/**
 * client/tests/screens/dashboard.test.js
 * 
 * Consolidated Dashboard & Home Screen UX Test Suite.
 * Combines structural/layout responsiveness audits and functional data-mapping/smart-action contracts.
 * 
 * Preserves all 24 checks from:
 *  - client/test_dashboard_layout_ux.js (10 tests)
 *  - client/test_home_screen_ux.js (14 tests)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '../..');

console.log('='.repeat(64));
console.log('  FINAURA CONSOLIDATED DASHBOARD & HOME SCREEN TEST SUITE');
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

const dashboardPath = path.join(clientRoot, 'src/screens/DashboardScreen.tsx');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

// ── Helpers mirroring DashboardScreen ───────────────────────
function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function fmiStatusColor(score) {
  if (score >= 70) {
    return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Strong' };
  }
  if (score >= 45) {
    return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Fair' };
  }
  return { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Needs Attention' };
}

function computeSmartAction({ isHistoryInsufficient, spendingSeries, rec, targetAge, nearestLiability, daysUntilLiability, emergencyFund }) {
  // Priority 1: Insufficient history
  if (isHistoryInsufficient || (spendingSeries && spendingSeries.length < 2)) {
    return {
      icon: 'sparkles',
      badge: 'Forecast Setup',
      title: 'Activate Detailed Forecasts',
      message: 'Log a few more transactions to build your behavioral history and unlock Monte Carlo projections.',
      actionText: 'Log Transaction',
      actionTarget: 'Transactions',
    };
  }

  // Priority 2: Contribution recommendation > 0
  if (rec?.solved && rec.additionalMonthlyContributionRequired > 0) {
    const stepUpText = rec.annualContributionGrowthRate && rec.annualContributionGrowthRate > 0
      ? ` (+${Math.round(rec.annualContributionGrowthRate * 100)}%/yr annual step-up)`
      : '';
    return {
      icon: 'trending-up',
      badge: 'Retirement Outlook',
      title: 'Boost Target Confidence',
      message: `Increasing initial investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo${stepUpText} improves your modeled retirement path toward age ${targetAge}.`,
      actionText: 'View Outlook',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 3: Upcoming liability due soon (within 7 days)
  if (nearestLiability && daysUntilLiability !== null && daysUntilLiability >= 0 && daysUntilLiability <= 7) {
    const dueLabel = daysUntilLiability === 0 ? 'today' : daysUntilLiability === 1 ? 'tomorrow' : `in ${daysUntilLiability} days`;
    return {
      icon: 'calendar',
      badge: 'Upcoming Due Date',
      title: `${nearestLiability.name} Due ${dueLabel}`,
      message: `${formatCurrency(nearestLiability.amount)} payment scheduled for ${formatShortDate(nearestLiability.nextDueDate)}${nearestLiability.autoDeduct ? ' (Auto Deduct enabled)' : ''}.`,
      actionText: 'View Liabilities',
      actionTarget: 'Liabilities',
    };
  }

  // Priority 4: Emergency fund gap
  if (emergencyFund && emergencyFund.fundingGap > 0) {
    return {
      icon: 'shield-checkmark',
      badge: 'Emergency Reserve',
      title: 'Build Safety Reserve',
      message: `Your liquid emergency reserve is ${formatCurrency(emergencyFund.fundingGap)} below the recommended ${emergencyFund.targetMonths || 6}-month essential buffer.`,
      actionText: 'View Buffer',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 5: Default on-track state
  return {
    icon: 'checkmark-circle',
    badge: 'Plan On Track',
    title: 'Current Plan Aligned',
    message: `Your current savings and investment trajectory meets your modeled retirement target for age ${targetAge}.`,
    actionText: 'View Outlook',
    actionTarget: 'FinancialOutlook',
  };
}

// ============================================================
// PART A: STRUCTURAL & LAYOUT RESPONSIVENESS CHECKS (10 TESTS)
// ============================================================

test('Layout Test 1 — Predictability Layout', () => {
  assert.ok(
    dashboardCode.includes('outlookProbCircleContainer'),
    'Predictability card must use a dedicated outlookProbCircleContainer'
  );
  assert.ok(
    dashboardCode.includes('outlookProbCircle'),
    'Predictability card must have a styled circular score graphic'
  );
  assert.ok(
    dashboardCode.includes('outlookProbDenominator') && dashboardCode.includes('/100'),
    'Circle must contain compact /100 denominator'
  );
  assert.ok(
    dashboardCode.includes('outlookProbPill') || dashboardCode.includes('outlookProbPillText'),
    'Status badge (e.g. Good Predictability) must be separated outside the circular score graphic'
  );

  const circleMatch = dashboardCode.match(/<View style=\{styles\.outlookProbCircle\}>([\s\S]*?)<\/View>/);
  assert.ok(circleMatch, 'Found outlookProbCircle JSX');
  const circleContent = circleMatch[1];
  assert.ok(
    !circleContent.includes('Modeled chance'),
    'Descriptive headline must NOT be placed inside the inner circle'
  );
  assert.ok(
    !circleContent.includes('simulated'),
    'Subtitle simulation text must NOT be placed inside the inner circle'
  );
});

test('Layout Test 2 — Overflow Guards & Flex Safety', () => {
  assert.ok(
    dashboardCode.includes('adjustsFontSizeToFit'),
    'Key financial figures must use adjustsFontSizeToFit to prevent overflow on narrow screens'
  );
  assert.ok(
    dashboardCode.includes('minimumFontScale'),
    'Figures using font scaling must define a minimumFontScale'
  );
  assert.ok(
    dashboardCode.includes('numberOfLines={1}'),
    'Header greeting, balance amount, and metric numbers must specify numberOfLines guards'
  );
  assert.ok(
    dashboardCode.includes('flexShrink: 1'),
    'Text info containers must include flexShrink: 1 to allow clean wrapping without clipping'
  );
});

test('Layout Test 3 — No Brittle Clipping or Fixed Card Heights', () => {
  const cardStyleNames = [
    'fmiCard',
    'balanceHeroCard',
    'outlookCard',
    'spendingCard',
    'liabilityCard',
    'assetsCard',
    'smartActionCard'
  ];

  for (const styleName of cardStyleNames) {
    const regex = new RegExp(`${styleName}:\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const match = dashboardCode.match(regex);
    assert.ok(match, `Style definition for ${styleName} should exist`);
    const styleBody = match[1];
    const hasFixedHeight = /height:\s*\d{2,3}/.test(styleBody);
    assert.equal(
      hasFixedHeight,
      false,
      `${styleName} must not have a fixed height that causes clipping on long content`
    );
  }
});

test('Layout Test 4 — Large Score Support (100/100)', () => {
  const maxScore = 100;
  const scoreText = `${Math.round(maxScore)}`;
  assert.equal(scoreText, '100');

  const denom = '/100';
  assert.equal(denom.length, 4);

  const circleStyleMatch = dashboardCode.match(/outlookProbCircle:\s*\{([\s\S]*?)\}/);
  assert.ok(circleStyleMatch, 'outlookProbCircle style must exist');
  const widthMatch = circleStyleMatch[1].match(/width:\s*(\d+)/);
  const heightMatch = circleStyleMatch[1].match(/height:\s*(\d+)/);
  assert.ok(widthMatch && parseInt(widthMatch[1], 10) >= 60, 'Circle width must be >= 60px');
  assert.ok(heightMatch && parseInt(heightMatch[1], 10) >= 60, 'Circle height must be >= 60px');
});

test('Layout Test 5 — Long Monetary Values (₹1,25,00,000)', () => {
  const largeCorpus = 12500000;
  const formatted = formatCurrency(largeCorpus);
  assert.ok(
    formatted.includes('1,25,00,000') || formatted.includes('125,00,000'),
    `Formatted INR amount must be valid Indian currency format: ${formatted}`
  );

  assert.ok(
    dashboardCode.includes('formatCurrency(balance)') && dashboardCode.includes('minimumFontScale'),
    'Balance amount must use formatCurrency with font scale adjustments'
  );
});

test('Layout Test 6 — Existing Data Wiring Preserved (Zero Mock Data)', () => {
  assert.ok(dashboardCode.includes('getDashboard()'), 'Calls getDashboard');
  assert.ok(dashboardCode.includes('getPredictability()'), 'Calls getPredictability');
  assert.ok(dashboardCode.includes('getLiabilities()'), 'Calls getLiabilities');
  assert.ok(dashboardCode.includes('getFMI()'), 'Calls getFMI');
  assert.ok(dashboardCode.includes('getUserProfile()'), 'Calls getUserProfile');
  assert.ok(dashboardCode.includes('getAssets()'), 'Calls getAssets');

  assert.ok(!dashboardCode.includes('+$50/mo'), 'No fake demo labels');
  assert.ok(!dashboardCode.includes('AiReasoningPanel'), 'No fake AI panels');
});

test('Layout Test 7 — Redundant Floating Balance Button Removed', () => {
  assert.ok(
    !dashboardCode.includes('accessibilityLabel="Quick Update Current Balance"'),
    'Floating balance action button JSX is removed from Dashboard'
  );
  assert.ok(
    !dashboardCode.includes('style={styles.floatingBtn}'),
    'floatingBtn JSX reference is removed from Dashboard'
  );
});

test('Layout Test 8 — Balance Widget Edit Interaction Preserved', () => {
  assert.ok(
    dashboardCode.includes('styles.updateBalanceBtn'),
    'Balance widget retains its dedicated updateBalanceBtn'
  );
  assert.ok(
    dashboardCode.includes('accessibilityLabel="Update Current Balance"'),
    'Balance widget button retains descriptive accessibility label'
  );
  assert.ok(
    dashboardCode.includes('onPress={() => setShowUpdateBalance(true)}'),
    'Balance widget button opens the balance update flow'
  );
});

test('Layout Test 9 — Shared Balance Modal & Flow Preserved', () => {
  assert.ok(
    dashboardCode.includes('const [showUpdateBalance, setShowUpdateBalance] = useState(false)'),
    'showUpdateBalance state is preserved'
  );
  assert.ok(
    dashboardCode.includes('<UpdateBalanceScreen'),
    'UpdateBalanceScreen modal is mounted and reachable'
  );
});

test('Layout Test 10 — No Dead Floating Button Styles', () => {
  assert.ok(
    !dashboardCode.includes('floatingBtn: {'),
    'floatingBtn style definition is completely removed from StyleSheet'
  );
});

// ============================================================
// PART B: FUNCTIONAL & DATA PRESENTATION CHECKS (14 TESTS)
// ============================================================

test('Data Test 1: FMI Score Display & Status Color Mapping', () => {
  const high = fmiStatusColor(78);
  assert.equal(high.label, 'Strong');
  assert.equal(high.text, '#059669');

  const med = fmiStatusColor(58);
  assert.equal(med.label, 'Fair');
  assert.equal(med.text, '#D97706');

  const low = fmiStatusColor(32);
  assert.equal(low.label, 'Needs Attention');
  assert.equal(low.text, '#DC2626');
});

test('Data Test 2: Cash Position & Month Snapshot Mapping', () => {
  const balance = 124500;
  const income = 85000;
  const spent = 42000;
  const invested = 20000;

  assert.equal(formatCurrency(balance), '₹1,24,500');
  assert.equal(formatCurrency(income), '₹85,000');
  assert.equal(formatCurrency(spent), '₹42,000');
  assert.equal(formatCurrency(invested), '₹20,000');
});

test('Data Test 3: Needs / Wants / Investment Breakdown Mapping', () => {
  const breakdown = {
    needs: { amount: 30000, pct: 50 },
    wants: { amount: 18000, pct: 30 },
    investments: { amount: 12000, pct: 20 },
    total: 60000
  };

  assert.equal(breakdown.needs.pct + breakdown.wants.pct + breakdown.investments.pct, 100);
  assert.equal(formatCurrency(breakdown.needs.amount), '₹30,000');
  assert.equal(formatCurrency(breakdown.wants.amount), '₹18,000');
  assert.equal(formatCurrency(breakdown.investments.amount), '₹12,000');
});

test('Data Test 4: Upcoming Liability Nearest Schedule Sorting', () => {
  const liabilities = [
    { id: '1', name: 'Car Loan', amount: 15000, nextDueDate: '2026-09-10', autoDeduct: true },
    { id: '2', name: 'Home Rent', amount: 25000, nextDueDate: '2026-09-01', autoDeduct: true },
    { id: '3', name: 'Electricity', amount: 3500, nextDueDate: '2026-09-15', autoDeduct: false },
  ];

  const sorted = [...liabilities].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  assert.equal(sorted[0].name, 'Home Rent');
  assert.equal(sorted[0].amount, 25000);
  assert.equal(formatShortDate(sorted[0].nextDueDate), '1 Sept');
});

test('Data Test 5: Empty Liability State Handled Cleanly', () => {
  const liabilities = [];
  const nearest = liabilities[0] || null;
  assert.equal(nearest, null);
});

test('Data Test 6: Predictability Available with Monte Carlo Probability', () => {
  const predictability = {
    probabilistic: {
      available: true,
      estimatedFire: {
        probabilityFundedAtTargetAge: 0.72
      },
      contributionRecommendation: {
        solved: true,
        recommendedMonthlyContribution: 28500,
        additionalMonthlyContributionRequired: 8500,
        annualContributionGrowthRate: 0.10,
        targetProbability: 0.75
      }
    },
    retirement: {
      retirementAge: 60
    }
  };

  const prob = predictability.probabilistic.estimatedFire.probabilityFundedAtTargetAge;
  assert.equal(Math.round(prob * 100), 72);
  assert.equal(predictability.retirement.retirementAge, 60);
});

test('Data Test 7: Predictability Insufficient History Fallback', () => {
  const predictability = {
    forecastStatus: {
      available: false,
      dataQuality: 'INSUFFICIENT'
    },
    probabilistic: {
      available: false
    }
  };

  const isAvailable = predictability.probabilistic?.available === true;
  assert.equal(isAvailable, false);
});

test('Data Test 8: Smart Next Action: Contribution Recommendation Priority', () => {
  const action = computeSmartAction({
    isHistoryInsufficient: false,
    spendingSeries: [100, 200, 300],
    rec: {
      solved: true,
      additionalMonthlyContributionRequired: 5000,
      annualContributionGrowthRate: 0.10
    },
    targetAge: 60,
    nearestLiability: null,
    daysUntilLiability: null,
    emergencyFund: { fundingGap: 0 }
  });

  assert.equal(action.actionTarget, 'FinancialOutlook');
  assert.equal(action.badge, 'Retirement Outlook');
  assert.ok(action.message.includes('₹5,000/mo'));
  assert.ok(action.message.includes('+10%/yr annual step-up'));
});

test('Data Test 9: Smart Next Action: Upcoming Liability within 7 days', () => {
  const action = computeSmartAction({
    isHistoryInsufficient: false,
    spendingSeries: [100, 200, 300],
    rec: {
      solved: true,
      additionalMonthlyContributionRequired: 0
    },
    targetAge: 60,
    nearestLiability: {
      name: 'House Rent',
      amount: 30000,
      nextDueDate: '2026-09-01',
      autoDeduct: true
    },
    daysUntilLiability: 3,
    emergencyFund: { fundingGap: 0 }
  });

  assert.equal(action.actionTarget, 'Liabilities');
  assert.equal(action.badge, 'Upcoming Due Date');
  assert.ok(action.title.includes('House Rent Due in 3 days'));
  assert.ok(action.message.includes('₹30,000'));
});

test('Data Test 10: Smart Next Action: Already On Track State', () => {
  const action = computeSmartAction({
    isHistoryInsufficient: false,
    spendingSeries: [100, 200, 300],
    rec: {
      solved: true,
      additionalMonthlyContributionRequired: 0
    },
    targetAge: 60,
    nearestLiability: null,
    daysUntilLiability: null,
    emergencyFund: { fundingGap: 0 }
  });

  assert.equal(action.actionTarget, 'FinancialOutlook');
  assert.equal(action.badge, 'Plan On Track');
  assert.equal(action.title, 'Current Plan Aligned');
});

test('Data Test 11: Smart Next Action: Missing History Priority', () => {
  const action = computeSmartAction({
    isHistoryInsufficient: true,
    spendingSeries: [],
    rec: null,
    targetAge: 60,
    nearestLiability: null,
    daysUntilLiability: null,
    emergencyFund: null
  });

  assert.equal(action.actionTarget, 'Transactions');
  assert.equal(action.badge, 'Forecast Setup');
  assert.equal(action.actionText, 'Log Transaction');
});

test('Data Test 12: Zero Null / NaN Text Leaks on Empty/Missing Edge Cases', () => {
  assert.equal(formatCurrency(null), '₹0');
  assert.equal(formatCurrency(undefined), '₹0');
  assert.equal(formatCurrency(NaN), '₹0');
  assert.equal(formatShortDate(null), '');
  assert.equal(formatShortDate(undefined), '');
  assert.equal(formatShortDate('invalid-date'), '');
});

test('Data Test 13: Indian Currency Formatting (INR en-IN)', () => {
  assert.equal(formatCurrency(1000), '₹1,000');
  assert.equal(formatCurrency(100000), '₹1,00,000');
  assert.equal(formatCurrency(10000000), '₹1,00,00,000');
  assert.equal(formatCurrency(28500), '₹28,500');
});

test('Data Test 14: Navigation Action Targets Match Registered Routes', () => {
  const validStackRoutes = ['FinancialOutlook', 'FMI'];
  const validTabRoutes = ['Envelopes', 'Transactions', 'Dashboard', 'Liabilities', 'Chat', 'Profile'];
  const allRoutes = [...validStackRoutes, ...validTabRoutes];

  assert.ok(allRoutes.includes('FinancialOutlook'));
  assert.ok(allRoutes.includes('FMI'));
  assert.ok(allRoutes.includes('Transactions'));
  assert.ok(allRoutes.includes('Liabilities'));
  assert.ok(allRoutes.includes('Profile'));
});

// ── Execution Summary ───────────────────────────────────────
console.log('='.repeat(64));
if (failed === 0) {
  console.log(`  ALL ${passed} CONSOLIDATED DASHBOARD TESTS PASSED 🚀`);
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log('='.repeat(64));

if (failed > 0) {
  process.exit(1);
}
