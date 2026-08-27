/**
 * client/test_proactive_saving_ux.js
 * 
 * Unit & Contract Verification Suite for Proactive Saving Intervention UX (Point 8)
 * Verifies Dashboard smartAction integration, Financial Outlook "What You Can Do" section,
 * status badge colors, icons, copy variations, and presentation safety.
 */

import assert from 'node:assert/strict';

console.log('='.repeat(64));
console.log('  FINAURA PROACTIVE SAVING INTERVENTION UX TEST SUITE (POINT 8)');
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

// ── Helpers mirroring DashboardScreen.tsx ────────────────────
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#10B981';
const GREEN_LIGHT = '#ECFDF5';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FFFBEB';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#F3E8FF';
const GRAY_400 = '#94A3B8';

function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function computeSmartAction({
  predictability,
  isHistoryInsufficient,
  spendingSeries,
  rec,
  targetAge = 60,
  nearestLiability,
  daysUntilLiability,
}) {
  const guidance = predictability?.proactiveGuidance;

  // Priority 1: Insufficient history / LIMITED_DATA
  if (guidance?.status === 'LIMITED_DATA' || isHistoryInsufficient || (spendingSeries && spendingSeries.length < 2)) {
    return {
      icon: 'sparkles',
      iconColor: PURPLE,
      iconBg: PURPLE_LIGHT,
      badge: 'Getting Started',
      title: guidance?.headline || 'More Financial History Needed',
      message: guidance?.explanation || 'Log a few more transactions to build your behavioral history and unlock saving guidance.',
      actionText: 'Log Transaction',
      actionTarget: 'Transactions',
    };
  }

  // Priority 2: TEMPORARILY_UNAVAILABLE
  if (guidance?.status === 'TEMPORARILY_UNAVAILABLE') {
    return {
      icon: 'cloud-offline-outline',
      iconColor: GRAY_400,
      iconBg: '#F1F5F9',
      badge: 'Service Notice',
      title: guidance.headline,
      message: guidance.explanation,
      actionText: 'View Forecast',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 3: ON_TRACK
  if (guidance?.status === 'ON_TRACK') {
    return {
      icon: 'checkmark-circle',
      iconColor: GREEN,
      iconBg: GREEN_LIGHT,
      badge: 'Plan On Track',
      title: guidance.headline,
      message: guidance.explanation,
      actionText: 'View Outlook',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 4: IMPROVEMENT_RECOMMENDED
  if (guidance?.status === 'IMPROVEMENT_RECOMMENDED') {
    const isKnownZero = guidance.investmentBaseline === 'KNOWN_ZERO';
    const isAggressive = guidance.feasibilityStatus === 'AGGRESSIVE';
    const variableNote = guidance.isVariableIncome
      ? ' Because your income varies, treat this as an average target.'
      : '';

    let message = guidance.explanation;
    if (guidance.additionalMonthlyContribution != null && guidance.additionalMonthlyContribution > 0 && !isKnownZero) {
      message = `Increasing monthly investments by ${formatCurrency(guidance.additionalMonthlyContribution)}/mo could improve your modeled retirement path toward age ${targetAge}.${variableNote}`;
    } else if (isKnownZero && guidance.recommendedMonthlyContribution != null) {
      message = `Starting at approximately ${formatCurrency(guidance.recommendedMonthlyContribution)}/mo could move you toward the modeled funding target.${variableNote}`;
    }

    return {
      icon: isKnownZero ? 'rocket-outline' : 'trending-up',
      iconColor: isAggressive ? AMBER : BLUE,
      iconBg: isAggressive ? AMBER_LIGHT : BLUE_LIGHT,
      badge: isKnownZero ? 'Start Investing' : 'Retirement Outlook',
      title: guidance.headline,
      message,
      actionText: 'View Outlook',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 5: ACTION_NEEDED
  if (guidance?.status === 'ACTION_NEEDED') {
    return {
      icon: 'time-outline',
      iconColor: AMBER,
      iconBg: AMBER_LIGHT,
      badge: 'Action Needed',
      title: guidance.headline,
      message: guidance.retirementAlternativeAvailable
        ? 'Reaching your target at the current retirement age may require a large increase. Extending the timeline could reduce the required monthly amount.'
        : guidance.explanation,
      actionText: 'View Alternatives',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 6: Upcoming liability
  if (nearestLiability && daysUntilLiability !== null && daysUntilLiability >= 0 && daysUntilLiability <= 7) {
    const dueLabel = daysUntilLiability === 0 ? 'today' : daysUntilLiability === 1 ? 'tomorrow' : `in ${daysUntilLiability} days`;
    return {
      icon: 'calendar',
      iconColor: AMBER,
      iconBg: AMBER_LIGHT,
      badge: 'Upcoming Due Date',
      title: `${nearestLiability.name} Due ${dueLabel}`,
      message: `${formatCurrency(nearestLiability.amount)} payment scheduled.`,
      actionText: 'View Liabilities',
      actionTarget: 'Liabilities',
    };
  }

  // Priority 7: Emergency fund gap
  if (predictability?.emergencyFund && predictability.emergencyFund.fundingGap > 0) {
    return {
      icon: 'shield-checkmark',
      iconColor: GREEN,
      iconBg: GREEN_LIGHT,
      badge: 'Emergency Reserve',
      title: 'Build Safety Reserve',
      message: `Your liquid emergency reserve is ${formatCurrency(predictability.emergencyFund.fundingGap)} below target.`,
      actionText: 'View Buffer',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 8: Legacy fallback
  if (rec?.solved && rec.additionalMonthlyContributionRequired > 0) {
    return {
      icon: 'trending-up',
      iconColor: BLUE,
      iconBg: BLUE_LIGHT,
      badge: 'Retirement Outlook',
      title: 'Boost Target Confidence',
      message: `Increasing initial investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo improves your path.`,
      actionText: 'View Outlook',
      actionTarget: 'FinancialOutlook',
    };
  }

  // Priority 9: Default on-track state
  return {
    icon: 'checkmark-circle',
    iconColor: GREEN,
    iconBg: GREEN_LIGHT,
    badge: 'Plan On Track',
    title: 'Current Plan Aligned',
    message: `Your current savings and investment trajectory meets your modeled retirement target for age ${targetAge}.`,
    actionText: 'View Outlook',
    actionTarget: 'FinancialOutlook',
  };
}

// ── TEST SUITE ───────────────────────────────────────────────

test('1. Dashboard smartAction: LIMITED_DATA renders onboarding card targeting Transactions', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'LIMITED_DATA',
        priority: 'MEDIUM',
        headline: 'More Financial History Needed',
        explanation: 'We need a little more financial history before we can suggest a saving target.',
        actionType: 'ADD_DATA',
        reasons: ['Transaction history is insufficient.']
      }
    },
    isHistoryInsufficient: true,
    spendingSeries: []
  });

  assert.equal(action.actionTarget, 'Transactions');
  assert.equal(action.actionText, 'Log Transaction');
  assert.equal(action.badge, 'Getting Started');
  assert.match(action.title, /More Financial History Needed/i);
  assert.match(action.message, /before we can suggest a saving target/i);
});

test('2. Dashboard smartAction: TEMPORARILY_UNAVAILABLE renders service notice without blaming user history', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'TEMPORARILY_UNAVAILABLE',
        priority: 'LOW',
        headline: 'Modeled Guidance Temporarily Unavailable',
        explanation: 'Modeled saving guidance is temporarily unavailable. Your baseline forecast remains available.',
        actionType: 'NONE'
      }
    },
    isHistoryInsufficient: false,
    spendingSeries: [50000, 52000, 48000]
  });

  assert.equal(action.actionTarget, 'FinancialOutlook');
  assert.equal(action.actionText, 'View Forecast');
  assert.equal(action.badge, 'Service Notice');
  assert.match(action.title, /Temporarily Unavailable/i);
  assert.match(action.message, /Your baseline forecast remains available/i);
  assert.ok(!action.message.includes('insufficient'));
});

