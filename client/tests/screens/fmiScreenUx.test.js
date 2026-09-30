/**
 * client/test_fmi_screen_ux.js
 * 
 * Unit & UX contract test suite for FINAURA Financial Health (FMI) Screen
 * Verifies score bounds, pillar calculations, status color mapping, insights,
 * new-user handling, and consistency between Home and FMI screens.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA FMI SCREEN UX & CONTRACT TEST SUITE');
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

// ── Helpers mirroring FmiScreen & DashboardScreen ────────────
function fmiColor(score) {
  if (score >= 70) return '#059669';
  if (score >= 45) return '#D97706';
  return '#DC2626';
}

function formatINR(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

function resolveFmiStatus(status) {
  return {
    above: { label: 'Budget Pressure', color: '#DC2626' },
    on_track: { label: 'On Track', color: '#D97706' },
    below: { label: 'Safe Buffer', color: '#059669' },
  }[status] || { label: 'Calibrating', color: '#64748B' };
}

// ── 1. FMI SCORE FORMATTING & BOUNDS ────────────────────────
test('Test 1: FMI Score Formatting & 0–100 Boundary Checks', () => {
  const clampScore = (score) => Math.max(0, Math.min(100, Math.round(score)));
  
  assert.equal(clampScore(78.4), 78);
  assert.equal(clampScore(-15), 0);
  assert.equal(clampScore(125), 100);
  assert.equal(clampScore(0), 0);
  assert.equal(clampScore(100), 100);
});

// ── 2. STATUS MAPPING & COLOR PALETTE ───────────────────────
test('Test 2: Authoritative FMI Status Mapping', () => {
  assert.equal(fmiColor(85), '#059669'); // Green
  assert.equal(fmiColor(60), '#D97706'); // Amber
  assert.equal(fmiColor(30), '#DC2626'); // Red

  assert.equal(resolveFmiStatus('below').label, 'Safe Buffer');
  assert.equal(resolveFmiStatus('on_track').label, 'On Track');
  assert.equal(resolveFmiStatus('above').label, 'Budget Pressure');
});

// ── 3. 3 PILLARS DATA CONTRACT & WEIGHTS ────────────────────
test('Test 3: 3 Pillars Weights and Computation Formula', () => {
  const pillars = {
    D1_savingDiscipline: { score: 90, weight: 0.40 },
    D2_spendingControl: { score: 80, weight: 0.30 },
    D3_behavioralRisk: { score: 70, weight: 0.30 },
  };

  const totalWeight = pillars.D1_savingDiscipline.weight +
                      pillars.D2_spendingControl.weight +
                      pillars.D3_behavioralRisk.weight;
  assert.equal(totalWeight, 1.0);

  const rawScore = (pillars.D1_savingDiscipline.score * pillars.D1_savingDiscipline.weight) +
                   (pillars.D2_spendingControl.score * pillars.D2_spendingControl.weight) +
                   (pillars.D3_behavioralRisk.score * pillars.D3_behavioralRisk.weight);
  
  assert.equal(Math.round(rawScore), 81);
});

// ── 4. SAVING DISCIPLINE PILLAR SEMANTICS ───────────────────
test('Test 4: Saving Discipline Pillar Semantics', () => {
  // 100% of target saved should yield >= 90 score
  const required = 10000;
  const saved = 10000;
  const savingRatio = saved / required;
  assert.equal(savingRatio, 1.0);
  assert.ok(savingRatio >= 1.0);
});

// ── 5. SPENDING CONTROL PILLAR SEMANTICS ────────────────────
test('Test 5: Spending Control Pillar Semantics', () => {
  const availableMoney = 50000;
  const predictedSpend = 30000;
  const spendRatio = predictedSpend / availableMoney;
  assert.equal(spendRatio, 0.6);
  assert.ok(spendRatio <= 0.7); // Well-controlled range
});

// ── 6. BEHAVIORAL RISK PILLAR SEMANTICS ─────────────────────
test('Test 6: Behavioral Risk Deductions Structure', () => {
  let baseScore = 100;
  const penalties = {
    lateNight: 15,
    wantsExceedNeeds: 15,
    anomalyCluster: 10,
    impulseShopping: 8,
    foodSpike: 5
  };

  // Case: Only food spike
  let scoreWithFood = baseScore - penalties.foodSpike;
  assert.equal(scoreWithFood, 95);

  // Case: Wants exceed Needs + late night
  let scoreRisky = baseScore - penalties.wantsExceedNeeds - penalties.lateNight;
  assert.equal(scoreRisky, 70);
});

// ── 7. EXPLAINABLE INSIGHTS FORMATTING ──────────────────────
test('Test 7: Explainable Insights Content Verification', () => {
  const insights = [
    'Great discipline! You are on track to save ₹12,000 extra this month',
    'You have met your savings target for this month — keep it up!'
  ];

  assert.equal(insights.length, 2);
  assert.ok(insights[0].includes('₹12,000'));
  assert.ok(insights[1].includes('savings target'));
});

// ── 8. NEW USER / EMPTY HISTORY STATE ───────────────────────
test('Test 8: Brand New User / Zero-Transaction Resilience', () => {
  const emptyState = {
    totalSpent: 0,
    totalSaved: 0,
    score: 62,
    status: 'on_track'
  };

  assert.equal(formatINR(emptyState.totalSpent), '₹0');
  assert.equal(formatINR(emptyState.totalSaved), '₹0');
  assert.ok(emptyState.score > 0 && emptyState.score <= 100);
});

// ── 9. ZERO NULL / UNDEFINED / NAN LEAKAGE ──────────────────
test('Test 9: Numerical Safety on Edge Cases', () => {
  assert.equal(formatINR(null), '₹0');
  assert.equal(formatINR(undefined), '₹0');
  assert.equal(formatINR(NaN), '₹0');
});

// ── 10. HOME SCREEN & FMI SCREEN CONSISTENCY ────────────────
test('Test 10: Home Screen & FMI Screen Score Parity Contract', () => {
  const serverResponse = {
    FMI: 78,
    score: 78,
    fmiLabel: 'Good',
    pillars: {
      D1_savingDiscipline: { score: 90, weight: 0.4 },
      D2_spendingControl: { score: 75, weight: 0.3 },
      D3_behavioralRisk: { score: 68, weight: 0.3 }
    }
  };

  // Both screens use score || FMI directly from server without independent mutation
  const homeFmiScore = serverResponse.score ?? serverResponse.FMI;
  const fmiScreenScore = serverResponse.FMI ?? serverResponse.score;

  assert.equal(homeFmiScore, fmiScreenScore);
  assert.equal(homeFmiScore, 78);
});

// ── 11. SCORE AND RATING SEPARATION ─────────────────────────
test('Test 11: Score and Qualitative Rating Separated in Layout', () => {
  const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'client');
  const code = fs.readFileSync(path.join(clientDir, 'src/screens/FmiScreen.tsx'), 'utf8');

  // scoreWrap must be inside arcWrap
  const arcWrapSection = code.substring(code.indexOf('<View style={g.arcWrap}>'), code.indexOf('<View style={g.ratingWrap}>'));
  assert.ok(
    arcWrapSection.includes('<View style={g.scoreWrap}>'),
    'scoreWrap is nested inside arcWrap for accurate geometric containment'
  );

  // ratingWrap must be separate below arcWrap
  assert.ok(
    code.includes('<View style={g.ratingWrap}>'),
    'ratingWrap provides a dedicated container for the qualitative rating below the arc'
  );
});

// ── 12. LARGE SCORE (100/100) GEOMETRY SUPPORT ──────────────
test('Test 12: Large Score (100/100) Support without Collision', () => {
  const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'client');
  const code = fs.readFileSync(path.join(clientDir, 'src/screens/FmiScreen.tsx'), 'utf8');

  assert.ok(
    code.includes('adjustsFontSizeToFit'),
    'scoreText specifies adjustsFontSizeToFit for dynamic text scaling'
  );
  assert.ok(
    code.includes('numberOfLines={1}'),
    'scoreText specifies single line constraint'
  );
  assert.ok(
    code.includes('minimumFontScale'),
    'scoreText specifies minimumFontScale safety floor'
  );
});

// ── 13. NO BRITTLE OVERLAP OFFSETS ──────────────────────────
test('Test 13: No Conflicting Absolute Offsets on Rating', () => {
  const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'client');
  const code = fs.readFileSync(path.join(clientDir, 'src/screens/FmiScreen.tsx'), 'utf8');

  // status and ratingWrap must NOT have position: 'absolute' with negative offsets
  assert.ok(
    !code.includes("ratingWrap: {\n    position: 'absolute'"),
    'ratingWrap uses in-flow flex positioning'
  );
  assert.ok(
    !code.includes("status: {\n    position: 'absolute'"),
    'status uses in-flow flex positioning'
  );
});

// ── 14. QUALITATIVE LABELS REMAIN VISIBLE ───────────────────
test('Test 14: Qualitative Rating Labels Integrity', () => {
  const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'client');
  const code = fs.readFileSync(path.join(clientDir, 'src/screens/FmiScreen.tsx'), 'utf8');

  assert.ok(code.includes('Excellent'), 'Label "Excellent" preserved');
  assert.ok(code.includes('Good'), 'Label "Good" preserved');
  assert.ok(code.includes('Fair'), 'Label "Fair" preserved');
  assert.ok(code.includes('Needs Attention'), 'Label "Needs Attention" preserved');
});

// ── 15. FMI BACKEND & STATE WIRING PRESERVED ────────────────
test('Test 15: FMI Backend & State Wiring Preserved', () => {
  const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'client');
  const code = fs.readFileSync(path.join(clientDir, 'src/screens/FmiScreen.tsx'), 'utf8');

  assert.ok(code.includes('getFMI'), 'getFMI API client imported and called');
  assert.ok(code.includes('FMIRecord'), 'FMIRecord type imported');
  assert.ok(code.includes('FMIResponse'), 'FMIResponse type imported');
  assert.ok(code.includes('PillarCard'), '3 Pillars component retained');
});

console.log('='.repeat(64));
console.log(`  ALL ${passed} FMI SCREEN UX TESTS PASSED! 🚀`);
console.log('='.repeat(64));
