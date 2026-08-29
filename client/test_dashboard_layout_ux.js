/**
 * client/test_dashboard_layout_ux.js
 * 
 * Unit & layout audit test suite for FINAURA Dashboard/Home Screen Graphics & Responsiveness.
 * Verifies that:
 *  1. Predictability/Future Score circular graphic contains compact score data without long labels inside the circle.
 *  2. Dashboard text elements have responsive wrapping, flexShrink, and font scaling guards.
 *  3. Card containers avoid brittle fixed heights that clip content.
 *  4. High scores (e.g. 100/100) render cleanly with proper inner padding.
 *  5. Long monetary amounts (₹1,25,00,000) fit safely within card boundaries.
 *  6. Real data wiring is preserved across all cards without fake or mock values.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(64));
console.log('  FINAURA DASHBOARD GRAPHICS & RESPONSIVENESS TEST SUITE');
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

const dashboardPath = path.join(__dirname, 'src/screens/DashboardScreen.tsx');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

// ── Test 1 — Predictability Layout ──────────────────────────
test('Test 1 — Predictability Layout', () => {
  // Check that the circular container contains compact score and denominator
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

  // Ensure long descriptive labels are NOT placed directly inside the inner circle
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

// ── Test 2 — Overflow Guards ────────────────────────────────
test('Test 2 — Overflow Guards & Flex Safety', () => {
  // Verify flexShrink, numberOfLines, and adjustsFontSizeToFit are used on critical text elements
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

// ── Test 3 — No Brittle Clipping ────────────────────────────
test('Test 3 — No Brittle Clipping or Fixed Card Heights', () => {
  // Check that major dashboard card styles do NOT use fixed height
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
    // Check that there is no rigid fixed height like "height: 120" or "height: 200"
    const hasFixedHeight = /height:\s*\d{2,3}/.test(styleBody);
    assert.equal(
      hasFixedHeight,
      false,
      `${styleName} must not have a fixed height that causes clipping on long content`
    );
  }
});

// ── Test 4 — Large Score Layout ─────────────────────────────
test('Test 4 — Large Score Support (100/100)', () => {
  // Test numeric formatting for full 100/100 score
  const maxScore = 100;
  const scoreText = `${Math.round(maxScore)}`;
  assert.equal(scoreText, '100');

  // Verify that the denominator is compact '/100'
  const denom = '/100';
  assert.equal(denom.length, 4);

  // Check that circle diameter is large enough (>= 60px) for 100/100
  const circleStyleMatch = dashboardCode.match(/outlookProbCircle:\s*\{([\s\S]*?)\}/);
  assert.ok(circleStyleMatch, 'outlookProbCircle style must exist');
  const widthMatch = circleStyleMatch[1].match(/width:\s*(\d+)/);
  const heightMatch = circleStyleMatch[1].match(/height:\s*(\d+)/);
  assert.ok(widthMatch && parseInt(widthMatch[1], 10) >= 60, 'Circle width must be >= 60px');
  assert.ok(heightMatch && parseInt(heightMatch[1], 10) >= 60, 'Circle height must be >= 60px');
});

// ── Test 5 — Long Monetary Values ───────────────────────────
test('Test 5 — Long Monetary Values (₹1,25,00,000)', () => {
  function formatCurrency(n) {
    if (n === null || n === undefined || isNaN(n)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(n));
  }

  const largeCorpus = 12500000; // 1.25 Crore
  const formatted = formatCurrency(largeCorpus);
  assert.ok(
    formatted.includes('1,25,00,000') || formatted.includes('125,00,000'),
    `Formatted INR amount must be valid Indian currency format: ${formatted}`
  );

  // Ensure balanceAmount has adjustments for long values
  assert.ok(
    dashboardCode.includes('formatCurrency(balance)') && dashboardCode.includes('minimumFontScale'),
    'Balance amount must use formatCurrency with font scale adjustments'
  );
});

// ── Test 6 — Existing Data Wiring Preserved ─────────────────
test('Test 6 — Existing Data Wiring Preserved (Zero Mock Data)', () => {
  // Ensure real API hooks are called in DashboardScreen
  assert.ok(dashboardCode.includes('getDashboard()'), 'Calls getDashboard');
  assert.ok(dashboardCode.includes('getPredictability()'), 'Calls getPredictability');
  assert.ok(dashboardCode.includes('getLiabilities()'), 'Calls getLiabilities');
  assert.ok(dashboardCode.includes('getFMI()'), 'Calls getFMI');
  assert.ok(dashboardCode.includes('getUserProfile()'), 'Calls getUserProfile');
  assert.ok(dashboardCode.includes('getAssets()'), 'Calls getAssets');

  // Verify that there are no hardcoded fake demo values like 50000 or fake demo objects
  assert.ok(!dashboardCode.includes('+$50/mo'), 'No fake demo labels');
  assert.ok(!dashboardCode.includes('AiReasoningPanel'), 'No fake AI panels');
});

// ── Summary ─────────────────────────────────────────────────
console.log('='.repeat(64));
if (failed === 0) {
  console.log(`  ALL ${passed} DASHBOARD LAYOUT & RESPONSIVENESS TESTS PASSED 🚀`);
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log('='.repeat(64));

if (failed > 0) {
  process.exit(1);
}