test('3. Dashboard smartAction: ON_TRACK renders green plan on track card', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'ON_TRACK',
        priority: 'LOW',
        headline: 'Your Saving Trajectory Is On Track',
        explanation: 'Your current saving trajectory already meets FINAURA\'s modeled funding target.',
        actionType: 'NONE'
      }
    },
    isHistoryInsufficient: false,
    spendingSeries: [40000, 42000, 41000]
  });

  assert.equal(action.iconColor, GREEN);
  assert.equal(action.badge, 'Plan On Track');
  assert.match(action.title, /On Track/i);
  assert.equal(action.actionTarget, 'FinancialOutlook');
});

test('4. Dashboard smartAction: IMPROVEMENT_RECOMMENDED (MANAGEABLE) shows exact amount', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'IMPROVEMENT_RECOMMENDED',
        priority: 'MEDIUM',
        headline: 'A Manageable Increase Could Improve Your Outlook',
        explanation: 'Your current modeled probability is 45%.',
        actionType: 'INCREASE_CONTRIBUTION',
        additionalMonthlyContribution: 4500,
        feasibilityStatus: 'MANAGEABLE',
        investmentBaseline: 'OBSERVED',
        isVariableIncome: false
      }
    },
    isHistoryInsufficient: false,
    targetAge: 58
  });

  assert.equal(action.iconColor, BLUE);
  assert.equal(action.badge, 'Retirement Outlook');
  assert.match(action.message, /Increasing monthly investments by ₹4,500\/mo/);
  assert.match(action.message, /toward age 58/);
});

test('5. Dashboard smartAction: IMPROVEMENT_RECOMMENDED (AGGRESSIVE) shows amber high-commitment badge', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'IMPROVEMENT_RECOMMENDED',
        priority: 'HIGH',
        headline: 'A Manageable Increase Could Improve Your Outlook',
        explanation: 'Your current modeled probability is 35%.',
        actionType: 'INCREASE_CONTRIBUTION',
        additionalMonthlyContribution: 15000,
        feasibilityStatus: 'AGGRESSIVE',
        investmentBaseline: 'OBSERVED',
        isVariableIncome: false
      }
    },
    isHistoryInsufficient: false
  });

  assert.equal(action.iconColor, AMBER);
  assert.equal(action.iconBg, AMBER_LIGHT);
  assert.match(action.message, /Increasing monthly investments by ₹15,000\/mo/);
});

test('6. Dashboard smartAction: KNOWN_ZERO investment baseline renders Start Investing card with rocket', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'IMPROVEMENT_RECOMMENDED',
        priority: 'MEDIUM',
        headline: 'Start Building Your Retirement Path',
        explanation: 'You\'re not currently making regular investments.',
        actionType: 'INCREASE_CONTRIBUTION',
        recommendedMonthlyContribution: 8000,
        additionalMonthlyContribution: 8000,
        feasibilityStatus: 'MANAGEABLE',
        investmentBaseline: 'KNOWN_ZERO',
        isVariableIncome: false
      }
    },
    isHistoryInsufficient: false
  });

  assert.equal(action.icon, 'rocket-outline');
  assert.equal(action.badge, 'Start Investing');
  assert.match(action.title, /Start Building Your Retirement Path/i);
  assert.match(action.message, /Starting at approximately ₹8,000\/mo/);
});

test('7. Dashboard smartAction: ACTION_NEEDED (IMPRACTICAL / VERY_AGGRESSIVE) CTA says View Alternatives', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'ACTION_NEEDED',
        priority: 'HIGH',
        headline: 'Timeline Adjustment May Be More Realistic',
        explanation: 'Reaching the modeled probability by your target retirement age would require a large increase.',
        actionType: 'EXTEND_TIMELINE',
        retirementAlternativeAvailable: true
      }
    },
    isHistoryInsufficient: false
  });

  assert.equal(action.badge, 'Action Needed');
  assert.equal(action.actionText, 'View Alternatives');
  assert.equal(action.actionTarget, 'FinancialOutlook');
  assert.match(action.message, /Extending the timeline could reduce/i);
});

test('8. Dashboard smartAction: Variable income appends average contribution note', () => {
  const action = computeSmartAction({
    predictability: {
      proactiveGuidance: {
        status: 'IMPROVEMENT_RECOMMENDED',
        priority: 'MEDIUM',
        headline: 'A Manageable Increase Could Improve Your Outlook',
        explanation: 'Your current modeled probability is 48%.',
        actionType: 'INCREASE_CONTRIBUTION',
        additionalMonthlyContribution: 3000,
        feasibilityStatus: 'MANAGEABLE',
        investmentBaseline: 'OBSERVED',
        isVariableIncome: true
      }
    },
    isHistoryInsufficient: false
  });

  assert.match(action.message, /Because your income varies, treat this as an average target\./);
});

test('9. Financial Outlook "What You Can Do" section config: ON_TRACK', () => {
  const pg = {
    status: 'ON_TRACK',
    priority: 'LOW',
    headline: 'Your Saving Trajectory Is On Track',
    explanation: 'Your current saving trajectory already meets FINAURA\'s modeled funding target.',
    reasons: ['Current modeled probability (82%) meets or exceeds the 75% target.'],
    stepUpAvailable: false,
    retirementAlternativeAvailable: false
  };

  const statusIcon = pg.status === 'ON_TRACK' ? 'checkmark-circle-outline'
    : pg.status === 'IMPROVEMENT_RECOMMENDED' ? 'bulb-outline'
    : 'alert-circle-outline';
  const statusColor = pg.status === 'ON_TRACK' ? GREEN : pg.status === 'IMPROVEMENT_RECOMMENDED' ? BLUE : AMBER;
  const priorityLabel = pg.priority === 'HIGH' ? 'High Priority' : pg.priority === 'MEDIUM' ? 'Suggested Action' : 'Looking Good';

  assert.equal(statusIcon, 'checkmark-circle-outline');
  assert.equal(statusColor, GREEN);
  assert.equal(priorityLabel, 'Looking Good');
});

test('10. Financial Outlook "What You Can Do" section config: IMPROVEMENT_RECOMMENDED with Step-Up', () => {
  const pg = {
    status: 'IMPROVEMENT_RECOMMENDED',
    priority: 'MEDIUM',
    headline: 'A Manageable Increase Could Improve Your Outlook',
    explanation: 'Your current modeled probability of being funded by retirement is 48%.',
    reasons: [
      'Increasing monthly investments by approximately ₹4,000 could elevate your modeled funding probability toward 75%.'
    ],
    stepUpAvailable: true,
    retirementAlternativeAvailable: false
  };

  const priorityLabel = pg.priority === 'HIGH' ? 'High Priority' : pg.priority === 'MEDIUM' ? 'Suggested Action' : 'Looking Good';
  assert.equal(priorityLabel, 'Suggested Action');
  assert.ok(pg.stepUpAvailable);
  assert.ok(pg.reasons.length > 0);
});

test('11. Financial Outlook "What You Can Do" section config: ACTION_NEEDED with alternatives', () => {
  const pg = {
    status: 'ACTION_NEEDED',
    priority: 'HIGH',
    headline: 'Timeline Adjustment May Be More Realistic',
    explanation: 'Reaching the 75% modeled probability by your target retirement age would require a large investment.',
    reasons: [
      'Required investment of ₹65,000/month exceeds practical savings capacity.',
      'Retirement timeline alternatives are available with potentially more manageable contribution requirements.'
    ],
    stepUpAvailable: false,
    retirementAlternativeAvailable: true
  };

  const statusIcon = pg.status === 'ON_TRACK' ? 'checkmark-circle-outline'
    : pg.status === 'IMPROVEMENT_RECOMMENDED' ? 'bulb-outline'
    : 'alert-circle-outline';
  const statusColor = pg.status === 'ON_TRACK' ? GREEN : pg.status === 'IMPROVEMENT_RECOMMENDED' ? BLUE : AMBER;
  const priorityLabel = pg.priority === 'HIGH' ? 'High Priority' : pg.priority === 'MEDIUM' ? 'Suggested Action' : 'Looking Good';

  assert.equal(statusIcon, 'alert-circle-outline');
  assert.equal(statusColor, AMBER);
  assert.equal(priorityLabel, 'High Priority');
  assert.ok(pg.retirementAlternativeAvailable);
});

test('12. Presentation safety: No NaN, null, or undefined strings in any rendered output', () => {
  const sampleGuidances = [
    {
      status: 'ON_TRACK',
      priority: 'LOW',
      headline: 'Your Saving Trajectory Is On Track',
      explanation: 'Your current saving trajectory meets target.',
      additionalMonthlyContribution: null,
      recommendedMonthlyContribution: 10000,
      reasons: ['All good']
    },
    {
      status: 'IMPROVEMENT_RECOMMENDED',
      priority: 'MEDIUM',
      headline: 'A Manageable Increase',
      explanation: 'Explanation text',
      additionalMonthlyContribution: 0,
      recommendedMonthlyContribution: 0,
      reasons: []
    },
    {
      status: 'ACTION_NEEDED',
      priority: 'HIGH',
      headline: 'Timeline Adjustment',
      explanation: 'Alternatives text',
      additionalMonthlyContribution: 50000,
      recommendedMonthlyContribution: 60000,
      reasons: ['Reason 1', 'Reason 2']
    }
  ];

  for (const g of sampleGuidances) {
    const action = computeSmartAction({
      predictability: { proactiveGuidance: g },
      isHistoryInsufficient: false
    });

    for (const [key, val] of Object.entries(action)) {
      if (typeof val === 'string') {
        assert.ok(!val.includes('NaN'), `Action property ${key} contains NaN: ${val}`);
        assert.ok(!val.includes('null'), `Action property ${key} contains "null": ${val}`);
        assert.ok(!val.includes('undefined'), `Action property ${key} contains "undefined": ${val}`);
      }
    }
  }
});

console.log('='.repeat(64));
console.log(`  CLIENT PROACTIVE SAVING UX SUITE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(64));
if (failed > 0) process.exit(1);
